"""Gemini embedding layer for semantic (meaning-based) search over map plates.

Each ingested plate page already has its OCR/extracted text sitting in
content_fts (see ingest.py). This module turns that text into vectors with
Gemini's embedding model, stores them in the `embeddings` table, and answers
"which pages are semantically closest to this query" via cosine similarity
over an in-memory copy of the vectors.

Environment:
    GEMINI_API_KEY          — reused from ai_search.py's configuration
    GEMINI_EMBEDDING_MODEL  — defaults to "gemini-embedding-2"
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

import numpy as np

import db
import ai_search as ai_search_mod

GEMINI_API_KEY = ai_search_mod.GEMINI_API_KEY
EMBEDDING_MODEL = os.environ.get("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2")
EMBED_URL_SINGLE = f"https://generativelanguage.googleapis.com/v1beta/models/{EMBEDDING_MODEL}:embedContent"
EMBED_URL_BATCH = f"https://generativelanguage.googleapis.com/v1beta/models/{EMBEDDING_MODEL}:batchEmbedContents"

MAX_CHARS = 8000  # stay well under the model's per-request input limit


MAX_RETRIES = 5
RETRY_BASE_DELAY_S = 8  # free-tier embedding quota is RPM-limited; back off and retry


def _post(url: str, payload: dict) -> dict:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    data = json.dumps(payload).encode("utf-8")

    for attempt in range(MAX_RETRIES):
        req = urllib.request.Request(
            f"{url}?key={GEMINI_API_KEY}", data=data,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            if e.code == 429 and attempt < MAX_RETRIES - 1:
                delay = RETRY_BASE_DELAY_S * (2 ** attempt)
                print(f"  rate limited (429), retrying in {delay}s...")
                time.sleep(delay)
                continue
            raise RuntimeError(f"Gemini embedding API error {e.code}: {err_body[:300]}")

    raise RuntimeError("Gemini embedding API: exhausted retries")


def embed_text(text: str) -> list[float]:
    """Embed a single piece of text (typically a search query)."""
    body = {"content": {"parts": [{"text": text[:MAX_CHARS]}]}}
    result = _post(EMBED_URL_SINGLE, body)
    return result["embedding"]["values"]


def embed_texts(texts: list[str], chunk_size: int = 5, delay_between_s: float = 2.0) -> list[list[float]]:
    """Embed many texts via batchEmbedContents, chunked to stay under
    per-request payload limits, with a small delay between chunks to stay
    under the free-tier requests-per-minute quota."""
    vectors: list[list[float]] = []
    for i in range(0, len(texts), chunk_size):
        chunk = texts[i:i + chunk_size]
        body = {
            "requests": [
                {
                    "model": f"models/{EMBEDDING_MODEL}",
                    "content": {"parts": [{"text": t[:MAX_CHARS]}]},
                }
                for t in chunk
            ]
        }
        result = _post(EMBED_URL_BATCH, body)
        vectors.extend(e["values"] for e in result["embeddings"])
        if i + chunk_size < len(texts):
            time.sleep(delay_between_s)
    return vectors


def is_available() -> bool:
    return bool(GEMINI_API_KEY)


def indexed_count() -> int:
    conn = db.connect()
    try:
        return conn.execute("SELECT COUNT(*) AS n FROM embeddings").fetchone()["n"]
    finally:
        conn.close()


def build_index(reset: bool = False) -> int:
    """Compute and store embeddings for every ingested plate page that
    doesn't already have one (or all of them, if reset=True).

    Returns the number of pages embedded in this run.
    """
    conn = db.connect()
    try:
        if reset:
            conn.execute("DELETE FROM embeddings")
            conn.commit()

        rows = conn.execute("SELECT plate_id, page, content FROM content_fts").fetchall()
        if not reset:
            done = {
                (r["plate_id"], r["page"])
                for r in conn.execute("SELECT plate_id, page FROM embeddings").fetchall()
            }
            rows = [r for r in rows if (r["plate_id"], r["page"]) not in done]

        if not rows:
            return 0

        chunk_size = 5
        embedded = 0
        for i in range(0, len(rows), chunk_size):
            chunk = rows[i:i + chunk_size]
            texts = [r["content"] or "" for r in chunk]
            vectors = embed_texts(texts, chunk_size=chunk_size)
            for row, vec in zip(chunk, vectors):
                conn.execute(
                    "INSERT OR REPLACE INTO embeddings (plate_id, page, model, dim, vector_json) "
                    "VALUES (?,?,?,?,?)",
                    (row["plate_id"], row["page"], EMBEDDING_MODEL, len(vec), json.dumps(vec)),
                )
            conn.commit()
            embedded += len(chunk)
            print(f"  embedded {embedded}/{len(rows)} page(s)...")

        invalidate_cache()
        return embedded
    finally:
        conn.close()


_cache: dict | None = None


def _load_cache() -> dict:
    global _cache
    if _cache is not None:
        return _cache
    conn = db.connect()
    try:
        rows = conn.execute("SELECT plate_id, page, vector_json FROM embeddings").fetchall()
    finally:
        conn.close()

    keys = [(r["plate_id"], r["page"]) for r in rows]
    if rows:
        matrix = np.array([json.loads(r["vector_json"]) for r in rows], dtype=np.float32)
        norms = np.linalg.norm(matrix, axis=1)
    else:
        matrix = np.zeros((0, 0), dtype=np.float32)
        norms = np.zeros((0,), dtype=np.float32)

    _cache = {"keys": keys, "matrix": matrix, "norms": norms}
    return _cache


def invalidate_cache() -> None:
    global _cache
    _cache = None


def search_semantic(query: str, top_k: int = 25) -> list[dict]:
    """Rank ingested plate pages by cosine similarity to the query embedding."""
    cache = _load_cache()
    if not cache["keys"]:
        return []

    qvec = np.array(embed_text(query), dtype=np.float32)
    qnorm = np.linalg.norm(qvec)
    if qnorm == 0:
        return []

    sims = (cache["matrix"] @ qvec) / (cache["norms"] * qnorm + 1e-8)
    order = np.argsort(-sims)[:top_k]
    return [
        {
            "plateId": cache["keys"][i][0],
            "page": cache["keys"][i][1],
            "similarity": float(sims[i]),
        }
        for i in order
    ]
