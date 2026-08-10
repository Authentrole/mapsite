#!/usr/bin/env python3
"""Local, dependency-free HTTP server for the Tier-3 AI search engine.

Python stdlib only (no Flask/FastAPI) -- nothing new to install, nothing
external to reach. Serves:

  GET /                                        -> the standalone search harness
  GET /api/search?q=...                        -> JSON ranked list of matching plates
  GET /api/ai-search?q=...                     -> Gemini intent + semantic/keyword retrieval + summary
  GET /api/ai-status                           -> is GEMINI_API_KEY configured
  GET /api/embedding-status                    -> is the embedding index built, and how big
  GET /api/crop?plate=&page=&x0=&y0=&x1=&y1=    -> PNG crop with the match highlighted
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

import db  # noqa: E402
import matching  # noqa: E402
import ai_search as ai_search_mod  # noqa: E402
import embeddings as embeddings_mod  # noqa: E402

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
# Cosine similarity floor for keeping a semantic hit that has no lexical
# corroboration on its page -- see the comment where this is used in
# ai_search() for why this exists.
HIGH_CONFIDENCE_SIMILARITY = 0.55
CROP_DPI = 200
CROP_PAD_PT = 60  # padding around the matched word, in PDF points


def fts_phrase(term: str) -> str:
    term = term.replace('"', '')
    return f'"{term}"*'


def _run(conn, match_expr: str, limit: int):
    return conn.execute(
        """SELECT plate_id, page, bm25(content_fts) AS score
           FROM content_fts WHERE content_fts MATCH ?
           ORDER BY score ASC LIMIT ?""",
        (match_expr, limit),
    ).fetchall()


def _best_word_on_page(conn, plate_id: str, page: int, term_norm: str) -> tuple[dict | None, int | None]:
    """Find the word on this page that best matches term_norm: exact first,
    then a hardened fuzzy match. Returns (row, edit_distance_or_None).

    Tries an indexed exact lookup first (the common case -- most hits are
    exact/prefix FTS matches) instead of always fetching every word on the
    page: a dense plate can carry 5,000-10,000 words, and fetching + fuzzy-
    scanning all of them for every one of ~20 results was the main cost in
    /api/search (each such scan running a Levenshtein comparison against the
    full per-page vocabulary even when an exact match existed elsewhere on
    the same page).
    """
    exact = conn.execute(
        "SELECT * FROM word_positions WHERE plate_id=? AND page=? AND word_norm=? LIMIT 1",
        (plate_id, page, term_norm),
    ).fetchone()
    if exact is not None:
        return exact, None

    wrows = conn.execute(
        "SELECT * FROM word_positions WHERE plate_id=? AND page=?", (plate_id, page)
    ).fetchall()
    if not wrows:
        return None, None
    cand_map = {w["word_norm"]: w for w in wrows}
    matches = matching.fuzzy_candidates(term_norm, list(cand_map), limit=1)
    if matches:
        word_norm, dist = matches[0]
        return cand_map[word_norm], dist
    return None, None


def search(term: str, limit: int = 25) -> dict:
    conn = db.connect()
    term_norm = db.norm(term)
    fq = fts_phrase(term)

    id_rows = _run(conn, f"equipment_ids:{fq}", limit)
    seen = {(r["plate_id"], r["page"]) for r in id_rows}
    text_rows = [r for r in _run(conn, f"content:{fq}", limit) if (r["plate_id"], r["page"]) not in seen]

    fuzzy_used = False
    ranked = [(r, True) for r in id_rows] + [(r, False) for r in text_rows]

    if not ranked:
        # Hardened fuzzy fallback: composition-aware + real edit distance,
        # instead of difflib's shared-character-run ratio (see matching.py
        # for why -- it was cross-matching unrelated numeric IDs).
        #
        # Resolve matches by querying word_positions directly, NOT by
        # re-running an FTS phrase query on the matched word: FTS5's
        # tokenizer splits on punctuation (e.g. the OCR token "m.2215"
        # becomes two FTS tokens "m" + "2215"), while word_norm collapses it
        # to one alnum string ("m2215") for fuzzy comparison. A phrase query
        # for "m2215"* against FTS then finds nothing even though the fuzzy
        # match was correct -- word_positions already carries the exact
        # word_norm per occurrence, so look hits up there instead.
        vocab = [r[0] for r in conn.execute(
            "SELECT DISTINCT word_norm FROM word_positions WHERE length(word_norm) >= 3"
        ).fetchall()]
        close = matching.fuzzy_candidates(term_norm, vocab, limit=5)
        if close:
            fuzzy_used = True
            seen2 = set()
            for word_norm, dist in close:
                hits = conn.execute(
                    "SELECT DISTINCT plate_id, page FROM word_positions WHERE word_norm=?",
                    (word_norm,),
                ).fetchall()
                for h in hits:
                    key = (h["plate_id"], h["page"])
                    if key not in seen2:
                        seen2.add(key)
                        ranked.append(({"plate_id": h["plate_id"], "page": h["page"], "score": None}, False))

    ranked = ranked[:limit]

    # Group hits by plate: a multi-page plate that matches on more than one
    # page should surface as one card listing every matching page, not one
    # duplicate card per page.
    by_plate: dict[str, dict] = {}
    for r, id_hit in ranked:
        plate_id, page, score = r["plate_id"], r["page"], r["score"]
        prow = conn.execute(
            "SELECT * FROM plates WHERE plate_id=? AND page=?", (plate_id, page)
        ).fetchone()
        best, fuzzy_dist = _best_word_on_page(conn, plate_id, page, term_norm)

        page_entry = {
            "page": page,
            "extractionQuality": prow["extraction_quality"],
            "idMatch": id_hit,
            "score": round(-score, 3) if score is not None else None,
            "matchedWord": best["word"] if best else None,
            "bbox": [best["x0"], best["y0"], best["x1"], best["y1"]] if best else None,
            "fuzzyDistance": fuzzy_dist,
        }

        entry = by_plate.get(plate_id)
        if entry is None:
            entry = {
                "plateId": plate_id,
                "region": prow["region"], "regionCode": prow["region_code"],
                "utility": prow["utility"], "facilityType": prow["facility_type"],
                "metadataSource": prow["metadata_source"],
                "metadataConfidence": prow["metadata_confidence"],
                "pages": [],
            }
            by_plate[plate_id] = entry
        entry["pages"].append(page_entry)

    def page_sort_key(p):
        # Best first: id-matches before text-matches, higher score before
        # lower, and (for fuzzy-only hits with no score) smaller edit
        # distance before larger.
        return (not p["idMatch"], -(p["score"] or 0), p["fuzzyDistance"] if p["fuzzyDistance"] is not None else 0)

    results = list(by_plate.values())
    for entry in results:
        entry["pages"].sort(key=page_sort_key)
        best_page = entry["pages"][0]
        entry["bestScore"] = best_page["score"]
        entry["idMatch"] = best_page["idMatch"]
    results.sort(key=lambda e: (not e["idMatch"], -(e["bestScore"] or 0)))

    conn.close()
    return {"query": term, "fuzzy": fuzzy_used, "results": results}


def _locate_term_on_page(conn, plate_id: str, page: int, search_terms: list[str]) -> tuple[dict | None, str | None]:
    """Try to pinpoint one of the intent's search terms on this specific
    page, so a semantic hit (page-level similarity only) can still get an
    exact highlighted crop instead of a plain thumbnail. Reuses the same
    exact/fuzzy word lookup the keyword search path already relies on --
    no new matching logic."""
    best_row, best_dist, best_term = None, None, None
    for term in search_terms:
        term_norm = db.norm(term)
        if not term_norm:
            continue
        row, dist = _best_word_on_page(conn, plate_id, page, term_norm)
        if row is None:
            continue
        # Prefer an exact match (dist is None) over any fuzzy one.
        if best_row is None or (best_dist is not None and (dist is None or dist < best_dist)):
            best_row, best_dist, best_term = row, dist, term
        if dist is None:
            break
    return best_row, best_term


def _plate_from_semantic_hit(conn, hit: dict, search_terms: list[str]) -> dict | None:
    prow = conn.execute(
        "SELECT * FROM plates WHERE plate_id=? AND page=?", (hit["plateId"], hit["page"])
    ).fetchone()
    if not prow:
        return None

    word_row, matched_term = _locate_term_on_page(conn, hit["plateId"], hit["page"], search_terms)
    page_entry = {"page": hit["page"], "similarity": round(hit["similarity"], 4)}
    id_match = False
    if word_row is not None:
        page_entry["matchedWord"] = word_row["word"]
        page_entry["bbox"] = [word_row["x0"], word_row["y0"], word_row["x1"], word_row["y1"]]
        id_match = True

    return {
        "plateId": hit["plateId"],
        "region": prow["region"], "regionCode": prow["region_code"],
        "utility": prow["utility"], "facilityType": prow["facility_type"],
        "metadataSource": prow["metadata_source"],
        "metadataConfidence": prow["metadata_confidence"],
        "pages": [page_entry],
        "bestScore": round(hit["similarity"], 4),
        "idMatch": id_match,
        "semantic": True,
    }


def ai_search(user_query: str, limit: int = 25) -> dict:
    """AI-powered search: Gemini extracts intent; retrieval is semantic
    (Gemini embeddings + cosine similarity) when an embedding index exists,
    falling back to the keyword/FTS engine otherwise."""
    # Step 1: Extract intent via Gemini
    intent = ai_search_mod.extract_intent(user_query)

    if not intent.get("in_scope", True):
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

    # Step 2: Retrieve candidate plates
    all_results = []
    seen_plates = set()
    used_semantic = False

    if embeddings_mod.is_available():
        try:
            hits = embeddings_mod.search_semantic(user_query, top_k=limit * 3)
        except Exception as e:
            hits = []
            print(f"semantic search failed, falling back to keyword search: {e}")
        if hits:
            used_semantic = True
            conn = db.connect()
            try:
                for hit in hits:
                    if hit["plateId"] in seen_plates:
                        continue
                    plate = _plate_from_semantic_hit(conn, hit, intent["search_terms"])
                    if plate:
                        seen_plates.add(hit["plateId"])
                        all_results.append(plate)
            finally:
                conn.close()

            # Embedding similarity has a high "noise floor" -- unrelated
            # pages routinely score ~0.40 against a short query, so without
            # a cutoff a specific term search (a street name, a plate ID)
            # returns most of the corpus. When the intent named specific
            # search terms, only keep a hit if it's lexically corroborated
            # (an exact/close word match was found on that page) or its
            # similarity is well above that noise floor. Broad/conceptual
            # queries with no specific terms skip this -- there's nothing
            # to corroborate against, so similarity rank is all we have.
            if intent["search_terms"]:
                all_results = [
                    p for p in all_results
                    if p["idMatch"] or p["bestScore"] >= HIGH_CONFIDENCE_SIMILARITY
                ]

    if not used_semantic:
        for term in intent["search_terms"]:
            result = search(term, limit=limit)
            for plate in result.get("results", []):
                if plate["plateId"] not in seen_plates:
                    seen_plates.add(plate["plateId"])
                    all_results.append(plate)

    # Step 3: Apply metadata filters
    filters = intent.get("filters", {})
    filtered = []
    for plate in all_results:
        if filters.get("region") and plate.get("region") != filters["region"]:
            # Allow "Unknown" to pass through (metadata may be imperfect)
            if plate.get("region") != "Unknown":
                continue
        if filters.get("utility") and plate.get("utility") != filters["utility"]:
            continue
        if filters.get("facility_type") and plate.get("facilityType") != filters["facility_type"]:
            continue
        filtered.append(plate)

    # Step 4: Generate AI summary
    try:
        summary = ai_search_mod.summarize_results(user_query, filtered)
    except Exception as e:
        summary = f"Found {len(filtered)} plate(s) matching your query."

    return {
        "query": user_query,
        "intent": intent,
        "summary": summary,
        "results": filtered[:limit],
        "totalFound": len(filtered),
        "retrieval": "semantic" if used_semantic else "keyword",
    }


def render_crop(plate_id: str, page_no: int, bbox) -> bytes:
    conn = db.connect()
    prow = conn.execute("SELECT * FROM plates WHERE plate_id=? AND page=?", (plate_id, page_no)).fetchone()
    conn.close()
    if not prow:
        raise ValueError("unknown plate/page")

    doc = fitz.open(prow["source_path"])
    page = doc[page_no - 1]
    zoom = CROP_DPI / 72.0
    mat = fitz.Matrix(zoom, zoom)

    if bbox:
        x0, y0, x1, y1 = bbox
        # Render ONLY the padded region around the match, not the whole
        # page. These are E-size plates (~6800x8800px at 200 DPI, ~60
        # megapixels) -- rasterizing the full page just to crop a ~400px
        # snippet out of it was the actual cost of a search (~2s per crop,
        # dominating a multi-result search): clip restricts what PyMuPDF
        # rasterizes in the first place.
        clip = fitz.Rect(
            max(page.rect.x0, x0 - CROP_PAD_PT), max(page.rect.y0, y0 - CROP_PAD_PT),
            min(page.rect.x1, x1 + CROP_PAD_PT), min(page.rect.y1, y1 + CROP_PAD_PT),
        )
        pix = page.get_pixmap(matrix=mat, clip=clip, alpha=False)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        if pix.n == 4:
            arr = arr[:, :, :3]
        crop = Image.fromarray(arr)
        draw = ImageDraw.Draw(crop)
        hl = ((x0 - clip.x0) * zoom, (y0 - clip.y0) * zoom,
              (x1 - clip.x0) * zoom, (y1 - clip.y0) * zoom)
        draw.rectangle(hl, outline=(255, 0, 0), width=3)
    else:
        thumb_zoom = min(zoom, 800 / max(page.rect.width, page.rect.height))
        pix = page.get_pixmap(matrix=fitz.Matrix(thumb_zoom, thumb_zoom), alpha=False)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        if pix.n == 4:
            arr = arr[:, :, :3]
        crop = Image.fromarray(arr)

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
                    "model": ai_search_mod.GEMINI_MODEL,
                })

            if parsed.path == "/api/embedding-status":
                return self._send_json({
                    "available": embeddings_mod.is_available(),
                    "model": embeddings_mod.EMBEDDING_MODEL,
                    "indexedPages": embeddings_mod.indexed_count(),
                })

            if parsed.path == "/api/ai-search":
                term = (qs.get("q") or [""])[0].strip()
                if not term:
                    return self._send_json({"results": [], "error": "missing q"}, 400)
                if not ai_search_mod.is_available():
                    return self._send_json({"error": "GEMINI_API_KEY not configured"}, 503)
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
                conn = db.connect()
                row = conn.execute("SELECT source_path FROM plates WHERE plate_id=? LIMIT 1", (plate,)).fetchone()
                conn.close()
                if not row:
                    return self._send_json({"error": "unknown plate"}, 404)
                with open(row["source_path"], "rb") as f:
                    return self._send_bytes(f.read(), "application/pdf")

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
    if not os.path.exists(db.DB_PATH):
        print(f"No index found at {db.DB_PATH} -- run ingest.py first.")
        return 1
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Serving on http://127.0.0.1:{port}  (Ctrl+C to stop)")
    server.serve_forever()


if __name__ == "__main__":
    raise SystemExit(main())
