import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from 'rxjs';
import { AuthorizationService } from './authorization.service';
//import {config} from '../../config';

@Injectable({
  providedIn: 'root'
})
export class UamNewService {

  constructor(private http: HttpClient,public authenticationService: AuthorizationService) { }
  
  environments : any;
  applications :any;
    
  GetEnvironments(): Observable<any> {
    let url = this.authenticationService.uam_api_url + "api/EgisEnvironments";
    return this.http.get(url);
  }

  GetAllEnvironments(): Observable<any> {
    let url = this.authenticationService.uam_api_url + "api/EgisEnvironments/All";
    return this.http.get(url);
  }

  GetApplications(): Observable<any> {
    let url = this.authenticationService.uam_api_url + "api/EgisApplications";
    return this.http.get(url);
  }


  GetRoles(): Observable<any> {
    let url = this.authenticationService.uam_api_url + "api/EgisAppRoles";
    return this.http.get(url);
  }

  VerifyUserAccess(data:any): Observable<any> {
    let url = this.authenticationService.uam_api_url + "api/access/verifyuseraccess"; 
    return this.http.post(url,JSON.stringify(data));
  }

  GrantOrRevokeUserAccess(data:any,isRevoke:boolean): Observable<any> {
    let url = this.authenticationService.uam_api_url + "api/access/GrantUserAccess"; 
    if(isRevoke){
      url=this.authenticationService.uam_api_url + "api/access/RevokeUserAccess"; 
    }   
    
    return this.http.post(url,JSON.stringify(data));
  }
  RefreshPortalMemberShip(data:any): Observable<any> {
    let url = this.authenticationService.uam_api_url + "api/access/RefreshPortalMembership"; 
    return this.http.post(url,JSON.stringify(data));
  }

  GetNotifications(): Observable<any> {
    let url =  this.authenticationService.uam_api_url + "api/EgisNotifications/ActiveNotifications";
    return this.http.get(url);
  }

  GetCommodities(): Observable<any> {
    let url = this.authenticationService.uam_api_url + "api/EgisCommodities";
    return this.http.get(url);
  }
}
