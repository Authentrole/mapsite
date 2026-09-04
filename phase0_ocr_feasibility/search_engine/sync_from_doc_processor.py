#!/usr/bin/env python3
"""Test-batch sync: pull a bounded number of Electric PDFs from Con
Edison's on-prem Document Processor API (see doc_processor_client.py)
straight into Azure Blob Storage, split across regions.

This is a manual, capped validation run -- NOT the daily-sync Azure
Function planned separately (that needs a persisted file catalog for
add/remove diffing at full-corpus scale; out of scope here). Defaults to
AZURE_STORAGE_DEVTEST_CONTAINER (a container dedicated to validating
this Document Processor pull, separate from AZURE_STORAGE_CONTAINER --
the real corpus ingest.py/server.py serve from). Everything this script
uploads still lands under the 'doc_processor/' blob prefix regardless of
--container, so it never collides with any hand-uploaded PDFs sitting
at a container's root.

Must run on a domain-joined host with a path to maps.conedison.net (the
VDI) -- Windows Integrated auth has no meaning anywhere else.

Names normally come from a live Files/Search call per region (default
mode). Pass --catalog to instead read filenames from a file already
built by build_file_catalog.py -- decouples the (slow, multi-hour)
full-catalog enumeration from this script's actual fetch+upload work,
and Files/Search has been observed, live, to be slow/flaky enough that
not re-querying it here when a catalog already exists is worth it.

Usage:
    python sync_from_doc_processor.py --limit 100
    python sync_from_doc_processor.py --limit 100 --regions Bronx,Brooklyn,Queens,Westchester
    python sync_from_doc_processor.py --limit 100 --catalog doc_processor_catalog.txt
    python sync_from_doc_processor.py --limit 100 --container egis-mapsite-electric-container
"""
from __future__ import annotations

import argparse
import sys

import blob_storage
import doc_processor_client as dpc

DEFAULT_REGIONS = ["Bronx", "Brooklyn", "Queens", "Westchester"]


def _names_from_catalog(path: str, limit: int, already_in_blob: set[str]) -> list[str]:
    """Read filenames from a build_file_catalog.py output file, skipping
    ones whose blob destination is already present, stopping once `limit`
    new names have been collected."""
    picked: list[str] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            full_name = line.rstrip("\n")
            if not full_name:
                continue
            if dpc.to_blob_name(full_name) in already_in_blob:
                continue
            picked.append(full_name)
            if len(picked) >= limit:
                break
    return picked


def _fetch_and_upload(full_name: str, *, commodity: str, region: str, container: str, existing: set[str]) -> tuple[str, bool, str]:
    """Fetch one file and upload it, unless already present. Returns
    (blob_name, uploaded, message) -- uploaded=False with no exception
    means it was skipped, not failed."""
    blob_name = dpc.to_blob_name(full_name)
    if blob_name in existing:
        return blob_name, False, f"SKIP  (already in blob) {blob_name}"
    data = dpc.fetch_pdf_bytes(full_name, commodity=commodity, region=region)
    blob_storage.upload_pdf_bytes(blob_name, data, container_name=container)
    existing.add(blob_name)
    return blob_name, True, f"OK    {blob_name} ({len(data)} bytes)"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Pull a capped batch of Electric PDFs from the Document Processor into Blob Storage")
    ap.add_argument("--limit", type=int, default=100, help="total files to pull (default: 100)")
    ap.add_argument("--regions", default=",".join(DEFAULT_REGIONS),
                     help="comma-separated regions, split evenly (ignored with --catalog)")
    ap.add_argument("--commodity", default="Electric")
    ap.add_argument("--catalog", help="read filenames from a build_file_catalog.py output file instead of querying Files/Search live")
    ap.add_argument("--container", default=None,
                     help="blob container to upload into (default: AZURE_STORAGE_DEVTEST_CONTAINER, "
                          "*not* the real corpus container ingest.py/server.py use)")
    args = ap.parse_args(argv)

    if args.limit < 1:
        ap.error("--limit must be at least 1")

    container = args.container or blob_storage.AZURE_STORAGE_DEVTEST_CONTAINER
    if not blob_storage.AZURE_STORAGE_CONNECTION_STRING:
        print("AZURE_STORAGE_CONNECTION_STRING is not configured (see search_engine/.env).")
        return 1

    try:
        auth = dpc.authenticate()
    except Exception as e:
        print(f"Could not authenticate to the Document Processor: {e}")
        return 1
    print(f"Authenticated to Document Processor as {auth.get('userName')} ({auth.get('userID')})")

    existing = set(blob_storage.list_pdf_blobs(container_name=container))
    print(f"{len(existing)} PDF(s) already in blob container '{container}'")

    attempted = uploaded = skipped = failed = 0
    failures: list[str] = []

    if args.catalog:
        print(f"\nReading filenames from catalog '{args.catalog}' (up to {args.limit})")
        try:
            names = _names_from_catalog(args.catalog, args.limit, existing)
        except OSError as e:
            print(f"Could not read catalog '{args.catalog}': {e}")
            return 1
        print(f"{len(names)} new filename(s) to fetch")
        for full_name in names:
            attempted += 1
            try:
                # The catalog was built with a single unscoped search (region=""),
                # so fetch the same way -- filePath/fileName alone fully qualify
                # the file regardless of region.
                _, was_uploaded, message = _fetch_and_upload(full_name, commodity=args.commodity, region="", container=container, existing=existing)
                uploaded += 1 if was_uploaded else 0
                skipped += 0 if was_uploaded else 1
                print(f"  {message}")
            except Exception as e:
                failed += 1
                failures.append(f"{full_name}: {e}")
                print(f"  FAILED {full_name}: {e}")
    else:
        regions = [r.strip() for r in args.regions.split(",") if r.strip()]
        if not regions:
            ap.error("--regions must name at least one region")

        # Split the total limit evenly across regions, handing any remainder
        # to the first regions in the list so the sum is exactly --limit.
        per_region, remainder = divmod(args.limit, len(regions))
        quotas = [per_region + (1 if i < remainder else 0) for i in range(len(regions))]

        for region, quota in zip(regions, quotas):
            print(f"\n{region}: requesting up to {quota} filename(s)")
            try:
                names = list(dpc.search_files(commodity=args.commodity, region=region, limit=quota))
            except Exception as e:
                print(f"  FAILED to search {region}: {e}")
                failed += 1
                failures.append(f"{region} (search): {e}")
                continue
            print(f"{region}: {len(names)} filename(s) returned")

            for full_name in names:
                attempted += 1
                try:
                    _, was_uploaded, message = _fetch_and_upload(full_name, commodity=args.commodity, region=region, container=container, existing=existing)
                    uploaded += 1 if was_uploaded else 0
                    skipped += 0 if was_uploaded else 1
                    print(f"  {message}")
                except Exception as e:
                    failed += 1
                    failures.append(f"{full_name}: {e}")
                    print(f"  FAILED {full_name}: {e}")

    print(f"\nDone: {attempted} attempted, {uploaded} uploaded, {skipped} skipped (already present), {failed} failed")
    if failures:
        print("Failures:")
        for f in failures:
            print(f"  - {f}")
    return 1 if failed and uploaded == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
