#!/usr/bin/env python3
"""Ingest map-plate PDFs into the Azure AI Search vector index (Tier 3,
ingestion half).

Born-digital pages: PyMuPDF word-level extraction (instant, exact). Scanned
pages: tiled RapidOCR -- single-shot OCR on these ~34-megapixel plates
misses most labels (recall collapses on dense pages, see ../RESULTS.md);
tiling with overlap recovers it. The extracted/OCR'd text of each page is
embedded via Azure OpenAI (see azure_openai.py) and stored in Azure AI
Search (see search_index.py) alongside heuristic plate metadata -- no
SQLite, no per-word bounding boxes.

Source PDFs come from either a local folder or an Azure Blob Storage
container (see blob_storage.py) -- pick with --source.

Usage:
    python ingest.py --source local --input "C:\\path\\to\\PDFs" --reset
    python ingest.py --source blob --reset
"""
from __future__ import annotations

import argparse
import glob
import os
import re
import sys
import time

import fitz
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ocr_engines  # noqa: E402

import azure_openai  # noqa: E402
import blob_storage  # noqa: E402
import metadata  # noqa: E402
import search_index  # noqa: E402

TEXT_LAYER_MIN_CHARS = 200   # below this, treat the page as scanned/handwritten
RENDER_DPI = 200
TILE_SIZE = 1500
TILE_OVERLAP = 250

# A word counts as an equipment/plate-ID token if it mixes letters and digits
# (catches 1W02, 10-AB, M-22158, GR100, TM4x, ...). Heuristic, not a full
# grammar -- false positives (e.g. "1st") are harmless since they also live
# in the free-text content field.
ID_RE = re.compile(r'^(?=.*[0-9])(?=.*[A-Za-z])[A-Za-z0-9-]{2,12}$')

UNKNOWN = "Unknown"


def is_equipment_id(word: str) -> bool:
    return bool(ID_RE.match(word.strip(".,;:'\"")))


def extract_born_digital(page) -> list[dict]:
    """PyMuPDF's get_text("words") returns bboxes in the page's raw,
    pre-rotation content-stream space -- but page.rect / get_pixmap() (used
    later for rendering crops) are in the rotated *display* space. On a
    rotated page (e.g. rotation=270, common on these landscape plates) the
    two disagree, so a highlight box drawn straight from the raw bbox lands
    on the wrong part of the rendered image. Map through rotation_matrix so
    every stored bbox is in the same space get_pixmap() renders into.
    """
    rot = page.rotation_matrix
    words = []
    for x0, y0, x1, y1, text, *_ in page.get_text("words"):
        text = text.strip()
        if not text:
            continue
        r = fitz.Rect(x0, y0, x1, y1) * rot
        words.append({
            "word": text, "bbox": (float(r.x0), float(r.y0), float(r.x1), float(r.y1)),
            "confidence": 1.0, "source": "extract",
        })
    return words


def iou(a, b) -> float:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ix0, iy0 = max(ax0, bx0), max(ay0, by0)
    ix1, iy1 = min(ax1, bx1), min(ay1, by1)
    iw, ih = max(0.0, ix1 - ix0), max(0.0, iy1 - iy0)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    a_area = (ax1 - ax0) * (ay1 - ay0)
    b_area = (bx1 - bx0) * (by1 - by0)
    return inter / (a_area + b_area - inter)


def extract_scanned(rgb: np.ndarray) -> list[dict]:
    """Tile the page, OCR each tile, offset boxes to page coords, dedupe
    overlap (bboxes here are only used for de-duplicating words found twice
    in overlapping tiles -- they are not persisted)."""
    h, w = rgb.shape[:2]
    step = TILE_SIZE - TILE_OVERLAP
    ys = sorted(set(list(range(0, max(1, h - 1), step)) + [max(0, h - TILE_SIZE)]))
    xs = sorted(set(list(range(0, max(1, w - 1), step)) + [max(0, w - TILE_SIZE)]))

    all_words = []
    for ty in ys:
        for tx in xs:
            tile = rgb[ty:ty + TILE_SIZE, tx:tx + TILE_SIZE]
            if tile.size == 0:
                continue
            try:
                found = ocr_engines.run_engine("rapidocr", tile)
            except Exception:
                continue
            for wobj in found:
                x0, y0, x1, y1 = wobj.bbox
                all_words.append({
                    "word": wobj.text,
                    "bbox": (x0 + tx, y0 + ty, x1 + tx, y1 + ty),
                    "confidence": wobj.confidence, "source": "ocr",
                })

    all_words.sort(key=lambda w: -w["confidence"])
    kept = []
    for wobj in all_words:
        if any(iou(wobj["bbox"], k["bbox"]) > 0.5 and
               wobj["word"].lower() == k["word"].lower() for k in kept):
            continue
        kept.append(wobj)
    return kept


def ingest_document(doc: "fitz.Document", plate_id: str, name: str, source_meta: dict) -> int:
    """Extract every page of one already-open PDF and upsert it into the
    Azure AI Search index. `source_meta` (source_type + source_path) is
    merged into every page's document so server.py knows how to re-fetch
    the PDF later (open a local path, or download a blob). Returns the
    number of pages added."""
    n_pages = doc.page_count
    if n_pages > 1:
        print(f"  {name}: multi-page plate ({n_pages} pages) -- classifying each page independently")

    docs, texts = [], []
    for i, page in enumerate(doc):
        page_no = i + 1
        text_layer = page.get_text("text")
        rect = page.rect

        if len(text_layer.strip()) >= TEXT_LAYER_MIN_CHARS:
            words = extract_born_digital(page)
            quality = "high"
        else:
            zoom = RENDER_DPI / 72.0
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
            if pix.n == 4:
                arr = arr[:, :, :3]
            words = extract_scanned(np.ascontiguousarray(arr))
            mean_conf = sum(w["confidence"] for w in words) / len(words) if words else 0.0
            quality = "ocr-high" if mean_conf >= 0.7 else "ocr-low"

        content = " ".join(w["word"] for w in words)
        eq_ids = " ".join(sorted({w["word"] for w in words if is_equipment_id(w["word"])}))
        meta = metadata.guess_metadata(plate_id, content)

        print(f"  {name} p{page_no}: {len(words):4d} words  quality={quality}  "
              f"utility={meta['utility']} region={meta['region']} "
              f"facility={meta['facility_type']} (conf={meta['metadata_confidence']})")

        if not content.strip():
            print(f"  {name} p{page_no}: no text extracted -- skipping (nothing to embed)")
            continue

        texts.append(content)
        docs.append({
            "id": search_index.doc_id(plate_id, page_no),
            "plate_id": plate_id,
            "page": page_no,
            "content": content,
            "region": meta["region"] or UNKNOWN,
            "region_code": meta["region_code"] or "",
            "utility": meta["utility"] or UNKNOWN,
            "facility_type": meta["facility_type"] or UNKNOWN,
            "metadata_source": meta["metadata_source"],
            "metadata_confidence": float(meta["metadata_confidence"]),
            "extraction_quality": quality,
            "equipment_ids": eq_ids,
            "page_width": float(rect.width),
            "page_height": float(rect.height),
            **source_meta,
        })

    if docs:
        embeddings = azure_openai.embed_texts(texts)
        for d, vec in zip(docs, embeddings):
            d["embedding"] = vec
        search_index.upsert_documents(docs)
    return len(docs)


def ingest_file(path: str) -> int:
    """Ingest one PDF from local disk."""
    name = os.path.basename(path)
    plate_id = os.path.splitext(name)[0]
    doc = fitz.open(path)
    try:
        return ingest_document(doc, plate_id, name, {"source_type": "local", "source_path": path})
    finally:
        doc.close()


def ingest_blob(blob_name: str) -> int:
    """Ingest one PDF read from the configured Blob Storage container."""
    name = os.path.basename(blob_name)
    plate_id = os.path.splitext(name)[0]
    pdf_bytes = blob_storage.download_pdf_bytes(blob_name)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return ingest_document(doc, plate_id, name, {"source_type": "blob", "source_path": blob_name})
    finally:
        doc.close()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Ingest map PDFs into the Azure AI Search vector index")
    ap.add_argument("--source", choices=["local", "blob"], default="local",
                     help="where to read PDFs from (default: local)")
    ap.add_argument("--input", help="folder of PDFs to ingest (--source local only)")
    ap.add_argument("--reset", action="store_true", help="wipe the vector index first")
    args = ap.parse_args(argv)

    if not azure_openai.is_available():
        print("AZURE_OPENAI_API_KEY / AZURE_OPENAI_ENDPOINT are not configured (see search_engine/.env) -- cannot embed pages.")
        return 1
    if not search_index.is_available():
        print("AZURE_SEARCH_ENDPOINT / AZURE_SEARCH_API_KEY are not configured (see search_engine/.env).")
        return 1

    if args.source == "local" and not args.input:
        ap.error("--input is required when --source local")
    if args.source == "blob" and not blob_storage.is_available():
        print("AZURE_STORAGE_CONNECTION_STRING / AZURE_STORAGE_CONTAINER are not configured (see search_engine/.env).")
        return 1

    search_index.ensure_index(reset=args.reset)
    t0 = time.time()

    total_pages = 0
    failed = []

    if args.source == "blob":
        blob_names = blob_storage.list_pdf_blobs()
        print(f"Ingesting {len(blob_names)} PDFs from blob container '{blob_storage.AZURE_STORAGE_CONTAINER}'")
        for blob_name in blob_names:
            try:
                total_pages += ingest_blob(blob_name)
            except Exception as e:
                print(f"  FAILED {blob_name}: {e}")
                failed.append(blob_name)
    else:
        files = sorted(glob.glob(os.path.join(args.input, "*.pdf")))
        print(f"Ingesting {len(files)} PDFs from {args.input}")
        for path in files:
            try:
                total_pages += ingest_file(path)
            except Exception as e:
                print(f"  FAILED {path}: {e}")
                failed.append(path)

    elapsed = time.time() - t0
    print(f"\nDone in {elapsed:.1f}s -> {total_pages} page(s) embedded "
          f"({search_index.count()} total in '{search_index.AZURE_SEARCH_INDEX_NAME}')")
    if failed:
        print(f"{len(failed)} file(s) failed: {', '.join(os.path.basename(p) for p in failed)}")
    return 1 if failed and total_pages == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
