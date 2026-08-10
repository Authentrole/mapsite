import { Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import {
  CardModule,
  DrawerComponent,
  LayoutModule,
} from '@progress/kendo-angular-layout';
import { IndicatorsModule } from '@progress/kendo-angular-indicators';
import { IconsModule } from '@progress/kendo-angular-icons';
import { NavigationModule } from '@progress/kendo-angular-navigation';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { PopupModule } from '@progress/kendo-angular-popup';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { SidenavComponent } from './core/components/sidenav/sidenav.component';
import { SubHeaderComponent } from './core/components/sub-header/sub-header.component';
import { SearchResultComponent } from './feature/components/search-result/search-result.component';
import { CoreService } from './core/services/core.service';

@Component({
    selector: 'app-root',
    standalone: true,
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
    imports: [
        CommonModule,
        RouterOutlet,
        CardModule,
        LayoutModule,
        IndicatorsModule,
        IconsModule,
        NavigationModule,
        ButtonsModule,
        PopupModule,
        DropDownsModule    
      ]
})
export class AppComponent {
  title = "eGIS Maps";
  selectedMapsCommodity: any;
  dataToggle: any;
  PDFList:any;
  @ViewChild(SidenavComponent) sideNav: SidenavComponent | undefined;
  @ViewChild(SubHeaderComponent) subheader!: SubHeaderComponent;  
  @ViewChild(SearchResultComponent) searchResult!: SearchResultComponent;  
  public coreService: CoreService = inject(CoreService);
  public ToggleDrawer(drawer: DrawerComponent): void {
    drawer.toggle();
  }
  public ToggleSideNav(sidenav: SidenavComponent): void {
    // this.sideNav.
    sidenav.drawer?.toggle();
  }

  showComponent(event: any) {
    this.selectedMapsCommodity = event;
    this.subheader.showComponentEvent();
  }

  notificationToggle(event: any) {
    this.dataToggle = event;
    this.subheader.toggleNotification();
  }

  showSearchResults(data:any){
    this.sideNav!.showResults(data);
  }
}
