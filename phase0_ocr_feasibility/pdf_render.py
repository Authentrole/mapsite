"""PDF -> page image rendering using PyMuPDF (fitz).

Kept intentionally small: given a PDF path and a DPI, yield one numpy RGB
array per page. Also supports being handed an image file directly so the
same pipeline works for PDFs and loose PNG/JPG samples.
"""
from __future__ import annotations

import os
from typing import Iterator, Tuple

import numpy as np

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"}
PDF_EXTS = {".pdf"}


def is_supported(path: str) -> bool:
    ext = os.path.splitext(path)[1].lower()
    return ext in IMAGE_EXTS or ext in PDF_EXTS


def render_pages(path: str, dpi: int = 300, max_pages: int | None = None) -> Iterator[Tuple[int, np.ndarray]]:
    """Yield (page_number, rgb_array) for each page.

    page_number is 1-indexed. For image inputs, yields a single page (1).
    """
    ext = os.path.splitext(path)[1].lower()

    if ext in IMAGE_EXTS:
        from PIL import Image

        with Image.open(path) as im:
            arr = np.array(im.convert("RGB"))
        yield 1, arr
        return

    if ext in PDF_EXTS:
        import fitz  # PyMuPDF

        # 72 is the PDF's native point-per-inch; scale to reach target dpi.
        zoom = dpi / 72.0
        matrix = fitz.Matrix(zoom, zoom)

        doc = fitz.open(path)
        try:
            for i, page in enumerate(doc):
                if max_pages is not None and i >= max_pages:
                    break
                pix = page.get_pixmap(matrix=matrix, alpha=False)
                arr = np.frombuffer(pix.samples, dtype=np.uint8)
                arr = arr.reshape(pix.height, pix.width, pix.n)
                if pix.n == 4:  # RGBA -> RGB
                    arr = arr[:, :, :3]
                yield i + 1, np.ascontiguousarray(arr)
        finally:
            doc.close()
        return

    raise ValueError(f"Unsupported file type: {path}")
