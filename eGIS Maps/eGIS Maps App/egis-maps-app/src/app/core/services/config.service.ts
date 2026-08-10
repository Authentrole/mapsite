import { Injectable, ViewContainerRef, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import moment from 'moment';
import { WindowService } from '@progress/kendo-angular-dialog';
import { FacilityMapWinComponent } from '../../feature/components/faciltiy-map-win/faciltiy-map-win.component';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private http: HttpClient = inject(HttpClient);
  public windowService: WindowService = inject(WindowService);
  public containerRef: ViewContainerRef | undefined; 
  configJson:any;

  getNavItem(component: string): Observable<any> {
    let navItemPath = 'assets/json/nav_items.json';

    if (component !== 'header') {
      return this.http.get(this.buildNonCacheURL(navItemPath)).pipe(
        switchMap((response: any) => {
          const navItem = response.find(
            (item: any) => item.name.toLowerCase() === component.toLowerCase()
          );
          if (navItem && navItem.url) {
            return this.http.get(this.buildNonCacheURL(navItem.url));
          } else {
            throw new Error('Facility Maps path not found in configuration');
          }
        })
      );
    } else {
      return this.http.get(this.buildNonCacheURL(navItemPath));
    }
  }

  getAllNavItem() {
    return this.http.get(this.buildNonCacheURL('assets/json/nav_items.json'));
  }

  getConfig(config:any) {
    return this.http.get(this.buildNonCacheURL('assets/json/' + config + '.json'));
  }

  getApiDetail() {
    return this.http.get(this.buildNonCacheURL('assets/json/config.json'));
  }

  getDataByCommodity(commodity: string): Observable<any> {
    let path = `assets/json/${commodity}.json`;
    return this.http.get(this.buildNonCacheURL(path));
  }

  buildNonCacheURL(url: string) {
    if (url.indexOf('/#/') >= 0) {
      return url;
  }
  else{
    let delimiter ='?';

    if(url.includes('?')){
      delimiter ='&';
    }
    return url + delimiter + 't=' + moment().format('MMDDYYYYHHmmss');
    // return delimiter == '&' ? url : url + delimiter + 't=' + moment().format('MMDDYYYYHHmmss');
  }
    
  }

  openLink(url: any,isNonCacheURL:boolean=true) {
    if(isNonCacheURL){
      //console.log('cache' + this.buildNonCacheURL(url));
      window.open(this.buildNonCacheURL(url), '_blank');
    }
    else{
      console.log(url);
      window.open(url, '_blank');
    }
    
  }

  openDialog(detail:any | string, canSearch: boolean, pdfViewer:boolean, facilityMapPath:string=''){
   
    let data:any =JSON.stringify({data:detail, canSearch: canSearch, pdfViewer : pdfViewer, facilityMapPath : facilityMapPath });
    localStorage.setItem('MAPS_Current_Facility',data);

    this.getApiDetail().subscribe(config=>{
      this.configJson =  config;
      if(this.configJson && this.configJson[0].viewer_mode){
        if(this.configJson[0].viewer_mode.toLowerCase().trim() == 'window'){
          this.openDialogWin(detail, canSearch, pdfViewer, facilityMapPath);
          return;
        }
      }
      let url = './#/facility';
      // if(!canSearch){
      //     url = detail.toLowerCase().endsWith('.pdf') ? url + '?file=' + detail.replace(this.configJson[0].file_url,'') : url;
      // }
      window.open(url, '_blank');      
    });
  }

  openDialogWin(detail: any | string, canSearch: boolean, pdfViewer:boolean, facilityMapPath:string='') {
    // titlebar: TemplateRef<unknown>
    const windowRef = this.windowService.open({
      content: FacilityMapWinComponent,
      // titleBarContent: titlebar,
      title: "ConEdison Facility Map",
      // appendTo: this.containerRef,
      state: 'maximized',
      width: 1350,
      height: 600,
      top: 100,
      left: 50
    });

    const modalInstance = windowRef.content.instance as FacilityMapWinComponent;
    modalInstance.pdfDetail = detail;
    modalInstance.canSearch = canSearch;
    modalInstance.pdfViewer = pdfViewer;
    modalInstance.facilityMapPath = facilityMapPath;

  }

  GetRAGImages(): Observable<any>{
    return this.http.get(this.buildNonCacheURL('assets/json/rag_symbols.json'));
  }

  getTemplate(name:any) {
    return this.http.get(this.buildNonCacheURL('assets/html/' + name +'.html'),{responseType: 'text'});
  }

   toTitleCase(str: string): string {
    return str.toLowerCase().replace(/(^|\s)\S/g, function (firstLetter) {
      return firstLetter.toUpperCase();
    });
  }
}
