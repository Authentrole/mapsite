"""AI-powered natural language search layer using Azure OpenAI.

Sits between the user's natural language query and the existing search
engine. The chat deployment interprets the intent, extracts structured
search parameters, and vectordb/server does the retrieval. After
retrieval, the same chat deployment summarizes the results in plain
English.

Configuration lives in azure_openai.py / search_engine/.env
(AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_CHAT_DEPLOYMENT).
"""
from __future__ import annotations

import json
import re

import azure_openai

# System prompt that teaches the model about our domain
INTENT_SYSTEM_PROMPT = """\
You are an AI assistant for the Con Edison eGIS Map Site search system.
The system indexes engineering map plates (PDFs) containing electrical distribution
infrastructure: street names, plate IDs (like "11-AD", "1W02"), equipment IDs,
substation names, grid labels, and region information.

Your job: given a user's natural language query, extract structured search parameters.

Available metadata filters:
- region: Manhattan, Queens, Westchester, Bronx, Brooklyn, Staten_Island
- region_code: M, Q, W, X, B, R
- utility: Electric, Gas, Steam
- facility_type: M&S Plate, Feeder/Network Map, Structure Layout Sketch, Composite/Substation Area Map, Gas Regulator Plate, Steam Mains and Service Plate

You MUST respond with valid JSON only (no markdown, no explanation), in this format:
{
  "in_scope": true or false,
  "search_terms": ["term1", "term2"],
  "filters": {
    "region": null or "region name",
    "utility": null or "Electric"/"Gas"/"Steam",
    "facility_type": null or one of the facility types above
  },
  "intent_summary": "one sentence describing what the user is looking for"
}

Rules:
- in_scope: false if the query is NOT about Con Edison map plates, utility infrastructure, streets/locations, plate IDs, equipment, regions, or facility types -- e.g. celebrities, general trivia, other companies, coding help, math, or any topic unrelated to this map search system. true otherwise. When in doubt about a genuine location/plate/utility question, prefer true.
- If in_scope is false, you may leave search_terms empty and filters null, but still fill in intent_summary with a one-sentence description of what the user actually asked (not a map-related rephrasing).
- search_terms: the most specific keywords to search for (street names, plate IDs, equipment IDs, location names). Maximum 3 terms. Each term will be searched independently.
- If the user mentions a borough, set the region filter AND still include location-specific terms.
- If the user asks for "all maps" or "everything", use a broad term like the region or utility.
- Plate IDs look like: "11-AD", "1W02", "10-AB", "M-22158". If the user mentions one, put it as-is in search_terms.
- Street names: use the name without "Street"/"Avenue" suffix if possible (e.g. "Eastchester" not "Eastchester Road").
- Be concise. Do not include generic words like "map", "plate", "show" in search_terms.
"""

SUMMARY_SYSTEM_PROMPT = """\
You are an AI assistant for the Con Edison eGIS Map Site. Given search results
(map plates with metadata), write a brief, helpful summary for the user.
Keep it to 2-3 sentences. Mention how many plates were found, what regions/areas
they cover, and any notable details. If no results were found, say so and suggest
what the user might try instead.
"""


def extract_intent(user_query: str) -> dict:
    """Use the Azure OpenAI chat deployment to parse natural language into
    structured search params.

    Returns:
        {
            "search_terms": ["term1", ...],
            "filters": {"region": ..., "utility": ..., "facility_type": ...},
            "intent_summary": "..."
        }
    """
    raw = azure_openai.chat(INTENT_SYSTEM_PROMPT, user_query)

    # Strip markdown code fences if the model wraps the JSON
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: treat the whole query as a single search term
        return {
            "in_scope": True,
            "search_terms": [user_query],
            "filters": {"region": None, "utility": None, "facility_type": None},
            "intent_summary": f'Searching for "{user_query}"',
        }

    # Validate / sanitize
    if not isinstance(parsed.get("in_scope"), bool):
        parsed["in_scope"] = True
    if not isinstance(parsed.get("search_terms"), list) or not parsed["search_terms"]:
        parsed["search_terms"] = [user_query] if parsed["in_scope"] else []
    if "filters" not in parsed:
        parsed["filters"] = {"region": None, "utility": None, "facility_type": None}
    if "intent_summary" not in parsed:
        parsed["intent_summary"] = f'Searching for: {", ".join(parsed["search_terms"])}' if parsed["search_terms"] else f'Off-topic query: "{user_query}"'

    return parsed


def summarize_results(user_query: str, results: list[dict]) -> str:
    """Use the Azure OpenAI chat deployment to produce a human-friendly
    summary of search results."""
    if not results:
        context = f'User searched for: "{user_query}"\nNo results were found.'
    else:
        # Build a compact representation for the model
        plates_info = []
        for r in results[:10]:  # limit to avoid token explosion
            pages_str = ", ".join(
                f"p{p['page']}(matched: {p.get('matchedWord', '?')})"
                for p in r.get("pages", [])[:3]
            )
            plates_info.append(
                f"- {r['plateId']}: region={r.get('region','?')}, "
                f"utility={r.get('utility','?')}, "
                f"facility={r.get('facilityType','?')}, "
                f"pages=[{pages_str}]"
            )
        context = (
            f'User searched for: "{user_query}"\n'
            f"Found {len(results)} plate(s):\n" + "\n".join(plates_info)
        )

    return azure_openai.chat(SUMMARY_SYSTEM_PROMPT, context)


def is_available() -> bool:
    """Check if the AI layer is configured (Azure OpenAI key + endpoint present)."""
    return azure_openai.is_available()
