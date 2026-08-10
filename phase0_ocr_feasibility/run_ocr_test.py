#!/usr/bin/env python3
"""Phase 0 OCR feasibility runner.

For each input PDF/image, render pages, apply preprocessing variants, run each
available OCR engine, and write per-page JSON/TXT/annotated-PNG plus a summary
CSV comparing engines and variants.

Usage:
    python run_ocr_test.py --input ./samples --output ./results
    python run_ocr_test.py --input ./samples/map.pdf --engines tesseract --dpi 400
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from typing import List

import numpy as np
from PIL import Image, ImageDraw

import pdf_render
import preprocess
import ocr_engines


def _annotate(rgb: np.ndarray, words: List[ocr_engines.OcrWord]) -> Image.Image:
    im = Image.fromarray(rgb.astype(np.uint8)).convert("RGB")
    draw = ImageDraw.Draw(im)
    for w in words:
        x0, y0, x1, y1 = w.bbox
        color = (255, 0, 0) if w.confidence < 0.6 else (0, 180, 0)
        draw.rectangle([x0, y0, x1, y1], outline=color, width=2)
    return im


def _mean_conf(words: List[ocr_engines.OcrWord]) -> float:
    if not words:
        return 0.0
    return sum(w.confidence for w in words) / len(words)


def process_file(path: str, out_dir: str, engines: List[str],
                 variants: dict, dpi: int, max_pages: int | None,
                 summary_rows: list) -> None:
    base = os.path.splitext(os.path.basename(path))[0]
    print(f"\n=== {os.path.basename(path)} ===")

    for page_no, rgb in pdf_render.render_pages(path, dpi=dpi, max_pages=max_pages):
        print(f"  page {page_no} ({rgb.shape[1]}x{rgb.shape[0]})")
        for vname, vfn in variants.items():
            try:
                proc = vfn(rgb)
            except Exception as e:
                print(f"    [variant {vname}] preprocessing failed: {e}")
                continue

            for eng in engines:
                tag = f"{base}_p{page_no}_{vname}_{eng}"
                t0 = time.time()
                try:
                    words = ocr_engines.run_engine(eng, proc)
                except Exception as e:
                    print(f"    [{vname}/{eng}] OCR failed: {e}")
                    summary_rows.append({
                        "file": os.path.basename(path), "page": page_no,
                        "variant": vname, "engine": eng, "word_count": 0,
                        "mean_confidence": 0.0, "seconds": 0.0, "error": str(e),
                    })
                    continue
                dt = time.time() - t0

                # Write JSON
                with open(os.path.join(out_dir, tag + ".json"), "w", encoding="utf-8") as f:
                    json.dump([w.to_dict() for w in words], f, indent=2)

                # Write flat text
                with open(os.path.join(out_dir, tag + ".txt"), "w", encoding="utf-8") as f:
                    f.write("\n".join(w.text for w in words))

                # Write annotated image
                try:
                    _annotate(proc, words).save(os.path.join(out_dir, tag + "_boxes.png"))
                except Exception as e:
                    print(f"    [{vname}/{eng}] annotate failed: {e}")

                mc = _mean_conf(words)
                print(f"    [{vname}/{eng}] words={len(words):4d} "
                      f"mean_conf={mc:.2f} time={dt:.1f}s")
                summary_rows.append({
                    "file": os.path.basename(path), "page": page_no,
                    "variant": vname, "engine": eng, "word_count": len(words),
                    "mean_confidence": round(mc, 4), "seconds": round(dt, 2),
                    "error": "",
                })


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Phase 0 OCR feasibility test")
    ap.add_argument("--input", required=True,
                    help="PDF/image file, or a directory of them")
    ap.add_argument("--output", default="./results", help="output directory")
    ap.add_argument("--engines", nargs="*", default=None,
                    help="subset of engines (default: all available). "
                         "choices: rapidocr tesseract paddle")
    ap.add_argument("--variants", nargs="*", default=None,
                    help="subset of preprocessing variants (default: all). "
                         "choices: raw gray_contrast inverted upscaled binarized")
    ap.add_argument("--dpi", type=int, default=300, help="render DPI (default 300)")
    ap.add_argument("--max-pages", type=int, default=None,
                    help="limit pages per PDF")
    args = ap.parse_args(argv)

    # Resolve engines
    avail = ocr_engines.available_engines()
    if not avail:
        print("ERROR: no OCR engine available. Install pytesseract (+ tesseract "
              "binary) and/or paddleocr. See README.md.", file=sys.stderr)
        return 2
    engines = args.engines or avail
    unknown = [e for e in engines if e not in avail]
    if unknown:
        print(f"WARNING: requested engines not available and will be skipped: "
              f"{unknown}. Available: {avail}", file=sys.stderr)
        engines = [e for e in engines if e in avail]
    if not engines:
        print("ERROR: none of the requested engines are available.", file=sys.stderr)
        return 2
    print(f"Using engines: {engines}")

    variants = preprocess.get_variants(args.variants)
    print(f"Using variants: {list(variants)}")

    # Gather inputs
    inputs: List[str] = []
    if os.path.isdir(args.input):
        for name in sorted(os.listdir(args.input)):
            p = os.path.join(args.input, name)
            if os.path.isfile(p) and pdf_render.is_supported(p):
                inputs.append(p)
    elif os.path.isfile(args.input):
        inputs.append(args.input)
    else:
        print(f"ERROR: input not found: {args.input}", file=sys.stderr)
        return 2

    if not inputs:
        print(f"ERROR: no supported files (.pdf/.png/.jpg...) in {args.input}",
              file=sys.stderr)
        return 2

    os.makedirs(args.output, exist_ok=True)
    summary_rows: list = []

    for path in inputs:
        try:
            process_file(path, args.output, engines, variants,
                         args.dpi, args.max_pages, summary_rows)
        except Exception as e:
            print(f"  FAILED {path}: {e}", file=sys.stderr)

    # Write summary CSV
    summary_path = os.path.join(args.output, "summary.csv")
    with open(summary_path, "w", newline="") as f:
        cols = ["file", "page", "variant", "engine", "word_count",
                "mean_confidence", "seconds", "error"]
        writer = csv.DictWriter(f, fieldnames=cols)
        writer.writeheader()
        writer.writerows(summary_rows)

    print(f"\nDone. Summary -> {summary_path}")
    print("Next: open summary.csv and the *_boxes.png files to judge quality.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
