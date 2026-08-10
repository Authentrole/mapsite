import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  NgZone,
  ViewChild,
  ElementRef,
  inject,
  ChangeDetectorRef,
  Input,
} from '@angular/core';
import { IconsModule } from '@progress/kendo-angular-icons';
import { AppBarModule } from '@progress/kendo-angular-navigation';
import { PopupModule } from '@progress/kendo-angular-popup';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { menuIcon, SVGIcon } from '@progress/kendo-svg-icons';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { CoreService } from '../../services/core.service';
import { ConfigService } from '../../services/config.service';
import { DataService } from '../../services/data.service';
import { CardModule } from '@progress/kendo-angular-layout';
import {
  Router,
  RouterModule,
} from '@angular/router';
import { AuthorizationService } from '../../services/authorization.service';
import { Align } from '@progress/kendo-angular-popup';
import {
  DialogService,
  WindowModule,
  WindowService,
} from '@progress/kendo-angular-dialog';
import { FacilityMapComponent } from '../../../pages/faciltiy-map/faciltiy-map.component';
import { PopoverContainerDirective, TooltipsModule } from '@progress/kendo-angular-tooltip';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotifyService } from '../notify/notify.service';
interface Item {
  text: string;
  path: string;
  icon: string;
  selected?: boolean;
}

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  imports: [
    CommonModule,
    AppBarModule,
    IconsModule,
    ButtonsModule,
    PopupModule,
    TooltipsModule,
    DropDownsModule,
    RouterModule,
    CardModule,
    WindowModule,
    FormsModule
  ]
})
export class HeaderComponent implements OnInit {
  @Input() showTools: any = true;
  @Output() public toggle = new EventEmitter();
  @Output() public openAiSearchEvent = new EventEmitter<string>();
  public aiQuery: string = '';
  public notifyService: NotifyService = inject(NotifyService);
  public dialogService: DialogService = inject(DialogService);
  public windowService: WindowService = inject(WindowService);
  public dataService: DataService = inject(DataService);
  @Output() public showComponentEvent = new EventEmitter<string>();
  @Output() public clearControlsEvent = new EventEmitter<string>();
  @Output() public notificationEvent = new EventEmitter<boolean>();
  public coreService: CoreService = inject(CoreService);
  public configService: ConfigService = inject(ConfigService);
  public authorizationService: AuthorizationService = inject(
    AuthorizationService
  );
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  public menuIcon: SVGIcon = menuIcon;
  public theme: any;
  public items: any = [];
  // public selected: string = 'Electric';
  public components = ['Electric', 'Gas', 'Steam'];

  @ViewChild('anchor', { static: false })
  public anchor: ElementRef<HTMLElement> | undefined;
  public anchorAlign: Align = { horizontal: 'center', vertical: 'bottom' };
  public popupAlign: Align = { horizontal: 'right', vertical: 'top' };
  @ViewChild("windowTitleBar") private windowTitleBar: any;
  @ViewChild("container", { static: false }) private container: PopoverContainerDirective | undefined;

  // @ViewChild('recentPanel', { read: ElementRef })
  // public recentPanel!: ElementRef;
  // @ViewChild('recentPopup', { read: ElementRef })
  // public recentPopup!: ElementRef;
  // @ViewChild('favPanel', { read: ElementRef }) public favPanel!: ElementRef;
  // @ViewChild('favPopup', { read: ElementRef }) public favPopup!: ElementRef;
  public margin = { horizontal: -46, vertical: 7 };
  public show = false;
  public showFavPanel: boolean | string = false;
  public showRecentPanel: boolean | string = false;
  public favoriteItems: any;
  selectedComponent: string = '';
  buttonState: { [key: string]: boolean } = {};
  public recentItemList: any;
  public favItemList: any;
  public isActive: any;
  activeItems: any[] = [];
  allRegions: any[] = [];
  apiDetails: any;
  notificationToggle: boolean = true;
  mailId: any;
  public showPopup = false;
  popUpTitle: any;
  popupData: any;
  // public loaderType = 'pulsing';
  // public loaderSize = 'medium';
  // public isLoading = false;
  notificationIcon: string = "fa fa-bell";
  outagesTooltip = 'Toggle Outages';

  appEnv: string = '';

  public onToggle(): void {
    this.show = !this.show;
  }

  constructor(private router: Router, private zone: NgZone) { }

  ngOnInit(): void {
    this.recentTheme();
    this.zone.runOutsideAngular(() => {
      window.addEventListener('resize', () => {
        if (this.show) {
          this.zone.run(() => this.onToggle());
        }
      });
    });

    this.dataService.toggleData$.subscribe((isShow: any) => {
      this.notificationIcon = isShow ? "fa fa-bell-slash" : "fa fa-bell";
      this.outagesTooltip = this.notificationIcon.includes('slash') ? 'Show Outages' : 'Hide Outages';

    });

    this.loadRecentCommodity();

    this.getEgisSupportMail();
    this.getRecentItems();
    this.getFavorites();
    this.getApiFilesPath();
    this.getAllRegion();

  }

  loadRecentCommodity() {
    let commodityName: any;
    const commodityObj = JSON.parse(
      localStorage.getItem('MAPS_Commodity') || '{}'
    );

    if (commodityObj) {
      commodityName = commodityObj.commodity;
    }

    commodityName = commodityName ? commodityName : 'Electric';
    // const hasValue = Object.values(commodityObj).some((o: any) => o === true);
    // if (hasValue) {
    //   commodityName = Object.keys(commodityObj).find(
    //     (key) => commodityObj[key]
    //   );
    // } else {
    //   commodityName = 'Electric';
    // }

    this.components.forEach((name: any) => {
      this.buttonState[name] = name === commodityName;
    });
    this.selectedComponent = commodityName;
    this.dataService.selectedCommodityData(
      this.selectedComponent
    );
    this.showComponentEvent.emit(this.selectedComponent);
    //localStorage.setItem('MAPS_Commodity', JSON.stringify(this.buttonState));
  }

  public ToggleSideNav() {
    this.toggle.emit();
  }

  aiSearchKeyPress(event: any) {
    const keycode = (event.keyCode ? event.keyCode : event.which);
    if (keycode == '13') {
      this.triggerAiSearch();
      return false;
    }
    return true;
  }

  triggerAiSearch() {
    const q = this.aiQuery?.trim();
    if (!q) {
      this.notifyService.showNotification('Please enter a question for AI Search', 'error');
      return;
    }
    this.openAiSearchEvent.emit(q);
    this.aiQuery = '';
  }

  public ToggleDark() {
    // this.coreService.isBusy = true;
    this.coreService.setBusy(true);

    this.coreService.ToggleTheme();
    this.theme = this.coreService.theme;
    let recentObj: any = { mode: this.theme };
    localStorage.setItem('MAPS_DarkMode', JSON.stringify(recentObj));
    this.cdr.detectChanges();
    // this.coreService.isBusy = false;
    this.coreService.setBusy(false);

  }

  public recentTheme() {
    let theme: any = localStorage.getItem('MAPS_DarkMode');
    if (theme) {
      this.coreService.recentTheme(JSON.parse(theme).mode);
    }
    this.cdr.detectChanges();
  }

  togglePanels(panel: string) {
    if (panel?.toLowerCase().trim() == 'favorites') {
      this.getFavorites();
      this.showFavPanel = !this.showFavPanel;
      this.showRecentPanel = false;
    } else if (panel?.toLowerCase().trim() == 'recent') {
      this.getRecentItems();
      this.showRecentPanel = !this.showRecentPanel;
      this.showFavPanel = false;
    }
  }

  togglePopup(event: any) {
    let popupName: string = event.currentTarget.title;
    this.popUpTitle = popupName;
    if (popupName?.toLowerCase().trim() == 'favorites') {
      // this.popUpTitle = popupName.toUpperCase();
      this.getFavorites();
      // this.showFavPanel = !this.showFavPanel;
      // this.showRecentPanel = false;
    } else if (popupName?.toLowerCase().trim().includes('recent')) {
      // this.popUpTitle = popupName.toUpperCase() + ' Pages';
      this.getRecentItems();
      // this.showRecentPanel = !this.showRecentPanel;
      // this.showFavPanel = false;
    }
    this.container?.toggle(event.currentTarget);
  }

  // @HostListener('document:keydown', ['$event'])
  // public keydown(event: KeyboardEvent): void {
  //   if (event?.code === 'Escape') {
  //     this.togglePanels('favorites');
  //   }
  // }

  // @HostListener('document:click', ['$event'])
  // public documentClick(event: KeyboardEvent): void {
  //   if (!this.contains(event?.target)) {
  //     this.togglePanels('favorites');
  //   }
  // }

  // private contains(target: any): boolean {
  //   return (
  //     this.recentPanel.nativeElement.contains(target) ||
  //     (this.recentPopup
  //       ? this.recentPopup.nativeElement.contains(target)
  //       : false)
  //   );
  // }

  // public mapItems(routes: any): Item[] {
  //   return routes.map((item: any) => {
  //     return {
  //       icon: item.data ? (item.data.icon ? item.data.icon : '') : '',
  //       text: item.title ? item.title : '',
  //       path: item.path ? item.path : '',
  //     };
  //   });
  // }

  showComponent(component: string) {
    this.buttonState[component] = true;

    Object.keys(this.buttonState)
      .filter((o: any) => o !== component)
      .forEach((i: any) => {
        this.buttonState[i] = false;
      });
    // localStorage.setItem('MAPS_Commodity', JSON.stringify(this.buttonState));
    let recentCommodity: any = { commodity: component };
    localStorage.setItem('MAPS_Commodity', JSON.stringify(recentCommodity));
    this.selectedComponent = component;
    this.dataService.selectedCommodityData(component);
    this.showComponentEvent.emit(component);
  }

  // showComponent(component: string) {
  //   this.buttonState[component] = true;

  //   Object.keys(this.buttonState)
  //     .filter((o: any) => o !== component)
  //     .forEach((i: any) => {
  //       this.buttonState[i] = false;
  //     });

  //     let recentCommodity:any = {commodity : component};
  //   // localStorage.setItem('MAPS_Commodity', JSON.stringify(this.buttonState));
  //   localStorage.setItem('MAPS_Commodity', JSON.stringify(recentCommodity));
  //   this.selectedComponent = component;
  //   this.showComponentEvent.emit(component.toLowerCase());
  // }

  ToggleOutages() {
    this.notificationIcon = this.notificationIcon.includes('slash') ? this.notificationIcon.replace('-slash', '') : this.notificationIcon + '-slash';
    this.outagesTooltip = this.notificationIcon.includes('slash') ? 'Show Outages' : 'Hide Outages';
    this.dataService.toggle();
  }

  // notifyToggle() {
  //   this.notificationToggle = !this.notificationToggle;
  //   this.dataService.notiftyData(this.notificationToggle);
  //   // this.notificationEvent.emit(this.notificationToggle);
  //   // console.log();
  // }

  openContactSupport() {
    let url = this.mailId.find((o: any) =>
      o.name.toLowerCase().includes('contact')
    ).url;
    this.configService.openLink(url);
  }

  getApiFilesPath() {
    this.configService.getApiDetail().subscribe((response: any) => {
      let res = response;
      this.apiDetails = res;
      this.appEnv = this.apiDetails[0].app_env;
    });
  }

  getEgisSupportMail() {
    this.configService.getAllNavItem().subscribe((response: any) => {
      let res = response;
      this.mailId = res;
    });
  }

  getAllRegion() {
    this.configService.getNavItem('Regions').subscribe((response: any) => {
      let res = response;
      this.allRegions = res;
    });
  }

  getFavorites(): void {
    const favorites = JSON.parse(localStorage.getItem('MAPS_Favorites') || '[]');
    // if (favorites.length > 0) {
    this.favItemList = favorites;
    this.popupData = favorites;
    // }
  }

  getRecentItems(): any {
    let recentItems = JSON.parse(
      localStorage.getItem('MAPS_RecentPages') || '[]'
    );

    if (recentItems.length > 5) {
      const spliceData = recentItems.splice(5);
      this.recentItemList = recentItems;
    } else {
      this.recentItemList = recentItems;
    }
    this.popupData = this.recentItemList;
  }

  openRecentPDF(recentItem: any) {
    let pdfViewer = this.apiDetails && this.apiDetails[0] && this.apiDetails[0].use_default_viewer ? this.apiDetails[0].use_default_viewer : false;
    let currentPDFViewer: any = localStorage.getItem('MAPS_PDFViewer');
    if (currentPDFViewer) {
      currentPDFViewer = JSON.parse(currentPDFViewer);
      pdfViewer = currentPDFViewer.EdgeViewer;
    }

    if (
      recentItem.url
        .toString()
        .toLowerCase()
        .trim()
        .startsWith('pages/map-display.html')
    ) {
      let region = '';
      let facility = '';
      let pdfType = '';
      let regionFullName = '';
      let param: any = {};

      let urlString = recentItem.url.split('?')[1];
      let queryParams: any = {};
      if (urlString) {
        let queryString = urlString.split('&');
        queryString.forEach((param: any) => {
          let [key, value] = param.split('=');
          queryParams[key] = decodeURIComponent(value);
        });
      }

      if (queryParams?.CSO) {
        regionFullName = this.getRegionByShortName(queryParams?.CSO);
      }

      region += `${regionFullName ? regionFullName : recentItem.groupName
        }/${queryParams?.FACILITY.replace('PDF_', '')?.replace(/>/g, '/').trim()}`;

      param = {
        facility: queryParams?.FACILITY,
        region: queryParams?.CSO,
        regName: this.removeCommonReg(
          recentItem.name,
          regionFullName ? regionFullName : recentItem.groupName
        ),
        pdfDet: region,
        itemName: regionFullName ? regionFullName : recentItem.groupName,
        type: queryParams?.PDFTYPE,
        // component: recentItem.commodity,
        commodity: recentItem.commodity,
        alt_url: recentItem.alt_url
      };
      // this.configService.openDialog(param, true,this.windowTitleBar);
      this.configService.openDialog(param, true, pdfViewer);
    } else {
      if (recentItem.url.toString().toLowerCase().trim().endsWith('.pdf')) {

        let filePath: any = recentItem.url.replace("PDF/", "");
        let filePathParts = filePath.split('/');
        let param = {
          commodity: recentItem?.commodity,
          pageTemplate: recentItem?.page_template,
          filePath: filePathParts[0].trim(),
          fileName: filePathParts[1].trim()
        }

        localStorage.setItem('MAPS_Payload', JSON.stringify({ payload: param }));

        let url = recentItem.url.replace('PDF/', '').trim();
        // this.configService.openDialog(url, false,this.windowTitleBar);
        this.configService.openDialog(url, false, pdfViewer);
      } else if (
        recentItem.url.toString().toLowerCase().trim().startsWith('http')
      ) {
        if (
          recentItem.url.toString().toLowerCase().trim().indexOf('.pdf') >= 0
        ) {
          // window.open(buildNonCacheURL(navUrl), '_top');
          // window.open('pages/egis/pages/map-display.html','_top');
        } else {
          this.configService.openLink(recentItem.url);
        }
      }
    }
    this.setActive(recentItem);
  }

  getRegionByShortName(shortName: any): string {
    const region = this.allRegions?.find(
      (o) =>
        o.short_name.toLowerCase().trim() === shortName.toLowerCase().trim()
    )?.region;
    return region ? region : '';
  }

  extractRegion(input: string): string[] {
    return input.split(/\s+|&/).filter((w: any) => w.trim() !== '');
  }

  removeCommonReg(regName: string, itemName: string): string {
    let str: string = '';
    if (regName.includes(itemName)) {
      str = regName.replace(new RegExp(itemName, 'gi'), '').trim();
    } else {
      str = regName;
    }
    return str;
  }

  setActive(item: any) {
    this.activeItems.push(item);
    if (this.activeItems.length > 1) {
      this.activeItems.find((o) => o?.isActive)['isActive'] = false;
    }
    item['isActive'] = true;
  }

  openDialog(detail: any) {
    const windowRef = this.windowService.open({
      content: FacilityMapComponent,
      title: 'ConEdison Facility Map',
      state: 'maximized',
      width: 1000,
      height: 600,
      top: 50,
      left: 300,
    });

    const modalInstance = windowRef.content.instance as FacilityMapComponent;
    modalInstance.pdfDetail = detail;
  }
}
