import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FileSearchService {
  private http: HttpClient = inject(HttpClient);

  constructor() {}

  getFiles(apiUrl: string, model: any) {
    return this.http.post(apiUrl, model);
  }

  getFile(apiUrl: string, model: any) {
    return this.http.post(apiUrl, model);
  }
}
