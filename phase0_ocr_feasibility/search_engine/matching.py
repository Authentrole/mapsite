"""Hardened fuzzy word matching -- pure Python, no new dependencies.

The original fuzzy fallback used difflib.get_close_matches on normalized
(alnum-only) tokens. That is a Ratcliff/Obershelp similarity ratio, which
scores purely on shared character runs -- it doesn't distinguish "these are
the same ID with one OCR error" from "these are two unrelated numbers that
happen to share several digits". Concretely: searching "M-22158" (OCR'd
elsewhere as "m.2215") fell back to fuzzy and correctly found the right
plate, but ALSO surfaced "22589" and "2258" from two completely unrelated
plates, purely because they share digit substrings.

This module fixes that with two changes:
  1. A composition prefilter: a candidate must share the query's
     alpha/digit "shape" (both contain a letter, or neither does) before an
     edit-distance is even computed. This alone rejects "2258" (all-digit)
     as a candidate for "m22158" (mixed alpha+digit) -- it isn't a plausible
     OCR variant of that ID.
  2. Real edit distance (Levenshtein) instead of a similarity ratio, with a
     length-proportional threshold, so the accepted edit budget scales with
     the length of the term instead of using one global cutoff.
"""
from __future__ import annotations


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    la, lb = len(a), len(b)
    if la == 0:
        return lb
    if lb == 0:
        return la
    prev = list(range(lb + 1))
    for i, ca in enumerate(a, 1):
        cur = [i] + [0] * lb
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
        prev = cur
    return prev[lb]


def _shape_compatible(a: str, b: str) -> bool:
    """Both must (or must not) contain a letter -- prevents a mixed
    alpha+digit ID from fuzzy-matching a pure-number token, e.g. keeps
    "m22158" from matching unrelated "2258"/"22589"."""
    return any(c.isalpha() for c in a) == any(c.isalpha() for c in b)


def is_fuzzy_match(term: str, candidate: str) -> tuple[bool, int]:
    """Return (matches, edit_distance). Distance is meaningless if matches
    is False (returned as a large sentinel)."""
    if not term or not candidate:
        return False, 999
    if not _shape_compatible(term, candidate):
        return False, 999
    max_len = max(len(term), len(candidate))
    if abs(len(term) - len(candidate)) > max(2, max_len // 3):
        return False, 999
    threshold = max(1, max_len // 4)  # allow ~25% of characters to differ
    d = levenshtein(term, candidate)
    if d > threshold:
        return False, 999
    return True, d


def fuzzy_candidates(term: str, vocab: list[str], limit: int = 5) -> list[tuple[str, int]]:
    """Return up to `limit` (candidate, edit_distance) pairs from vocab,
    sorted by distance ascending, that pass is_fuzzy_match against term."""
    scored = []
    for cand in vocab:
        ok, d = is_fuzzy_match(term, cand)
        if ok:
            scored.append((cand, d))
    scored.sort(key=lambda t: t[1])
    return scored[:limit]
