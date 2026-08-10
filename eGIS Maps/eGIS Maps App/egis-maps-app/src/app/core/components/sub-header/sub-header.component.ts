import {
  Component,
  OnInit,
  inject,
  EventEmitter,
  Output,
  Input,
  ChangeDetectorRef,
  AfterViewInit, ViewChild
} from '@angular/core';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DropDownsModule, DropDownListComponent } from '@progress/kendo-angular-dropdowns';
import { CardModule, LayoutModule } from '@progress/kendo-angular-layout';
import { ConfigService } from '../../services/config.service';
import { UamNewService } from '../../services/uam-service.service';
import { AuthorizationService } from '../../services/authorization.service';
import { DataService } from '../../services/data.service';
import { NotifyService } from '../notify/notify.service';
import { FileSearchService } from '../../services/file-search.service';
import { IconsModule } from '@progress/kendo-angular-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { ActivatedRoute } from '@angular/router';
import {
  ListViewModule,
  PagerSettings,
  PagerPosition,
  PagerType,
} from '@progress/kendo-angular-listview';
import { PagerModule } from '@progress/kendo-angular-pager';
import { firstValueFrom } from 'rxjs';
import _ from 'lodash';
import { ScrollViewModule, ScrollViewPagerOverlay } from '@progress/kendo-angular-scrollview';
import { WindowModule } from '@progress/kendo-angular-dialog';
import { IndicatorsModule } from '@progress/kendo-angular-indicators';
import { CoreService } from '../../services/core.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sub-header',
  standalone: true,
  imports: [
    CommonModule,
    InputsModule,
    LabelModule,
    FormsModule,
    ReactiveFormsModule,
    DropDownsModule,
    CardModule,
    IconsModule,
    FontAwesomeModule,
    ButtonsModule,
    ListViewModule,
    LayoutModule,
    WindowModule,
    PagerModule,
    ScrollViewModule,
    IndicatorsModule
  ],
  templateUrl: './sub-header.component.html',
  styleUrl: './sub-header.component.scss',
})
export class SubHeaderComponent implements OnInit, AfterViewInit {
  public configService: ConfigService = inject(ConfigService);
  public coreService: CoreService = inject(CoreService);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private route: ActivatedRoute = inject(ActivatedRoute);
  public dataService: DataService = inject(DataService);
  public uamNewService: UamNewService = inject(UamNewService);
  public notifyService: NotifyService = inject(NotifyService);
  public authorizationService: AuthorizationService = inject(AuthorizationService);
  @ViewChild('region', { static: true }) regionControl!: DropDownListComponent;
  private fileSearchService: FileSearchService = inject(FileSearchService);
  @Output() expansionChange = new EventEmitter<boolean>();
  @ViewChild("windowTitleBar") public windowTitleBar: any;
  @Output() public showSearchResultsEvent = new EventEmitter<any>();
  public navLinks: any = [];
  // searchIcon = faSearch;
  isBusy: boolean = false;
  isExpanded: boolean = true;
  regionList: any[] = [];
  regionfilteredList: any[] = [];
  routeName: any;
  regionValue: any;
  isGlobalSearch: boolean = false;
  facilityValue: any;
  pdfName: string = '';
  facilities: any[] = [];
  filteredFacilities: any[] = [];
  apiDetails: any;
  public chartExpandPanel: boolean = false;
  public showExpandPanel: boolean = false;
  public pdfList: any;
  public position: PagerPosition = 'bottom';
  public pageSizes = false;
  public info = true;
  public prevNext = true;
  public type: PagerType = 'numeric';
  public pageSize: number = 10;
  public skip: number = 0;
  public totalCount: number = 0;
  public pageIndex: number = 1;
  @Input() selectedMapsCommodity: any;
  @Input() notifyToggleData: any;
  public componentDataList: any;
  public controlsDisable: boolean = false;
  resFilePath: string = "";
  allRegions: any[] = [];
  steamResponse: any[] = [];
  isUndefined: boolean = false;

  @ViewChild("sv") private scrollView: any;
  public endless = true;
  public ispaused = false;
  public arrows = true;
  public pageable = false;
  public pagerOverlay: ScrollViewPagerOverlay = "none";
  public width = "100%";
  public height = "250px";

  public appUpdates: any[] = [
    {
      "title": "Notification",
      "message": "",
      "applications": "",
      "environments": "",
      "regions": "",
      "commodities": "",
      "fromDate": "",
      "toDate": "",
      "isActive": "",
      "isCompleted": ""
    }
  ];

  public notifications: any[] = [
    {
      "title": "Notification",
      "message": "",
      "applications": "",
      "environments": "",
      "regions": "",
      "commodities": "",
      "fromDate": "",
      "toDate": "",
      "isActive": "1",
      "isCompleted": "0"
    }
  ];

  public selected_notification: any =
    {
      "title": "Notification",
      "message": "",
      "applications": "",
      "environments": "",
      "regions": "",
      "commodities": "",
      "fromDate": "",
      "toDate": "",
      "isActive": "1",
      "isCompleted": "0"
    };

  public appUpdateMsg: any;
  public appUpdateMsgList: any = [];
  private interval: any;
  private notificationInterval: any;
  private notificationIntervalTime = 600000;
  public notificationExpandPanel: boolean = false;
  public fileItems: any[] = [];
  commodityData: any;
  public fileName: string = '';
  public get pagerSettings(): PagerSettings {
    return {
      position: this.position,
      pageSizeValues: this.pageSizes,
      info: this.info,
      previousNext: this.prevNext,
      type: this.type,
    };
  }

  constructor(

  ) {
  }

  ngOnInit() {
    // this.getRecentPage();
    this.getRespectivePageData();
    this.getAllRegion();

    this.getApiFilesPath();
    this.getNavLinks();
    // this.getAllRegion();
    // this.fetchSearchParams();

  }



  ngAfterViewInit() {
    // console.log(this.regionControl.disabled = true);
  }

  //   GetNotifications() {

  //     clearInterval(this.notificationInterval);
  //     clearInterval(this.interval);
  // //this.apiDetails[0].notifications_api_url
  //     this.uamNewService.GetNotifications().subscribe(data => {

  //       // //this.notifications=data;
  //       // this.appUpdates = _.filter(data, { title: this.authorizationService.config.announcement_notification_type });
  //       // this.notifications = _.reject(data, { title: this.authorizationService.config.announcement_notification_type });
  //       // //this.notifications = [];
  //       if(data){
  //         this.appUpdates = _.filter(data, {title : this.authorizationService.config.announcement_notification_type});
  //         this.notifications = _.reject(data, {title : this.authorizationService.config.announcement_notification_type});

  //       }
  //       else{
  //         this.notifications = [];
  //         this.appUpdates=[];
  //       }
  //       this.coreService.isBusy = false;

  //       for(var notInd = 0; notInd < this.notifications.length; notInd++){
  //         let curNotification = this.notifications[notInd];
  //         if(curNotification.isCompleted == 0 && moment(curNotification.toDate).format('DD-MMM-YYYY') == moment().format('DD-MMM-YYYY')){
  //           this.notifications[notInd].isCompleted = 1;
  //           this.notifications[notInd].completionmsg = 'Outage is completed';
  //         }
  //       }

  //       if (this.notifications.length > 0) {
  //         this.interval = setInterval(() => {
  //           if (!this.ispaused) {
  //             this.scrollView.next();
  //           }

  //         }, 15000);
  //       }
  //       this.appUpdateMsgList = [];
  //       this.appUpdateMsg = '';
  //       if (this.appUpdates.length > 0) {
  //         this.appUpdates.forEach(appUpdate => {
  //           let msg = appUpdate.message;// + ' on the ' + appUpdate.commodities + ' ' + appUpdate.environments + ' environment(s) for ' + appUpdate.regions + ' regions.'
  //           this.appUpdateMsgList.push(msg);
  //         });
  //         this.appUpdateMsg = ' *** ' + this.appUpdateMsgList.join(' *** ') + ' *** ';
  //       }
  //         if (this.notifications.length > 0 || this.appUpdates.length > 0) {
  //           this.notificationExpandPanel = true;
  //         }

  //     });    

  //     this.notificationIntervalTime=600000;
  //     this.notificationInterval = setInterval(() => {
  //       this.GetNotifications();      
  //     }, this.notificationIntervalTime); 
  //   }


  async getRespectivePageData() {
    try {
      const commodityName = await firstValueFrom(
        this.dataService.getCurrentCommodity()
      );
      this.selectedMapsCommodity = commodityName;

      const commData = await firstValueFrom(
        this.configService.getDataByCommodity(this.configService.toTitleCase(this.selectedMapsCommodity))
      );
      this.commodityData = commData;

      const regionsData = await firstValueFrom(
        this.configService.getNavItem('Regions')
      );
      this.allRegions = regionsData;
      this.regionList = this.compareRegionArrayLists(
        this.allRegions,
        this.commodityData
      );
      this.regionfilteredList = this.regionList;
      this.regionfilteredList = _.sortBy(this.regionfilteredList, 'region');
      this.regionValue = this.regionfilteredList[0];
      this.regionChange(this.regionValue);

      this.fetchSearchParams();
    } catch (err) {
      console.error('Error: ', err);
    }
  }

  compareRegionArrayLists(regions: any, dataList: any) {
    const returnRegions: any[] = [];
    dataList.forEach((o: any) => {
      const region1 = this.splitName(o.name);
      region1.forEach((p: any) => {
        if (regions.some((s: any) => s.region.replace('_', ' ') === p)) {
          returnRegions.push({ region: p });
        }
      });
    });
    return returnRegions;
  }

  splitName(name: string): string[] {
    return name ? name.split(' & ') : [];
  }

  GetCommodityApps(applications: string, commodity: any) {
    let commodityApps: any = [];
    //commodityApps = applications.split(',').sort();

    commodityApps = _.filter(applications.split(','), (app) => {
      return app.indexOf(commodity.trim()) > 0
    });
    commodityApps = _.sortBy(commodityApps, 'id');

    return commodityApps;
  }

  formatText(textstring: string) {
    return textstring.replace(/,/g, ', ');
  }

  showComponentEvent() {
    this.showSearchResultsEvent.emit(null);
    this.getRespectivePageData();
    this.isGlobalSearch = false;
    this.pdfName = '';
    // this.regionValue = {};
    // this.facilityValue = {};

    this.regionfilteredList = [];
    this.filteredFacilities = [];

    this.chartExpandPanel = false;
    this.showExpandPanel = false;

    // // if(this.isGlobalSearch) {
    //   this.getRegions();
    // // }  
    // this.fetchSearchParams();
  }

  toggleNotification() {
    this.notificationExpandPanel = !this.notificationExpandPanel;
  }

  // getRouteName() {
  //   this.router.events
  //     .pipe(filter((event) => event instanceof NavigationEnd))
  //     .subscribe(() => {
  //       this.routeName = this.route.snapshot.firstChild?.routeConfig?.path;
  //     });
  // }

  getNavLinks() {
    this.configService.getNavItem('header').subscribe((response: any) => {
      let res = response;
      this.navLinks = res?.filter(
        (i: { name: any; url: any }) =>
          !i.url.toUpperCase().includes('JSON') &&
          !i.url.toUpperCase().includes('MAILTO:')
        // i.name !== 'Gas' &&
        // i.name !== 'Electric' &&
        // i.name !== 'Steam' &&
        // i.name !== 'Contact eGIS Support' &&
        // i.name !== 'Regions'
      );
    });
  }

  getAllRegion() {
    this.configService.getNavItem('Regions').subscribe((response: any) => {
      let res = response;
      this.allRegions = res;
    });
  }

  // getRegions() {
  //   if(this.selectedMapsCommodity === undefined) {
  //     this.selectedMapsCommodity = "electric";
  //   }
  //   const storageName = this.selectedMapsCommodity.toLowerCase() == "electric" ? "elecRegion" : this.selectedMapsCommodity.toLowerCase() == "gas" ? "gasRegion" : this.selectedMapsCommodity.toLowerCase() == "steam" ? "steamRegion" : "";
  //   const regions = JSON.parse(localStorage.getItem(storageName) || '[]');
  //   this.regionList = regions;
  //   this.regionfilteredList = this.regionList;
  //   this.cdr.detectChanges();
  // }

  // fetchSearchParams() {
  //   let region = JSON.parse(localStorage.getItem("mapRegion") || '[]');
  //   let facility = JSON.parse(localStorage.getItem("mapFacility") || '[]');
  //   let commodity = JSON.parse(localStorage.getItem("selectedCommodity") || '{}');
  //   let selectedCommodity = Object.keys(commodity).find((key: any) => commodity[key] === true);
  //   this.selectedMapsCommodity = selectedCommodity?.toLowerCase().trim();
  //   if(region?.length > 0 && facility?.length > 0) {
  //     let matchingRegion = region.find((r: any) => selectedCommodity && selectedCommodity?.toLowerCase().trim() === r["commodity"]?.toLowerCase().trim());
  //     let matchingFacility = facility.find((f: any) => selectedCommodity && selectedCommodity?.toLowerCase().trim() === f["commodity"]?.toLowerCase().trim());
  //     if(matchingRegion !== undefined && matchingFacility !== undefined) {
  //       this.regionValue = matchingRegion;
  //       this.facilityValue = matchingFacility;
  //       this.regionChange(matchingRegion);
  //     } else {
  //       this.regionValue = {};
  //       this.facilityValue = {};
  //     }
  //   } 
  // }  


  // fetchSearchParams() {
  //   let region = JSON.parse(localStorage.getItem('mapRegion') || '[]');
  //   let facility = JSON.parse(localStorage.getItem('mapFacility') || '[]');
  //   let commodity = JSON.parse(localStorage.getItem('MAPS_Commodity') || '{}');
  //   let selectedCommodity = Object.keys(commodity).find(
  //     (key: any) => commodity[key] === true
  //   );
  //   this.selectedMapsCommodity = selectedCommodity?.toLowerCase().trim();
  //   if (region?.length > 0 && facility?.length > 0) {
  //     let matchingRegion = region.find(
  //       (r: any) =>
  //         selectedCommodity &&
  //         selectedCommodity?.toLowerCase().trim() ===
  //           r['commodity']?.toLowerCase().trim()
  //     );
  //     let matchingFacility = facility.find(
  //       (f: any) =>
  //         selectedCommodity &&
  //         selectedCommodity?.toLowerCase().trim() ===
  //           f['commodity']?.toLowerCase().trim()
  //     );
  //     if (matchingRegion !== undefined && matchingFacility !== undefined) {
  //       this.regionValue = matchingRegion;
  //       this.facilityValue = matchingFacility;
  //       this.regionChange(matchingRegion);
  //     } else {
  //       this.regionValue = {};
  //       this.facilityValue = {};
  //     }
  //   }
  // }


  fetchSearchParams() {
    var recentSearch = window.localStorage.getItem('MAPS_Search_Params');
    if (recentSearch) {
      let recentSearchJSON = JSON.parse(recentSearch);
      recentSearchJSON = _.find(recentSearchJSON, { commodity: this.selectedMapsCommodity.trim() });
      if (recentSearchJSON) {
        //if (recentSearchJSON.commodity.toLowerCase().trim() == this.selectedMapsCommodity.toLowerCase().trim()) {
        let selectedSearchRegion = recentSearchJSON.region;
        this.regionValue = _.find(this.regionfilteredList, { region: selectedSearchRegion });
        this.regionChange(this.regionValue);
      }
    }
  }

  getRecentPage() {
    this.dataService.data$.subscribe((data: any) => {
      this.selectedMapsCommodity = data;
      this.selectedMapsCommodity = this.selectedMapsCommodity?.toLowerCase();
      this.cdr.detectChanges();
    });
  }

  regionFilter(value: any) {
    this.regionfilteredList = this.regionList.filter(
      (s: any) => s.region?.toLowerCase().indexOf(value?.toLowerCase()) !== -1
    );
  }

  facilityFilter(value: any) {
    this.filteredFacilities = this.facilities.filter(
      (s: any) => s.name?.toLowerCase().indexOf(value?.toLowerCase()) !== -1
    );
  }

  regionChange(e: any) {
    const dataList = this.commodityData;
    let selectedRegionData = dataList?.find((item: any) =>
      item.name ? item.name.includes(e?.region) : false
    );

    if (selectedRegionData) {
      let items = selectedRegionData.items;
      let filteredBySelectedRegionData: any;

      let regionShortName = this.getRegionShortName(e?.region);
      // filteredBySelectedRegionData = items
      //   ?.filter((i: any) => {
      //     return (
      //       !this.regionList?.some((region: any) =>
      //         i.name?.toLowerCase().includes(region.region?.toLowerCase())
      //       ) && i.url.includes('FACILITY=')
      //     );
      //   })
      //   .map((o: any) => {
      //     o.modifiedName = o.name;
      //     return o;
      //   });

      // let filteredByRegion = items
      //   ?.filter(
      //     (i: any) => i.name.includes(e?.region) && i.url.includes('FACILITY=')
      //   )
      //   .map((o: any) => {
      //     o.modifiedName = o.name.replace(e?.region, '').trim();
      //     return o;
      //   });

      let filteredFacilities = items
        ?.filter(
          (i: any) => i.url.includes('CSO=' + regionShortName) && i.url.includes('FACILITY=')
          //this.selectedMapsCommodity.toLowerCase().trim() != 'steam' ? i.url.includes('CSO=' + regionShortName) && i.url.includes('FACILITY=') : i.url.includes('FACILITY=') 
        )
        .map((o: any) => {
          o.modifiedName = o.name.replace(e?.region, '').trim();
          return o;
        });


      this.facilities = [];
      this.filteredFacilities = [];
      this.facilities = filteredFacilities;//[...filteredByRegion, ...filteredBySelectedRegionData];
      this.filteredFacilities = this.facilities;
      this.facilityValue = this.filteredFacilities[0];

      var recentSearch = window.localStorage.getItem('MAPS_Search_Params');
      if (recentSearch) {
        let recentSearchJSON = JSON.parse(recentSearch);
        recentSearchJSON = _.find(recentSearchJSON, { commodity: this.selectedMapsCommodity.trim() });
        if (recentSearchJSON &&
          recentSearchJSON.region.toLowerCase().trim() == this.regionValue.region.toLowerCase().trim()) {
          let selectedSearchFacility = recentSearchJSON.facility;
          this.facilityValue = _.find(this.filteredFacilities, { modifiedName: selectedSearchFacility });

        }
      }

      // let isFacilityExistForComm: any;
      // if (this.facilityValue) {
      //   isFacilityExistForComm = this.facilities?.some(
      //     (i) => i.name === this.facilityValue['name']
      //   );
      // }

      // if (!isFacilityExistForComm) {
      //   this.facilityValue = {};
      // }

      // e['commodity'] = this.selectedMapsCommodity;
      // const mapRegion = JSON.parse(localStorage.getItem('mapRegion') || '[]');
      // mapRegion.unshift(e);
      // localStorage.setItem('mapRegion', JSON.stringify(mapRegion));
      this.cdr.detectChanges();
    }
  }

  // regionChange(e: any) {
  //   const dataList = JSON.parse(sessionStorage.getItem(this.selectedMapsCommodity ? this.selectedMapsCommodity : "electric") || '{}');
  //   let selectedRegionData = dataList?.find((item: any) =>
  //     item.name.includes(e?.region)
  //   );

  //   if (selectedRegionData) {
  //     let items = selectedRegionData.items;

  //     let filteredBySelectedRegionData = items.filter((i: any) => {
  //       return !this.regionList.some((region: any) =>
  //         i.name?.toLowerCase().includes(region.region?.toLowerCase())
  //       ) && i.url.includes('FACILITY=');
  //     }).map((o: any) => {o.modifiedName = o.name; return o;});

  //     let filteredByRegion = items.filter((i: any) =>
  //       i.name.includes(e?.region) && i.url.includes('FACILITY=')
  //     ).map((o: any) => {o.modifiedName = o.name.replace(e?.region, '').trim(); return o;});

  //     this.facilities = [];
  //     this.facilities = [...filteredByRegion, ...filteredBySelectedRegionData];
  //     this.filteredFacilities = this.facilities;
  //     e["commodity"] = this.selectedMapsCommodity;
  //     const mapRegion = JSON.parse(localStorage.getItem("mapRegion") || '[]');
  //     mapRegion.unshift(e);
  //     localStorage.setItem("mapRegion", JSON.stringify(mapRegion));
  //     this.cdr.detectChanges();
  //   }
  // }

  facilityChange(e: any) {
    // console.log(e);
    // e["commodity"] = this.selectedMapsCommodity;
    // delete e.url;
    // let mapFacility = JSON.parse(localStorage.getItem("mapFacility") || '[]');
    // mapFacility.unshift(e);
    // localStorage.setItem("mapFacility", JSON.stringify(mapFacility));
  }

  getApiFilesPath() {
    this.configService.getApiDetail().subscribe((response: any) => {
      let res = response;
      this.apiDetails = res;
      // this.GetNotifications();
    });
  }

  getPath(): any | null {
    const dataList = this.commodityData;//JSON.parse(sessionStorage.getItem(this.selectedMapsCommodity ? this.selectedMapsCommodity : "electric") || '{}');
    const selectedRegionData = dataList.find((item: any) =>
      item.name?.includes(this.regionValue.region)
    );

    if (selectedRegionData) {
      const facilityData = selectedRegionData.items.find(
        (item: any) => item.name === this.facilityValue['name']
      );

      if (facilityData) {
        const url = facilityData.url;
        const facilityMatch = url.match(/FACILITY=([^&]+)/);
        const pdfTypeMatch = url.match(/PDFTYPE=([^&]+)/);

        return facilityMatch
          ? {
            facility: facilityMatch[1].replace('PDF_', '').replace(/>/g, '/'),
            pdfType: pdfTypeMatch ? pdfTypeMatch[1] : undefined,
            pageTemplate: facilityData.page_template
          }
          : null;
      }
    }
    return null;
  }

  validateControls(): boolean {

    var canProceed = true;
    var errorMsg = '';
    var errorList = [];


    if (this.isGlobalSearch) {
      if (this.pdfName == "" || this.pdfName === null || this.pdfName === undefined) {
        errorMsg = "Please enter PDF file name to proceed with search";
        canProceed = false;
      }
      else {
        canProceed = true;
      }
    }
    else {
      if (!this.regionValue?.region) {
        errorList.push('Region');
      }

      if (!this.facilityValue?.name) {
        errorList.push('Facility');
      }

      errorMsg = errorList.length > 0 ? ' select ' + errorList.join(', ') : '';

      // if (this.pdfName == "" || this.pdfName === null || this.pdfName === undefined) {            
      //     errorMsg = errorMsg ? errorMsg + ' and enter PDF file name' : ' enter PDF file name';
      // }

      errorMsg = errorMsg ? 'Please ' + errorMsg + ' to proceed with search' : '';

      canProceed = true;
    }

    if (errorMsg) {
      this.notifyService.showNotification(errorMsg, 'error');
      canProceed = false;
    }
    else {
      canProceed = true;
    }

    return canProceed;
  }

  globSearch(e: any) {
    this.showSearchResultsEvent.emit(null);
    if (e === true) {
      this.regionValue = {};
      this.facilityValue = {};
      this.showExpandPanel = false;
    } else {
      this.fetchSearchParams();
      this.showExpandPanel = false;
    }
  }


  // D:\\eGIS\\MAPS\\PDF\\Manhattan\\STEAM"
  searchPdfFile() {
    this.showSearchResultsEvent.emit(null);
    if (this.validateControls()) {
      let model = {};
      this.isBusy = true;
      if (!this.isGlobalSearch) {
        this.saveSearchParams();
        if (this.facilityValue.alt_url) {
          this.configService.openLink(this.facilityValue.alt_url + this.pdfName, false);
          this.isBusy = false;
          return;
        }


        let path = this.getPath();
        let filePath: string = "";
        let pdfType: string = path.pdfType ? path.pdfType : "";
        // if(path.facility.toLowerCase() === "steam") {
        //   filePath = path.facility;
        // } 
        // else {
        filePath =
          this.regionValue.region.replaceAll(' ', '_') +
          '\\' +
          path.facility;

        filePath = pdfType && pdfType.toString().toUpperCase().trim() == 'BOTH' ? filePath : filePath + '\\' + pdfType;
        // }
        if (path) {
          model = {
            region: this.regionValue?.region + '/' + this.facilityValue['name'],
            fileName: this.pdfName ? this.pdfName : '',
            filePath: filePath,
            fileFormat: this.apiDetails[0].file_format,
            fileCount: this.pageSize.toString(),
            pageIndex: this.pageIndex.toString(),
            includeSubFolders: pdfType && pdfType.toString().toUpperCase().trim() == 'BOTH'
              ? 'true'
              : this.facilityValue.search_subfolders ? 'true' : 'false',
            timestamp: new Date().getTime(),
            pageTemplate: path.pageTemplate ? path.pageTemplate.toString() : 'false'
          };
        }


      } else {
        model = {
          commodity: this.selectedMapsCommodity ? this.selectedMapsCommodity : "electric",
          region: "",
          fileName: this.pdfName,
          filePath: "",
          fileFormat: this.apiDetails[0].file_format,
          fileCount: this.pageSize.toString(),
          pageIndex: this.pageIndex.toString(),
          includeSubFolders: 'true',
          timestamp: new Date().getTime(),
          pageTemplate: this.selectedMapsCommodity == "electric" ? "true" : "false"
        };
      }

      // this.coreService.isBusy = true;
      this.coreService.setBusy(true);


      this.fileSearchService
        .getFiles(this.apiDetails[0].api_url + 'api/Files/Search', model)
        .subscribe((response: any) => {
          // this.coreService.isBusy = false;
          this.coreService.setBusy(false);

          this.isBusy = false;
          this.pdfList = response;
          this.resFilePath = this.isGlobalSearch ? this.pdfList?.filePath : "";
          this.totalCount = this.pdfList.totalFiles;
          // if (this.pdfList.fileNames) {
          this.pdfList = this.pdfList.fileNames?.map((o: any) => ({
            file: o,
          }));
          if (this.pdfList?.length <= 0 || this.pdfList === undefined || this.pdfList === null) {
            this.notifyService.showNotification("No PDFs found with search text", 'error');
          }
          else {
            let eventData = { response: response, isGlobalSearch: this.isGlobalSearch, resFilePath: this.resFilePath, selectedMapsCommodity: this.selectedMapsCommodity, regionValue: this.regionValue, facilityValue: this.facilityValue, payLoad: model }

            // this.dataService.setData(response);

            this.showSearchResultsEvent.emit(eventData);
          }
          this.chartExpandPanel = true;
          this.showExpandPanel = true;
          // }
        });
    }
  }


  saveSearchParams() {
    var searchRegion = this.regionValue;
    var searchFacility = this.facilityValue;
    var selectedCommodity = this.selectedMapsCommodity;
    var recentSearchItem;
    if (searchFacility && searchRegion) {
      var recentStorage = window.localStorage.getItem('MAPS_Search_Params');
      if (recentStorage) {
        let recentStorageJSON = JSON.parse(recentStorage);
        if (Array.isArray(recentStorageJSON)) {
          var recentItem = _.find(recentStorageJSON, { 'commodity': selectedCommodity });
          if (recentItem) {
            recentItem = { 'commodity': selectedCommodity, 'region': searchRegion.region, 'facility': searchFacility.modifiedName };

            recentStorageJSON = _.map(recentStorageJSON, function (recentStorageItem) {
              var tt = recentStorageItem.commodity == selectedCommodity ? recentItem : recentStorageItem;
              return tt;
            });
            window.localStorage.setItem('MAPS_Search_Params', JSON.stringify(recentStorageJSON));
          }
          else {
            recentSearchItem = { 'commodity': selectedCommodity, 'region': searchRegion.region, 'facility': searchFacility.modifiedName };

            recentStorageJSON.push(recentSearchItem);
            window.localStorage.setItem('MAPS_Search_Params', JSON.stringify(recentStorageJSON));
          }
        }
        else {
          if (recentStorageJSON.commodity == selectedCommodity) {
            recentSearchItem = [{ 'commodity': selectedCommodity, 'region': searchRegion.region, 'facility': searchFacility.modifiedName }];
          }
          else {
            recentSearchItem = [recentStorage, { 'commodity': selectedCommodity, 'region': searchRegion.region, 'facility': searchFacility.modifiedName }];
          }

          window.localStorage.setItem('MAPS_Search_Params', JSON.stringify(recentSearchItem));
        }

      }
      else {
        recentSearchItem = [{ 'commodity': selectedCommodity, 'region': searchRegion.region, 'facility': searchFacility.modifiedName }];
        window.localStorage.setItem('MAPS_Search_Params', JSON.stringify(recentSearchItem));
      }
    }

  }


  getFileNames(file: string) {
    const fileStr = file.replace(this.resFilePath, "").split("\\");
    return fileStr[fileStr.length - 1];
  }


  onPageChange(e: any) {
    this.skip = e.skip;
    this.pageSize = e.take;
    this.pageIndex = Math.floor(this.skip / this.pageSize) + 1;
    this.searchPdfFile();
  }

  //  loadFiles1(fileList: any) {
  //   let dataList = JSON.parse(localStorage.getItem(this.selectedMapsCommodity ? this.selectedMapsCommodity : "electric") || '{}');
  //   let selectedComponent = this.selectedMapsCommodity ? this.selectedMapsCommodity : "electric";
  //   if(!this.isGlobalSearch) {
  //   const selectedRegionData = dataList.find((item: any) =>
  //     item?.name.includes(this.regionValue?.region)
  //   );
  //   const componentName = this.selectedMapsCommodity
  //     ? this.toTitleCase(this.selectedMapsCommodity)
  //     : 'Electric';

  //   let files: any[] = [];

  //   for (let i = 0; i < fileList.length; i++) {
  //     this.fileItems.push({file: componentName + '>' +selectedRegionData?.name + '>' +this.facilityValue['name'] + '>' + fileList[i].file, fileName: fileList[i].file});
  //   }
  //   console.log(files);
  //   }

  //  } else {
  //    let filePath: any;
  //    let filePathParts: any;
  //    let region: any;
  //    let region_ShortName: any;
  //    let facility: any;
  //    let fileName = "";
  //    let nameOfFile: string = "";

  //    if(selectedComponent.toLowerCase().trim() !== "steam") {
  //     filePath = file.replace(this.resFilePath, "");
  //     filePathParts = filePath.split("\\");
  //     region = filePathParts[0];
  //     facility = filePathParts[1];
  //        for (var j = 2; j < filePathParts.length; j++) {
  //           fileName = fileName
  //            ? fileName + " > " + filePathParts[j]
  //            : filePathParts[j];
  //        }
  //      } else {
  //       filePath = file.replace(this.resFilePath, "");
  //       // region = responseData.region.split('/')[0];
  //       // region_ShortName = GetRegionShortName(region);
  //       facility = this.selectedMapsCommodity ? this.toTitleCase(this.selectedMapsCommodity) : "Electric";
  //       fileName = file;
  //       filePath = filePath + "/" + fileName;
  //    }

  //     let facilityName = facility;
  //     let configItems: any[] = [];
  //     let configSubItems: any;
  //     const data = [{
  //       name: this.selectedMapsCommodity ? this.toTitleCase(this.selectedMapsCommodity) : "Electric",
  //       items: dataList
  //     }];
  //     data?.forEach((o: any) => {
  //       o.items.forEach((p: any) => {
  //         if(p.name.indexOf(region) >= 0) {
  //             region_ShortName = this.getRegionShortName(region);

  //          configSubItems = p.items.filter((v: any) => {
  //             return (v.url.toString().toUpperCase().trim().indexOf("?CSO=" + region_ShortName + "&FACILITY=PDF_" + facilityName.toUpperCase().trim()) > 1);
  //           });
  //           if (configSubItems && configSubItems.length > 0)
  //            nameOfFile = o.name + ' > ' + p.name + ' > ' + configSubItems[0].name
  //         }
  //       })
  //     })
  //      if (nameOfFile) {
  //           facilityName = nameOfFile;
  //        }
  //       filePath = filePath.replace(/\\/g, '/');
  //       fileName =  facilityName + ' > ' + fileName ;
  //     return fileName;
  //  }
  // }

  // loadFiles(file: any): string {
  //   let dataList = JSON.parse(sessionStorage.getItem(this.selectedMapsCommodity ? this.selectedMapsCommodity : "electric") || '{}');
  //   let selectedComponent = this.selectedMapsCommodity ? this.selectedMapsCommodity : "electric";
  //   if(!this.isGlobalSearch) {
  //   const selectedRegionData = dataList.find((item: any) =>
  //     item?.name.includes(this.regionValue?.region)
  //   );
  //   const componentName = this.selectedMapsCommodity
  //     ? this.configService.toTitleCase(this.selectedMapsCommodity)
  //     : 'Electric';
  //   return (
  //     componentName +
  //     '>' +
  //     selectedRegionData?.name +
  //     '>' +
  //     this.facilityValue['name'] +
  //     '>' +
  //     file
  //   );
  //  } else {
  //    let filePath: any;
  //    let filePathParts: any;
  //    let region: any;
  //    let region_ShortName: any;
  //    let facility: any;
  //    let fileName = "";
  //    let nameOfFile: string = "";

  //    if(selectedComponent.toLowerCase().trim() !== "steam") {
  //     filePath = file.replace(this.resFilePath, "");
  //     filePathParts = filePath.split("\\");
  //     region = filePathParts[0];
  //     facility = filePathParts[1];
  //        for (var j = 2; j < filePathParts.length; j++) {
  //           fileName = fileName
  //            ? fileName + " > " + filePathParts[j]
  //            : filePathParts[j];
  //        }
  //      } else {
  //       filePath = file.replace(this.resFilePath, "");
  //       // region = responseData.region.split('/')[0];
  //       // region_ShortName = GetRegionShortName(region);
  //       facility = this.selectedMapsCommodity ? this.configService.toTitleCase(this.selectedMapsCommodity) : "Electric";
  //       fileName = file;
  //       filePath = filePath + "/" + fileName;
  //    }

  //     let facilityName = facility;
  //     let configItems: any[] = [];
  //     let configSubItems: any;
  //     const data = [{
  //       name: this.selectedMapsCommodity ? this.configService.toTitleCase(this.selectedMapsCommodity) : "Electric",
  //       items: dataList
  //     }];
  //     data?.forEach((o: any) => {
  //       o.items.forEach((p: any) => {
  //         if(p.name.indexOf(region) >= 0) {
  //             region_ShortName = this.getRegionShortName(region);

  //          configSubItems = p.items.filter((v: any) => {
  //             return (v.url.toString().toUpperCase().trim().indexOf("?CSO=" + region_ShortName + "&FACILITY=PDF_" + facilityName.toUpperCase().trim()) > 1);
  //           });
  //           if (configSubItems && configSubItems.length > 0)
  //            nameOfFile = o.name + ' > ' + p.name + ' > ' + configSubItems[0].name
  //         }
  //       })
  //     })
  //      if (nameOfFile) {
  //           facilityName = nameOfFile;
  //        }
  //       filePath = filePath.replace(/\\/g, '/');
  //       fileName =  facilityName + ' > ' + fileName ;
  //     return fileName;
  //  }

  // }

  getRegionShortName(region: any): string {
    var configList = this.allRegions?.find(o => o.region === region)?.short_name;
    return configList ? configList : "";
  }



  // routeUrl(item: any) {
  //   let url: string = "";
  //   if(!this.isGlobalSearch) {
  //   const pdfDetails: any = this.getPath();
  //   const pdfType = pdfDetails.pdfType ? pdfDetails.pdfType : '';
  //   if(pdfDetails.facility.toLowerCase() === "steam") {
  //     url =
  //     this.apiDetails[0].file_url +
  //     pdfDetails.facility +
  //     '\\' +
  //     item.file;
  //   } else {
  //     url =
  //     this.apiDetails[0].file_url +
  //     this.regionValue.region +
  //     '\\' +
  //     pdfDetails.facility +
  //     '\\' +
  //     pdfType +
  //     '\\' +
  //     item.file;
  //   }
  // } else {
  //   let selectedComponent = this.selectedMapsCommodity ? this.configService.toTitleCase(this.selectedMapsCommodity) : "Electric";
  //   if(selectedComponent.toLowerCase().trim() !== "steam") {
  //   const file = item.file.replace(this.resFilePath, "");
  //   url = this.apiDetails[0].file_url + file;
  //   } else {
  //     url = this.apiDetails[0].file_url + selectedComponent + "/" + item.file;
  //   }
  // }
  //   this.fileName = this.loadFiles(item.file);
  //   // this.configService.openDialog(url, false,this.windowTitleBar);
  //   let pdfViewer = this.apiDetails && this.apiDetails[0] && this.apiDetails[0].use_default_viewer ? this.apiDetails[0].use_default_viewer : false;

  //   this.configService.openDialog(url, false, pdfViewer);
  // }

  togglePanel() {
    this.chartExpandPanel = !this.chartExpandPanel;
  }

  keyPress(event: any) {
    var keycode = (event.keyCode ? event.keyCode : event.which);
    if (keycode == '13') {
      this.searchPdfFile();
      // event.currentTarget.blur();
      // event.preventDefault();
      // if (!isisGlobalSearch) {
      //     SaveSearchParams();            
      // }
      // currentPayload = null;
      // getFiles(1);
      return false;
    }
    return true;
  }
}
