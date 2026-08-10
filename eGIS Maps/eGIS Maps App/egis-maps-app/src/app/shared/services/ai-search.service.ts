import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import { ConfigService } from '../../core/services/config.service';

export interface AiSearchPage {
  page: number;
  similarity?: number;
  matchedWord?: string | null;
  bbox?: [number, number, number, number] | null;
}

export interface AiSearchResultPlate {
  plateId: string;
  region: string;
  utility: string;
  facilityType: string;
  bestScore: number | null;
  idMatch: boolean;
  pages: AiSearchPage[];
}

export interface AiSearchResponse {
  query: string;
  intent?: {
    intent_summary: string;
    filters: any;
    search_terms: string[];
    in_scope?: boolean;
  };
  summary: string;
  results: AiSearchResultPlate[];
  totalFound: number;
  retrieval?: 'semantic' | 'keyword' | 'rejected';
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AiSearchService {
  private http: HttpClient = inject(HttpClient);
  private configService: ConfigService = inject(ConfigService);

  private cachedBaseUrl: string | null = null;

  search(query: string): Observable<AiSearchResponse> {
    return this.baseUrl().pipe(
      switchMap((baseUrl) => {
        const url = `${baseUrl}/api/ai-search?q=${encodeURIComponent(query)}`;
        return this.http.get<AiSearchResponse>(url);
      })
    );
  }

  /** Base URL of the search_engine API, e.g. "http://127.0.0.1:8000". */
  baseUrl(): Observable<string> {
    if (this.cachedBaseUrl) {
      return new Observable((subscriber) => {
        subscriber.next(this.cachedBaseUrl!);
        subscriber.complete();
      });
    }
    return this.configService.getApiDetail().pipe(
      map((config: any) => {
        const raw: string = config?.[0]?.ai_search_api_url || 'http://127.0.0.1:8000/';
        const resolved = raw.replace(/\/$/, '');
        this.cachedBaseUrl = resolved;
        return resolved;
      })
    );
  }

  pdfUrl(baseUrl: string, plateId: string): string {
    return `${baseUrl}/api/pdf?plate=${encodeURIComponent(plateId)}`;
  }

  /** Crop URL for a page: a tight highlighted crop when a bbox is known,
   * otherwise a full-page preview thumbnail (server already handles both). */
  cropUrl(baseUrl: string, plateId: string, page: AiSearchPage): string {
    let url = `${baseUrl}/api/crop?plate=${encodeURIComponent(plateId)}&page=${page.page}`;
    if (page.bbox && page.bbox.length === 4) {
      const [x0, y0, x1, y1] = page.bbox;
      url += `&x0=${x0}&y0=${y0}&x1=${x1}&y1=${y1}`;
    }
    return url;
  }
}
