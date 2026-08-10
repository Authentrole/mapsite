"""SQLite-backed local search index for the eGIS Map Site AI Search engine.

Zero external services: everything lives in one SQLite file. FTS5 gives
full-text + prefix matching over two fields (free-text content and
regex-extracted equipment/plate IDs); a plain table holds per-word bounding
boxes so a hit can be turned into a highlighted crop image on demand.
"""
from __future__ import annotations

import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "index.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS plates (
    plate_id TEXT NOT NULL,
    page INTEGER NOT NULL,
    region TEXT,
    region_code TEXT,
    utility TEXT,
    facility_type TEXT,
    metadata_source TEXT,
    metadata_confidence REAL,
    extraction_quality TEXT,
    page_width REAL,
    page_height REAL,
    source_path TEXT NOT NULL,
    PRIMARY KEY (plate_id, page)
);

CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
    content,
    equipment_ids,
    plate_id UNINDEXED,
    page UNINDEXED,
    tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS word_positions (
    plate_id TEXT NOT NULL,
    page INTEGER NOT NULL,
    word TEXT NOT NULL,
    word_norm TEXT NOT NULL,
    x0 REAL, y0 REAL, x1 REAL, y1 REAL,
    confidence REAL,
    source TEXT
);
CREATE INDEX IF NOT EXISTS idx_word_norm ON word_positions(word_norm);
CREATE INDEX IF NOT EXISTS idx_word_plate_page ON word_positions(plate_id, page);
CREATE INDEX IF NOT EXISTS idx_word_plate_page_norm ON word_positions(plate_id, page, word_norm);

CREATE TABLE IF NOT EXISTS embeddings (
    plate_id TEXT NOT NULL,
    page INTEGER NOT NULL,
    model TEXT NOT NULL,
    dim INTEGER NOT NULL,
    vector_json TEXT NOT NULL,
    PRIMARY KEY (plate_id, page)
);
"""


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db(reset: bool = False) -> None:
    if reset and os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        for ext in ("-wal", "-shm"):
            p = DB_PATH + ext
            if os.path.exists(p):
                os.remove(p)
    conn = connect()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def norm(word: str) -> str:
    """Lowercased, alnum-only form used for exact/fuzzy word matching."""
    return "".join(ch.lower() for ch in word if ch.isalnum())
