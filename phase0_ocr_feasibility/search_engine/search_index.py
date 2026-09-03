"""Azure AI Search-backed vector index for the eGIS Map Site AI Search engine.

Replaces vectordb.py (ChromaDB). Each ingested plate page becomes one
document in a dedicated Azure AI Search index -- extracted/OCR'd text,
its Azure OpenAI embedding vector, and plate metadata all live together,
using the exact same field names ingest.py/server.py already used with
Chroma so the business logic in either file barely changes -- only how
documents get stored/retrieved does.

A dedicated index (AZURE_SEARCH_INDEX_NAME) is created here; the several
pre-existing indexes on this same Azure AI Search service (egis_documents_index
etc., serving an unrelated older system) are never touched.

Environment (see search_engine/.env, loaded automatically -- never
commit real values):
    AZURE_SEARCH_ENDPOINT
    AZURE_SEARCH_API_KEY
    AZURE_SEARCH_INDEX_NAME
"""
from __future__ import annotations

import os
import re
import time

from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import ResourceNotFoundError
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    HnswAlgorithmConfiguration,
    HnswParameters,
    SearchableField,
    SearchField,
    SearchFieldDataType,
    SearchIndex,
    SimpleField,
    VectorSearch,
    VectorSearchAlgorithmMetric,
    VectorSearchProfile,
)
from azure.search.documents.models import VectorizedQuery
from dotenv import load_dotenv

load_dotenv()

AZURE_SEARCH_ENDPOINT = os.environ.get("AZURE_SEARCH_ENDPOINT", "")
AZURE_SEARCH_API_KEY = os.environ.get("AZURE_SEARCH_API_KEY", "")
AZURE_SEARCH_INDEX_NAME = os.environ.get("AZURE_SEARCH_INDEX_NAME", "egis-mapsite-electric-index")

EMBEDDING_DIMENSIONS = 1536  # text-embedding-3-small -- must match azure_openai's embedding deployment
VECTOR_PROFILE_NAME = "vector-profile"
HNSW_ALGORITHM_NAME = "hnsw-cosine"
PAGE_SIZE = 1000  # Azure Search's per-request max for listing/paging

# Index deletion and the document count are both asynchronous on the
# service side -- see _delete_index_and_wait() and count() for why these
# waits exist rather than trusting the first value the service returns.
INDEX_DELETE_POLL_SECONDS = 1.0
INDEX_DELETE_TIMEOUT_SECONDS = 120.0
COUNT_SETTLE_POLL_SECONDS = 2.0

_index_client: SearchIndexClient | None = None
_search_client: SearchClient | None = None

# Azure Search document keys only allow letters, digits, underscore, dash,
# and equal sign -- plate filenames in this corpus include spaces and other
# characters (e.g. "-M22144-1_20050802 1.pdf"), so sanitize before using as
# a key. The real, unsanitized name lives in the plate_id field regardless.
_UNSAFE_KEY_RE = re.compile(r"[^A-Za-z0-9_\-=]")


def is_available() -> bool:
    return bool(AZURE_SEARCH_ENDPOINT) and bool(AZURE_SEARCH_API_KEY)


def _credential() -> AzureKeyCredential:
    return AzureKeyCredential(AZURE_SEARCH_API_KEY)


def doc_id(plate_id: str, page: int) -> str:
    safe = _UNSAFE_KEY_RE.sub("_", plate_id)
    return f"{safe}_p{page}"


def norm_id(s: str) -> str:
    return "".join(ch.lower() for ch in s if ch.isalnum())


def _get_index_client() -> SearchIndexClient:
    global _index_client
    if _index_client is None:
        if not is_available():
            raise RuntimeError("AZURE_SEARCH_ENDPOINT / AZURE_SEARCH_API_KEY are not configured")
        _index_client = SearchIndexClient(AZURE_SEARCH_ENDPOINT, _credential())
    return _index_client


def get_search_client() -> SearchClient:
    global _search_client
    if _search_client is None:
        if not is_available():
            raise RuntimeError("AZURE_SEARCH_ENDPOINT / AZURE_SEARCH_API_KEY are not configured")
        _search_client = SearchClient(AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_INDEX_NAME, _credential())
    return _search_client


def _build_index_definition() -> SearchIndex:
    vector_search = VectorSearch(
        algorithms=[HnswAlgorithmConfiguration(
            name=HNSW_ALGORITHM_NAME,
            parameters=HnswParameters(metric=VectorSearchAlgorithmMetric.COSINE),
        )],
        profiles=[VectorSearchProfile(name=VECTOR_PROFILE_NAME, algorithm_configuration_name=HNSW_ALGORITHM_NAME)],
    )
    fields = [
        SimpleField(name="id", type=SearchFieldDataType.String, key=True),
        SimpleField(name="plate_id", type=SearchFieldDataType.String, filterable=True),
        SimpleField(name="page", type=SearchFieldDataType.Int32, filterable=True, sortable=True),
        SearchableField(name="content", type=SearchFieldDataType.String),
        SearchField(
            name="embedding",
            type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
            searchable=True,
            vector_search_dimensions=EMBEDDING_DIMENSIONS,
            vector_search_profile_name=VECTOR_PROFILE_NAME,
        ),
        SimpleField(name="region", type=SearchFieldDataType.String, filterable=True),
        SimpleField(name="region_code", type=SearchFieldDataType.String, filterable=True),
        SimpleField(name="utility", type=SearchFieldDataType.String, filterable=True),
        SimpleField(name="facility_type", type=SearchFieldDataType.String, filterable=True),
        SimpleField(name="metadata_source", type=SearchFieldDataType.String),
        SimpleField(name="metadata_confidence", type=SearchFieldDataType.Double),
        SimpleField(name="extraction_quality", type=SearchFieldDataType.String, filterable=True),
        SearchableField(name="equipment_ids", type=SearchFieldDataType.String),
        SimpleField(name="page_width", type=SearchFieldDataType.Double),
        SimpleField(name="page_height", type=SearchFieldDataType.Double),
        SimpleField(name="source_type", type=SearchFieldDataType.String),
        SimpleField(name="source_path", type=SearchFieldDataType.String),
    ]
    return SearchIndex(name=AZURE_SEARCH_INDEX_NAME, fields=fields, vector_search=vector_search)


def _delete_index_and_wait(client: SearchIndexClient) -> None:
    """Drop the index and block until the service actually reports it gone.

    Azure AI Search processes index deletion asynchronously: delete_index()
    returns as soon as the request is accepted, not when the drop has
    finished. Recreating an index of the same name immediately afterwards
    therefore races the in-flight deletion, and documents written into the
    "new" index can be discarded when the old drop completes -- an ingest
    run that reports every page embedded then leaves only a handful of
    documents behind, with no error anywhere. Wait the name out first.
    """
    try:
        client.delete_index(AZURE_SEARCH_INDEX_NAME)
    except ResourceNotFoundError:
        return  # nothing to drop, so nothing to wait for
    deadline = time.monotonic() + INDEX_DELETE_TIMEOUT_SECONDS
    while True:
        try:
            client.get_index(AZURE_SEARCH_INDEX_NAME)
        except ResourceNotFoundError:
            return
        if time.monotonic() >= deadline:
            raise RuntimeError(
                f"index '{AZURE_SEARCH_INDEX_NAME}' still exists "
                f"{INDEX_DELETE_TIMEOUT_SECONDS:.0f}s after delete_index() -- refusing to "
                f"recreate it, since writing into a half-deleted index loses documents silently"
            )
        time.sleep(INDEX_DELETE_POLL_SECONDS)


def ensure_index(reset: bool = False) -> None:
    """Create the dedicated index if it doesn't exist. reset=True drops
    and recreates it first (used by `ingest.py --reset`). Never touches
    any other index on this Azure AI Search service."""
    client = _get_index_client()
    if reset:
        _delete_index_and_wait(client)
    try:
        client.get_index(AZURE_SEARCH_INDEX_NAME)
    except ResourceNotFoundError:
        client.create_index(_build_index_definition())
    invalidate_caches()


def upsert_documents(docs: list[dict]) -> int:
    """Each dict must already carry an 'id' (see doc_id()) and, for a
    searchable page, an 'embedding' vector of EMBEDDING_DIMENSIONS.
    Returns the number of documents the service confirmed it indexed.

    Azure AI Search reports per-document outcomes instead of raising: a
    batch can come back 207 Multi-Status with individual documents
    rejected (throttling, schema mismatch, oversized payload) while the
    call itself "succeeds". Silently discarding that result is how an
    ingest run prints a full page count while far fewer documents land,
    so surface it as an exception -- ingest.py already catches per file
    and reports the file as failed.
    """
    if not docs:
        return 0

    # A document with no vector indexes fine and is then invisible to every
    # vector query -- it inflates the document count while being unfindable,
    # which is worse than a loud failure.
    vectorless = [d.get("id", "<no id>") for d in docs if not d.get("embedding")]
    if vectorless:
        raise ValueError(
            f"{len(vectorless)}/{len(docs)} document(s) carry no embedding vector and would be "
            f"indexed unsearchable: {', '.join(vectorless[:5])}"
        )

    results = get_search_client().merge_or_upload_documents(documents=docs)
    invalidate_caches()
    failures = [r for r in results if not r.succeeded]
    if failures:
        detail = "; ".join(f"{r.key}: {r.error_message or r.status_code}" for r in failures[:5])
        raise RuntimeError(
            f"{len(failures)}/{len(docs)} document(s) rejected by Azure AI Search -- {detail}"
        )
    return len(results)


def count(settle_seconds: float = 0.0) -> int:
    """Document count as reported by the service.

    Azure AI Search's document count is eventually consistent and can lag
    recent writes by seconds, so a count read immediately after an ingest
    run is not trustworthy evidence of what landed. Pass settle_seconds to
    poll until the value repeats, which is what you want before printing
    the number for a human to compare against the portal.
    """
    client = get_search_client()
    if settle_seconds <= 0:
        return client.get_document_count()
    deadline = time.monotonic() + settle_seconds
    previous = client.get_document_count()
    while time.monotonic() < deadline:
        time.sleep(COUNT_SETTLE_POLL_SECONDS)
        current = client.get_document_count()
        if current == previous:
            return current
        previous = current
    return previous


def get_by_id(id_: str) -> dict | None:
    try:
        return dict(get_search_client().get_document(key=id_))
    except ResourceNotFoundError:
        return None


def get_by_plate_id(plate_id: str) -> list[dict]:
    escaped = plate_id.replace("'", "''")
    results = get_search_client().search(search_text="*", filter=f"plate_id eq '{escaped}'", top=PAGE_SIZE)
    return [dict(r) for r in results]


def vector_search(query_vector: list[float], top: int) -> list[dict]:
    """Nearest-neighbor search. Each returned dict carries '_score' --
    Azure's own relevance score for the vector query, NOT a raw 0..1
    cosine similarity the way Chroma's `1 - distance` was. Needs
    recalibrating server.py's SEMANTIC_SIMILARITY_FLOOR against real
    values once this runs against live data (untested from this sandbox
    -- this Azure AI Search service is behind the same kind of network
    restriction that blocked Azure OpenAI earlier in this project)."""
    query = VectorizedQuery(vector=query_vector, k_nearest_neighbors=top, fields="embedding")
    results = get_search_client().search(search_text=None, vector_queries=[query], top=top)
    out = []
    for r in results:
        d = dict(r)
        d["_score"] = r["@search.score"]
        out.append(d)
    return out


_plate_id_index: dict[str, str] | None = None
_all_docs_cache: list[dict] | None = None


def _load_all() -> list[dict]:
    global _all_docs_cache
    if _all_docs_cache is None:
        docs: list[dict] = []
        skip = 0
        while True:
            batch = [dict(r) for r in get_search_client().search(search_text="*", top=PAGE_SIZE, skip=skip)]
            docs.extend(batch)
            if len(batch) < PAGE_SIZE:
                break
            skip += PAGE_SIZE
        _all_docs_cache = docs
    return _all_docs_cache


def all_docs() -> list[tuple[str, str, dict]]:
    """Every ingested (id, document_text, metadata-dict) tuple -- mirrors
    vectordb.all_docs()'s shape so server.py's literal_matches() doesn't
    need to change."""
    return [(d["id"], d.get("content", ""), d) for d in _load_all()]


def match_plate_id(term: str) -> str | None:
    """Return the ingested plate_id that `term` refers to, if it's an
    exact match once normalized (case/punctuation-insensitive) -- either
    the whole term or one word within it."""
    global _plate_id_index
    if _plate_id_index is None:
        _plate_id_index = {norm_id(d["plate_id"]): d["plate_id"] for d in _load_all()}
    key = norm_id(term)
    if not key:
        return None
    whole = _plate_id_index.get(key)
    if whole:
        return whole
    for word in term.split():
        hit = _plate_id_index.get(norm_id(word))
        if hit:
            return hit
    return None


def invalidate_caches() -> None:
    global _plate_id_index, _all_docs_cache
    _plate_id_index = None
    _all_docs_cache = None
