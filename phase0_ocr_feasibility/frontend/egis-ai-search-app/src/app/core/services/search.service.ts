import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AiStatus, SearchResponse } from '../models/search-result.model';

/**
 * Talks to the Tier-3 AI search engine's Python stdlib server
 * (search_engine/server.py). In dev, `ng serve --proxy-config
 * proxy.conf.json` forwards /api/* to http://127.0.0.1:8000 so this
 * can just use relative URLs.
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  constructor(private http: HttpClient) {}

  aiStatus(): Observable<AiStatus> {
    return this.http.get<AiStatus>('/api/ai-status');
  }

  aiSearch(query: string): Observable<SearchResponse> {
    return this.http.get<SearchResponse>('/api/ai-search', { params: { q: query } });
  }

  keywordSearch(query: string): Observable<SearchResponse> {
    return this.http.get<SearchResponse>('/api/search', { params: { q: query } });
  }

  cropUrl(plateId: string, page: number, bbox?: [number, number, number, number] | null): string {
    let url = `/api/crop?plate=${encodeURIComponent(plateId)}&page=${page}`;
    if (bbox) {
      url += `&x0=${bbox[0]}&y0=${bbox[1]}&x1=${bbox[2]}&y1=${bbox[3]}`;
    }
    return url;
  }

  pdfUrl(plateId: string): string {
    return `/api/pdf?plate=${encodeURIComponent(plateId)}`;
  }
}
