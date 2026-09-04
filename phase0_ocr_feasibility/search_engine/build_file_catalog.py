#!/usr/bin/env python3
"""Build a plain-text catalog of every filename the Document Processor
reports for one commodity (see doc_processor_client.py) -- ~629k for
Electric as of 2026-09-04. Separate from sync_from_doc_processor.py on
purpose: listing every name and actually fetching+uploading PDFs are two
very different-sized jobs, and coupling them means one slow fetch stalls
the enumeration.

Files/Search has been observed, live, to swing between sub-second and
90s+ timeouts on the exact same request with no client-side change --
so this is written to survive that over what will likely be a
multi-hour run:

  - Names are appended to --output one per line, flushed after every
    page, so a crash loses at most the in-flight page, never prior
    progress.
  - The last fully-completed page number is written to a separate
    progress file after each page. Re-running with --resume picks up
    at the next page instead of starting over.
  - Each page retries with backoff (see iter_search_pages) before the
    whole run gives up.

Usage:
    python build_file_catalog.py --commodity Electric
    python build_file_catalog.py --commodity Electric --resume
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import doc_processor_client as dpc


def progress_path(output_path: str) -> str:
    return output_path + ".progress.json"


def load_progress(output_path: str) -> dict:
    path = progress_path(output_path)
    if not os.path.exists(path):
        return {"last_completed_page": 0, "names_written": 0}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_progress(output_path: str, progress: dict) -> None:
    # Write to a temp file and replace, so a crash mid-write can't leave
    # progress.json truncated/corrupt -- resuming would then trust a
    # page count that doesn't match what's actually in the output file.
    path = progress_path(output_path)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(progress, f)
    os.replace(tmp, path)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Enumerate every Document Processor filename for one commodity into a text file")
    ap.add_argument("--commodity", default="Electric")
    ap.add_argument("--region", default="", help="leave blank for all regions")
    ap.add_argument("--output", default="doc_processor_catalog.txt")
    ap.add_argument("--page-size", type=int, default=50, help="Files/Search fileCount per request (default: 50)")
    ap.add_argument("--resume", action="store_true", help="continue from the last completed page instead of starting over")
    ap.add_argument("--max-retries", type=int, default=5)
    ap.add_argument("--retry-backoff-seconds", type=float, default=5.0)
    ap.add_argument("--heartbeat-pages", type=int, default=20, help="print progress every N pages")
    args = ap.parse_args(argv)

    progress = load_progress(args.output) if args.resume else {"last_completed_page": 0, "names_written": 0}
    start_page = progress["last_completed_page"] + 1

    if not args.resume and os.path.exists(args.output):
        print(f"{args.output} already exists and --resume was not given -- refusing to overwrite. "
              f"Pass --resume to continue it, or remove/rename it first.")
        return 1

    try:
        auth = dpc.authenticate()
    except Exception as e:
        print(f"Could not authenticate to the Document Processor: {e}")
        return 1
    print(f"Authenticated to Document Processor as {auth.get('userName')} ({auth.get('userID')})")
    print(f"Starting at page {start_page} (page size {args.page_size}), writing to {args.output}")

    t0 = time.time()
    pages_done = 0
    total_files_reported = None

    with open(args.output, "a", encoding="utf-8") as out:
        try:
            for page_index, names, total_files in dpc.iter_search_pages(
                commodity=args.commodity,
                region=args.region,
                page_size=args.page_size,
                start_page=start_page,
                max_retries=args.max_retries,
                retry_backoff_seconds=args.retry_backoff_seconds,
            ):
                if total_files is not None:
                    total_files_reported = total_files
                for name in names:
                    out.write(name + "\n")
                out.flush()

                progress["last_completed_page"] = page_index
                progress["names_written"] += len(names)
                save_progress(args.output, progress)

                pages_done += 1
                if pages_done % args.heartbeat_pages == 0:
                    elapsed = time.time() - t0
                    rate = progress["names_written"] / elapsed if elapsed > 0 else 0.0
                    pct = (f"{100 * progress['names_written'] / total_files_reported:.1f}%"
                           if total_files_reported else "?")
                    print(f"  page {page_index}: {progress['names_written']} name(s) so far "
                          f"({pct} of {total_files_reported}), {rate:.1f} names/s, {elapsed:.0f}s elapsed")
        except KeyboardInterrupt:
            print(f"\nInterrupted at page {progress['last_completed_page']} -- re-run with --resume to continue.")
            return 1
        except Exception as e:
            print(f"\nFailed at page {progress['last_completed_page'] + 1}: {e}")
            print("Re-run with --resume to continue from the last completed page.")
            return 1

    elapsed = time.time() - t0
    print(f"\nDone in {elapsed:.0f}s: {progress['names_written']} name(s) written to {args.output} "
          f"across {progress['last_completed_page']} page(s)"
          + (f" (catalog reported {total_files_reported} total)" if total_files_reported else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
