#!/usr/bin/env python3
"""Characterize the 16503-2 PDFs to choose a representative OCR test sample.

For each PDF: page count, first-page pixel size @150dpi, mean brightness
(low => dark background), and embedded-text-layer char count (a real text
layer means OCR is unnecessary; image-only pages are the hard/interesting case).
"""
import csv
import glob
import os

import fitz  # PyMuPDF
import numpy as np

SRC = r"C:\Users\2444743\Downloads\16503-2"
OUT = os.path.join(os.path.dirname(__file__), "pdf_profile.csv")

rows = []
for path in sorted(glob.glob(os.path.join(SRC, "*.pdf"))):
    name = os.path.basename(path)
    try:
        doc = fitz.open(path)
        npages = doc.page_count
        page = doc[0]
        text_chars = len(page.get_text("text").strip())
        zoom = 150 / 72.0
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        gray = arr[:, :, :3].mean(axis=2)
        rows.append({
            "file": name,
            "size_mb": round(os.path.getsize(path) / 1e6, 2),
            "pages": npages,
            "w150": pix.width,
            "h150": pix.height,
            "mean_bright": round(float(gray.mean()), 1),
            "pct_dark": round(float((gray < 80).mean()) * 100, 1),
            "text_layer_chars": text_chars,
        })
        doc.close()
        print(f"{name:34s} pages={npages:3d} {pix.width}x{pix.height} "
              f"bright={gray.mean():5.1f} dark%={float((gray<80).mean())*100:5.1f} "
              f"textlayer={text_chars}")
    except Exception as e:
        print(f"{name:34s} ERROR {e}")
        rows.append({"file": name, "size_mb": "", "pages": "", "w150": "",
                     "h150": "", "mean_bright": "", "pct_dark": "",
                     "text_layer_chars": f"ERR:{e}"})

with open(OUT, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
print(f"\nProfile -> {OUT}")
