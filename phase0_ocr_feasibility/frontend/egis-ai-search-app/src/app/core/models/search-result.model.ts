/** Mirrors the JSON shape returned by search_engine/server.py (search() / ai_search()). */

export interface PlatePage {
  page: number;
  extractionQuality: string;
  idMatch: boolean;
  score: number | null;
  matchedWord: string | null;
  bbox: [number, number, number, number] | null;
  fuzzyDistance: number | null;
}

export interface PlateResult {
  plateId: string;
  region: string;
  regionCode: string | null;
  utility: string;
  facilityType: string;
  metadataSource: string;
  metadataConfidence: number | string;
  pages: PlatePage[];
  bestScore: number | null;
  idMatch: boolean;
}

export interface SearchIntent {
  search_terms: string[];
  filters?: {
    region?: string;
    utility?: string;
    facility_type?: string;
  };
  intent_summary?: string;
}

export interface SearchResponse {
  query: string;
  fuzzy?: boolean;
  intent?: SearchIntent;
  summary?: string;
  results: PlateResult[];
  totalFound?: number;
  error?: string;
}

export interface AiStatus {
  available: boolean;
  model: string;
}
