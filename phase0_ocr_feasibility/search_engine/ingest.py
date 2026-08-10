#!/usr/bin/env python3
"""Ingest map-plate PDFs into the local search index (Tier 3, ingestion half).

Born-digital pages: PyMuPDF word-level extraction (instant, exact, includes
bbox for free). Scanned pages: tiled RapidOCR -- single-shot OCR on these
~34-megapixel plates misses most labels (recall collapses on dense pages,
see ../RESULTS.md); tiling with overlap recovers it.

Usage:
    python ingest.py --input "C:\\Users\\2444743\\Downloads\\16503-2" --reset
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

import db  # noqa: E402
import metadata  # noqa: E402

TEXT_LAYER_MIN_CHARS = 200   # below this, treat the page as scanned/handwritten
RENDER_DPI = 200
TILE_SIZE = 1500
TILE_OVERLAP = 250

# A word counts as an equipment/plate-ID token if it mixes letters and digits
# (catches 1W02, 10-AB, M-22158, GR100, TM4x, ...). Heuristic, not a full
# grammar -- false positives (e.g. "1st") are harmless since they also live
# in the free-text content field.
ID_RE = re.compile(r'^(?=.*[0-9])(?=.*[A-Za-z])[A-Za-z0-9-]{2,12}$')


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
    """Tile the page, OCR each tile, offset boxes to page coords, dedupe overlap."""
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


def ingest_file(path: str, conn) -> None:
    name = os.path.basename(path)
    plate_id = os.path.splitext(name)[0]
    doc = fitz.open(path)
    n_pages = doc.page_count
    if n_pages > 1:
        print(f"  {name}: multi-page plate ({n_pages} pages) -- classifying each page independently")
    try:
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
                scale = 72.0 / RENDER_DPI  # OCR bboxes are in render-DPI pixels -> PDF points
                for w in words:
                    x0, y0, x1, y1 = w["bbox"]
                    w["bbox"] = (x0 * scale, y0 * scale, x1 * scale, y1 * scale)
                mean_conf = sum(w["confidence"] for w in words) / len(words) if words else 0.0
                quality = "ocr-high" if mean_conf >= 0.7 else "ocr-low"

            content = " ".join(w["word"] for w in words)
            eq_ids = " ".join(sorted({w["word"] for w in words if is_equipment_id(w["word"])}))
            meta = metadata.guess_metadata(plate_id, content)

            conn.execute(
                "INSERT OR REPLACE INTO plates VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (plate_id, page_no, meta["region"], meta["region_code"], meta["utility"],
                 meta["facility_type"], meta["metadata_source"], meta["metadata_confidence"],
                 quality, rect.width, rect.height, path),
            )
            conn.execute("DELETE FROM content_fts WHERE plate_id=? AND page=?", (plate_id, page_no))
            conn.execute(
                "INSERT INTO content_fts (content, equipment_ids, plate_id, page) VALUES (?,?,?,?)",
                (content, eq_ids, plate_id, page_no),
            )
            conn.execute("DELETE FROM word_positions WHERE plate_id=? AND page=?", (plate_id, page_no))
            conn.executemany(
                "INSERT INTO word_positions VALUES (?,?,?,?,?,?,?,?,?,?)",
                [(plate_id, page_no, w["word"], db.norm(w["word"]),
                  *w["bbox"], w["confidence"], w["source"]) for w in words],
            )
            print(f"  {name} p{page_no}: {len(words):4d} words  quality={quality}  "
                  f"utility={meta['utility']} region={meta['region']} "
                  f"facility={meta['facility_type']} (conf={meta['metadata_confidence']})")
    finally:
        doc.close()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Ingest map PDFs into the local search index")
    ap.add_argument("--input", required=True, help="folder of PDFs to ingest")
    ap.add_argument("--reset", action="store_true", help="wipe the index first")
    args = ap.parse_args(argv)

    db.init_db(reset=args.reset)
    conn = db.connect()
    t0 = time.time()
    files = sorted(glob.glob(os.path.join(args.input, "*.pdf")))
    print(f"Ingesting {len(files)} PDFs from {args.input}")
    for path in files:
        try:
            ingest_file(path, conn)
            conn.commit()
        except Exception as e:
            print(f"  FAILED {path}: {e}")
    conn.close()
    print(f"\nDone in {time.time() - t0:.1f}s -> {db.DB_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
