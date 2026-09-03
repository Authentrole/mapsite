"""Azure Blob Storage client for the eGIS Map Site AI Search engine.

Lets ingest.py read source PDFs directly from a Blob Storage container
instead of a local folder, and lets server.py re-fetch a PDF's bytes on
demand for crop rendering / raw download. ChromaDB still stores the
metadata + embeddings locally exactly as before -- this module only
supplies PDF bytes, nothing else changes.

Environment (see search_engine/.env, loaded automatically -- never commit
real values):
    AZURE_STORAGE_CONNECTION_STRING
    AZURE_STORAGE_CONTAINER
"""
from __future__ import annotations

import os

from azure.storage.blob import ContainerClient
from dotenv import load_dotenv

load_dotenv()

AZURE_STORAGE_CONNECTION_STRING = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
AZURE_STORAGE_CONTAINER = os.environ.get("AZURE_STORAGE_CONTAINER", "")

_container_client: ContainerClient | None = None


def is_available() -> bool:
    return bool(AZURE_STORAGE_CONNECTION_STRING) and bool(AZURE_STORAGE_CONTAINER)


def get_container_client() -> ContainerClient:
    global _container_client
    if _container_client is None:
        if not is_available():
            raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING / AZURE_STORAGE_CONTAINER are not configured")
        _container_client = ContainerClient.from_connection_string(
            AZURE_STORAGE_CONNECTION_STRING, container_name=AZURE_STORAGE_CONTAINER
        )
    return _container_client


def list_pdf_blobs() -> list[str]:
    """Every blob name in the container ending in .pdf (case-insensitive)."""
    return sorted(b.name for b in get_container_client().list_blobs() if b.name.lower().endswith(".pdf"))


def download_pdf_bytes(blob_name: str) -> bytes:
    """Download one blob's raw bytes (a PDF)."""
    return get_container_client().download_blob(blob_name).readall()
