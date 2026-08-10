# eGIS AI Search — Angular + Kendo UI demo frontend

This is a from-scratch Angular 21 + Kendo UI for Angular app that replicates the
layout and UX of the **eGIS Knowledge HUB "AI Search"** page (chat panel with
markdown responses/feedback/voice input on one side, a filterable **Data
Sources** panel on the other), wired up to the existing Python search API in
`../search_engine/server.py` instead of the Knowledge Hub's own backend.

It was written by hand (not scaffolded with `ng new`/`ng generate`, and not
`npm install`ed or compiled) because this machine doesn't have Node.js
installed. **Treat it as unverified until you run it.**

## What you need to do before this will run

1. Install **Node.js 20.x LTS** (or whatever major version resolves the
   `@angular/core@21.2.17` / `@angular/cli@21.2.12` pins below — adjust the
   versions in `package.json` if those aren't published, e.g. drop to
   whatever Angular version `npm view @angular/cli versions` shows as latest).
2. From this folder:
   ```
   npm install
   ```
3. Kendo UI for Angular components (`@progress/kendo-angular-*`) require a
   license for anything beyond the trial period — `@progress/kendo-licensing`
   will print a console warning/watermark until you either activate a trial
   (`npx kendo-ui-license activate`) or add a real license key. This doesn't
   block local dev, just something to be aware of before demoing.

## Running it

Two servers, same as any Angular app with a separate API:

```bash
# Terminal 1 — the existing Python search engine (from phase0_ocr_feasibility/)
cd ../..
python search_engine/server.py 8000   # requires search_engine/index.db (run ingest.py first if missing)

# Terminal 2 — this Angular app
cd frontend/egis-ai-search-app
npm start   # = ng serve --proxy-config proxy.conf.json, http://localhost:4200
```

`proxy.conf.json` forwards `/api/*` requests from the Angular dev server (port
4200) to the Python server (port 8000), so `SearchService` can just call
relative URLs like `/api/ai-search`.

If `GEMINI_API_KEY` isn't set for the Python server, `/api/ai-status` reports
`available: false` and the chat assistant automatically falls back to
`/api/search` (plain keyword/fuzzy search) instead of `/api/ai-search`,
same graceful-degradation behavior as the original static demo page.

## What maps to what

| Knowledge Hub AI Search (Angular + Kendo) | This app |
|---|---|
| `ai-search.component` (chat + history + sources, 3-pane) | `ai-search.component` (chat + sources, 2-pane — no history sidebar per scope) |
| `assistant.component` — chat bubbles, markdown, mic, feedback | Same UX, calls `SearchService.aiSearch()/keywordSearch()` instead of `AiChatService` |
| `datasource.component` — filterable source cards | Same UX, fields remapped from KH's `{title, application, content_type, link}` doc shape to the OCR engine's `PlateResult` shape (plate ID, region, utility, facility type, page-match thumbnails via `/api/crop`) |
| `@progress/kendo-angular-*` (buttons, grid, dialog, upload, …) | Trimmed to just what's used: buttons, inputs, icons, indicators (no grid/dialog/upload — not needed for this page) |

## Not carried over from the reference app

- Chat history sidebar / session persistence backend (`ai-chat.service.ts`'s
  session API) — this demo has no multi-session backend, so `assistant.component`
  only keeps the current conversation in `localStorage`.
- Feedback thumbs-up/down still exist visually but are local-only (no
  `POST` — the Tier-3 demo API has no feedback endpoint).
- Auth/UAM guards, routing shell (header/sidenav/footer), announcements, etc.
  — irrelevant to a single-page demo.
