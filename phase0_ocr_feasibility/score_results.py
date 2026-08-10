#!/usr/bin/env python3
"""Score Phase 0 OCR output into a hit-rate per engine/variant.

Turns the eyeballing into a number so the open-source-vs-cloud-OCR decision is
based on data. Two scoring modes, used together when available:

1. Pseudo-ground-truth from the PDF's embedded text layer.
   Most of these map PDFs carry a real (vector or previously-OCR'd) text layer.
   We extract those tokens and measure what fraction each OCR run recovered
   (token recall). No manual labelling needed. Pages without a usable text
   layer (pure scans) are reported with gt_tokens=0 so you know recall is N/A.

2. Known-terms hit-rate (optional): pass --terms terms.txt with one street
   name / plate ID per line; we report how many appear in each OCR dump.

Usage:
    python score_results.py --input ./samples --results ./results
    python score_results.py --results ./results --terms known_terms.txt
"""
from __future__ import annotations

import argparse
import csv
import glob
import os
import re
from collections import defaultdict

TAG_RE = re.compile(
    r"^(?P<base>.+)_p(?P<page>\d+)_"
    r"(?P<variant>raw|gray_contrast|inverted|upscaled|binarized)_"
    r"(?P<engine>rapidocr|tesseract|paddle)$"
)

TOKEN_RE = re.compile(r"[A-Za-z0-9]+")


def norm_tokens(text: str, min_len: int = 3) -> set[str]:
    """Lowercased alphanumeric tokens of at least min_len chars."""
    return {t.lower() for t in TOKEN_RE.findall(text) if len(t) >= min_len}


def build_pseudo_gt(input_dir: str) -> dict[tuple[str, int], set[str]]:
    """(base, page) -> set of ground-truth tokens from the PDF text layer."""
    gt: dict[tuple[str, int], set[str]] = {}
    if not input_dir or not os.path.isdir(input_dir):
        return gt
    try:
        import fitz  # PyMuPDF
    except Exception:
        print("  (PyMuPDF not available; skipping pseudo-ground-truth)")
        return gt
    for path in sorted(glob.glob(os.path.join(input_dir, "*.pdf"))):
        base = os.path.splitext(os.path.basename(path))[0]
        try:
            doc = fitz.open(path)
            for i, page in enumerate(doc):
                gt[(base, i + 1)] = norm_tokens(page.get_text("text"))
            doc.close()
        except Exception as e:
            print(f"  GT extract failed for {base}: {e}")
    return gt


def load_terms(path: str | None) -> list[str]:
    if not path or not os.path.isfile(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [ln.strip() for ln in f if ln.strip()]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Score Phase 0 OCR output")
    ap.add_argument("--results", default="./results",
                    help="directory of *.txt OCR dumps (default ./results)")
    ap.add_argument("--input", default="./samples",
                    help="source PDFs for pseudo-ground-truth (default ./samples)")
    ap.add_argument("--terms", default=None,
                    help="optional file: one known street name / plate ID per line")
    ap.add_argument("--min-len", type=int, default=3,
                    help="minimum token length to score (default 3)")
    args = ap.parse_args(argv)

    gt = build_pseudo_gt(args.input)
    terms = load_terms(args.terms)
    terms_norm = [(t, norm_tokens(t, args.min_len)) for t in terms]

    rows = []
    for txt_path in sorted(glob.glob(os.path.join(args.results, "*.txt"))):
        tag = os.path.splitext(os.path.basename(txt_path))[0]
        m = TAG_RE.match(tag)
        if not m:
            continue
        base = m.group("base")
        page = int(m.group("page"))
        variant = m.group("variant")
        engine = m.group("engine")

        with open(txt_path, encoding="utf-8") as f:
            ocr_text = f.read()
        ocr_tokens = norm_tokens(ocr_text, args.min_len)

        gt_tokens = gt.get((base, page), set())
        if gt_tokens:
            hit = len(gt_tokens & ocr_tokens)
            recall = round(hit / len(gt_tokens), 4)
        else:
            hit = 0
            recall = ""  # N/A: no text layer to compare against

        # Known-terms: a term counts as hit if all its tokens appear in OCR.
        term_hits = 0
        for _t, toks in terms_norm:
            if toks and toks <= ocr_tokens:
                term_hits += 1

        rows.append({
            "file": base, "page": page, "variant": variant, "engine": engine,
            "ocr_tokens": len(ocr_tokens),
            "gt_tokens": len(gt_tokens),
            "gt_hits": hit,
            "gt_recall": recall,
            "term_hits": term_hits if terms else "",
            "term_total": len(terms) if terms else "",
        })

    if not rows:
        print(f"No scorable OCR .txt dumps found in {args.results}. "
              f"Run run_ocr_test.py first.")
        return 1

    out_path = os.path.join(args.results, "score_summary.csv")
    cols = ["file", "page", "variant", "engine", "ocr_tokens", "gt_tokens",
            "gt_hits", "gt_recall", "term_hits", "term_total"]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)

    # Console summary: best variant per (file, engine) by recall then token count.
    print(f"\nScored {len(rows)} OCR runs -> {out_path}\n")
    best: dict[tuple[str, str], dict] = {}
    for r in rows:
        key = (r["file"], r["engine"])
        score = (r["gt_recall"] if r["gt_recall"] != "" else -1, r["ocr_tokens"])
        if key not in best or score > (
            best[key]["gt_recall"] if best[key]["gt_recall"] != "" else -1,
            best[key]["ocr_tokens"],
        ):
            best[key] = r

    print(f"{'file':30s} {'engine':9s} {'best variant':14s} "
          f"{'recall':>7s} {'gt':>6s} {'ocr':>6s}")
    print("-" * 80)
    for (file, engine), r in sorted(best.items()):
        rec = f"{r['gt_recall']*100:5.1f}%" if r["gt_recall"] != "" else "  N/A "
        print(f"{file:30s} {engine:9s} {r['variant']:14s} {rec:>7s} "
              f"{r['gt_tokens']:6d} {r['ocr_tokens']:6d}")

    # Aggregate recall by variant (across pages that have a text layer).
    by_variant = defaultdict(list)
    for r in rows:
        if r["gt_recall"] != "":
            by_variant[(r["engine"], r["variant"])].append(r["gt_recall"])
    if by_variant:
        print("\nMean pseudo-GT recall by engine/variant "
              "(text-layer pages only):")
        for (engine, variant), vals in sorted(by_variant.items()):
            print(f"  {engine:9s} {variant:14s} "
                  f"{sum(vals)/len(vals)*100:5.1f}%  (n={len(vals)})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
