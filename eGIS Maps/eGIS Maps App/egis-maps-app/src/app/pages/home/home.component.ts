import { Component, OnInit, ViewChild, ViewContainerRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
// import { BrowserModule } from '@angular/platform-browser';
// import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  CardModule,
  DrawerComponent,
  DrawerItem,
  DrawerMode,
  DrawerSelectEvent,
  LayoutModule,
} from '@progress/kendo-angular-layout';
import { IndicatorsModule } from '@progress/kendo-angular-indicators';
import { IconsModule } from '@progress/kendo-angular-icons';
import { NavigationModule } from '@progress/kendo-angular-navigation';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { PopupModule } from '@progress/kendo-angular-popup';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { SidenavComponent } from '../../core/components/sidenav/sidenav.component';
import { SubHeaderComponent } from '../../core/components/sub-header/sub-header.component';
import { SearchResultComponent } from '../../feature/components/search-result/search-result.component';
import { HeaderComponent } from '../../core/components/header/header.component';
import { FooterComponent } from '../../core/components/footer/footer.component';
import { NavcontentComponent } from '../../core/components/navcontent/navcontent.component';
import { ConfigService } from '../../core/services/config.service';
import { CoreService } from '../../core/services/core.service';
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator.component';
import { AiSearchPanelComponent } from '../../feature/components/ai-search-panel/ai-search-panel.component';

@Component({
    selector: 'app-home',
    standalone: true,
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss',
    imports: [
        CommonModule,
        CardModule,
        LayoutModule,
        IndicatorsModule,
        IconsModule,
        NavigationModule,
        ButtonsModule,
        PopupModule,
        DropDownsModule,
        SubHeaderComponent,
        SidenavComponent,
        HeaderComponent,
        FooterComponent,
        AiSearchPanelComponent
    ]
})
export class HomeComponent implements OnInit {

  title = "eGIS Maps";
  selectedMapsCommodity: any;
  dataToggle: any;
  PDFList:any;
  aiSearchVisible: boolean = false;
  aiSearchQuery: string = '';
  @ViewChild(SidenavComponent) sideNav: SidenavComponent | undefined;
  @ViewChild(SubHeaderComponent) subheader!: SubHeaderComponent;  
  @ViewChild(SearchResultComponent) searchResult!: SearchResultComponent;  
  @ViewChild("container", { read: ViewContainerRef })
  public containerRef: ViewContainerRef | undefined;
  public configService: ConfigService = inject(ConfigService);
  public coreService: CoreService = inject(CoreService);

  ngOnInit(): void {
    this.configService.containerRef=this.containerRef;
  }

  public ToggleDrawer(drawer: DrawerComponent): void {
    drawer.toggle();
  }
  public ToggleSideNav(sidenav: SidenavComponent): void {
    // this.sideNav.
    sidenav.drawer?.toggle();
  }

  showComponent(event: any) {
    this.selectedMapsCommodity = event;
    this.subheader?.showComponentEvent();
  }

  notificationToggle(event: any) {
    this.dataToggle = event;
    this.subheader?.toggleNotification();
  }

  showSearchResults(data:any){
    this.sideNav!.showResults(data);
  }

  openAiSearch(query: string) {
    this.aiSearchQuery = query;
    this.aiSearchVisible = true;
  }

  closeAiSearch() {
    this.aiSearchVisible = false;
  }
}
