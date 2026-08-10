import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withHashLocation, withRouterConfig } from '@angular/router';

import { routes } from './app.routes';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NotificationModule } from '@progress/kendo-angular-notification';
import {
  provideHttpClient,
  HTTP_INTERCEPTORS,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { HttpCoreInterceptor } from './core/services/httpCoreInterceptor';
import { WindowModule, WindowService } from '@progress/kendo-angular-dialog';


export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes,withHashLocation()),
    importProvidersFrom(BrowserAnimationsModule, NotificationModule, WindowModule),
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HttpCoreInterceptor,
      multi: true,
    },
  ],
};
