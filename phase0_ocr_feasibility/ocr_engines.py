"""OCR engine wrappers with a common interface.

Each engine returns a list of OcrWord:
    {text, confidence (0-1), bbox [x0, y0, x1, y1]}

Engines are optional. availability is auto-detected so the runner can skip
whatever isn't installed instead of crashing.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import List

import numpy as np


@dataclass
class OcrWord:
    text: str
    confidence: float          # 0.0 - 1.0
    bbox: List[float]          # [x0, y0, x1, y1]

    def to_dict(self) -> dict:
        return asdict(self)


# --------------------------------------------------------------------------
# Tesseract
# --------------------------------------------------------------------------
def tesseract_available() -> bool:
    try:
        import pytesseract  # noqa: F401
        from shutil import which
        # pytesseract needs the system binary; check both.
        return which("tesseract") is not None
    except Exception:
        return False


def run_tesseract(rgb: np.ndarray) -> List[OcrWord]:
    import pytesseract
    from pytesseract import Output

    # psm 11 = sparse text: good for scattered map labels.
    data = pytesseract.image_to_data(
        rgb, output_type=Output.DICT, config="--psm 11"
    )
    words: List[OcrWord] = []
    n = len(data["text"])
    for i in range(n):
        text = (data["text"][i] or "").strip()
        if not text:
            continue
        try:
            conf = float(data["conf"][i])
        except (ValueError, TypeError):
            conf = -1.0
        if conf < 0:
            continue
        x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
        words.append(OcrWord(text=text, confidence=conf / 100.0,
                             bbox=[float(x), float(y), float(x + w), float(y + h)]))
    return words


# --------------------------------------------------------------------------
# PaddleOCR (recommended for maps: detects rotated/angled text)
# --------------------------------------------------------------------------
_paddle_instance = None


def paddle_available() -> bool:
    try:
        import paddleocr  # noqa: F401
        return True
    except Exception:
        return False


def _get_paddle():
    global _paddle_instance
    if _paddle_instance is None:
        from paddleocr import PaddleOCR
        _paddle_instance = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    return _paddle_instance


def run_paddle(rgb: np.ndarray) -> List[OcrWord]:
    ocr = _get_paddle()
    # PaddleOCR expects BGR or a path; it accepts numpy arrays (RGB works fine).
    result = ocr.ocr(rgb, cls=True)
    words: List[OcrWord] = []
    if not result:
        return words
    # result is a list (per image); take first.
    page = result[0] if result and result[0] is not None else []
    for line in page:
        box, (text, conf) = line[0], line[1]
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        text = (text or "").strip()
        if not text:
            continue
        words.append(OcrWord(text=text, confidence=float(conf),
                             bbox=[float(min(xs)), float(min(ys)),
                                   float(max(xs)), float(max(ys))]))
    return words


# --------------------------------------------------------------------------
# RapidOCR (PP-OCR models exported to ONNX; bundled inside the wheel).
#
# Same detection/recognition models as PaddleOCR (good on rotated/angled map
# labels) but with no system binary and no runtime model download -- which is
# why it is the engine that actually installs on locked-down / offline boxes.
# --------------------------------------------------------------------------
_rapid_instance = None


def rapidocr_available() -> bool:
    try:
        import rapidocr_onnxruntime  # noqa: F401
        return True
    except Exception:
        try:
            import rapidocr  # noqa: F401  (newer unified package)
            return True
        except Exception:
            return False


def _get_rapid():
    global _rapid_instance
    if _rapid_instance is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
        except Exception:
            from rapidocr import RapidOCR
        _rapid_instance = RapidOCR()
    return _rapid_instance


def run_rapidocr(rgb: np.ndarray) -> List[OcrWord]:
    engine = _get_rapid()
    out = engine(rgb)
    # rapidocr-onnxruntime returns (result, elapse); newer rapidocr returns an
    # object exposing .boxes/.txts/.scores. Handle both.
    words: List[OcrWord] = []
    result = out[0] if isinstance(out, tuple) else out
    if result is None:
        return words
    if hasattr(result, "boxes"):  # unified rapidocr >= 2.x output object
        triples = zip(result.boxes or [], result.txts or [], result.scores or [])
    else:                          # list of [box, text, score]
        triples = ((r[0], r[1], r[2]) for r in result)
    for box, text, conf in triples:
        text = (text or "").strip()
        if not text:
            continue
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        words.append(OcrWord(text=text, confidence=float(conf),
                             bbox=[float(min(xs)), float(min(ys)),
                                   float(max(xs)), float(max(ys))]))
    return words


# --------------------------------------------------------------------------
# Registry
# --------------------------------------------------------------------------
ENGINES = {
    "tesseract": {"available": tesseract_available, "run": run_tesseract},
    "paddle": {"available": paddle_available, "run": run_paddle},
    "rapidocr": {"available": rapidocr_available, "run": run_rapidocr},
}


def available_engines() -> List[str]:
    return [name for name, e in ENGINES.items() if e["available"]()]


def run_engine(name: str, rgb: np.ndarray) -> List[OcrWord]:
    if name not in ENGINES:
        raise ValueError(f"Unknown engine '{name}'. Available: {list(ENGINES)}")
    return ENGINES[name]["run"](rgb)
