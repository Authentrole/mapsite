"""Preprocessing variants for OCR feasibility testing.

Engineering / GIS maps are hard for OCR because of:
  - dark backgrounds with light text (the "LOW TENSION" style)
  - tiny and rotated labels along roads
  - dense line work competing with characters

We don't know in advance which preprocessing helps, so Phase 0 runs several
variants and lets you compare. Each variant takes an RGB uint8 array and
returns an RGB uint8 array.
"""
from __future__ import annotations

from typing import Callable, Dict

import cv2
import numpy as np


def _to_gray(rgb: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)


def _to_rgb(gray: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)


def variant_raw(rgb: np.ndarray) -> np.ndarray:
    """No changes. Baseline."""
    return rgb


def variant_gray_contrast(rgb: np.ndarray) -> np.ndarray:
    """Grayscale + CLAHE contrast boost. Helps faint labels."""
    gray = _to_gray(rgb)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    out = clahe.apply(gray)
    return _to_rgb(out)


def variant_inverted(rgb: np.ndarray) -> np.ndarray:
    """Invert, so light-text-on-dark becomes dark-text-on-light.

    Only inverts when the image is predominantly dark; otherwise returns the
    grayscale image unchanged so this variant is safe to always run.
    """
    gray = _to_gray(rgb)
    if gray.mean() < 110:  # mostly dark background
        gray = cv2.bitwise_not(gray)
    return _to_rgb(gray)


def variant_upscaled(rgb: np.ndarray) -> np.ndarray:
    """2x upscale + gray + light denoise. Helps very small labels."""
    gray = _to_gray(rgb)
    up = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    up = cv2.fastNlMeansDenoising(up, h=7)
    return _to_rgb(up)


def variant_binarized(rgb: np.ndarray) -> np.ndarray:
    """Adaptive threshold to crisp black/white. Helps Tesseract especially."""
    gray = _to_gray(rgb)
    if gray.mean() < 110:
        gray = cv2.bitwise_not(gray)
    binar = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15
    )
    return _to_rgb(binar)


# Name -> function. Order is the order they run in.
VARIANTS: Dict[str, Callable[[np.ndarray], np.ndarray]] = {
    "raw": variant_raw,
    "gray_contrast": variant_gray_contrast,
    "inverted": variant_inverted,
    "upscaled": variant_upscaled,
    "binarized": variant_binarized,
}


def get_variants(names: list[str] | None = None) -> Dict[str, Callable[[np.ndarray], np.ndarray]]:
    if not names:
        return dict(VARIANTS)
    out = {}
    for n in names:
        if n not in VARIANTS:
            raise ValueError(f"Unknown variant '{n}'. Available: {list(VARIANTS)}")
        out[n] = VARIANTS[n]
    return out
