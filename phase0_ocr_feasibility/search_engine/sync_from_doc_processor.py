#!/usr/bin/env python3
"""Test-batch sync: pull a bounded number of Electric PDFs from Con
Edison's on-prem Document Processor API (see doc_processor_client.py)
straight into Azure Blob Storage, split across regions.

This is a manual, capped validation run -- NOT the daily-sync Azure
Function planned separately (that needs a persisted file catalog for
add/remove diffing at full-corpus scale; out of scope here). Everything
this script uploads lands under the 'doc_processor/' blob prefix, kept
apart from the existing hand-uploaded corpus at the container root.

Must run on a domain-joined host with a path to maps.conedison.net (the
VDI) -- Windows Integrated auth has no meaning anywhere else.

Usage:
    python sync_from_doc_processor.py --limit 100
    python sync_from_doc_processor.py --limit 100 --regions Bronx,Brooklyn,Queens,Westchester
"""
from __future__ import annotations

import argparse
import sys

import blob_storage
import doc_processor_client as dpc

DEFAULT_REGIONS = ["Bronx", "Brooklyn", "Queens", "Westchester"]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Pull a capped batch of Electric PDFs from the Document Processor into Blob Storage")
    ap.add_argument("--limit", type=int, default=100, help="total files to pull across all regions combined (default: 100)")
    ap.add_argument("--regions", default=",".join(DEFAULT_REGIONS), help="comma-separated regions, split evenly")
    ap.add_argument("--commodity", default="Electric")
    args = ap.parse_args(argv)

    regions = [r.strip() for r in args.regions.split(",") if r.strip()]
    if not regions:
        ap.error("--regions must name at least one region")
    if args.limit < 1:
        ap.error("--limit must be at least 1")

    if not blob_storage.is_available():
        print("AZURE_STORAGE_CONNECTION_STRING / AZURE_STORAGE_CONTAINER are not configured (see search_engine/.env).")
        return 1

    try:
        auth = dpc.authenticate()
    except Exception as e:
        print(f"Could not authenticate to the Document Processor: {e}")
        return 1
    print(f"Authenticated to Document Processor as {auth.get('userName')} ({auth.get('userID')})")

    # Split the total limit evenly across regions, handing any remainder
    # to the first regions in the list so the sum is exactly --limit.
    per_region, remainder = divmod(args.limit, len(regions))
    quotas = [per_region + (1 if i < remainder else 0) for i in range(len(regions))]

    existing = set(blob_storage.list_pdf_blobs())
    print(f"{len(existing)} PDF(s) already in blob container '{blob_storage.AZURE_STORAGE_CONTAINER}'")

    attempted = uploaded = skipped = failed = 0
    failures: list[str] = []

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
            blob_name = dpc.to_blob_name(full_name)
            if blob_name in existing:
                skipped += 1
                print(f"  SKIP  (already in blob) {blob_name}")
                continue
            try:
                data = dpc.fetch_pdf_bytes(full_name, commodity=args.commodity, region=region)
                blob_storage.upload_pdf_bytes(blob_name, data)
                existing.add(blob_name)
                uploaded += 1
                print(f"  OK    {blob_name} ({len(data)} bytes)")
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
