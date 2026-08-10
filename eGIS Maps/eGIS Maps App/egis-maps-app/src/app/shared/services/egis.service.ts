import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class EgisService {

  private http: HttpClient = inject(HttpClient);
  public apiURL: any;
  
    constructor() {}
    
    getRegions() {
      return this.http.get(this.apiURL + '/regions');
    }
}
