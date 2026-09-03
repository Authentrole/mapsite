# eGIS Map Site — AI Search Engine

Local search engine for Con Edison engineering map plates, with an AI natural
language layer powered by Azure OpenAI.

## Quick Start

```powershell
# 1. Create search_engine/.env with your Azure OpenAI + Azure AI Search config (see Configuration below)

# 2. Make sure the index exists (run ingest first if not)
python ingest.py --source local --input "C:\path\to\your\PDFs" --reset
# or: python ingest.py --source blob --reset   (reads PDFs from Blob Storage instead)

# 3. Start the server
python server.py 8000

# 4. Open http://127.0.0.1:8000 in your browser
```

## How It Works

### Without AI (Keyword Mode)
Semantic (vector) search over extracted map content, via a dedicated Azure
AI Search index built by `ingest.py`. Enter a plate ID (`11-AD`), street
name (`Eastchester`), or equipment ID (`1W02`) and get plates ranked by
embedding similarity, with full-page thumbnails.

### With AI (Natural Language Mode)
1. User types a natural language query, e.g. *"show me electrical maps near
   Sound View Avenue in the Bronx"*
2. **Azure OpenAI** (chat deployment) parses the intent → extracts search
   terms (`Sound View`) and filters (`region: Bronx`, `utility: Electric`)
3. Each search term is run through the same Azure AI Search semantic search
4. Results are filtered by the extracted metadata constraints
5. **Azure OpenAI** generates a plain-English summary of what was found
6. UI shows the summary, parsed intent, and the same map-plate cards as before

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/ai-status` | Check if Azure OpenAI is configured (`{"available": true/false}`) |
| `GET /api/ai-search?q=...` | AI natural language search (requires Azure OpenAI config) |
| `GET /api/search?q=...` | Direct semantic search (no AI, always works once the index exists) |
| `GET /api/embedding-status` | Size of the Azure AI Search vector index |
| `GET /api/crop?plate=&page=` | PNG page thumbnail |
| `GET /api/pdf?plate=...` | Raw source PDF |

There are no per-word bounding boxes in this index, so `/api/crop` always
returns a full-page thumbnail rather than a highlighted crop of one match.

## Configuration

All config lives in `search_engine/.env` (gitignored -- never commit real
values).

| Env Variable | Default | Description |
|---|---|---|
| `AZURE_OPENAI_API_KEY` | *(required)* | Azure OpenAI resource key |
| `AZURE_OPENAI_ENDPOINT` | *(required)* | Azure OpenAI resource endpoint, e.g. `https://<resource>.openai.azure.com/` |
| `AZURE_OPENAI_API_VERSION` | `2024-10-21` | API version |
| `AZURE_OPENAI_CHAT_DEPLOYMENT` | `gpt-4o-mini` | Deployment name for intent extraction + summaries |
| `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` | `text-embedding-3-large` | Deployment name for page/query embeddings -- see `search_index.py`'s `EMBEDDING_DIMENSIONS`, must match |
| `AZURE_SEARCH_ENDPOINT` | *(required)* | Azure AI Search service endpoint, e.g. `https://<service>.search.windows.net` |
| `AZURE_SEARCH_API_KEY` | *(required)* | Azure AI Search admin key |
| `AZURE_SEARCH_INDEX_NAME` | `egis-mapsite-electric-index` | Dedicated index name -- other indexes on the same service are never touched |
| `AZURE_STORAGE_CONNECTION_STRING` | *(only for `--source blob`)* | Blob Storage connection string |
| `AZURE_STORAGE_CONTAINER` | *(only for `--source blob`)* | Container holding the source PDFs |

Embeddings (page text at ingest time, query text at search time) and the
natural-language layer (intent + summary) both call Azure OpenAI -- there
is no local/offline fallback. `pip install -r ../requirements.txt` pulls in
`azure-search-documents`, `azure-storage-blob`, and `openai`.

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
    +-- ai_search.py     -->  azure_openai.py (chat: intent extraction + summarization)
    |
    +-- search()         -->  Azure AI Search nearest-neighbor
    |                           over azure_openai.py (embedding) vectors
    +-- search_index.py   -->  Azure AI Search (dedicated index, see AZURE_SEARCH_INDEX_NAME)
    |
    +-- blob_storage.py   -->  Azure Blob Storage (only if a page's source_type is "blob")
```

`ingest.py` extracts each PDF page's text (PyMuPDF for born-digital pages,
tiled RapidOCR for scanned ones; source PDFs from a local folder or Blob
Storage, see `--source`), tags it with heuristic metadata (`metadata.py`),
embeds it via `azure_openai.py`, and upserts it into the Azure AI Search
index.

**Note**: the embedding dimension (`search_index.py`'s `EMBEDDING_DIMENSIONS`,
currently 1536 for `text-embedding-3-small`) is baked into the index's
vector field at creation time. Changing `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`
to a model with a different output dimension requires updating
`EMBEDDING_DIMENSIONS` to match and rebuilding the index with `ingest.py --reset`.
