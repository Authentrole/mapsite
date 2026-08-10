import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ClipboardModule, ClipboardService } from 'ngx-clipboard';
import { NotifyService } from '../../core/components/notify/notify.service';
@Injectable({
  providedIn: 'root'
})
export class LsngService {
  public notifyService: NotifyService = inject(NotifyService);
  private clipboardService: ClipboardService = inject(ClipboardService);
  
  private http: HttpClient = inject(HttpClient);
  public apiURL: any;

  constructor() {}

  getNetworks() {
    return this.http.get(this.apiURL + '/networks');
  }

  getMunicipals() {
    return this.http.get(this.apiURL + '/municipals');
  }

  getLayoutTypes() {
    return this.http.get(this.apiURL + '/layoutTypes');
  }

  getLayoutClasses() {
    return this.http.get(this.apiURL + '/layoutClasses');
  }

  getLayoutSequences(payload?: any) {
    return this.http.post(this.apiURL + '/layoutSequences', payload);
  }

  getLayoutCount(payload?: any) {
    return this.http.post(this.apiURL + '/layoutCount', payload);
  }

  generateLayoutNumber(payload?: any) {
    return this.http.post(this.apiURL + '/layoutNumber', payload);
  }

  getLayoutHistory(payload?: any) {
    return this.http.post(this.apiURL + '/layoutHistory', payload);
  }

   CopyLayoutNumber(layoutNumber: string){
    this.clipboardService.copyFromContent(layoutNumber);
    this.notifyService.showNotification("Layout Number copied to clipboard", 'info');    
    
  }
}
