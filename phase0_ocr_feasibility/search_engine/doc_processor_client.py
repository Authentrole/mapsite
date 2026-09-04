"""Client for Con Edison's on-prem Document Processor API
(https://maps.conedison.net/server/swagger/index.html) -- the real,
production source of map-plate PDFs. Lets a sync script pull PDFs
straight into Azure Blob Storage instead of someone downloading them by
hand and uploading through the portal.

Auth: Windows Integrated (NTLM/Negotiate), confirmed live against a VDI
session on 2026-09-04 -- AuthenticateUser returned 200 with the caller's
domain identity and an *empty* cookie jar, so "Persistent-Auth: true"
means the authenticated connection persists within one HTTP session/
connection, not a session cookie. Practically: authenticate once, reuse
one requests.Session for every subsequent call, don't re-authenticate
per request.

Files/Search returns filenames as a single "folder\\name" string with no
extension (e.g. "Brooklyn\\50-AB"). Files/PDFFile, confirmed live, needs
`filePath` and `fileName` as *separate* fields -- passing the combined
string as `fileName` with `filePath` empty returns an empty body with no
error. split_path() below undoes the concatenation Search applies.

fileFormat as a Files/Search filter was tried live and barely changed the
result count (640203 -> 627215 total files for "" vs "pdf"), so it is not
a reliable filter -- verify actual content by magic bytes after fetching
instead of trusting this filter to have selected only PDFs.

Environment (see search_engine/.env, loaded automatically):
    DOC_PROCESSOR_BASE_URL   (default: https://maps.conedison.net/server)

Requires the domain-joined Windows host this project's VDI runs on --
this client cannot authenticate from an unjoined machine or over a
network path without access to maps.conedison.net.
"""
from __future__ import annotations

import base64
import json
import os
import time
from collections.abc import Iterator

import requests
from dotenv import load_dotenv
from requests_negotiate_sspi import HttpNegotiateAuth

# maps.conedison.net sits behind a corporate TLS-inspecting proxy, so its
# cert chain is signed by an internal root CA. The Windows certificate
# store already trusts that root (which is why PowerShell's
# Invoke-WebRequest works out of the box), but Python's `requests` verifies
# against its own bundled certifi CA list by default, which does not.
# truststore repoints ssl.SSLContext at the OS store instead, confirmed
# live against a VDI session on 2026-09-04 (requests raised
# CERTIFICATE_VERIFY_FAILED / "self-signed certificate in certificate
# chain" until this was added).
import truststore  # noqa: E402

truststore.inject_into_ssl()

load_dotenv()

BASE_URL = os.environ.get("DOC_PROCESSOR_BASE_URL", "https://maps.conedison.net/server").rstrip("/")

SEARCH_PAGE_SIZE = 100  # Files/Search page size per request when paginating

_session: requests.Session | None = None


def get_session() -> requests.Session:
    global _session
    if _session is None:
        s = requests.Session()
        s.auth = HttpNegotiateAuth()
        _session = s
    return _session


def authenticate() -> dict:
    """Confirm the current Windows identity can reach the API. Raises if
    the identity has no access; returns the {userID, userName, isOpsUser}
    payload otherwise."""
    resp = get_session().get(f"{BASE_URL}/api/Access/AuthenticateUser", timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if data.get("errorMSg"):
        raise RuntimeError(f"Document Processor authentication failed: {data['errorMSg']}")
    return data


def split_path(full_name: str) -> tuple[str, str]:
    """'Brooklyn\\50-AB' -> ('Brooklyn', '50-AB'). Files/Search glues
    folder and name together with a backslash; Files/PDFFile wants them
    apart (see module docstring)."""
    if "\\" in full_name:
        folder, name = full_name.rsplit("\\", 1)
        return folder, name
    return "", full_name


def to_blob_name(full_name: str) -> str:
    """Map a Document Processor path to a Blob Storage name. Everything
    pulled by this client lands under 'doc_processor/' so it never
    collides with or is mistaken for the existing hand-uploaded corpus at
    the container root, and can be found/removed as a group later."""
    folder, name = split_path(full_name)
    safe_folder = folder.replace("\\", "/")
    return f"doc_processor/{safe_folder}/{name}.pdf" if safe_folder else f"doc_processor/{name}.pdf"


def _search_page(*, commodity: str, region: str, page_index: int, page_size: int) -> dict:
    body = {
        "commodity": commodity, "region": region, "fileName": "", "filePath": "",
        "fileFormat": "", "fileCount": str(page_size), "pageIndex": str(page_index),
        "includeSubFolders": "true", "pageTemplate": "",
    }
    resp = get_session().post(f"{BASE_URL}/api/Files/Search", json=body, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    if data.get("error"):
        raise RuntimeError(f"Files/Search error (commodity={commodity!r}, region={region!r}): {data['error']}")
    return data


def search_files(*, commodity: str = "Electric", region: str = "", limit: int | None = None) -> Iterator[str]:
    """Yield 'folder\\name' strings for one commodity/region, paginating
    automatically, stopping once `limit` names have been yielded (or the
    catalog is exhausted)."""
    page_index = 1
    yielded = 0
    while True:
        data = _search_page(commodity=commodity, region=region, page_index=page_index, page_size=SEARCH_PAGE_SIZE)
        names = data.get("fileNames") or []
        if not names:
            return
        for name in names:
            yield name
            yielded += 1
            if limit is not None and yielded >= limit:
                return
        page_index += 1


def iter_search_pages(
    *,
    commodity: str = "Electric",
    region: str = "",
    page_size: int,
    start_page: int = 1,
    max_retries: int = 5,
    retry_backoff_seconds: float = 5.0,
) -> Iterator[tuple[int, list[str], int | None]]:
    """Page-level driver for a full-catalog crawl (see
    build_file_catalog.py). Files/Search has been observed, live, to swing
    between sub-second and 90s+ timeouts on the exact same request with
    no client-side change -- transient server-side slowness, not
    something a fixed page size or a fresh session reliably avoids. So
    each page gets its own retry-with-backoff here rather than letting one
    bad page kill a multi-hour crawl.

    Yields (page_index, names, total_files_reported) per page. Stops when
    a page comes back with no names (catalog exhausted) or a page fails
    every retry (raises, so the caller's persisted progress reflects only
    fully-completed pages).
    """
    page_index = start_page
    while True:
        last_error: Exception | None = None
        data = None
        for attempt in range(max_retries):
            try:
                data = _search_page(commodity=commodity, region=region, page_index=page_index, page_size=page_size)
                last_error = None
                break
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    time.sleep(retry_backoff_seconds * (attempt + 1))
        if last_error is not None:
            raise RuntimeError(f"page {page_index} failed after {max_retries} attempt(s): {last_error}") from last_error

        names = data.get("fileNames") or []
        if not names:
            return
        total_files = data.get("totalFiles")
        yield page_index, names, int(total_files) if total_files is not None else None
        page_index += 1


def fetch_pdf_bytes(full_name: str, *, commodity: str = "Electric", region: str = "") -> bytes:
    """Download one file's raw bytes. Raises if the response is empty or
    doesn't decode to a PDF -- fileFormat isn't a trustworthy filter (see
    module docstring), so this is the actual verification point."""
    folder, name = split_path(full_name)
    body = {
        "commodity": commodity, "region": region, "fileName": name, "filePath": folder,
        "fileFormat": "", "fileCount": "1", "pageIndex": "1",
        "includeSubFolders": "true", "pageTemplate": "",
    }
    resp = get_session().post(f"{BASE_URL}/api/Files/PDFFile", json=body, timeout=120)
    resp.raise_for_status()
    text = resp.text.strip()
    if not text:
        raise RuntimeError(f"Files/PDFFile returned an empty body for {full_name!r}")
    # The response is a bare base64 string, sometimes JSON-quoted (a JSON
    # string literal), sometimes not -- handle both.
    if text.startswith('"') and text.endswith('"'):
        text = json.loads(text)
    if not text:
        raise RuntimeError(f"Files/PDFFile returned no content for {full_name!r}")
    data = base64.b64decode(text)
    if not data.startswith(b"%PDF"):
        raise ValueError(f"{full_name!r} did not decode to a PDF ({len(data)} byte(s) received)")
    return data
