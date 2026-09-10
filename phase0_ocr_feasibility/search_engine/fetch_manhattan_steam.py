#!/usr/bin/env python3
"""One-off pull: fetch every Manhattan Steam plate named in
manhattan_steam_names_raw.txt (the real filename list from the eGIS Maps
app itself, not from Files/Search -- commodity/region as Files/Search
request filters were confirmed live to not actually narrow results, so
this list came from the app UI instead) from the Document Processor API
and save each as a local PDF.

Names are pulled one at a time via Files/PDFFile at
"Manhattan\\Steam\\<name>" (the folder confirmed live via a fileName
search for "16501-1", which resolved to
"Manhattan\\Steam\\16501-1" and "Manhattan\\Steam\\Old_BW\\16501-1" --
this script only pulls the primary Steam folder, not Old_BW).

Resumable: skips any name whose output PDF already exists, so a
partial run (this endpoint has been observed live to time out
intermittently) can just be re-run to pick up where it left off.

Usage:
    python fetch_manhattan_steam.py
    python fetch_manhattan_steam.py --input manhattan_steam_names_raw.txt --output-dir "C:\\Users\\ROYRA\\Desktop\\Manhattan Steam"
"""
from __future__ import annotations

import argparse
import os
import time

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


def sanitize_filename(name: str) -> str:
    """Windows-illegal filename characters, just in case a plate name
    ever contains one -- none of the confirmed names do, but this is
    cheap insurance."""
    bad = '<>:"/\\|?*'
    return "".join("_" if c in bad else c for c in name)


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
    ap = argparse.ArgumentParser(description="Fetch every Manhattan Steam plate in manhattan_steam_names_raw.txt and save as local PDFs")
    ap.add_argument("--input", default="manhattan_steam_names_raw.txt")
    ap.add_argument("--folder", default=DEFAULT_FOLDER, help="Document Processor folder to fetch from")
    ap.add_argument("--commodity", default="Steam")
    ap.add_argument("--region", default="Manhattan")
    ap.add_argument("--output-dir", default=os.path.join(os.path.expanduser("~"), "Desktop", "Manhattan Steam"))
    args = ap.parse_args(argv)

    try:
        names = load_names(args.input)
    except OSError as e:
        print(f"Could not read '{args.input}': {e}")
        return 1
    print(f"{len(names)} unique name(s) parsed from '{args.input}'")

    os.makedirs(args.output_dir, exist_ok=True)

    try:
        auth = dpc.authenticate()
    except Exception as e:
        print(f"Could not authenticate to the Document Processor: {e}")
        return 1
    print(f"Authenticated to Document Processor as {auth.get('userName')} ({auth.get('userID')})")
    print(f"Saving to '{args.output_dir}'\n")

    attempted = saved = skipped = failed = 0
    failures: list[str] = []

    for name in names:
        out_path = os.path.join(args.output_dir, sanitize_filename(name) + ".pdf")
        if os.path.exists(out_path):
            skipped += 1
            print(f"  SKIP  (already saved) {name}")
            continue

        attempted += 1
        full_name = f"{args.folder}\\{name}"
        try:
            data = fetch_with_retry(full_name, commodity=args.commodity, region=args.region)
            with open(out_path, "wb") as f:
                f.write(data)
            saved += 1
            print(f"  OK    {name} ({len(data)} bytes)")
        except Exception as e:
            failed += 1
            failures.append(f"{name}: {e}")
            print(f"  FAILED {name}: {e}")

    print(f"\nDone: {attempted} attempted, {saved} saved, {skipped} already-present, {failed} failed")
    if failures:
        print("Failures (re-run this script to retry -- it skips anything already saved):")
        for f in failures:
            print(f"  - {f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
