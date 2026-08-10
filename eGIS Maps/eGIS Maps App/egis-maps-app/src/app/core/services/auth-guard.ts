import { AuthorizationService } from './authorization.service';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  Router,
  CanActivate,
  NavigationExtras,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Injectable } from '@angular/core';
// import { error } from '@angular/compiler/src/util';
import * as _ from 'lodash';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CoreService } from './core.service';
// import * as configData from '../../assets/config.json';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationGaurd {
  public user: any;
  constructor(
    private authorizationService: AuthorizationService,
    private coreService: CoreService,
    private router: Router,
    private http: HttpClient
  ) {
    // this.http.get('../../assets/config.json').subscribe((resp)=>{
    //     this.authorizationService.config = resp;
    //     this.authorizationService.apiUrl = environment.production ? this.authorizationService.config.apiUrl : this.authorizationService.config.apiUrl_dev;
    //     });
  }

  public defaultRout: any;

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    // this.coreService.isBusy = true;
    this.coreService.setBusy(true);

    this.defaultRout = route.routeConfig?.path;
    // debugger;
    if (this.authorizationService.isValidUser) {
      return of(true);
    }
    else {
      return this.authorizationService.isAuthenticated().pipe(
        map((response) => {
          if (response) {
            if (!response.errorMSg) {

              this.authorizationService.AuthenticatedUser = response;
              this.authorizationService.AuthenticatedUserName = response.userName ? response.userName : null;
              if (
                this.authorizationService.AuthenticatedUserName !== '' ||
                this.authorizationService.AuthenticatedUserName !== null ||
                this.authorizationService.AuthenticatedUserName !== undefined
              ) {
                // this.authorizationService.selectedItem =
                //   route.routeConfig?.title;
                this.authorizationService.isValidUser = true;
                if (route.url[0].path.toString().toLowerCase().includes('info')) {
                  this.router.navigate(['/']);
                  return true;
                  // if(this.router.url == '/'){
                  //   this.router.navigate(['/']);
                  //   return true;
                  // }
                  // else{
                  //   return false;
                  // }
                }
                else if (route.url[0].path.toString().toLowerCase().includes('facility')) {
                  const curentFacility = JSON.parse(
                    localStorage.getItem('MAPS_Current_Facility') || '{}'
                  );

                  if (curentFacility && curentFacility.data) {
                    // if(route.queryParams && route.queryParams['data']){                    
                    return true;
                  }
                  else {
                    this.router.navigate(['/']);
                    return true;
                  }
                }
                else {
                  return true;
                }
              } else {
                // this.coreService.isBusy = false;
                this.coreService.setBusy(false);

                this.authorizationService.isValidUser = false;
                if (!route.url[0].path.toString().toLowerCase().includes('info')) {
                  this.router.navigate(['/info', { isAuthError: true }]);
                  return false;
                }
                else {
                  return true;
                }
              }
            }
          }
          // this.coreService.isBusy = false;
          this.coreService.setBusy(false);

          this.authorizationService.isValidUser = false;
          //this.router.navigate(['/info']);
          if (!route.url[0].path.toString().toLowerCase().includes('info')) {
            this.router.navigate(['/info', { isAuthError: true }]);
            return false;
          }
          else {
            return true;
          }
        }),
        catchError((e) => {
          this.authorizationService.isValidUser = false;
          //this.router.navigate(['/info']);      
          if (!route.url[0].path.toString().toLowerCase().includes('info')) {
            this.router.navigate(['/info', { isAuthError: false }]);
            return of(false)
          }
          else {
            return of(true)
          }
        })
      );
    }
  }
}

// isAuthenticated(){
//     let url = 'http://localhost:2711/api/Access';
//     return this.http.get(url);
// }
