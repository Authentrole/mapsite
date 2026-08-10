import { Component, OnInit, inject, Input, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CardModule } from '@progress/kendo-angular-layout';
import {
  PDFViewerModule,
  PDFViewerTool,
} from '@progress/kendo-angular-pdfviewer';
import {
  ButtonsModule,
} from '@progress/kendo-angular-buttons';
import { CommonModule } from '@angular/common';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { FormsModule } from '@angular/forms';
import { LabelModule } from '@progress/kendo-angular-label';
import { PagerModule } from '@progress/kendo-angular-pager';
import { ConfigService } from '../../core/services/config.service';
import { FileSearchService } from '../../core/services/file-search.service';
// import { WindowRef } from '@progress/kendo-angular-dialog';
import { IndicatorsModule } from '@progress/kendo-angular-indicators';
import _ from 'lodash';
import { ClipboardModule, ClipboardService } from 'ngx-clipboard';
import { NotifyService } from '../../core/components/notify/notify.service';
import { SafePipeModule } from 'safe-pipe';
import { ActivatedRoute, Router } from '@angular/router';
import { CoreService } from '../../core/services/core.service';
import { SafeResourceUrl } from '@angular/platform-browser';
import { NavigationModule } from "@progress/kendo-angular-navigation";
import { AuthorizationService } from '../../core/services/authorization.service';

@Component({
  selector: 'app-facility-map',
  standalone: true,
  imports: [
    ClipboardModule,
    CardModule,
    PDFViewerModule,
    ButtonsModule,
    CommonModule,
    InputsModule,
    FormsModule,
    LabelModule,
    PagerModule,
    SafePipeModule,
    IndicatorsModule,
    NavigationModule
  ],
  templateUrl: './faciltiy-map.component.html',
  styleUrl: './faciltiy-map.component.scss',
})
export class FacilityMapComponent implements OnInit, OnDestroy {
  public coreService: CoreService = inject(CoreService);
  public configService: ConfigService = inject(ConfigService);
  private fileSearchService: FileSearchService = inject(FileSearchService);
  private authorizationService: AuthorizationService = inject(AuthorizationService);

  // public windowRef: WindowRef = inject(WindowRef);
  public notifyService: NotifyService = inject(NotifyService);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  @Input() pdfDetail: any;
  @Input() canSearch: boolean = true;
  @Input() pdfViewer: boolean = true;
  @Input() facilityMapPath: string = '';
  pdfRefTo: string = '';
  pdfName: string = '';
  pdfType: string = '';
  apiDetails: any;
  saveFileName: string = '';
  public expanded: boolean = true;
  public pageSize: number = 100;
  public skip: number = 0;
  public totalCount: number = 0;
  public pageIndex: number = 1;
  public pdfList: any;
  pdfPath: string = '';
  title: string = 'ConEdison Facility Map';
  activeItems: any[] = [];
  copiedItems: any[] = [];
  public pdfViewerTools: PDFViewerTool[] = [
    'pager',
    'spacer',
    'zoomInOut',
    'zoom',
    'selection',
    'spacer',
    'search',
    'download',
    'print',
  ];
  isDisable: boolean = true;
  hasMono: boolean = true;
  hasColor: boolean = true;
  isMono: boolean = false;
  isColor: boolean = false;
  canShowPDFColor: boolean = false;
  isSearchShow: boolean = false;
  isBusy: boolean = false;
  isPageTemplate: boolean = false;
  showMsg: boolean = false;
  public pdfSrc: any;
  pdfBufferData: any;
  currentPayload: any;
  safeBase64Url: SafeResourceUrl | undefined;
  public copyText: string = '';
  appEnv: string = '';
  pdfBlobUrl: any;

  constructor(public route: ActivatedRoute,
    public router: Router, private clipboardService: ClipboardService) {

  }

  ngOnInit(): void {
    // let encdata = this.route.snapshot.queryParams['data']
    // encdata = JSON.stringify(encdata);
    // console.log(encdata.replace(/ /g,'+'));
    // let data:any = this.configService.decrypt(encdata);
    // let data = this.route.snapshot.queryParams['data'];
    // console.log(data);
    let currentData: any = localStorage.getItem('MAPS_Current_Facility');
    let curPayLoad: any = localStorage.getItem('MAPS_Payload');
    if (currentData) {
      currentData = JSON.parse(currentData);
      // console.log(data);
      this.isPageTemplate = currentData.data.pageTemplate;
      this.pdfDetail = currentData.data;
      this.canSearch = currentData.canSearch;//data.isSerach;
      this.pdfViewer = currentData.pdfViewer;
      this.facilityMapPath = currentData.facilityMapPath;
      let currentPDFViewer: any = localStorage.getItem('MAPS_PDFViewer');
      if (currentPDFViewer) {
        currentPDFViewer = JSON.parse(currentPDFViewer);
        this.pdfViewer = currentPDFViewer.EdgeViewer;
      }
      this.saveFileName = this.canSearch ? this.saveFileName : this.pdfDetail.substring(this.pdfDetail.lastIndexOf('/') + 1);
      localStorage.removeItem('MAPS_Current_Facility');
      localStorage.removeItem('MAPS_Payload');

      this.recentTheme();

      if (this.pdfDetail) {
        // this.getApiFilesPath();
        this.configService.getApiDetail().subscribe((response: any) => {
          let res = response;
          this.apiDetails = res;
          this.appEnv = this.apiDetails[0].app_env;
          if (!this.canSearch) {
            this.isSearchShow = this.canSearch;
            curPayLoad = JSON.parse(curPayLoad);
            this.currentPayload = curPayLoad.payload;
            this.GetPDFData(this.saveFileName.split('.')[0]);
            //this.pdfPath = this.pdfDetail;

            return;
          }
          // const pdfColor = JSON.parse(localStorage.getItem("mapPdfType") || '{}');
          let searchLabel: string = this.pdfDetail.alt_url ? 'containing' : 'starting with';
          let regionDetail = this.pdfDetail.eventData ? this.pdfDetail.eventData.name.indexOf(this.pdfDetail.itemName) >= 0 ? this.pdfDetail.itemName : this.pdfDetail.eventData.groupName : this.pdfDetail.itemName;
          this.pdfRefTo = `${regionDetail} ${this.pdfDetail.commodity} ${this.pdfDetail.regName.replace(this.pdfDetail.commodity, '')} ${searchLabel}`;
          this.pdfType = this.pdfDetail.type === 'BOTH' ? '' : this.pdfDetail.type;

          // const pdfColor: any[] = JSON.parse(
          //   localStorage.getItem('MAPS_FacilitySearchParams') || '[]'
          // );
          // if (pdfColor?.length > 0) {
          //   this.updatePdfColor(this.pdfDetail, pdfColor);
          // }
          // this.disabledRadio();

          this.setPDFColor(this.pdfDetail);
          // this.getApiFilesPath();
        });

      }
      else {
        // this.coreService.isBusy = false;
        this.coreService.setBusy(false);

      }
    }
    else {
      this.router.navigate(['/']);
    }



  }

  ngOnDestroy() {
    URL.revokeObjectURL(this.pdfBlobUrl);
  }

  public recentTheme() {
    let theme: any = localStorage.getItem('MAPS_DarkMode');
    if (theme) {
      this.coreService.recentTheme(JSON.parse(theme).mode);
    }
    this.cdr.detectChanges();
  }

  setPDFViewer() {
    localStorage.setItem('MAPS_PDFViewer', JSON.stringify({ EdgeViewer: this.pdfViewer }));
  }

  isDisableRadio(elementType: string | null): boolean {
    if (this.pdfDetail?.type === undefined || this.pdfDetail?.type === null) {
      return true;
    }
    if (
      elementType === 'mono' &&
      this.pdfDetail?.type.toLowerCase() === 'mono'
    ) {
      return true;
    }
    if (
      elementType === 'color' &&
      this.pdfDetail?.type.toLowerCase() === 'color'
    ) {
      return true;
    }
    return false;
  }

  disabledRadio() {
    if (this.pdfDetail.type === 'MONO' && this.isDisable === false) {
      this.isMono = false;
      this.isColor = false;
    } else if (this.pdfDetail.type === 'COLOR' && this.isDisable === false) {
      this.isMono = false;
      this.isColor = false;
    } else if (
      this.pdfDetail.type === 'BOTH' ||
      this.pdfDetail.type === undefined ||
      this.pdfDetail.type === null ||
      this.pdfDetail.type === ''
    ) {
      this.isMono = false;
      this.isColor = false;
    } else if (this.isDisable === true) {
      this.isMono = this.pdfDetail.type === 'COLOR';
      this.isColor = this.pdfDetail.type === 'MONO';
    }
    this.canShowPDFColor = !(
      this.pdfDetail.type === 'MONO' || this.pdfDetail.type === 'COLOR' || this.pdfDetail.type === 'BOTH'
    );
  }

  radioChangeEvent(e: any) {
    this.pdfType = e.currentTarget.value;
    this.pdfList = null;
    this.totalCount = 0;
    this.skip = 0;
    // let mapPdfType = { ...this.pdfDetail, selectedType: e };
    // let arrayToPush = JSON.parse(localStorage.getItem('MAPS_FacilitySearchParams') || '[]');
    // arrayToPush.unshift(mapPdfType);
    // localStorage.setItem('MAPS_FacilitySearchParams', JSON.stringify(arrayToPush));
  }


  setPDFColor(params: any) {
    var pdfColor = params.type;
    if (pdfColor) {
      this.canShowPDFColor = true;
      if (pdfColor.toString().toUpperCase().trim() == 'BOTH') {
        let pdfColorVal = 'mono';
        let recentStorage = window.localStorage.getItem('MAPS_FacilitySearchParams');
        if (recentStorage) {
          let recentStorageJson = JSON.parse(recentStorage);
          let recentItem = _.find(recentStorageJson, { 'region': params.region, 'faciltity': params.facility });
          if (recentItem) {
            pdfColorVal = recentItem.pdfColor;
          }
        }

        this.hasColor = true;
        this.hasMono = true;
        this.isMono = false;
        this.isColor = false;

        if (pdfColorVal.toLowerCase().trim().indexOf('mono') >= 0) {
          this.isMono = true;
          this.pdfType = 'MONO';
        }
        else {
          this.isColor = true;
          this.pdfType = 'COLOR';
        }

      }
      else if (pdfColor.toString().toUpperCase().trim() == 'COLOR') {
        this.hasColor = true;
        this.hasMono = false;
        this.isMono = false;
        this.isColor = true;
        this.pdfType = 'COLOR';
      }
      else if (pdfColor.toString().toUpperCase().trim().indexOf('MONO') >= 0) {
        this.hasColor = false;
        this.hasMono = true;
        this.isMono = true;
        this.isColor = false;
        this.pdfType = 'MONO';
      }
    }
    else {
      this.hasColor = false;
      this.hasMono = false;
      this.isMono = false;
      this.isColor = false;
      this.canShowPDFColor = false;
      this.pdfType = '';
    }
  }

  SaveFacilitySearchParams(qryParams: any, pdfColor: any) {
    if (qryParams.type && qryParams.type.toLowerCase().trim() == 'both') {
      pdfColor = pdfColor.replace(/\\/g, '');
      var recentStorage = window.localStorage.getItem('MAPS_FacilitySearchParams');
      if (recentStorage) {
        let recentStorageJson = JSON.parse(recentStorage);
        var recentItem = _.find(recentStorageJson, { 'region': qryParams.region, 'faciltity': qryParams.facility });
        if (recentItem) {
          recentItem.pdfColor = pdfColor;
          recentStorageJson = _.map(recentStorageJson, function (recentStorageItem: any) {
            var tt = recentStorageItem.region == qryParams.region && recentStorageItem.facility == qryParams.facility ? recentItem : recentStorageItem;
            return tt;
          });
          window.localStorage.setItem('MAPS_FacilitySearchParams', JSON.stringify(recentStorageJson));
        }
        else {
          var recentItems = { 'region': qryParams.region, 'faciltity': qryParams.facility, 'pdfColor': pdfColor };
          recentStorageJson.push(recentItems);
          window.localStorage.setItem('MAPS_FacilitySearchParams', JSON.stringify(recentStorageJson));
        }

      }
      else {
        let recentItems = [{ 'region': qryParams.region, 'faciltity': qryParams.facility, 'pdfColor': pdfColor }];
        window.localStorage.setItem('MAPS_FacilitySearchParams', JSON.stringify(recentItems));
      }
    }

  }

  updatePdfColor(obj: any, pdfDet: any) {
    let matchingObj = pdfDet.find(
      (o: any) =>
        o.commodity === obj.commodity &&
        o.itemName === obj.itemName &&
        o.pdfDet === obj.pdfDet &&
        o.regName === obj.regName
    );

    if (matchingObj) {
      // this.pdfDetail.type = obj.selectedType = matchingObj.selectedType;
      this.pdfType = this.pdfDetail.selectedType;
      this.isDisable = false;
    }
  }

  getApiFilesPath() {
    this.configService.getApiDetail().subscribe((response: any) => {
      let res = response;
      this.apiDetails = res;
    });
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

  openPdf(pdf: any) {
    // if (this.pdfDetail.commodity.toLowerCase() === 'steam') {
    //   this.pdfDetail['pdfDet'] = this.pdfDetail.pdfDet.replace(/^.*?\//, '');
    // }
    let pdfType = this.pdfType ? '\\' + this.pdfType + '\\' : '\\';

    // this.pdfPath = this.configService.buildNonCacheURL(this.formatingString(
    //   this.apiDetails[0].file_url + this.pdfDetail.pdfDet + pdfType + pdf.file.split('|')[0] + '.pdf')
    // );

    this.GetPDFData(pdf.file.split('|')[0].trim());
    this.setActive(pdf);
    // this.configService.openLink(this.pdfPath);
  }

  GetPDFData(fileName: any) {
    // this.coreService.isBusy = true;
    this.coreService.setBusy(true);
    this.currentPayload.fileName = fileName;
    this.saveFileName = fileName;
    this.fileSearchService
      .getFiles(this.apiDetails[0].api_url + 'api/Files/PDFFile', this.currentPayload)
      .subscribe((response: any) => {
        this.pdfSrc = response;
        const base64Data = 'data:application/pdf;base64,' + response; // Your Base64 data
        //   //this.safeBase64Url = this.sanitizer.bypassSecurityTrustResourceUrl(base64Data);
        //   const myBlob = new Blob([response],{type:'application/pdf'});
        //   const file = new File([myBlob], fileName)
        //   const pdfUrl = URL.createObjectURL(file);  
        //  this.safeBase64Url = this.sanitizer.bypassSecurityTrustResourceUrl(pdfUrl);     
        this.pdfPath = this.getPdfAsBlobURL(response, fileName);//base64Data;
        // console.log(response);
        // this.coreService.isBusy = false;
        this.coreService.setBusy(false);

        this.cdr.detectChanges();
      });
  }

  getPdfAsBlobURL(base64String: any, fileName: any): any {
    URL.revokeObjectURL(this.pdfBlobUrl)
    // Decode the base64 string into a byte array
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    // Create a Blob from the byte array
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    // const file = new File([byteArray], fileName, { type: 'application/pdf' })
    // Create a URL for the Blob
    const pdfUrl = URL.createObjectURL(blob);
    this.pdfBlobUrl = pdfUrl;
    return pdfUrl + '#toolbar=1&navpanes=0&scrollbar=0&view=FitBH';;
  }

  public blobToBase64(blob: Blob): void {
    var reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = (e: any) => {
      //split the result to retrieve only the Base64 string
      this.pdfSrc = (e.target.result as string).split(",")[1];
    };
  }

  public fetchPdfFromUrl(): void {
    var request = new XMLHttpRequest();
    request.open('GET', this.pdfPath, true);
    request.responseType = 'blob';
    request.onload = () => {
      //pass the Blob response to the method
      this.blobToBase64(request.response);
    };
    request.send();
  }

  downloadPdf(): void {
    const downloadLink = document.createElement('a');
    document.body.appendChild(downloadLink);

    const filename = this.saveFileName;
    const linkData = `data:application/pdf;base64,${this.pdfSrc}`;

    downloadLink.href = linkData;
    downloadLink.download = filename;
    downloadLink.click();

    document.body.removeChild(downloadLink); // Clean up the temporary element
  }

  updateSearchParams() {

  }

  searchPdfFile() {
    if (this.pdfDetail.alt_url) {
      // if(this.pdfName){
      //   this.configService.openLink(this.pdfDetail.alt_url + this.pdfName);        
      // }
      // else{
      //   this.notifyService.showNotification("Please enter PDF file name to search", 'error');
      // }
      this.configService.openLink(this.pdfDetail.alt_url + this.pdfName, false);
      return;
    }

    this.SaveFacilitySearchParams(this.pdfDetail, this.pdfType);
    this.isBusy = true;
    let model = {};
    let region = '';
    // if (this.pdfDetail.commodity.toLowerCase() === 'steam') {
    //   region = this.pdfDetail.pdfDet.replace(/^.*?\//, '');
    // } 
    // else {
    region = this.pdfDetail.pdfDet;
    // }
    let pdfType = this.pdfType ? '\\' + this.pdfType : '';

    model = {
      pageTemplate: this.isPageTemplate ? this.isPageTemplate.toString() : '',
      region: region + pdfType,
      fileName: this.pdfName ? this.pdfName : '',
      filePath: this.formatingString(
        region + pdfType
      ),

      fileFormat: this.apiDetails[0].file_format,
      fileCount: this.pageSize.toString(),
      pageIndex: this.pageIndex.toString(),
      includeSubFolders:
        this.pdfType && this.pdfType.toString().toUpperCase().trim() == 'BOTH'
          ? 'true'
          : this.pdfDetail.eventData.search_subfolders ? 'true' : 'false',
      timestamp: new Date().getTime(),
    };

    this.currentPayload = model;
    this.fileSearchService
      .getFiles(this.apiDetails[0].api_url + 'api/Files/Search', model)
      .subscribe((response: any) => {
        this.isBusy = false;
        this.pdfList = response;
        // console.log(this.pdfList);
        this.totalCount = this.pdfList.totalFiles ? this.pdfList.totalFiles : 0;
        this.pdfList = this.pdfList.fileNames ? this.pdfList.fileNames.map((o: any) => ({
          file: o.replace(this.pdfList.filePath + '\\', ''),
        })) : [];
        // console.log(this.pdfList);
      });
  }

  onPageChange(e: any) {
    this.skip = e.skip;
    this.pageSize = e.take;
    this.pageIndex = Math.floor(this.skip / this.pageSize) + 1;
    this.searchPdfFile();
  }

  formatingString(str: string) {
    return str.replace('/', '\\');
  }

  // closeDialog() {
  //   this.dialog.close();
  // }

  closeWindow() {
    // this.windowRef.close();
    window.close();
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

  pdfLoad(event: any) {
    let elem: any = document.querySelectorAll('.k-toggle-button')[1];
    elem.click();
    // let drp:any  = document.querySelectorAll('.k-combobox');
    // drp.value('Fit to page');
    // drp.tigger('change');
  }

  public CopyContent(e: any) {
    // http://localhost:4200/#/mapviewer?regname=Manhattan&maptype=e_m_and_s&type=mono&filename=1-J.pdf
    let filename: any;
    let file: any = e.file;
    if (file.indexOf('\\') > 0) {
      let fileParts = file.split('\\');
      filename = fileParts[fileParts.length - 1].split('|')[0].trim();
    }
    else {
      filename = file.split('|')[0].trim();

    }
    let params: any = this.currentPayload.filePath.split('\\');
    this.copyText = window.location.origin + '/#/mapviewer?region=' + params[0];
    if (params.length > 1) {
      this.copyText = this.copyText + '&maptype=' + params[1];
    }
    if (params.length > 2) {
      this.copyText = this.copyText + '&mode=' + params[2];
    }
    this.copyText = this.copyText + '&filename=' + filename;// + '.pdf';
    this.clipboardService.copyFromContent(this.copyText);
    this.notifyService.showNotification("PDF URL copied to clipboard", 'info');
    // this.setCopied(e);
    this.cdr.detectChanges();
  }

  printPdf() {
    window.print();
  }

  public ToggleDark() {
    // this.coreService.isBusy = true;
    this.coreService.setBusy(true);

    this.coreService.ToggleTheme();
    let theme = this.coreService.theme;
    let recentObj: any = { mode: theme };
    localStorage.setItem('MAPS_DarkMode', JSON.stringify(recentObj));
    this.cdr.detectChanges();
    // this.coreService.isBusy = false;
    this.coreService.setBusy(false);

  }
}
