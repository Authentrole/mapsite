# eGIS Map Site — AI Search Engine

Local search engine for Con Edison engineering map plates, with an AI natural
language layer powered by Google Gemini.

## Quick Start

```powershell
# 1. Set your Gemini API key
$env:GEMINI_API_KEY = "your-key-here"

# 2. Make sure the index exists (run ingest first if not)
python ingest.py --input "C:\path\to\your\PDFs" --reset

# 3. Start the server
python server.py 8000

# 4. Open http://127.0.0.1:8000 in your browser
```

## How It Works

### Without AI (Keyword Mode)
Semantic (vector) search over extracted map content, via a local ChromaDB
collection built by `ingest.py`. Enter a plate ID (`11-AD`), street name
(`Eastchester`), or equipment ID (`1W02`) and get plates ranked by
embedding similarity, with full-page thumbnails.

### With AI (Natural Language Mode)
1. User types a natural language query, e.g. *"show me electrical maps near
   Sound View Avenue in the Bronx"*
2. **Gemini** parses the intent → extracts search terms (`Sound View`) and
   filters (`region: Bronx`, `utility: Electric`)
3. Each search term is run through the same ChromaDB semantic search
4. Results are filtered by the extracted metadata constraints
5. **Gemini** generates a plain-English summary of what was found
6. UI shows the summary, parsed intent, and the same map-plate cards as before

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/ai-status` | Check if Gemini is configured (`{"available": true/false}`) |
| `GET /api/ai-search?q=...` | AI natural language search (requires API key) |
| `GET /api/search?q=...` | Direct semantic search (no AI, always works) |
| `GET /api/embedding-status` | Size of the ChromaDB vector index |
| `GET /api/crop?plate=&page=` | PNG page thumbnail |
| `GET /api/pdf?plate=...` | Raw source PDF |

There are no per-word bounding boxes in this index, so `/api/crop` always
returns a full-page thumbnail rather than a highlighted crop of one match.

## Configuration

| Env Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | *(required for AI mode)* | Google AI Studio API key -- used only for intent parsing + result summaries |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Model to use |

Vector embeddings are computed locally by ChromaDB's bundled
sentence-transformers model (`all-MiniLM-L6-v2`) -- no API key and no
network calls needed for search itself; only the AI natural-language layer
(intent + summary) calls Gemini. `pip install -r ../requirements.txt` pulls
in `chromadb`.

## Architecture

```
User (browser)
    |
    v
static/index.html  (mode toggle: AI / Keyword)
    |
    v  /api/ai-search
server.py
    |
    +-- ai_search.py  -->  Gemini API (intent extraction + summarization)
    |
    +-- search()      -->  ChromaDB nearest-neighbor (local embeddings)
    |
    +-- vectordb.py   -->  chroma_db/ (persistent Chroma collection "plates")
```

`ingest.py` extracts each PDF page's text (PyMuPDF for born-digital pages,
tiled RapidOCR for scanned ones), tags it with heuristic metadata
(`metadata.py`), and upserts it into the same Chroma collection.
