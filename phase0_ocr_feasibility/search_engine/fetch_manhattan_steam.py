#!/usr/bin/env python3
"""One-off pull: fetch every Manhattan Steam plate named in
manhattan_steam_names_raw.txt (the real filename list from the eGIS Maps
app itself, not from Files/Search -- commodity/region as Files/Search
request filters were confirmed live to not actually narrow results, so
this list came from the app UI instead) from the Document Processor API
and upload each straight into Azure Blob Storage.

Names are pulled one at a time via Files/PDFFile at
"Manhattan\\Steam\\<name>" (the folder confirmed live via a fileName
search for "16501-1", which resolved to
"Manhattan\\Steam\\16501-1" and "Manhattan\\Steam\\Old_BW\\16501-1" --
this script only pulls the primary Steam folder, not Old_BW).

Uploads land in AZURE_STORAGE_DEVTEST_CONTAINER by default (see
blob_storage.py) under the same 'doc_processor/' prefix everything else
pulled from the Document Processor uses (dpc.to_blob_name()) -- kept
apart from any hand-uploaded corpus at a container's root.

Resumable: skips any name already present in the target container, so
a partial run (this endpoint has been observed live to time out
intermittently) can just be re-run to pick up where it left off.

Usage:
    python fetch_manhattan_steam.py
    python fetch_manhattan_steam.py --container egis-mapsite-electric-container
"""
from __future__ import annotations

import argparse
import time

import blob_storage
import doc_processor_client as dpc

DEFAULT_FOLDER = "Manhattan\\Steam"


def load_names(path: str) -> list[str]:
    """Parse the tab-separated grid into a flat, de-duplicated,
    order-preserving list of plate names. Splitting on '\\t' (not
    generic whitespace) matters -- some names contain internal spaces,
    e.g. "18512 (2)" and "18540-6 - COPY"."""
    seen: set[str] = set()
    names: list[str] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            for token in line.rstrip("\n").split("\t"):
                name = token.strip()
                if name and name not in seen:
                    seen.add(name)
                    names.append(name)
    return names


def fetch_with_retry(full_name: str, *, commodity: str, region: str, max_retries: int = 3, backoff_seconds: float = 5.0) -> bytes:
    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            return dpc.fetch_pdf_bytes(full_name, commodity=commodity, region=region)
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                time.sleep(backoff_seconds * (attempt + 1))
    raise last_error


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Fetch every Manhattan Steam plate in manhattan_steam_names_raw.txt into Blob Storage")
    ap.add_argument("--input", default="manhattan_steam_names_raw.txt")
    ap.add_argument("--folder", default=DEFAULT_FOLDER, help="Document Processor folder to fetch from")
    ap.add_argument("--commodity", default="Steam")
    ap.add_argument("--region", default="Manhattan")
    ap.add_argument("--container", default=None,
                     help="blob container to upload into (default: AZURE_STORAGE_DEVTEST_CONTAINER, "
                          "*not* the real corpus container ingest.py/server.py use)")
    args = ap.parse_args(argv)

    container = args.container or blob_storage.AZURE_STORAGE_DEVTEST_CONTAINER
    if not blob_storage.AZURE_STORAGE_CONNECTION_STRING:
        print("AZURE_STORAGE_CONNECTION_STRING is not configured (see search_engine/.env).")
        return 1

    try:
        names = load_names(args.input)
    except OSError as e:
        print(f"Could not read '{args.input}': {e}")
        return 1
    print(f"{len(names)} unique name(s) parsed from '{args.input}'")

    try:
        auth = dpc.authenticate()
    except Exception as e:
        print(f"Could not authenticate to the Document Processor: {e}")
        return 1
    print(f"Authenticated to Document Processor as {auth.get('userName')} ({auth.get('userID')})")

    existing = set(blob_storage.list_pdf_blobs(container_name=container))
    print(f"{len(existing)} PDF(s) already in blob container '{container}'")
    print(f"Uploading into '{container}'\n")

    attempted = uploaded = skipped = failed = 0
    failures: list[str] = []

    for name in names:
        full_name = f"{args.folder}\\{name}"
        blob_name = dpc.to_blob_name(full_name)
        if blob_name in existing:
            skipped += 1
            print(f"  SKIP  (already in blob) {blob_name}")
            continue

        attempted += 1
        try:
            data = fetch_with_retry(full_name, commodity=args.commodity, region=args.region)
            blob_storage.upload_pdf_bytes(blob_name, data, container_name=container)
            existing.add(blob_name)
            uploaded += 1
            print(f"  OK    {blob_name} ({len(data)} bytes)")
        except Exception as e:
            failed += 1
            failures.append(f"{name}: {e}")
            print(f"  FAILED {name}: {e}")

    print(f"\nDone: {attempted} attempted, {uploaded} uploaded, {skipped} already-present, {failed} failed")
    if failures:
        print("Failures (re-run this script to retry -- it skips anything already uploaded):")
        for f in failures:
            print(f"  - {f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
