import { Routes } from '@angular/router';
import { NavcontentComponent } from './core/components/navcontent/navcontent.component';
import { HomeComponent } from './pages/home/home.component';
import { InfoComponent } from './pages/info/info.component';
import { AppComponent } from './app.component';
import { AuthenticationGaurd } from './core/services/auth-guard';
import { FacilityMapComponent } from './pages/faciltiy-map/faciltiy-map.component';
import { MapViewerComponent } from './pages/mapviewer/mapviewer.component';
import { LsngComponent } from './pages/lsng/lsng.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  // {
  //   path: '',
  //   title: 'eGIS Maps',
  //   data: { icon: 'home' },
  //   component: HomeComponent,
  //   canActivate: [AuthenticationGaurd]
  // },
  {
    path: 'info',
    title: 'eGIS Maps - Info',
    component: InfoComponent,
    //canActivate: [AuthenticationGaurd]
  },
  {
    path: 'home',
    title: 'eGIS Maps',
    component: HomeComponent,
    canActivate: [AuthenticationGaurd]
  },
  {
    path: 'facility',
    title: 'eGIS Maps',
    component: FacilityMapComponent,
    // canActivate: [AuthenticationGaurd]
  },
  {
    path: 'mapviewer',
    title: 'eGIS Maps Viewer',
    component: MapViewerComponent,
    canActivate: [AuthenticationGaurd]
  },
  {
    path: 'lng',
    title: 'eGIS Layout Sequence Number Generator',
    component: LsngComponent,
    canActivate: [AuthenticationGaurd]
  }

];
