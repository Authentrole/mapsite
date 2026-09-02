"""Shared Azure OpenAI client for the eGIS Map Site AI Search engine.

Replaces the previous Gemini-based AI layer and Chroma's local
sentence-transformers embedder: intent extraction/summarization now call
an Azure OpenAI chat deployment, and page/query embeddings now come from
an Azure OpenAI embedding deployment, both via one AzureOpenAI client.

Environment (see search_engine/.env, loaded automatically -- never commit
real values, only .env.example-style placeholders):
    AZURE_OPENAI_API_KEY
    AZURE_OPENAI_ENDPOINT
    AZURE_OPENAI_API_VERSION
    AZURE_OPENAI_CHAT_DEPLOYMENT
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT
"""
from __future__ import annotations

import os

from dotenv import load_dotenv
from openai import AzureOpenAI, BadRequestError

load_dotenv()

AZURE_OPENAI_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21")
AZURE_OPENAI_CHAT_DEPLOYMENT = os.environ.get("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4o-mini")
AZURE_OPENAI_EMBEDDING_DEPLOYMENT = os.environ.get("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-large")

MAX_CHARS = 20000  # stay well under the embedding deployment's per-request input limit

_client: AzureOpenAI | None = None


def is_available() -> bool:
    return bool(AZURE_OPENAI_API_KEY) and bool(AZURE_OPENAI_ENDPOINT)


def get_client() -> AzureOpenAI:
    global _client
    if _client is None:
        if not is_available():
            raise RuntimeError("AZURE_OPENAI_API_KEY / AZURE_OPENAI_ENDPOINT are not configured")
        _client = AzureOpenAI(
            api_key=AZURE_OPENAI_API_KEY,
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_version=AZURE_OPENAI_API_VERSION,
        )
    return _client


def chat(system_prompt: str, user_message: str, temperature: float = 0.1, max_tokens: int = 512) -> str:
    """Call the chat deployment and return the reply text."""
    resp = get_client().chat.completions.create(
        model=AZURE_OPENAI_CHAT_DEPLOYMENT,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return (resp.choices[0].message.content or "").strip()


def _embed_with_shrink(chunk: list[str], max_attempts: int = 6) -> list[list[float]]:
    """Call the embedding deployment, shrinking every text in `chunk` and
    retrying if Azure rejects it for exceeding its per-input token limit
    (8192 tokens for text-embedding-3-*). A character count is a poor
    proxy for token count on this corpus -- dense, label-heavy plate text
    (many short alphanumeric IDs like "M22158", "10-AB") tokenizes far
    less efficiently than prose, so a single static character cap either
    wastes budget on plain text or still overflows on label-heavy text.
    Shrinking on the actual rejection is correct regardless of content."""
    for attempt in range(max_attempts):
        try:
            resp = get_client().embeddings.create(model=AZURE_OPENAI_EMBEDDING_DEPLOYMENT, input=chunk)
            return [d.embedding for d in resp.data]
        except BadRequestError as e:
            if "maximum input length" not in str(e) or attempt == max_attempts - 1:
                raise
            chunk = [(t[:int(len(t) * 0.6)] or " ") for t in chunk]
    raise RuntimeError("unreachable")  # loop always returns or raises


def embed_text(text: str) -> list[float]:
    """Embed a single piece of text (typically a search query)."""
    return _embed_with_shrink([text[:MAX_CHARS] or " "])[0]


def embed_texts(texts: list[str], chunk_size: int = 16) -> list[list[float]]:
    """Embed many texts, chunked to stay under per-request payload limits."""
    vectors: list[list[float]] = []
    for i in range(0, len(texts), chunk_size):
        chunk = [t[:MAX_CHARS] or " " for t in texts[i:i + chunk_size]]
        vectors.extend(_embed_with_shrink(chunk))
    return vectors
