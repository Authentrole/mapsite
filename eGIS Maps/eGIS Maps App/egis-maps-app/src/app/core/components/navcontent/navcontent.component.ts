import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  ViewEncapsulation,
  OnInit,
  ChangeDetectorRef,
  inject,
  ViewChild,
  ElementRef,
  OnDestroy,
} from '@angular/core';
import { CardModule } from '@progress/kendo-angular-layout';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { SubHeaderComponent } from '../sub-header/sub-header.component';
import { HeaderComponent } from '../header/header.component';
import { SidenavComponent } from '../sidenav/sidenav.component';
import { FooterComponent } from '../footer/footer.component';
import { SearchResultComponent } from '../../../feature/components/search-result/search-result.component';
import { AuthenticationGaurd } from '../../services/auth-guard';
// import { AccessControl } from '../../services/access-control';
import { LoadingIndicatorComponent } from '../../../shared/components/loading-indicator/loading-indicator.component';
import { AuthorizationService } from '../../services/authorization.service';

import { DialogService, DialogsModule, WindowModule, WindowService } from '@progress/kendo-angular-dialog';
import { NotificationsComponent } from "../../../feature/components/notifications-new/notifications.component";
import { DataService } from '../../services/data.service';
import { Subscription } from 'rxjs';
import { CommodityFacilitiesComponent } from '../../../feature/components/commodity-facilities/commodity-facilities.component';

@Component({
    // encapsulation: ViewEncapsulation.None,
    selector: 'app-navcontent',
    standalone: true,
    templateUrl: './navcontent.component.html',
    styleUrl: './navcontent.component.scss',
    imports: [
        CommonModule,
        CardModule,
        WindowModule,        
        CommodityFacilitiesComponent,
        SearchResultComponent,       
        NotificationsComponent
    ]
})
export class NavcontentComponent implements OnInit, OnDestroy {
  @Input() selectedItem: string | undefined;
  @Input() selectedMapsCommodity: any;
  @Input() notifyToggleData:any;
  @Input() PDFList:any;
  @Input() showResultsPanel:boolean = false;
  // isExpanded: boolean = false;
  @ViewChild('commodityFacility') commodityFacility:CommodityFacilitiesComponent | undefined;
  @ViewChild('subHeader', { static: true }) subHeader: ElementRef | undefined;
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  selectedComponent: string = '';
 
  @ViewChild('subheader') subheader!: SubHeaderComponent;  
  @ViewChild('sidenav') sideNav!: SidenavComponent;
  @ViewChild('searchResults') searchResults!: SearchResultComponent;
  @ViewChild('notifications') notifications!: NotificationsComponent;

  public authorizationService: AuthorizationService = inject(
    AuthorizationService
  );
  public loaderType = 'pulsing';
  // // public loaderSize = 'medium';s
  public isLoading = false;
  public fileName:string='';
  
  public dataService: DataService = inject(DataService);
  toggleOutages: boolean = false;
  private subscription!: Subscription;

  private commoditySubs!: Subscription;

  constructor(authenticationGaurd: AuthenticationGaurd) {
    // super(authenticationGaurd);
  }
  ngOnInit(): void {
    // // // throw new Error('Method not implemented.');
    this.getSelectedCommodity();
    this.toggleOutageData();
  }

  // override ngOnInit() {
  //   super.ngOnInit();
  //   // const subHeaderHeight = this.subHeader?.nativeElement.offsetHeight;
  //   // console.log(subHeaderHeight);
  // }

  // onExpansionChange(e: boolean) {
  //   this.isExpanded = e;
  // }

  // getBodyHeight(): string {
  //   const windowHeight = window.innerHeight;
  //   const subHeaderHeight = this.subHeader?.nativeElement.offsetHeight;
  //   const remainingHeight = windowHeight - subHeaderHeight;
  //   return `${remainingHeight}px`;
  // }
  // public ToggleSideNav(event: any): void {
  //   this.sideNav.drawer?.toggle();
  // }

  getSelectedCommodity() {
    this.commoditySubs = this.dataService.commodityName$.subscribe(
      (commodity: any) => {
        this.selectedMapsCommodity = commodity;
        this.commodityFacility?.getNavLinks(commodity);
      }
    );
  }

  toggleOutageData() {
    this.subscription = this.dataService.toggleData$.subscribe((toggleOutages: any) => {
      this.toggleOutages = toggleOutages;
      this.notifications?.GetNotifications();
    });
    this.cdr.detectChanges();
  }
  
  public showResults(data: any) {
    if(this.notifications!){
      this.notifications!.expandPanel=false;
    }    
    // this.showResultsPanel = true;
    // this.subscription = this.dataService.toggleData$.subscribe((isExpanded: any) => {
    //   this.showResultsPanel = isExpanded;
    // });
    if(this.searchResults!){
      this.searchResults!.ShowResults(data);
    }
    
  }

  ngOnDestroy() {
    if(this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
