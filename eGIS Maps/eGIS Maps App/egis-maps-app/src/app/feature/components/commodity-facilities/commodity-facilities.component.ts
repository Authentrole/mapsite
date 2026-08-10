import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ChangeDetectorRef, ViewChild, Input } from '@angular/core';
import { CardModule, LayoutModule } from '@progress/kendo-angular-layout';
import { ConfigService } from '../../../core/services/config.service';
import { DataService } from '../../../core/services/data.service';
import { FacilityMapComponent } from '../../../pages/faciltiy-map/faciltiy-map.component';
// import { AccessControl } from '../../core/services/access-control';
import { AuthenticationGaurd } from '../../../core/services/auth-guard';
import { DialogService, DialogsModule, WindowModule, WindowService } from '@progress/kendo-angular-dialog';
import { Router } from '@angular/router';
import _ from 'lodash';


@Component({
  selector: 'app-commodity-facility',
  standalone: true,
   imports: [
    CommonModule,
    CardModule,
    LayoutModule,
    WindowModule
  ],
  templateUrl: './commodity-facilities.component.html',
  styleUrl: './commodity-facilities.component.scss',
})
export class CommodityFacilitiesComponent implements OnInit {
  @Input() commodity:string = 'Electric';
  @ViewChild("windowTitleBar") private windowTitleBar: any;
  public configService: ConfigService = inject(ConfigService);
  public dataService: DataService = inject(DataService);
  public dialogService: DialogService = inject(DialogService);
  public windowService: WindowService = inject(WindowService);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  // public component: string = 'Electric';
  public facilityURLs: any = [];
  public disclaimer: any = null;
  // isActive: boolean = false;
  activeItemsMap: Map<number, number[]> = new Map<number, number[]>;
  public chartExpandPanel: boolean = true;
  public expanded: boolean = false;
  public regionList: any;
  public regionfilteredList: any;
  allRegions: any[] = [];
  apiDetails: any;
  commodityData: any;

  
  constructor(
    
  ) {
  }

   ngOnInit() {
    // this.loadFavourites();
    this.getNavLinks(this.commodity);
    this.getAllRegion();
    this.getApiFilesPath();
  }

  getNavLinks(commodity:string) {
    this.configService.getNavItem(commodity).subscribe((response: any) => {
      let res = response;
      // Extract disclaimer if present - ADO 1286313
const disclaimerObj = res.find((o: any) => o.disclaimer);
if (disclaimerObj) {
  this.disclaimer = disclaimerObj;
}

// Filter out disclaimer object and only map region items
this.facilityURLs = res
  .filter((o: any) => o.name && o.items)
  .map((o: any) => {
    return {...o, items: o.items.map((i: any) => {
      return { ...i, favorite: false, recent: false };
    })};
  });
      this.facilityURLs = this.updateFavorite(this.facilityURLs);
      // // this.commodityData = [
      // //   {commodity: this.component, data: this.electricUrls}
      // // ];
      if (this.facilityURLs) {
        sessionStorage.setItem(commodity.toLowerCase().trim(), JSON.stringify(this.facilityURLs));
      }
      this.expanded = true;
    });
    this.cdr.detectChanges();
  }

  updateFavorite(dataList: any) {
    const favorites = JSON.parse(localStorage.getItem('MAPS_Favorites') || '[]');
    if(favorites?.length > 0) {
      dataList.forEach((g: any) => { 
        g.items.forEach((item: any) => {
          const favorite = favorites.find((fav: any) => fav.groupName === g.name && fav.name === item.name);
          if(favorite) {
            item.favorite = true;
          }
        });
      });
    }
    return dataList;
  }

   getApiFilesPath() {
    this.configService.getApiDetail().subscribe((response: any) => {
      let res = response;
      this.apiDetails = res;
    });
  }


  // getRegion(data: any) {
  //   this.configService.getNavItem('Regions').subscribe((response: any) => {
  //     let res = response;
  //     this.regionList = this.compareRegionArrayLists(res, data);
  //     localStorage.setItem('elecRegion', JSON.stringify(this.regionList));
  //     this.cdr.detectChanges();
  //   });
  // }

  getAllRegion() {
    this.configService.getNavItem('Regions').subscribe((response: any) => {
      let res = response;
      this.allRegions = res;
    });
  }

  // compareRegionArrayLists(regions: any, dataList: any) {
  //   const returnRegions: any[] = [];
  //   dataList.forEach((o: any) => {
  //     const region1 = this.splitName(o.name);
  //     region1.forEach((p: any) => {
  //       if(regions.some((s: any) => s.region.replace("_", " ") === p)) {
  //         returnRegions.push({ region: p});
  //       }
  //     });
  //   });
  //   return returnRegions;
  // }

  // splitName(name: string): string[] {
  //   return name.split(' & ');
  // }

  addToFavorite(e:any,groupIndex: number, index: number) {
    let currentItem = this.facilityURLs[groupIndex].items[index];
    currentItem.favorite = !currentItem.favorite;
    // localStorage.setItem('elecFavorites', JSON.stringify(this.electricUrls));

    let arrayToPush = JSON.parse(localStorage.getItem('MAPS_Favorites') || '[]');
    // if(currentItem.favorite === true) {
    //   currentItem.groupName = this.facilityURLs[groupIndex].name;
    //   currentItem.commodity = this.commodity;
    //   arrayToPush.unshift(currentItem);
    // } else {
    //   arrayToPush = arrayToPush.filter((o: any) => o.favorite);
    // }

    if(currentItem) {
      currentItem.groupName = this.facilityURLs[groupIndex].name;
      currentItem.commodity = this.commodity;
      // currentItem.eventData=e;
      // else{
        arrayToPush = _.reject(arrayToPush,{name:currentItem.name, groupName: currentItem.groupName,commodity:currentItem.commodity});
      // }
      if(currentItem.favorite){
        arrayToPush.unshift(currentItem);
      }
      
    } 

    
    // else {
      arrayToPush = arrayToPush.filter((o: any) => o.favorite);
    // }
    
    localStorage.setItem('MAPS_Favorites', JSON.stringify(arrayToPush));
  }

  isActive(groupIndex: number,index: number): boolean {
    return this.facilityURLs[groupIndex].items[index].favorite;
  }

  // loadFavourites() {
  //   const favorites = localStorage.getItem('elecFavorites');
  //   if(favorites) {
  //     this.electricUrls = JSON.parse(favorites);
  //     localStorage.setItem('electric', JSON.stringify(this.electricUrls));
  //     this.expanded = true;
  //   } else {
  //     this.getNavLinks();
  //   }
  // }

  generateQueryParams(e: any, header: string, regionName: string, groupIndex: number, index: number) {
    let pdfViewer = this.apiDetails && this.apiDetails[0] && this.apiDetails[0].use_default_viewer ? !this.apiDetails[0].use_default_viewer : false;
    let currentPDFViewer: any = localStorage.getItem('MAPS_PDFViewer');
    if (currentPDFViewer) {
      currentPDFViewer = JSON.parse(currentPDFViewer);
      pdfViewer = currentPDFViewer.EdgeViewer;
    }
    /* Add recent items */
    this.addRecentItems(e, groupIndex, index);
    let param: any = {};
    /* Add recent items */
    if (e.url.toString().toLowerCase().trim().startsWith('pages/map-display.html')) {
      let region = '';
      let facility = "";
      let pdfType = "";
      let regionFullName = "";


      let urlString = e.url.split('?')[1];
      let queryParams: any = {};
      if (urlString) {
        let queryString = urlString.split('&');
        queryString.forEach((param: any) => {
          let [key, value] = param.split("=");
          queryParams[key] = decodeURIComponent(value);
        });
      }


      if (queryParams?.CSO) {
        regionFullName = this.getRegionByShortName(queryParams?.CSO);
      }

      region += `${regionFullName ? regionFullName : header}/${queryParams?.FACILITY.replace(/PDF_/g, '')?.replace(/>/g, '/').trim()}`;

      param = {
        alt_url: e?.alt_url,
        facility: queryParams?.FACILITY,
        pageTemplate: e?.page_template,
        region: queryParams?.CSO,
        regName: this.removeCommonReg(regionName, regionFullName ? regionFullName : header),
        pdfDet: region,
        itemName: regionFullName ? regionFullName : header,
        type: queryParams?.PDFTYPE,
        commodity: this.commodity,
        header: header,
        eventData: e
      };
      // this.configService.openDialog(param, true, this.windowTitleBar);
      this.configService.openDialog(param, true, pdfViewer);

    }
    else {
      if (e.url.toString().toLowerCase().trim().endsWith('.pdf')) {
        let filePath: any = e.url.replace("PDF/", "");
        let filePathParts = filePath.split('/');
        param = {
          commodity: this.commodity,
          pageTemplate: e?.page_template,
          filePath: filePathParts[0].trim(),
          fileName: filePathParts[1].trim()
        }

        localStorage.setItem('MAPS_Payload', JSON.stringify({ payload: param }));

        let url = e.url.replace("PDF/", "").trim();

        this.configService.openDialog(url, false, pdfViewer);
      } 
      else {
        this.configService.openLink(e.url);
      }
      //   if (e.url.toString().toLowerCase().trim().startsWith('http')) {
      //     if ((e.url.toString().toLowerCase().trim().indexOf('.pdf') >= 0)) {
      //       // window.open(buildNonCacheURL(navUrl), '_top');
      //       // window.open('pages/egis/pages/map-display.html','_top');                        
      //     }
      //     else {
      //       this.configService.openLink(e.url);
      //     }
      // }
    }
  }

   getRegionByShortName(shortName: any): string {
    const region = this.allRegions?.find(o => o.short_name.toLowerCase().trim() === shortName.toLowerCase().trim())?.region;
    return region ? region : "";
   }

  extractRegion(input: string): string[] {
    return input.split(/\s+|&/).filter((w: any) => w.trim() !== "");
  }

  addRecentItems(e:any,groupIndex: number, index: number) {
    const data = this.facilityURLs;
    const currentItem = data[groupIndex].items[index];
    currentItem.recent = true;

    let arrayToPush = JSON.parse(localStorage.getItem('MAPS_RecentPages') || '[]');
    if(currentItem) {
      currentItem.groupName = data[groupIndex].name;
      currentItem.commodity = this.commodity;
      // currentItem.eventData = e;
      arrayToPush.unshift(currentItem);
    }

    arrayToPush = arrayToPush.filter((obj: any, index: number, self: any) => index === self.findIndex((t: any) => (
      JSON.stringify(t) === JSON.stringify(obj)
    )));

    localStorage.setItem('MAPS_RecentPages', JSON.stringify(arrayToPush));
  }

  removeCommonReg(regName: string, itemName: string): string {
    let str: string = "";
    if(regName.includes(itemName)) {
      str = regName.replace(new RegExp(itemName, 'gi'), '').trim();
    } else {
      str = regName;
    }
    return str;
  }
  

  togglePanel() {
    this.expanded = !this.expanded;
  }

}
