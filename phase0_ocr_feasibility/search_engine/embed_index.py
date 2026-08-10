#!/usr/bin/env python3
"""Build Gemini embeddings for every plate page already ingested into the
local search index (see ingest.py), enabling semantic search in ai_search().

Usage:
    python embed_index.py            # embed any pages not yet embedded
    python embed_index.py --reset    # re-embed every page from scratch
"""
from __future__ import annotations

import argparse
import time

import embeddings


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Build embeddings for the local search index")
    ap.add_argument("--reset", action="store_true", help="re-embed every page from scratch")
    args = ap.parse_args(argv)

    if not embeddings.is_available():
        print("GEMINI_API_KEY is not configured -- cannot build embeddings.")
        return 1

    t0 = time.time()
    n = embeddings.build_index(reset=args.reset)
    total = embeddings.indexed_count()
    print(
        f"Embedded {n} page(s) in {time.time() - t0:.1f}s using model "
        f"'{embeddings.EMBEDDING_MODEL}' ({total} page(s) total in the index)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
