import {
  Component,
  OnInit,
  inject,
  ViewChild,
  Output,
  EventEmitter,
  Input,
  ChangeDetectorRef,
} from '@angular/core';
import {
  ListViewModule,
  PagerType,
} from '@progress/kendo-angular-listview';

import { InputsModule } from '@progress/kendo-angular-inputs';
import { FormsModule } from '@angular/forms';
import { LabelModule } from '@progress/kendo-angular-label';
import { PagerModule } from '@progress/kendo-angular-pager';
import { DataService } from '../../../core/services/data.service';
import { ConfigService } from '../../../core/services/config.service';
import { SubHeaderComponent } from '../../../core/components/sub-header/sub-header.component';
import { LayoutModule } from '@progress/kendo-angular-layout';
import { WindowModule } from '@progress/kendo-angular-dialog';
import { FileSearchService } from '../../../core/services/file-search.service';
import { CoreService } from '../../../core/services/core.service';
import { ClipboardModule, ClipboardService } from 'ngx-clipboard';
import { NotifyService } from '../../../core/components/notify/notify.service';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-search-result',
  standalone: true,
  imports: [CommonModule, ClipboardModule, ListViewModule, LayoutModule, PagerModule, WindowModule, InputsModule,
    FormsModule,
    LabelModule],
  templateUrl: './search-result.component.html',
  styleUrl: './search-result.component.scss',
})
export class SearchResultComponent implements OnInit {
  public coreService: CoreService = inject(CoreService);
  public configService: ConfigService = inject(ConfigService);
  public dataService: DataService = inject(DataService);
  private fileSearchService: FileSearchService = inject(FileSearchService);
  public notifyService: NotifyService = inject(NotifyService);
  public showExpandPanel: boolean = true;
  public chartExpandPanel: boolean = false;
  public pdfList: any;
  public prevNext = true;
  public type: PagerType = 'numeric';
  public searchListHeight = 60;
  public pageSize: number = 10;
  // public minPageSize: number = 5;
  public skip: number = 0;
  public totalCount: number = 0;
  public pageIndex: number = 1;
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  @Output() pageChanged = new EventEmitter<{ skip: number; take: number }>();
  @ViewChild('subheader') subheader!: SubHeaderComponent;
  @ViewChild("windowTitleBar") public windowTitleBar: any;
  @Input() expandPanel: boolean = true;
  @Input() PDFList: any;
  allRegions: any[] = [];

  searchData: any;
  apiDetails: any;
  fileName: any;
  payLoad: any;

  pdfviewer: boolean = false;
  public copyText: string = '';
  activeItems: any[] = [];
  copiedItems: any[] = [];

  constructor(private clipboardService: ClipboardService) { }

  ngOnInit() {
    //this.getData();
    this.getAllRegion();
    this.getApiFilesPath();
  }

  getData() {
    this.dataService.data$.subscribe((data: any) => {
      this.skip = 0;
      this.pdfList = data;
      this.totalCount = this.pdfList.totalFiles;
      this.pdfList = this.pdfList.fileNames.map((o: any) => ({
        file: o,
      }));
      this.showExpandPanel = true;
      this.chartExpandPanel = true;
    });
  }

  onPageChange(e: any) {
    this.skip = e.skip;
    this.pageSize = e.take;
    this.pageIndex = Math.floor(e.skip / this.pageSize) + 1;
    // const paginationData = { skip: this.skip, take: this.pageSize };
    // this.dataService.setPagerData(paginationData);
    let payLoad = this.payLoad;
    payLoad.fileCount = this.pageSize.toString();
    payLoad.pageIndex = this.pageIndex.toString();
    payLoad.timestamp = new Date().getTime();
    // this.coreService.isBusy = true;
    this.coreService.setBusy(true);

    this.fileSearchService
      .getFiles(this.apiDetails[0].api_url + 'api/Files/Search', payLoad)
      .subscribe((response: any) => {
        this.searchData.response = response;
        // this.coreService.isBusy = false;
        this.coreService.setBusy(false);

        this.ShowResults(this.searchData);
      });
  }

  togglePanel() {
    this.chartExpandPanel = !this.chartExpandPanel;
  }


  loadFiles(file: any): string {
    let dataList = JSON.parse(sessionStorage.getItem(this.searchData.selectedMapsCommodity.toLowerCase().trim() ? this.searchData.selectedMapsCommodity.toLowerCase().trim() : "electric") || '{}');
    let selectedComponent = this.searchData.selectedMapsCommodity.toLowerCase().trim() ? this.searchData.selectedMapsCommodity.toLowerCase().trim() : "electric";

    //   if (file.indexOf(linkConfig.physical_file_path) >= 0) {
    //     filePath = file.replace(linkConfig.physical_file_path, '');
    //     fileName = filePath.replace(responseData.region.replace('/', '\\'), '').replace(/\\/g, ' > ');
    // }

    if (!this.searchData.isGlobalSearch) {
      const selectedRegionData = dataList.find((item: any) =>
        item?.name.includes(this.searchData.regionValue?.region)
      );
      const componentName = this.searchData.selectedMapsCommodity ? this.toTitleCase(this.searchData.selectedMapsCommodity) : 'Electric';

      let retPath: any = componentName + ' > ' + selectedRegionData?.name + ' > ' + this.searchData.facilityValue['name'].replace(this.searchData.regionValue?.region, '') + ' >' + file.replace(this.searchData.response.filePath, '').replace(/\\/g, ' > ')

      let fileName = retPath.replace('> >', '>');
      let tempFileNameParts: any = fileName.split('>');
      let fileNameParts: any[] = [];
      tempFileNameParts.forEach((element: any, index: any) => {
        if (element && element.trim() != '') {
          if (index == tempFileNameParts.length - 1) {
            fileNameParts.push(element.toUpperCase().trim());
          }
          else {
            if (element.indexOf('&') <= 0) {
              fileNameParts.push(this.configService.toTitleCase(element.trim()));
            }
            else {
              fileNameParts.push(element.trim());
            }

          }
        }
      });
      fileName = fileNameParts.join(' > ');

      return fileName;
    }
    else {
      let filePath: any;
      let filePathParts: any;
      let region: any;
      let region_ShortName: any;
      let facility: any;
      let fileName = "";
      let nameOfFile: string = "";

      //  if(selectedComponent.toLowerCase().trim() !== "steam") {
      filePath = file.replace(this.searchData.resFilePath, "");
      filePathParts = filePath.split("\\");
      region = filePathParts[0];
      facility = filePathParts[1].replace(region, '');
      for (var j = 2; j < filePathParts.length; j++) {
        fileName = fileName
          ? fileName + " > " + filePathParts[j]
          : filePathParts[j];
      }
      //    } 
      //    else {
      //     filePath = file.replace(this.searchData.resFilePath, "");
      //     facility = this.searchData.selectedMapsCommodity ? this.toTitleCase(this.searchData.selectedMapsCommodity) : "Electric";
      //     fileName = file;
      //     filePath = filePath + "/" + fileName;
      //  }

      let facilityName = facility;
      let configItems: any[] = [];
      let configSubItems: any;
      const data = [{
        name: this.searchData.selectedMapsCommodity ? this.toTitleCase(this.searchData.selectedMapsCommodity) : "Electric",
        items: dataList
      }];
      data?.forEach((o: any) => {
        o.items.forEach((p: any) => {
          if (p.name.indexOf(region) >= 0) {
            region_ShortName = this.getRegionShortName(region);

            configSubItems = p.items.filter((v: any) => {
              return (v.url.toString().toUpperCase().trim().indexOf("?CSO=" + region_ShortName + "&FACILITY=PDF_" + facilityName.toUpperCase().trim()) > 1);
            });
            if (configSubItems && configSubItems.length > 0)
              nameOfFile = o.name + ' > ' + p.name + ' > ' + configSubItems[0].name
          }
        })
      })
      if (nameOfFile) {
        facilityName = nameOfFile;
      }
      filePath = filePath.replace(/\\/g, '/');
      fileName = fileName.includes(facilityName) ? fileName : facilityName + ' > ' + fileName;
      fileName = fileName.replace('>>', '>');
      let tempFileNameParts: any = fileName.split('>');
      let fileNameParts: any[] = [];
      tempFileNameParts.forEach((element: any, index: any) => {
        if (element && element.trim() != '') {
          if (index == tempFileNameParts.length - 1) {
            fileNameParts.push(element.toUpperCase().trim());
          }
          else {
            if (element.indexOf('&') <= 0) {
              fileNameParts.push(this.configService.toTitleCase(element.trim()));
            }
            else {
              fileNameParts.push(element.trim());
            }
          }
        }
      });
      fileName = fileNameParts.join(' > ');
      return fileName;
    }

  }


  getAllRegion() {
    this.configService.getNavItem('Regions').subscribe((response: any) => {
      let res = response;
      this.allRegions = res;
    });
  }

  getRegionShortName(region: any): string {
    var configList = this.allRegions?.find(o => o.region === region)?.short_name;
    return configList ? configList : "";
  }

  toTitleCase(str: string): string {
    return str.toLowerCase().replace(/(^|\s)\S/g, function (firstLetter) {
      return firstLetter.toUpperCase();
    });
  }

  routeUrl(item: any) {
    let url: string = "";
    if (!this.searchData.isGlobalSearch) {
      const pdfDetails: any = this.getPath();
      const pdfType = pdfDetails.pdfType ? pdfDetails.pdfType : '';
      // if(pdfDetails.facility.toLowerCase() === "steam") {
      //   url =
      //   // this.apiDetails[0].file_url +
      //   pdfDetails.facility +
      //   '/' +
      //   item.file;
      // } 
      // else {      
      let rootPath = this.searchData.response.filePath;
      rootPath = rootPath.endsWith('\\') || rootPath.endsWith('/') ? rootPath : rootPath + '\\';
      url = rootPath + item.file.replace(rootPath, '');
      url = url.replaceAll('\\', '/');
      // }
    }
    else {
      let selectedComponent = this.searchData.selectedMapsCommodity ? this.toTitleCase(this.searchData.selectedMapsCommodity) : "Electric";
      // if(selectedComponent.toLowerCase().trim() !== "steam") {
      const file = item.file.replace(this.searchData.resFilePath, "");
      url = file;
      // } 
      // else {
      //   url = selectedComponent + "/" + item.file;
      // }
    }
    this.fileName = this.loadFiles(item.file);
    let tempPayLoad: any = this.payLoad;
    if (item.file.indexOf('\\') > 0) {
      tempPayLoad.filePath = item.file.substring(0, item.file.lastIndexOf('\\') + 1);
    }
    else {
      tempPayLoad.filePath = this.searchData.response.filePath;
    }

    localStorage.setItem('MAPS_Payload', JSON.stringify({ payload: tempPayLoad }));
    // this.configService.openDialog(url, false,this.windowTitleBar);
    url = url.replaceAll('\\', '/');
    url = url.split('|')[0].trim() + '.pdf';
    this.setActive(item);
    this.configService.openDialog(url, false, this.pdfviewer, this.fileName.split('|')[0].trim());//' - ' + this.fileName
  }


  getPath(): any | null {
    const dataList = JSON.parse(sessionStorage.getItem(this.searchData.selectedMapsCommodity.toLowerCase().trim() ? this.searchData.selectedMapsCommodity.toLowerCase().trim() : "electric") || '{}');
    const selectedRegionData = dataList.find((item: any) =>
      item.name.includes(this.searchData.regionValue.region)
    );

    if (selectedRegionData) {
      const facilityData = selectedRegionData.items.find(
        (item: any) => item.name === this.searchData.facilityValue['name']
      );

      if (facilityData) {
        const url = facilityData.url;
        const facilityMatch = url.match(/FACILITY=([^&]+)/);
        const pdfTypeMatch = url.match(/PDFTYPE=([^&]+)/);

        return facilityMatch
          ? {
            facility: facilityMatch[1].replace('PDF_', ''),
            pdfType: pdfTypeMatch ? pdfTypeMatch[1] : undefined,
          }
          : null;
      }
    }
    return null;
  }

  getApiFilesPath() {
    this.configService.getApiDetail().subscribe((response: any) => {
      let res = response;
      this.apiDetails = res;

    });
  }

  setPDFViewer() {
    localStorage.setItem('MAPS_PDFViewer', JSON.stringify({ EdgeViewer: this.pdfviewer }));
  }

  public ShowResults(data: any) {
    this.pdfviewer = this.apiDetails && this.apiDetails[0] && this.apiDetails[0].use_default_viewer ? !this.apiDetails[0].use_default_viewer : false;
    let currentPDFViewer: any = localStorage.getItem('MAPS_PDFViewer');
    if (currentPDFViewer) {
      currentPDFViewer = JSON.parse(currentPDFViewer);
      this.pdfviewer = currentPDFViewer.EdgeViewer;
    }
    if (data) {
      if (data.payLoad.pageIndex == "1") {
        this.skip = 0;
      }
      this.pdfList = data.response;
      this.payLoad = data.payLoad;
      // this.resFilePath = data.isGlobalSearch ? this.pdfList?.filePath : "";
      this.totalCount = this.pdfList.totalFiles;
      // if (this.pdfList.fileNames) {
      this.pdfList = this.pdfList.fileNames?.map((o: any) => ({
        file: o,
      }));
      // this.pdfList=data;
      this.PDFList = this.pdfList;
      this.searchListHeight = this.pdfList && this.pdfList.length > 0 && this.pdfList.length <= this.pageSize ? this.pdfList.length * 6 : this.searchListHeight;
      this.searchData = data;
      this.expandPanel = this.pdfList.length > 0;
    }
    else {
      this.hideResults();
    }

  }

  public hideResults() {
    this.pdfList = null;
  }

  showComponentEvent() {

  }

  public CopyContent(e: any) {
    // http://localhost:4200/#/mapviewer?regname=Manhattan&maptype=e_m_and_s&type=mono&filename=1-J.pdf
    let params: any;
    let filename: any;
    let file: any = e.file;
    if (file.indexOf('\\') > 0) {
      params = file.split('\\');
      filename = params[params.length - 1].split('|')[0].trim();
    }
    else {
      params = this.payLoad.filePath.split('\\');
      filename = file.split('|')[0].trim();

    }

    this.copyText = window.location.origin + '/#/mapviewer?region=' + params[0];
    if (params.length > 1) {
      this.copyText = this.copyText + '&maptype=' + params[1];
    }
    if (params.length > 3) {
      this.copyText = this.copyText + '&mode=' + params[2];
    }
    this.copyText = this.copyText + '&filename=' + filename;
    this.clipboardService.copyFromContent(this.copyText);
    this.notifyService.showNotification("PDF URL copied to clipboard", 'info');
    // this.setCopied(e);
    this.cdr.detectChanges();
  }

  setActive(item: any) {
    this.activeItems.push(item);
    if (this.activeItems.length > 1) {
      this.activeItems.find((o) => o?.isActive)['isActive'] = false;
    }
    item['isActive'] = true;
  }

  setCopied(item: any) {
    this.copiedItems.push(item);
    if (this.copiedItems.length > 1) {
      this.copiedItems.find((o) => o?.isCopied)['isCopied'] = false;
    }
    item['isCopied'] = true;
  }
}
