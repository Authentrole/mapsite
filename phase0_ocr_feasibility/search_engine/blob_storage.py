"""Azure Blob Storage client for the eGIS Map Site AI Search engine.

Lets ingest.py read source PDFs directly from a Blob Storage container
instead of a local folder, and lets server.py re-fetch a PDF's bytes on
demand for crop rendering / raw download. ChromaDB still stores the
metadata + embeddings locally exactly as before -- this module only
supplies PDF bytes, nothing else changes.

Every function here defaults to AZURE_STORAGE_CONTAINER (the real
search-engine corpus) but accepts an explicit container_name so
sync_from_doc_processor.py / build_file_catalog.py can target
AZURE_STORAGE_DEVTEST_CONTAINER instead -- pulls from the on-prem
Document Processor API are being validated there, kept apart from the
container ingest.py and server.py actually serve from.

Environment (see search_engine/.env, loaded automatically -- never commit
real values):
    AZURE_STORAGE_CONNECTION_STRING
    AZURE_STORAGE_CONTAINER
    AZURE_STORAGE_DEVTEST_CONTAINER   (optional, for Document Processor testing)
"""
from __future__ import annotations

import os

from azure.storage.blob import ContainerClient
from dotenv import load_dotenv

load_dotenv()

AZURE_STORAGE_CONNECTION_STRING = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
AZURE_STORAGE_CONTAINER = os.environ.get("AZURE_STORAGE_CONTAINER", "")
AZURE_STORAGE_DEVTEST_CONTAINER = os.environ.get("AZURE_STORAGE_DEVTEST_CONTAINER", "egis-mapsite-devtest-container")

_container_clients: dict[str, ContainerClient] = {}


def is_available() -> bool:
    return bool(AZURE_STORAGE_CONNECTION_STRING) and bool(AZURE_STORAGE_CONTAINER)


def get_container_client(container_name: str | None = None) -> ContainerClient:
    name = container_name or AZURE_STORAGE_CONTAINER
    if not AZURE_STORAGE_CONNECTION_STRING or not name:
        raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING / AZURE_STORAGE_CONTAINER are not configured")
    if name not in _container_clients:
        _container_clients[name] = ContainerClient.from_connection_string(
            AZURE_STORAGE_CONNECTION_STRING, container_name=name
        )
    return _container_clients[name]


def list_pdf_blobs(container_name: str | None = None) -> list[str]:
    """Every blob name in the container ending in .pdf (case-insensitive)."""
    return sorted(b.name for b in get_container_client(container_name).list_blobs() if b.name.lower().endswith(".pdf"))


def download_pdf_bytes(blob_name: str, container_name: str | None = None) -> bytes:
    """Download one blob's raw bytes (a PDF)."""
    return get_container_client(container_name).download_blob(blob_name).readall()


def upload_pdf_bytes(blob_name: str, data: bytes, overwrite: bool = False, container_name: str | None = None) -> None:
    """Upload raw PDF bytes to the container, e.g. from doc_processor_client.py
    so a sync script can push straight to Blob Storage without a manual
    download+upload round trip. overwrite defaults to False so a repeat
    sync run can't silently clobber a file -- callers that already checked
    list_pdf_blobs() and mean to overwrite can pass True explicitly."""
    get_container_client(container_name).upload_blob(name=blob_name, data=data, overwrite=overwrite)
