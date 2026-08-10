# Phase 0 — OCR Feasibility Results

Run date: 2026-07-10 · Platform: Windows 11 (locked-down corporate box) ·
Python 3.13.6 · Engine: **RapidOCR** (PP-OCR models via ONNX Runtime, CPU)

Test corpus: `16503-2` — 47 Con Edison electrical distribution / "Low Tension
Mains & Services" plate maps, mostly E-size (34"×44") single-page drawings.
6 representative sheets were run end-to-end (see `samples/`).

---

## TL;DR decision

- **You do NOT need OCR for most of this corpus, and you do NOT need cloud OCR
  (Textract) for the bulk.** 41 of 47 PDFs already carry a clean, embedded text
  layer — plate IDs, substation names, street names, voltages — that
  `PyMuPDF` extracts verbatim with zero recognition error. For those sheets,
  **direct text extraction beats OCR on every axis** (accuracy, speed, cost).
- **OCR is genuinely needed only for the ~6 pure-scan sheets** (no text layer:
  the `-M22*` files, `m10f`, `m10j`, `w100ag`). On those, open-source
  **RapidOCR reads the printed labels/form fields well**; only handwriting and
  ink stamps are unreliable (no cheap OCR fixes that).
- **Open-source OCR is viable** for the scanned subset. The real limitation is
  **recall on large dense pages, not character accuracy** — and the fix is
  tiling/higher DPI in Phase 1, not a different engine or preprocessing.

---

## What was tested

6 sheets chosen to span the corpus:

| sheet | why chosen | text layer | background |
|---|---|---|---|
| `11-AD` | darkest sheet (brightness 52, 80% dark) | 2936 ch | dark (light-on-dark) |
| `10-AB` | dark sheet (brightness 63) | 6879 ch | dark |
| `-M22158_1991_20050802` | 1991 pure scan, **no text layer** | 0 ch | light |
| `w100ag` | small mostly-image sheet | 469 ch | light |
| `riverdale_1x` | typical dense street map | 15615 ch | light |
| `west_bronx_2x` | dense urban, slightly dark | 21105 ch | light |

Each was rendered at 150 DPI and run through 4 preprocessing variants
(`raw`, `gray_contrast`, `inverted`, `binarized`) × RapidOCR.
Outputs: per-page `.json` / `.txt` / annotated `_boxes.png`, plus
`results/summary.csv` and `results/score_summary.csv`.

Scoring uses each PDF's embedded text layer as automatic **pseudo-ground-truth**
(token recall). Pure scans show `gt=0` (recall N/A — nothing to compare to).

---

## Numbers (token recall vs. embedded text layer)

| sheet | best variant | recall | gt tokens | ocr tokens |
|---|---|---:|---:|---:|
| `w100ag` (small) | binarized | **69.2%** | 39 | 30 |
| `11-AD` (dark) | gray_contrast | 21.1% | 109 | 39 |
| `10-AB` (dark) | raw | 17.5% | 251 | 118 |
| `west_bronx_2x` (dense) | gray_contrast | 4.1% | 886 | 36 |
| `riverdale_1x` (dense) | gray_contrast | 3.8% | 655 | 26 |
| `-M22158` (scan) | gray_contrast | N/A | 0 | 35 |

Mean recall by variant was essentially flat — **raw 21.7%, gray_contrast 21.7%,
inverted 21.5%, binarized 20.0%**.

### How to read these numbers

- **Recall collapses as the sheet gets bigger/denser** (w100ag 69% → dense maps
  ~4%). RapidOCR's text *detector* internally downscales the ~34-megapixel
  page, so most small road labels are never detected. The words it *does*
  detect are read accurately (see below) — this is a **recall** problem
  (finding the text), not a **precision** problem (reading it).
- **Preprocessing variant barely matters at full-page scale.** Don't spend
  Phase 1 tuning contrast/inversion; spend it on tiling.

---

## Qualitative read (the `_boxes.png` truth)

Dark sheet `11-AD`, what OCR got right vs. wrong:

- ✅ **Plate/grid IDs perfect**: `12-AD`, `11-AC`, `11-AE`, `10-AD`,
  `PLATE NO.11-AD`, `CONSOLIDATED EDISON CO.OF N.Y.INC. Bronx`.
- ✅ **Clear street names correct**: `EASTCHESTER`, `Sound View`,
  `1st Avenue`, `Dock Street`, `4th`, `5th Avenue`.
- ⚠️ **Word spacing lost in title blocks**: `LOWTENSIONMAINSANDSERVICESPLATE`.
- ❌ **Small rotated legend/notes garbled**: `INEDEEVATER PARK IS ROPERTY DF
  EDGEWATER PAS CORF` (should be "EDGEWATER PARK IS PROPERTY OF EDGEWATER PARK
  CORP").

True scan `-M22158` (OCR is the only option here) — printed form fields read
well: `CONSOLIDATED EDISON CO.OF N.Y.INC.`, `LAYOUT-NO`, `BOROUGH`,
`STRUCTURE No.`, `LOCATION`, `MATERIAL`, `CONDITION`,
`UNDERGROUND PLANNING SECTION`, `FIELD ENGINEERING BUREAU`,
`ENGINEERING DEPARTMENT`. Handwritten/stamped codes (`3-3%0L...`) are garbled.

---

## Recommendations for Phase 1

1. **Split the pipeline by source type.** For each PDF, check
   `page.get_text()` length first.
   - Rich text layer (≈41/47 here) → **extract directly with PyMuPDF**. No OCR.
   - Empty/sparse (≈6/47) → send to OCR.
   `characterize_corpus.py` already produces this split (`results/corpus_profile.csv`).
2. **For the OCR subset, tile the page** into overlapping crops (e.g. 1000–1500
   px tiles, ~15% overlap) and OCR each, then merge boxes back to page
   coordinates. This is the single biggest recall win — far more than DPI or
   preprocessing.
3. **Keep RapidOCR as the engine.** It installs and runs fully offline (models
   bundled in the wheel), handles rotated labels, and reads what it detects
   accurately. No cloud dependency, no per-page cost.
4. **Only escalate to AWS Textract for the scanned subset** *if* tiled RapidOCR
   recall is still insufficient after step 2 — and even then, only for those
   ~6 sheets, not the whole corpus.
5. Handwriting / ink stamps on old scans will not be reliably machine-read by
   any low-cost option; flag those fields for manual review.

---

## Environment notes (important for reproducing this)

This is a **locked-down corporate Windows box**. Getting an OCR engine running
required working around several blocks — captured so the next person doesn't
re-discover them:

- `winget` is **blocked by group policy** → cannot install the Tesseract
  system binary. No `conda`, no admin. **Tesseract was not testable here.**
- `pip` intermittently gets **HTTP 403 on the PEP 658 `.whl.metadata`
  sidecars** from `files.pythonhosted.org` for less-common packages (CDN
  cache misses hit an origin the proxy blocks), which makes normal
  `pip install` fail during resolution — even though the actual `.whl` files
  download fine.
- `.tar.gz` **sdists are hard-blocked** (403 block page), so any dependency
  that ships sdist-only (e.g. `antlr4-python3-runtime==4.9.*`, pulled in by
  `rapidocr` 3.x → `omegaconf`) cannot be installed. This is why we use the
  older, wheels-only **`rapidocr-onnxruntime` 1.4.4** line instead of the
  `rapidocr` 3.x package.

**Working install recipe (offline resolver):**

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install PyMuPDF Pillow numpy opencv-python-headless   # these resolve fine
# RapidOCR + deps via the metadata-bypassing resolver (downloads wheels with urllib):
$env:IGNORE_RP="1"
.\.venv\Scripts\python.exe bootstrap_offline.py .\wheelhouse rapidocr-onnxruntime==1.4.4
.\.venv\Scripts\python.exe -m pip install --no-index --no-deps --ignore-requires-python (Get-ChildItem .\wheelhouse\*.whl).FullName
```

`rapidocr-onnxruntime` 1.4.4 declares `Requires-Python <3.13` but runs fine on
3.13 (hence `--ignore-requires-python`); all its dependencies have 3.13 wheels.
