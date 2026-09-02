"""ChromaDB-backed local vector index for the eGIS Map Site AI Search engine.

Replaces the old SQLite index (plates / content_fts / word_positions /
embeddings tables). Each ingested plate page becomes one document in a
persistent Chroma collection: its extracted/OCR'd text is embedded via
Azure OpenAI (see azure_openai.py) and stored here alongside plate
metadata (region, utility, facility type, source PDF path, ...). Chroma
itself never computes an embedding -- ingest.py and server.py always pass
explicit vectors (embeddings= / query_embeddings=), so this module is
pure storage/retrieval, not an embedding provider.

There is no separate keyword/FTS index and no per-word bounding boxes:
search is nearest-neighbor cosine similarity over the page embeddings, and
crops are rendered as full-page thumbnails rather than highlighted word
boxes.
"""
from __future__ import annotations

import os

import chromadb
from chromadb.config import Settings

CHROMA_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")
COLLECTION_NAME = "plates"

_client = None
_collection = None


def _get_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path=CHROMA_DIR, settings=Settings(anonymized_telemetry=False)
        )
    return _client


def get_collection(reset: bool = False):
    """Return the persistent 'plates' collection, creating it if needed.

    reset=True drops and recreates it first (used by `ingest.py --reset`).
    """
    global _collection
    client = _get_client()
    if reset:
        try:
            client.delete_collection(COLLECTION_NAME)
        except Exception:
            pass
        _collection = None
    if _collection is None:
        # cosine space so similarity = 1 - distance is a clean 0..1 score
        _collection = client.get_or_create_collection(
            name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
        )
    return _collection


def doc_id(plate_id: str, page: int) -> str:
    return f"{plate_id}::p{page}"


def count() -> int:
    return get_collection().count()


def norm_id(s: str) -> str:
    """Alnum-only, lowercased form used to match a typed plate ID against
    an ingested one regardless of hyphens/spaces/case -- "10-AB", "10 ab",
    "10AB" all normalize to "10ab"."""
    return "".join(ch.lower() for ch in s if ch.isalnum())


_plate_id_index: dict[str, str] | None = None
_all_docs_cache: list[tuple[str, str, dict]] | None = None


def _load_plate_id_index() -> dict[str, str]:
    global _plate_id_index
    if _plate_id_index is None:
        got = get_collection().get(include=["metadatas"])
        ids = {m["plate_id"] for m in (got.get("metadatas") or [])}
        _plate_id_index = {norm_id(pid): pid for pid in ids}
    return _plate_id_index


def all_docs() -> list[tuple[str, str, dict]]:
    """Every ingested (id, document_text, metadata) tuple. This corpus is
    one row per PDF page -- small enough to load and cache in full, which
    lets search do a literal-text pass independent of embedding
    similarity (see server.py's literal_matches)."""
    global _all_docs_cache
    if _all_docs_cache is None:
        got = get_collection().get(include=["documents", "metadatas"])
        _all_docs_cache = list(zip(got["ids"], got["documents"], got["metadatas"]))
    return _all_docs_cache


def invalidate_caches() -> None:
    global _plate_id_index, _all_docs_cache
    _plate_id_index = None
    _all_docs_cache = None


def match_plate_id(term: str) -> str | None:
    """Return the ingested plate_id that `term` refers to, if it's an exact
    match once normalized (case/punctuation-insensitive) -- either the
    whole term (the common case: term IS the plate ID, e.g. "10-AB") or one
    whitespace-separated word within it (covers a raw, un-parsed sentence
    like "show me plate 10-AB" being passed through as a single term).
    None if no word in `term` names one specific ingested plate ID."""
    index = _load_plate_id_index()
    whole = index.get(norm_id(term))
    if whole:
        return whole
    for word in term.split():
        hit = index.get(norm_id(word))
        if hit:
            return hit
    return None


def get_by_plate_id(plate_id: str) -> list[dict]:
    """Exact lookup: metadata for every ingested page of this plate_id."""
    got = get_collection().get(where={"plate_id": plate_id})
    return got.get("metadatas") or []
