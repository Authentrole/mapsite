"""Metadata classification for map plates.

There is no per-file metadata manifest anywhere in either eGIS Maps repo
(egis-maps-api / egis-maps-app) -- confirmed by grepping both trees for real
sample filenames. Electric.json/Gas.json/Steam.json are navigation menus
(region -> facility-type -> a live UNC-share query), not a filename lookup
table. In production, region/utility/facility come from wherever the
Document Processor enumerates the plate source (TDD Section 7.2); this
module does not replace that.

What this module DOES do: classify each ingested plate using the REAL
region short-codes and facility-type vocabulary from the eGIS Map Site's own
taxonomy (egis-maps-app/src/assets/json/Regions.json, Electric.json) via
filename/content heuristics, so the placeholder is a labeled best-effort
guess in the real vocabulary instead of a blind "Unknown". Every guess
carries a confidence and is tagged metadata_source="heuristic" so it is
never mistaken for authoritative data.
"""
from __future__ import annotations

import re

# Real short-codes, from egis-maps-app/src/assets/json/Regions.json.
REGION_CODES = {
    "M": "Manhattan", "Q": "Queens", "W": "Westchester",
    "X": "Bronx", "B": "Brooklyn", "R": "Staten_Island",
}

# Real facility-type vocabulary, from Electric.json / Gas.json / Steam.json.
FACILITY_MS_PLATE = "M&S Plate"
FACILITY_FEEDER_OR_NETWORK = "Feeder/Network Map"
FACILITY_STRUCTURE_SKETCH = "Structure Layout Sketch"
FACILITY_SUBSTATION_AREA = "Composite/Substation Area Map"
FACILITY_GAS_REGULATOR = "Gas Regulator Plate"
FACILITY_STEAM_MAINS = "Steam Mains and Service Plate"
FACILITY_UNKNOWN = "Unknown"

_BRONX_HINT = re.compile(r'(?:^|[_\-])bronx(?:[_\-]|$)', re.I)
_GRID_X_SUFFIX = re.compile(r'\d+x(?:[_.]|$)', re.I)    # e.g. "_2x", "7x" (Bronx grid convention)
_GRID_W_SUFFIX = re.compile(r'\d+w(?:[_.]|$)', re.I)    # e.g. "_1w_9w", "20w" (Westchester grid convention)
_MS_PLATE_PATTERN = re.compile(r'^\d{1,3}-[A-Z]{1,2}$', re.I)   # "10-A", "11-AD"
_STRUCTURE_PATTERN = re.compile(r'^-?M\d{3,6}', re.I)           # "M-22158", "M22144"
_SUBSTATION_AREA_HINT = re.compile(r'13kv|area$', re.I)

# Below this hit-count/density, a utility keyword is treated as an incidental
# cross-reference (e.g. an Electric plate noting a nearby gas main) rather
# than evidence the plate itself belongs to that utility. Calibrated against
# this corpus: true Gas Regulator plates run ~1.5-2.4% gas-word density
# (10 hits / ~600 words); Electric plates with one incidental mention run
# ~0.03% (1 hit / ~3800 words).
_GAS_RE = re.compile(r'\bGAS\b|\bREGULATOR\b', re.I)
_STEAM_RE = re.compile(r'\bSTEAM\b', re.I)
_UTILITY_MIN_HITS = 5
_UTILITY_MIN_DENSITY = 0.005


def classify_utility(content: str) -> tuple[str, float]:
    """Return (utility, confidence). Content-frequency based, not filename
    based -- filenames in this corpus carry no gas/steam signal at all."""
    words = content.split()
    total = max(1, len(words))
    gas_hits = len(_GAS_RE.findall(content))
    steam_hits = len(_STEAM_RE.findall(content))
    if gas_hits >= _UTILITY_MIN_HITS and gas_hits / total >= _UTILITY_MIN_DENSITY:
        return "Gas", 0.8
    if steam_hits >= _UTILITY_MIN_HITS and steam_hits / total >= _UTILITY_MIN_DENSITY:
        return "Steam", 0.8
    return "Electric", 0.6   # default: matches the observed corpus overwhelmingly


def classify_region(filename_stem: str) -> tuple[str, str, float]:
    """Return (region_name, short_code, confidence). Filename-suffix
    heuristic only -- there is no per-file region manifest anywhere in
    either eGIS Maps repo (verified by grep)."""
    if _BRONX_HINT.search(filename_stem) or _GRID_X_SUFFIX.search(filename_stem):
        return "Bronx", "X", 0.7
    if _GRID_W_SUFFIX.search(filename_stem):
        return "Westchester", "W", 0.6
    return "Unknown", "", 0.0


def classify_facility_type(filename_stem: str, utility: str) -> tuple[str, float]:
    if utility == "Gas":
        return FACILITY_GAS_REGULATOR, 0.6
    if utility == "Steam":
        return FACILITY_STEAM_MAINS, 0.5
    if _STRUCTURE_PATTERN.match(filename_stem):
        return FACILITY_STRUCTURE_SKETCH, 0.8
    if _MS_PLATE_PATTERN.match(filename_stem):
        return FACILITY_MS_PLATE, 0.6
    if _GRID_X_SUFFIX.search(filename_stem) or _GRID_W_SUFFIX.search(filename_stem):
        return FACILITY_FEEDER_OR_NETWORK, 0.5
    if _SUBSTATION_AREA_HINT.search(filename_stem):
        return FACILITY_SUBSTATION_AREA, 0.4
    return FACILITY_UNKNOWN, 0.0


def guess_metadata(filename_stem: str, content: str) -> dict:
    utility, u_conf = classify_utility(content)
    region, region_code, r_conf = classify_region(filename_stem)
    facility, f_conf = classify_facility_type(filename_stem, utility)
    return {
        "region": region, "region_code": region_code, "utility": utility,
        "facility_type": facility,
        "metadata_source": "heuristic:filename+content",
        "metadata_confidence": round((u_conf + r_conf + f_conf) / 3, 2),
    }
