# Phase 0 — OCR Feasibility Kit

Goal: quickly find out whether OCR can reliably read the baked-in text
(street names, plate IDs, grid labels) from your engineering / GIS map PDFs.

This is a **decision tool**, not the final product. Run it on your 3–5 ugliest
maps (especially dark-background ones). The output tells you whether open-source
OCR is good enough or whether you need cloud OCR (AWS Textract / Google DocAI).

---

## What it does

For each input PDF (or image):
1. Renders every page to a high-DPI PNG (PyMuPDF).
2. Applies preprocessing variants (raw, grayscale+contrast, inverted, upscaled).
3. Runs OCR with whichever engines are installed (Tesseract and/or PaddleOCR).
4. Writes, per page:
   - extracted words + confidence + bounding boxes (`.json`)
   - a flat text dump (`.txt`)
   - an annotated image with detected boxes drawn (`.png`)
5. Writes a top-level `summary.csv` so you can compare engines/variants at a glance.

---

## Setup

```bash
cd phase0_ocr_feasibility
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### System dependencies

- **PyMuPDF** installs via pip (no system dep) — used for PDF rendering.
- **Tesseract** (optional engine) needs the system binary:
  - Ubuntu/Debian: `sudo apt-get install -y tesseract-ocr`
  - macOS: `brew install tesseract`
- **PaddleOCR** (optional engine, recommended for maps) installs via pip
  (`paddleocr`, `paddlepaddle`). First run downloads models.

You do NOT need both engines. The script auto-detects what's available and
skips the rest. For a first smoke test, Tesseract alone is fine; for real map
labels, use **RapidOCR** (`rapidocr-onnxruntime`) — it bundles the PP-OCR
models in the wheel (no system binary, no runtime download) and is what this
kit was actually validated with. See `RESULTS.md`.

### Windows / locked-down or offline machines

On restricted corporate boxes `winget` may be policy-blocked (no Tesseract
binary) and `pip` may 403 on package metadata. Use the bundled offline resolver
and see `RESULTS.md` → "Environment notes" for the full working recipe:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install PyMuPDF Pillow numpy opencv-python-headless
$env:IGNORE_RP="1"
.\.venv\Scripts\python.exe bootstrap_offline.py .\wheelhouse rapidocr-onnxruntime==1.4.4
.\.venv\Scripts\python.exe -m pip install --no-index --no-deps --ignore-requires-python (Get-ChildItem .\wheelhouse\*.whl).FullName
python run_ocr_test.py --input .\samples --output .\results --engines rapidocr --variants raw gray_contrast inverted binarized --dpi 150
python score_results.py --input .\samples --results .\results
```

---

## Usage

Put a few sample PDFs in `./samples/` then:

```bash
# Run on everything in ./samples with all available engines
python run_ocr_test.py --input ./samples --output ./results

# Only Tesseract, first 2 pages per PDF
python run_ocr_test.py --input ./samples --engines tesseract --max-pages 2

# Higher DPI for tiny labels (slower, more accurate)
python run_ocr_test.py --input ./samples --dpi 400

# A single file
python run_ocr_test.py --input ./samples/map1.pdf
```

---

## Reading the results

- Open `results/summary.csv` — compare `word_count` and `mean_confidence`
  across engines and preprocessing variants for each page.
- Open the annotated `*_boxes.png` images — this is the real test: are street
  names actually being detected and boxed correctly?
- Skim the `*.txt` dumps for whether names like "Cross Bronx Expressway" or
  plate IDs like "1W02" come out intact.

### Decision guide

- Names mostly correct on your hardest (dark) maps → **open-source OCR is viable**,
  proceed to Phase 1 with PaddleOCR.
- Garbled / missing on dark or rotated labels even after the `inverted` and
  `upscaled` variants → **plan for cloud OCR** (AWS Textract fits your infra).

---

## Files

- `run_ocr_test.py` — CLI entry point / orchestration.
- `pdf_render.py`   — PDF → page images (PyMuPDF).
- `preprocess.py`   — preprocessing variants (OpenCV/Pillow).
- `ocr_engines.py`  — RapidOCR + Tesseract + PaddleOCR wrappers (common interface).
- `score_results.py` — turns OCR dumps into a token-recall number, scored
  against each PDF's embedded text layer (auto ground-truth) and/or a
  `--terms` list of known street names / plate IDs.
- `characterize_corpus.py` — profiles a folder of PDFs (page size, brightness,
  text-layer size) to pick samples and to decide extract-vs-OCR per file.
- `bootstrap_offline.py` — offline wheel resolver for locked-down networks
  (downloads a wheel closure via urllib, bypassing pip's blocked metadata API).
- `requirements.txt`
- `RESULTS.md` — findings + decision from the Phase 0 run on the `16503-2` maps.
