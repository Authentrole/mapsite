import { Observable, of } from 'rxjs';
import { Injectable, Output, inject } from '@angular/core';

// import { UserModel } from '../models/user.model';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MessageService } from '@progress/kendo-angular-l10n';
import { flatMap, map, switchMap } from 'rxjs/operators';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root',
})
export class AuthorizationService {
  @Output() public isValidUser?: boolean;
  @Output() public AuthenticatedUser?: any;
  @Output() public AuthenticatedUserName?: string;
  @Output() public drawItems: Array<any> = [];
  @Output() public loadingPanelVisible?: boolean = true;
  @Output() public config: any;
  @Output() public apiUrl: any;
  @Output() public uam_api_url: any;
  @Output() public selectedItem: any;
  // public customMsgService: CustomMessagesService;
  public drawItemsOrg: Array<any> = [];
  public http: HttpClient = inject(HttpClient);
  public configService: ConfigService = inject(ConfigService);

  constructor() {
    // this.customMsgService = this.msgService as CustomMessagesService;
    // this.drawItemsOrg=
    // [
    //     { id:8, text: this.customMsgService.translate('home'), icon: 'k-i-home', path: '/', selected: false },
    //     { id:1, text: this.customMsgService.translate('appusage'), icon: 'k-i-chart-pie', path: '/appusage', selected: false },
    //     { id:6, text: this.customMsgService.translate('appperf'), icon: 'k-i-graph', path: '/appperf', selected: false },
    //     { id:7, text: this.customMsgService.translate('appusers'), icon: 'k-i-myspace', path: '/appusers', selected: false },
    //     // { id:8, text: this.customMsgService.translate('reports'), icon: 'k-i-toggle-full-screen-mode', path: '/reports', selected: false },
    //     {id:4, text: this.customMsgService.translate('sessions'), icon: 'k-i-files', path: '/sessions', selected: false },
    //     {id:5, text: this.customMsgService.translate('dgn'), icon: 'k-i-aggregate-fields', path: '/dgn', selected: false },
    //     {id:3, text: this.customMsgService.translate('uam'), icon: 'k-i-user', path: '/uam', selected: false },
    //     {id:9, text: this.customMsgService.translate('notifications'), icon: 'k-i-notification', path: '/notifications', selected: false },
    //     {id:2, text: this.customMsgService.translate('admin'), icon: 'k-i-gear', path: '/admin', selected: false },
    // ];
  }

  isAuthenticated(): Observable<any> {
    return this.configService.getApiDetail().pipe(
      switchMap((resp: any) => {
        this.config = resp;
        this.apiUrl = this.config[0].api_url;
        this.uam_api_url = this.config[0].uam_api_url;
        let url = this.apiUrl;
        url = url + 'api/Access/AuthenticateUser';
        return this.http.get(url);
      }),
      map((result: any) => {
        // console.log(result);
        return result;
      })
    );
  }

  isAuthenticated1(): Observable<any> {
    //this.config=configData ? configData : config;
    this.apiUrl = this.config.apiUrl_dev;
    let url = this.apiUrl;
    // if(url){
    url = url + 'api/Access/AuthenticateUser';
    return this.http.get(url);
    // }
    // else{
    //     while (!this.apiUrl){
    //         this.http.get('../../assets/config.json').subscribe((resp)=>{
    //             this.config = resp;
    //             this.apiUrl = environment.production ? this.config.apiUrl : this.config.apiUrl_dev;
    //             });
    //         setTimeout('',600);
    //     }
    //     url = this.apiUrl;
    //     url = url + 'api/Access/AuthenticateUser';
    //     return this.http.get(url);
    // //     return this.http.get('../../assets/config.json').pipe(map((resp:any)=>{
    // //         this.config = resp;
    // //         this.apiUrl = environment.production ? this.config.apiUrl : this.config.apiUrl_dev;
    // //         url = this.apiUrl;
    // //         url = url + 'api/Access/AuthenticateUser';
    // //         return this.http.get(url);
    // //     }));
    // }
  }

  isAuthenticatedUser(): Observable<any> {
    this.apiUrl = this.config[0].api_url;
    let url = this.apiUrl;
    url = url + 'api/Access/AuthenticateUser';
    return this.http.get(url);
  }
}
