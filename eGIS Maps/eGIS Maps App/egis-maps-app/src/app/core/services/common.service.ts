import { ElementRef, Injectable } from '@angular/core';
import { AuthorizationService } from './authorization.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import moment from 'moment';

@Injectable({
  providedIn: 'root'
})
export class CommonService {



  constructor(private http: HttpClient,public authenticationService: AuthorizationService) { }

    
    buildNonCacheURL(url: string) {
      return url + '?t=' + moment().format('MMDDYYYYHHmmss');
    }
    openURL(url: any,isNonCacheURL:boolean=true) {
      if(isNonCacheURL){
        //console.log('cache' + this.buildNonCacheURL(url));
        window.open(this.buildNonCacheURL(url), '_blank');
      }
      else{
        console.log(url);
        window.open(url, '_blank');
      }
      
    }    

    formatDate(value:any,dateFormat:any){
      dateFormat = dateFormat ? dateFormat : 'MM/DD/YYYY hh:mm A';
      value = value ? new Date(moment(value).format(dateFormat)) : value;
      return value;
    }

    sortArray(arrayToSort:any[]):any[] {
      arrayToSort = arrayToSort.sort((a:any, b:any) => {
                    const lowerA = a.toLowerCase();
                    const lowerB = b.toLowerCase();
                    return lowerA.localeCompare(lowerB);
                  });
      return arrayToSort;
    }

    scrollToPanel(panelElement:ElementRef): void {
      if (panelElement) {
        panelElement.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
}
