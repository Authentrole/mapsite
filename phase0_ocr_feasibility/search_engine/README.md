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
Direct FTS5 full-text search over extracted map content. Enter a plate ID
(`11-AD`), street name (`Eastchester`), or equipment ID (`1W02`) and get
ranked results with highlighted bounding-box crops.

### With AI (Natural Language Mode)
1. User types a natural language query, e.g. *"show me electrical maps near
   Sound View Avenue in the Bronx"*
2. **Gemini** parses the intent → extracts search terms (`Sound View`) and
   filters (`region: Bronx`, `utility: Electric`)
3. Each search term is run through the existing keyword engine
4. Results are filtered by the extracted metadata constraints
5. **Gemini** generates a plain-English summary of what was found
6. UI shows the summary, parsed intent, and the same map-plate cards as before

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/ai-status` | Check if Gemini is configured (`{"available": true/false}`) |
| `GET /api/ai-search?q=...` | AI natural language search (requires API key) |
| `GET /api/search?q=...` | Direct keyword/FTS search (no AI, always works) |
| `GET /api/crop?plate=&page=&x0=&y0=&x1=&y1=` | PNG crop with highlight |
| `GET /api/pdf?plate=...` | Raw source PDF |

## Configuration

| Env Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | *(required)* | Google AI Studio API key |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Model to use (flash is fast + cheap) |

No new pip dependencies — the Gemini API is called via `urllib.request` (stdlib).

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
    +-- search()      -->  SQLite FTS5 (existing keyword engine)
    |
    +-- db.py         -->  index.db (plates, content_fts, word_positions)
```
