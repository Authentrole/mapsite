#!/usr/bin/env python3
"""Local, dependency-free-ish HTTP server for the Tier-3 AI search engine.

Python stdlib only for the HTTP layer (no Flask/FastAPI); Azure AI Search
is the vector store (see search_index.py). Embeddings and the
natural-language layer (intent extraction, summaries) call out to Azure
OpenAI -- see azure_openai.py. Serves:

  GET /                                        -> the standalone search harness
  GET /api/search?q=...                        -> JSON ranked list of matching plates (exact plate-ID / literal-text match only)
  GET /api/ai-search?q=...                     -> Azure OpenAI intent extraction + the same exact-match retrieval + summary
  GET /api/ai-status                           -> is Azure OpenAI configured
  GET /api/embedding-status                    -> size of the vector index
  GET /api/crop?plate=&page=&x0=&y0=&x1=&y1=    -> PNG crop, highlighted if a bbox is given
  GET /api/pdf?plate=                           -> raw PDF bytes (open the source plate)

Usage:
    python server.py 8000
"""
from __future__ import annotations

import io
import json
import os
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import fitz
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import ai_search as ai_search_mod  # noqa: E402
import azure_openai  # noqa: E402
import blob_storage  # noqa: E402
import ingest as ingest_mod  # noqa: E402
import search_index  # noqa: E402

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
CROP_DPI = 200
THUMB_MAX_PX = 800
CROP_PAD_PT = 60  # padding around a highlighted match, in PDF points


def _norm_word(w: str) -> str:
    return "".join(ch.lower() for ch in w if ch.isalnum())


# Excluded from single-word fallback matching: too generic on their own
# (e.g. searching "Custis Avenue" shouldn't highlight some unrelated
# plate's "AVENUE" label just because the specific street name "Custis"
# wasn't found on it).
_GENERIC_STREET_WORDS = {
    "street", "st", "avenue", "ave", "road", "rd", "drive", "dr",
    "boulevard", "blvd", "lane", "ln", "place", "pl", "court", "ct",
    "way", "parkway", "pkwy", "circle", "cir", "terrace", "ter",
    "highway", "hwy", "alley", "square", "sq", "north", "south",
    "east", "west",
}


def _merge_bbox(boxes) -> tuple[float, float, float, float]:
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


def _open_source_doc(meta: dict) -> fitz.Document:
    """Open this page's source PDF regardless of where it lives -- a local
    path (meta["source_type"] == "local") or a blob in Azure Storage
    (== "blob", meta["source_path"] is the blob name). ingest.py stamps
    source_type/source_path on every page at ingest time."""
    if meta.get("source_type") == "blob":
        pdf_bytes = blob_storage.download_pdf_bytes(meta["source_path"])
        return fitz.open(stream=pdf_bytes, filetype="pdf")
    return fitz.open(meta["source_path"])


def _extract_words_for_page(meta: dict, quality: str) -> list[dict]:
    """Re-extract this one page's words on demand so a specific match can
    be located and highlighted -- word positions aren't persisted in the
    vector index (only the joined text is, for embedding). Born-digital:
    instant PyMuPDF re-parse. Scanned: the same tiled RapidOCR ingest.py
    used, so this is slow (seconds) for that handful of OCR'd plates."""
    doc = _open_source_doc(meta)
    page_no = meta["page"]
    try:
        page = doc[page_no - 1]
        if quality == "high":
            return ingest_mod.extract_born_digital(page)
        zoom = ingest_mod.RENDER_DPI / 72.0
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        if pix.n == 4:
            arr = arr[:, :, :3]
        words = ingest_mod.extract_scanned(np.ascontiguousarray(arr))
        scale = 72.0 / ingest_mod.RENDER_DPI  # OCR bboxes are render-DPI pixels -> PDF points
        for w in words:
            x0, y0, x1, y1 = w["bbox"]
            w["bbox"] = (x0 * scale, y0 * scale, x1 * scale, y1 * scale)
        return words
    finally:
        doc.close()


def locate_phrase(meta: dict, phrase: str):
    """Find exactly where `phrase` (a street name, plate ID, ...) sits on
    this specific page, so a result can point at the match instead of
    showing a plain page thumbnail. Tries a contiguous multi-word phrase
    match first (e.g. "Dewey Avenue" as two adjacent words), then falls
    back to any single word that's an exact match -- no substring
    matching, so a highlighted word is always the term itself, never a
    word that merely contains it. Returns (bbox, matched_text) or
    (None, None)."""
    words = _extract_words_for_page(meta, meta.get("extraction_quality"))
    if not words:
        return None, None

    terms = [_norm_word(t) for t in phrase.split() if _norm_word(t)]
    if not terms:
        return None, None
    norm_words = [(_norm_word(w["word"]), w) for w in words]

    if len(terms) > 1:
        for i in range(len(norm_words) - len(terms) + 1):
            if all(norm_words[i + j][0] == terms[j] for j in range(len(terms))):
                group = [norm_words[i + j][1] for j in range(len(terms))]
                return _merge_bbox([w["bbox"] for w in group]), " ".join(w["word"] for w in group)

    fallback_terms = [t for t in terms if t not in _GENERIC_STREET_WORDS] or terms
    for t in sorted(fallback_terms, key=len, reverse=True):
        for nw, w in norm_words:
            if nw == t:
                return w["bbox"], w["word"]
    return None, None


def _hit_to_page_entry(meta: dict, similarity: float, bbox=None, matched_word=None) -> dict:
    entry = {
        "page": meta["page"],
        "extractionQuality": meta.get("extraction_quality"),
        "score": round(similarity, 4),
        "similarity": round(similarity, 4),
    }
    if bbox:
        entry["bbox"] = list(bbox)
        entry["matchedWord"] = matched_word
    return entry


def _plate_entry(meta: dict) -> dict:
    return {
        "plateId": meta["plate_id"],
        "region": meta.get("region"), "regionCode": meta.get("region_code"),
        "utility": meta.get("utility"), "facilityType": meta.get("facility_type"),
        "metadataSource": meta.get("metadata_source"),
        "metadataConfidence": meta.get("metadata_confidence"),
        "pages": [],
    }


def _exact_plate_result(plate_id: str, term: str) -> dict:
    metas = search_index.get_by_plate_id(plate_id)
    entry = _plate_entry(metas[0])
    pages = []
    for m in metas:
        bbox, matched_word = locate_phrase(m, term)
        pages.append(_hit_to_page_entry(m, 1.0, bbox, matched_word))
    pages.sort(key=lambda p: p["page"])
    entry["pages"] = pages
    entry["bestScore"] = 1.0
    entry["idMatch"] = True
    return entry


def literal_matches(term: str) -> list[dict]:
    """Every ingested page whose text literally contains a distinctive
    word from `term` -- independent of embedding similarity. A short,
    specific query (a street name fragment, a plate-adjacent word) can
    rank too low by pure cosine similarity against a page whose embedding
    is dominated by thousands of other, unrelated words; a literal hit is
    strong evidence regardless of what the embedding score says."""
    terms = [_norm_word(t) for t in term.split() if _norm_word(t)]
    significant = [t for t in terms if t not in _GENERIC_STREET_WORDS] or terms
    if not significant:
        return []
    hits = []
    for _id, doc_text, meta in search_index.all_docs():
        tokens = {_norm_word(w) for w in doc_text.split()}
        if any(t in tokens for t in significant):
            hits.append(meta)
    return hits


def search(term: str, limit: int = 25) -> dict:
    """If `term` names one specific ingested plate ID exactly (modulo
    case/hyphenation), return only that plate. Otherwise, exact literal
    text matches only (see literal_matches) -- no semantic/embedding
    nearest-neighbor fallback, so a plate that doesn't literally contain
    the query never surfaces just because its embedding happens to be
    nearby. Either way, try to locate `term` as literal text on each
    matched page so the result points at exactly where it is, not just
    which page it's on."""
    n = search_index.count()
    if n == 0:
        return {"query": term, "results": [], "message": "The search index is empty -- run ingest.py first."}

    exact_id = search_index.match_plate_id(term)
    if exact_id:
        return {"query": term, "results": [_exact_plate_result(exact_id, term)]}

    # Rank on similarity first, WITHOUT calling locate_phrase yet -- that
    # re-opens the source PDF per page and is by far the most expensive
    # step here. Only the final, limit-truncated set of pages needs an
    # actual highlight location. Every candidate here is a literal match
    # (similarity 1.0), so "ranking" is really just a stable grouping by
    # plate, but the shape is kept close to _exact_plate_result's for
    # locate_phrase reuse below.
    by_plate: dict[str, dict] = {}

    def add_candidate(meta: dict) -> None:
        entry = by_plate.setdefault(meta["plate_id"], _plate_entry(meta))
        if not any(p["meta"]["page"] == meta["page"] for p in entry["pages"]):
            entry["pages"].append({"meta": meta, "similarity": 1.0})

    for meta in literal_matches(term):
        add_candidate(meta)

    results = list(by_plate.values())
    for entry in results:
        entry["pages"].sort(key=lambda p: p["meta"]["page"])
        entry["bestScore"] = 1.0
        entry["idMatch"] = True
    results = results[:limit]

    for entry in results:
        entry["pages"] = [
            _hit_to_page_entry(p["meta"], p["similarity"], *locate_phrase(p["meta"], term))
            for p in entry["pages"]
        ]

    out = {"query": term, "results": results}
    if not results:
        out["message"] = (
            f'No exact match for "{term}" -- no plate ID and no literal text match. '
            f"Try the exact plate ID (e.g. \"11-AD\"), a street name, or an equipment ID as it "
            f"actually appears on a plate."
        )
    return out


def ai_search(user_query: str, limit: int = 25) -> dict:
    """AI-powered search: Azure OpenAI extracts intent (search terms +
    metadata filters); retrieval for each extracted term is the same
    exact-match search() used by /api/search (plate-ID / literal-text
    only, no semantic fallback), merged and then filtered by the
    extracted metadata constraints."""
    # Checked before the LLM's in_scope judgment gets a say: a bare,
    # ambiguous-looking plate ID (e.g. "bucharea") can get classified as
    # off-topic trivia by the intent model even though it's a real,
    # deterministically verifiable ingested plate -- confirmed live, where
    # this got rejected with in_scope=false and never reached retrieval at
    # all. A local, authoritative plate-ID match always overrides that
    # guess: if it's really in the index, it's in scope, full stop.
    exact_plate_id = search_index.match_plate_id(user_query)

    intent = ai_search_mod.extract_intent(user_query)

    if not intent.get("in_scope", True) and not exact_plate_id:
        return {
            "query": user_query,
            "intent": intent,
            "summary": (
                "I'm the eGIS Maps AI Assistant -- I can only help you find Con Edison "
                "map plates (feeder maps, M&S plates, gas regulator plates, manhole details, "
                "etc.) by region, facility type, plate ID, or street/location name. That "
                "question doesn't look related to map search, so I can't help with it here."
            ),
            "results": [],
            "totalFound": 0,
            "retrieval": "rejected",
        }

    all_results = []
    seen_plates = set()
    terms = intent["search_terms"] or [user_query]

    # If the user's query names one exact plate ID, don't let a *different*,
    # non-exact extracted term broaden the result set past it -- e.g. Azure
    # OpenAI splitting "buchanan 13w" into ["Buchanan", "13W"] means neither
    # piece alone exact-matches "buchanan_13w", so each falls through to a
    # broad search and the merge balloons to dozens of plates. Check the raw
    # query first (that's what actually matches), then each extracted term.
    exact_term = user_query if exact_plate_id else next(
        (t for t in terms if search_index.match_plate_id(t)), None
    )
    if exact_term:
        terms = [exact_term]

    for term in terms:
        result = search(term, limit=limit)
        for plate in result.get("results", []):
            if plate["plateId"] not in seen_plates:
                seen_plates.add(plate["plateId"])
                all_results.append(plate)

    filters = intent.get("filters", {})
    filtered = []
    for plate in all_results:
        if filters.get("region") and plate.get("region") != filters["region"]:
            if plate.get("region") != "Unknown":
                continue
        if filters.get("utility") and plate.get("utility") != filters["utility"]:
            continue
        if filters.get("facility_type") and plate.get("facilityType") != filters["facility_type"]:
            continue
        filtered.append(plate)

    if not filtered:
        # Deterministic, not LLM-generated: an empty result set is a plain
        # fact, and letting the model "summarize" zero results risks it
        # hedging, guessing, or suggesting something not actually in the
        # index instead of just saying no exact match was found.
        summary = (
            f'No exact match found for "{user_query}". Search here only returns a plate whose '
            f"ID or text literally matches -- try the exact plate ID (e.g. \"11-AD\"), a street "
            f"name, or an equipment ID as it actually appears on a plate."
        )
    else:
        try:
            summary = ai_search_mod.summarize_results(user_query, filtered)
        except Exception:
            summary = f"Found {len(filtered)} plate(s) matching your query."

    out = {
        "query": user_query,
        "intent": intent,
        "summary": summary,
        "results": filtered[:limit],
        "totalFound": len(filtered),
        "retrieval": "exact",
    }
    if not filtered:
        out["message"] = summary
    return out


def _get_page_meta(plate_id: str, page_no: int) -> dict | None:
    return search_index.get_by_id(search_index.doc_id(plate_id, page_no))


def render_crop(plate_id: str, page_no: int, bbox=None) -> bytes:
    """Render a PNG for this page. With a bbox (from locate_phrase), this
    is a tight, highlighted crop around the match -- these plates are
    ~60-megapixel E-size pages, so rendering just the padded region around
    the match (instead of the whole page) is what keeps this fast. Without
    a bbox, falls back to a full-page thumbnail."""
    meta = _get_page_meta(plate_id, page_no)
    if not meta:
        raise ValueError("unknown plate/page")

    doc = _open_source_doc(meta)
    try:
        page = doc[page_no - 1]
        zoom = CROP_DPI / 72.0

        if bbox:
            x0, y0, x1, y1 = bbox
            clip = fitz.Rect(
                max(page.rect.x0, x0 - CROP_PAD_PT), max(page.rect.y0, y0 - CROP_PAD_PT),
                min(page.rect.x1, x1 + CROP_PAD_PT), min(page.rect.y1, y1 + CROP_PAD_PT),
            )
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip, alpha=False)
            arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
            if pix.n == 4:
                arr = arr[:, :, :3]
            crop = Image.fromarray(arr)
            draw = ImageDraw.Draw(crop)
            hl = ((x0 - clip.x0) * zoom, (y0 - clip.y0) * zoom,
                  (x1 - clip.x0) * zoom, (y1 - clip.y0) * zoom)
            draw.rectangle(hl, outline=(255, 0, 0), width=3)
        else:
            thumb_zoom = min(zoom, THUMB_MAX_PX / max(page.rect.width, page.rect.height))
            pix = page.get_pixmap(matrix=fitz.Matrix(thumb_zoom, thumb_zoom), alpha=False)
            arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
            if pix.n == 4:
                arr = arr[:, :, :3]
            crop = Image.fromarray(arr)
    finally:
        doc.close()

    buf = io.BytesIO()
    crop.save(buf, format="PNG")
    return buf.getvalue()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, data, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        try:
            if parsed.path == "/api/ai-status":
                return self._send_json({
                    "available": ai_search_mod.is_available(),
                    "model": azure_openai.AZURE_OPENAI_CHAT_DEPLOYMENT,
                })

            if parsed.path == "/api/embedding-status":
                return self._send_json({
                    "available": azure_openai.is_available() and search_index.is_available(),
                    "model": azure_openai.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
                    "indexedPages": search_index.count(),
                })

            if parsed.path == "/api/ai-search":
                term = (qs.get("q") or [""])[0].strip()
                if not term:
                    return self._send_json({"results": [], "error": "missing q"}, 400)
                if not ai_search_mod.is_available():
                    return self._send_json({"error": "Azure OpenAI not configured"}, 503)
                return self._send_json(ai_search(term))

            if parsed.path == "/api/search":
                term = (qs.get("q") or [""])[0].strip()
                if not term:
                    return self._send_json({"results": [], "error": "missing q"}, 400)
                return self._send_json(search(term))

            if parsed.path == "/api/crop":
                plate = (qs.get("plate") or [""])[0]
                page = int((qs.get("page") or ["1"])[0])
                bbox = None
                if all(k in qs for k in ("x0", "y0", "x1", "y1")):
                    bbox = tuple(float(qs[k][0]) for k in ("x0", "y0", "x1", "y1"))
                png = render_crop(plate, page, bbox)
                return self._send_bytes(png, "image/png")

            if parsed.path == "/api/pdf":
                plate = (qs.get("plate") or [""])[0]
                metas = search_index.get_by_plate_id(plate)
                if not metas:
                    return self._send_json({"error": "unknown plate"}, 404)
                meta = metas[0]
                if meta.get("source_type") == "blob":
                    pdf_bytes = blob_storage.download_pdf_bytes(meta["source_path"])
                else:
                    with open(meta["source_path"], "rb") as f:
                        pdf_bytes = f.read()
                return self._send_bytes(pdf_bytes, "application/pdf")

            rel = parsed.path.lstrip("/") or "index.html"
            fpath = os.path.normpath(os.path.join(STATIC_DIR, rel))
            if not fpath.startswith(STATIC_DIR) or not os.path.isfile(fpath):
                return self._send_json({"error": "not found"}, 404)
            ctype = ("text/html" if fpath.endswith(".html") else
                     "application/javascript" if fpath.endswith(".js") else
                     "text/css" if fpath.endswith(".css") else "application/octet-stream")
            with open(fpath, "rb") as f:
                return self._send_bytes(f.read(), ctype)

        except Exception as e:
            return self._send_json({"error": str(e)}, 500)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    if not search_index.is_available():
        print("AZURE_SEARCH_ENDPOINT / AZURE_SEARCH_API_KEY are not configured (see search_engine/.env).")
        return 1
    if search_index.count() == 0:
        print(f"Index '{search_index.AZURE_SEARCH_INDEX_NAME}' is empty -- run ingest.py first.")
        return 1
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Serving on http://127.0.0.1:{port}  (Ctrl+C to stop)")
    server.serve_forever()


if __name__ == "__main__":
    raise SystemExit(main())
