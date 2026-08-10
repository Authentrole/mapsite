import { OnInit, inject, Injectable } from '@angular/core';
import { AuthenticationGaurd } from './auth-guard';
import { Router } from '@angular/router';

@Injectable()
export class AccessControl implements OnInit {
  constructor(
    protected authenticationGaurd?: AuthenticationGaurd,
    protected router?: Router
  ) {}

  ngOnInit(): void {
    // if (this.authenticationGaurd) {
    //   this.authenticationGaurd.canActivate().subscribe((canActivate: any) => {
    //     if (!canActivate) {
    //       if (this.router) {
    //         this.router.navigate(['/info']);
    //       }
    //     }
    //   });
    // }
  }
}
