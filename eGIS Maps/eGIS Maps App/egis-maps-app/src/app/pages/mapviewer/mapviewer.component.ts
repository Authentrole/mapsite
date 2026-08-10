import { Component, OnInit, inject, Input, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CardModule } from '@progress/kendo-angular-layout';
import { PDFViewerModule, PDFViewerTool, } from '@progress/kendo-angular-pdfviewer';
import { ButtonsModule, } from '@progress/kendo-angular-buttons';
import { CommonModule } from '@angular/common';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { PagerModule } from '@progress/kendo-angular-pager';
import { ConfigService } from '../../core/services/config.service';
import { FileSearchService } from '../../core/services/file-search.service';
import { IndicatorsModule } from '@progress/kendo-angular-indicators';
import _ from 'lodash';
import { NotifyService } from '../../core/components/notify/notify.service';
import { SafePipeModule } from 'safe-pipe';
import { ActivatedRoute, Router } from '@angular/router';
import { CoreService } from '../../core/services/core.service';
import { FormsModule } from '@angular/forms';
import { AppBarModule } from '@progress/kendo-angular-navigation';
import { forkJoin } from 'rxjs';
import { AuthorizationService } from '../../core/services/authorization.service';
import { HeaderComponent } from "../../core/components/header/header.component";
import { ClipboardModule, ClipboardService } from 'ngx-clipboard';

@Component({
    selector: 'app-mapviewer',
    standalone: true,
    imports: [
        ClipboardModule,
        AppBarModule,
        CardModule,
        PDFViewerModule,
        ButtonsModule,
        CommonModule,
        InputsModule,
        FormsModule,
        LabelModule,
        PagerModule,
        SafePipeModule,
        IndicatorsModule
    ],
    templateUrl: './mapviewer.component.html',
    styleUrl: './mapviewer.component.scss',
})
export class MapViewerComponent implements OnInit, OnDestroy {
    public coreService: CoreService = inject(CoreService);
    public configService: ConfigService = inject(ConfigService);
    private fileSearchService: FileSearchService = inject(FileSearchService);
    private authorizationService: AuthorizationService = inject(AuthorizationService);

    public notifyService: NotifyService = inject(NotifyService);
    private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
    @Input() pdfDetail: any;
    @Input() canSearch: boolean = false;
    @Input() pdfViewer: boolean = true;
    @Input() facilityMapPath: string = '';
    searchLabel: string = '';
    pdfName: string = '';
    pdfType: string = '';
    apiDetails: any;
    saveFileName: string = '';
    public expanded: boolean = false;
    public pageSize: number = 100;
    public skip: number = 0;
    public totalCount: number = 0;
    public pageIndex: number = 1;
    public pdfList: any;
    pdfPath: string = '';
    title: string = 'ConEdison Facility Map';
    activeItems: any[] = [];
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
    public pdfSrc: string | undefined;
    public mapviwertype: string = "";
    allRegions: any[] = [];
    appEnv: string = '';
    commodities: any = ['Electric', 'Gas', 'Steam'];
    isPageTemplate: boolean = false;
    showMsg: boolean = false;
    currentPayload: any;
    public copyText: string = '';
    errorMsg = 'PDF File not found.';
    pdfBlobUrl: any;

    constructor(public route: ActivatedRoute,
        public router: Router, private clipboardService: ClipboardService) {
    }

    ngOnInit(): void {
        // this.getApiFilesPath();
        this.recentTheme();
        let currentPDFViewer: any = localStorage.getItem('MAPS_PDFViewer');
        if (currentPDFViewer) {
            currentPDFViewer = JSON.parse(currentPDFViewer);
            this.pdfViewer = currentPDFViewer.EdgeViewer;
        }
        // this.coreService.isBusy = true;
        this.coreService.setBusy(true);

        this.configService.getApiDetail().subscribe((response: any) => {
            let res = response;
            this.apiDetails = res;
            this.appEnv = this.apiDetails[0].app_env;

            // let pdfBaseUrl = this.apiDetails[0].file_url;
            this.configService.getNavItem('Regions').subscribe((response: any) => {
                let res = response;
                this.allRegions = res;
                this.route.queryParams.subscribe(params => {
                    let regionName = params['regname'];
                    let mapType = params['maptype'];
                    let pdfFileName = params['filename'];
                    let region = params['region'];
                    let mode = params['mode'];
                    let formatedPdfUrl;
                    let mapTypeName: string = "";


                    region = region ? this.getRegionByShortName(region) : regionName;
                    let regionData: any = this.getRegionData(region);

                    if (region && mapType) {
                        this.commodities.forEach((commodity: any) => {
                            if (!mapTypeName) {
                                this.configService.getNavItem(commodity).subscribe((config: any) => {
                                    let commodityItems = _.filter(config, ((r: any) => {
                                        return r.name && r.name?.toLowerCase().trim().indexOf(region.toLowerCase().trim().replaceAll('_', ' ')) >= 0;
                                    }));
                                    commodityItems = commodityItems && commodityItems.length > 0 ? commodityItems[0].items : null;
                                    let facilityItems = _.filter(commodityItems, ((r: any) => {
                                        return r.url.toLowerCase().trim().indexOf('cso=' + regionData.short_name?.toLowerCase().trim() + '&facility=pdf_' + mapType.toLowerCase().trim()) >= 0;
                                    }));
                                    if (facilityItems && facilityItems.length > 0) {
                                        mapTypeName = facilityItems[0].name;
                                        mapTypeName = mapTypeName.replace(region, '');
                                        this.mapviwertype = commodity + " > " + region.replaceAll('_', ' ') + " > " + mapTypeName;
                                        this.searchLabel = region.replaceAll('_', ' ') + " " + commodity + " " + mapTypeName;
                                        this.searchLabel = facilityItems[0].alt_url ? this.searchLabel + ' containing' : this.searchLabel + ' starting with';
                                        if (mode && mode.toString().toUpperCase().trim() != 'BOTH') {
                                            this.mapviwertype = this.mapviwertype + ' > ' + this.configService.toTitleCase(mode);
                                        }
                                        this.isPageTemplate = facilityItems[0].page_template;

                                        let filePath: any;

                                        let filePathParts: any = [];

                                        filePathParts.push(region);
                                        if (mapType) {
                                            filePathParts.push(mapType);
                                        }
                                        if (mode && mode.toString().toUpperCase().trim() != 'BOTH') {
                                            filePathParts.push(mode);
                                        }

                                        filePath = filePathParts.join('/');
                                        // formatedPdfUrl = this.formatingString(pdfBaseUrl + filePath + '/' +  pdfFileName);

                                        let payload = {
                                            pageTemplate: this.isPageTemplate ? this.isPageTemplate.toString() : 'false',
                                            region: region,
                                            fileName: pdfFileName,
                                            filePath: filePath.replaceAll('/', '\\'),
                                            fileFormat: this.apiDetails[0].file_format,
                                            fileCount: this.pageSize.toString(),
                                            pageIndex: this.pageIndex.toString(),
                                            includeSubFolders:
                                                mode && mode.toString().toUpperCase().trim() == 'BOTH'
                                                    ? 'true'
                                                    : facilityItems[0].search_subfolders ? 'true' : 'false',
                                            timestamp: new Date().getTime(),
                                        };
                                        this.currentPayload = payload;
                                        if (pdfFileName) {
                                            this.saveFileName = pdfFileName;// + '.pdf';
                                            this.fileSearchService
                                                .getFiles(this.apiDetails[0].api_url + 'api/Files/PDFFile', payload)
                                                .subscribe((response: any) => {
                                                    this.pdfSrc = response;
                                                    this.pdfPath = response;
                                                    if (response) {
                                                        const base64Data = 'data:application/pdf;base64,' + response;
                                                        this.pdfPath = this.getPdfAsBlobURL(response, pdfFileName);//base64Data;    
                                                        // this.coreService.isBusy = false;
                                                        this.coreService.setBusy(false);

                                                        this.canSearch = false;
                                                        this.expanded = false;
                                                        this.cdr.detectChanges();
                                                    }
                                                    else {
                                                        this.fileSearchService
                                                            .getFiles(this.apiDetails[0].api_url + 'api/Files/Search', payload)
                                                            .subscribe((response: any) => {
                                                                this.isBusy = false;
                                                                this.pdfList = response;
                                                                // console.log(this.pdfList);
                                                                this.totalCount = this.pdfList.totalFiles ? this.pdfList.totalFiles : 0;
                                                                this.pdfList = this.pdfList.fileNames ? this.pdfList.fileNames.map((o: any) => ({
                                                                    file: this.parseFileName(o),
                                                                })) : [];
                                                                if (this.pdfList.length > 0) {
                                                                    this.openPdf(this.pdfList[0]);
                                                                    this.canSearch = false;
                                                                    this.expanded = this.pdfList.length > 1;
                                                                }
                                                                // this.coreService.isBusy = false;
                                                                this.coreService.setBusy(false);

                                                                this.cdr.detectChanges();
                                                            });
                                                    }
                                                });
                                            //this.pdfPath = this.configService.buildNonCacheURL(formatedPdfUrl);
                                            // this.setMapTypeName(regionName,maptype);
                                        }
                                        else {
                                            this.canShowPDFColor = true;
                                            this.canSearch = true;
                                            this.expanded = true;
                                            // this.coreService.isBusy = false;
                                            this.coreService.setBusy(false);

                                        }

                                    }
                                });
                            }

                        });
                    }
                    else {
                        this.errorMsg = "Invalid URL";
                        // this.coreService.isBusy = false;
                        this.coreService.setBusy(false);

                    }
                    //console.log(this.pdfPath);
                });
            });

        });

    }

    parseFileName(fileName: any): any {
        let tempFileName: any = fileName.toString().toUpperCase().trim().replace(this.currentPayload.filePath.toString().toUpperCase().trim(), '');
        tempFileName = tempFileName.split('\\');
        let tempFileParts: any = [];
        tempFileName.forEach((element: any) => {
            if (element) {
                tempFileParts.push(element);
            }
        });
        return tempFileParts.join(' > ');
    }

    ngOnDestroy() {
        URL.revokeObjectURL(this.pdfBlobUrl);
    }

    public setMapTypeName(region: string, mapType: string) {
        let mapTypeName: string = "";
        let commodityconfigs: any = [];
        forkJoin(
            this.configService.getNavItem('Electric'),
            this.configService.getNavItem('Gas'),
            this.configService.getNavItem('Steam')
        ).subscribe(([electricConfig, gasConfig, steamConfig]: any) => {
            commodityconfigs = electricConfig;
            commodityconfigs.push(gasConfig);
            commodityconfigs.push(steamConfig);

        });

        this.commodities.forEach((commodity: any) => {
            if (!mapTypeName) {
                this.configService.getNavItem(commodity).subscribe((config: any) => {
                    let commodityItems = _.filter(config, ((r: any) => {
                        return r.name.toLowerCase().trim().indexOf(region.toLowerCase().trim()) >= 0;
                    }));
                    commodityItems = commodityItems && commodityItems.length > 0 ? commodityItems[0].items : null;
                    let facilityItems = _.filter(commodityItems, ((r: any) => {
                        return r.url.toLowerCase().trim().indexOf('facility=pdf_' + mapType.toLowerCase().trim()) >= 0;
                    }));
                    if (facilityItems && facilityItems.length > 0) {
                        mapTypeName = facilityItems[0].name;
                        this.mapviwertype = commodity + " > " + region + " > " + mapTypeName;
                        this.isPageTemplate = facilityItems[0].page_template;
                    }
                });
            }

        });

        // switch (mapType.toLowerCase()) {
        //     case "c_and_do":
        //         mapTypeName = "C & DO";
        //         break;
        //     case "composite":
        //         mapTypeName = "Composite Feeder";
        //         break;
        //     case "conduit":
        //         mapTypeName = "Conduit";
        //         break;
        //     case "e_m_and_s":
        //         mapTypeName = "Electric M&S Plate";
        //         break;
        //     case "feeder":
        //         mapTypeName = "Feeder";
        //         break;
        //     case "g_m_and_s":
        //         mapTypeName = "Gas M&S Plate";
        //         break;
        //     case "g_reg_plate":
        //         mapTypeName = "Registration Plate";
        //         break;
        //     case "mhdetail":
        //         mapTypeName = "Manhole Detail";
        //         break;
        //     case "splicetckets":
        //         mapTypeName = "Splice Tckets";
        //         break;
        //     case "verticaldetails":
        //         mapTypeName = "Vertical Detail";
        //         break;
        // }


    }

    getRegionData(region: any) {
        return this.allRegions?.find(o => o.region.toLowerCase().trim() === region.toLowerCase().trim())
    }

    getRegionByShortName(shortName: any): string {
        const region = shortName.length > 2 ? shortName : this.allRegions?.find(o => o.short_name.toLowerCase().trim() === shortName.toLowerCase().trim())?.region;
        return region ? region : "";
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

    pdfLoad(event: any) {
        let elem: any = document.querySelectorAll('.k-toggle-button')[1];
        elem.click();
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

    getApiFilesPath() {
        this.configService.getApiDetail().subscribe((response: any) => {
            let res = response;
            this.apiDetails = res;
        });
    }

    getPdfAsBlobURL(base64String: any, fileName: any): any {
        URL.revokeObjectURL(this.pdfBlobUrl);
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

    // isDisableRadio(elementType: string | null): boolean {
    //     if (this.pdfDetail?.type === undefined || this.pdfDetail?.type === null) {
    //         return true;
    //     }
    //     if (
    //         elementType === 'mono' &&
    //         this.pdfDetail?.type.toLowerCase() === 'mono'
    //     ) {
    //         return true;
    //     }
    //     if (
    //         elementType === 'color' &&
    //         this.pdfDetail?.type.toLowerCase() === 'color'
    //     ) {
    //         return true;
    //     }
    //     return false;
    // }

    // disabledRadio() {
    //     if (this.pdfDetail.type === 'MONO' && this.isDisable === false) {
    //         this.isMono = false;
    //         this.isColor = false;
    //     } else if (this.pdfDetail.type === 'COLOR' && this.isDisable === false) {
    //         this.isMono = false;
    //         this.isColor = false;
    //     } else if (
    //         this.pdfDetail.type === 'BOTH' ||
    //         this.pdfDetail.type === undefined ||
    //         this.pdfDetail.type === null ||
    //         this.pdfDetail.type === ''
    //     ) {
    //         this.isMono = false;
    //         this.isColor = false;
    //     } else if (this.isDisable === true) {
    //         this.isMono = this.pdfDetail.type === 'COLOR';
    //         this.isColor = this.pdfDetail.type === 'MONO';
    //     }
    //     this.canShowPDFColor = !(
    //         this.pdfDetail.type === 'MONO' || this.pdfDetail.type === 'COLOR' || this.pdfDetail.type === 'BOTH'
    //     );
    // }

    radioChangeEvent(e: any) {
        this.pdfType = e.currentTarget.value;
        this.pdfList = null;
        this.totalCount = 0;
        this.skip = 0;
    }


    // setPDFColor(params: any) {
    //     var pdfColor = params.type;
    //     if (pdfColor) {
    //         this.canShowPDFColor = true;
    //         if (pdfColor.toString().toUpperCase().trim() == 'BOTH') {
    //             let pdfColorVal = 'mono';
    //             let recentStorage = window.localStorage.getItem('MAPS_FacilitySearchParams');
    //             if (recentStorage) {
    //                 let recentStorageJson = JSON.parse(recentStorage);
    //                 let recentItem = _.find(recentStorageJson, { 'region': params.region, 'faciltity': params.facility });
    //                 if (recentItem) {
    //                     pdfColorVal = recentItem.pdfColor;
    //                 }
    //             }

    //             this.hasColor = true;
    //             this.hasMono = true;
    //             this.isMono = false;
    //             this.isColor = false;

    //             if (pdfColorVal.toLowerCase().trim().indexOf('mono') >= 0) {
    //                 this.isMono = true;
    //                 this.pdfType = 'MONO';
    //             }
    //             else {
    //                 this.isColor = true;
    //                 this.pdfType = 'COLOR';
    //             }

    //         }
    //         else if (pdfColor.toString().toUpperCase().trim() == 'COLOR') {
    //             this.hasColor = true;
    //             this.hasMono = false;
    //             this.isMono = false;
    //             this.isColor = true;
    //             this.pdfType = 'COLOR';
    //         }
    //         else if (pdfColor.toString().toUpperCase().trim().indexOf('MONO') >= 0) {
    //             this.hasColor = false;
    //             this.hasMono = true;
    //             this.isMono = true;
    //             this.isColor = false;
    //             this.pdfType = 'MONO';
    //         }
    //     }
    //     else {
    //         this.hasColor = false;
    //         this.hasMono = false;
    //         this.isMono = false;
    //         this.isColor = false;
    //         this.canShowPDFColor = false;
    //         this.pdfType = '';
    //     }
    // }

    // SaveFacilitySearchParams(qryParams: any, pdfColor: any) {
    //     if (qryParams.type && qryParams.type.toLowerCase().trim() == 'both') {
    //         pdfColor = pdfColor.replace('\\', '');
    //         var recentStorage = window.localStorage.getItem('MAPS_FacilitySearchParams');
    //         if (recentStorage) {
    //             let recentStorageJson = JSON.parse(recentStorage);
    //             var recentItem = _.find(recentStorageJson, { 'region': qryParams.region, 'faciltity': qryParams.facility });
    //             if (recentItem) {
    //                 recentItem.pdfColor = pdfColor;
    //                 recentStorageJson = _.map(recentStorageJson, function (recentStorageItem: any) {
    //                     var tt = recentStorageItem.region == qryParams.region && recentStorageItem.facility == qryParams.facility ? recentItem : recentStorageItem;
    //                     return tt;
    //                 });
    //                 window.localStorage.setItem('MAPS_FacilitySearchParams', JSON.stringify(recentStorageJson));
    //             }
    //             else {
    //                 var recentItems = { 'region': qryParams.region, 'faciltity': qryParams.facility, 'pdfColor': pdfColor };
    //                 recentStorageJson.push(recentItems);
    //                 window.localStorage.setItem('MAPS_FacilitySearchParams', JSON.stringify(recentStorageJson));
    //             }

    //         }
    //         else {
    //             let recentItems = [{ 'region': qryParams.region, 'faciltity': qryParams.facility, 'pdfColor': pdfColor }];
    //             window.localStorage.setItem('MAPS_FacilitySearchParams', JSON.stringify(recentItems));
    //         }
    //     }

    // }

    // updatePdfColor(obj: any, pdfDet: any) {
    //     let matchingObj = pdfDet.find(
    //         (o: any) =>
    //             o.commodity === obj.commodity &&
    //             o.itemName === obj.itemName &&
    //             o.pdfDet === obj.pdfDet &&
    //             o.regName === obj.regName
    //     );

    //     if (matchingObj) {
    //         this.pdfType = this.pdfDetail.selectedType;
    //         this.isDisable = false;
    //     }
    // }



    setActive(item: any) {
        this.activeItems.push(item);
        if (this.activeItems.length > 1) {
            this.activeItems.find((o) => o?.isActive)['isActive'] = false;
        }
        item['isActive'] = true;
    }

    openPdf(pdf: any) {
        let fileName: any = pdf.file;//.replace(' > ','\\');
        this.GetPDFData(fileName.split('|')[0].trim());
        this.setActive(pdf);
    }

    GetPDFData(fileName: any) {
        // this.coreService.isBusy = true;
        this.coreService.setBusy(true);

        this.currentPayload.fileName = fileName.replaceAll(' > ', '\\');;
        this.saveFileName = fileName;//.replace('\\','_');
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
                this.pdfPath = base64Data;//this.getPdfAsBlobURL(response,fileName);//base64Data;
                // console.log(response);
                // this.coreService.isBusy = false;
                this.coreService.setBusy(false);

                this.cdr.detectChanges();
            });
    }

    // public blobToBase64(blob: Blob): void {
    //     var reader = new FileReader();
    //     reader.readAsDataURL(blob);
    //     reader.onload = (e: any) => {
    //         //split the result to retrieve only the Base64 string
    //         this.pdfSrc = (e.target.result as string).split(",")[1];
    //     };
    // }

    // public fetchPdfFromUrl(): void {
    //     var request = new XMLHttpRequest();
    //     request.open('GET', this.pdfPath, true);
    //     request.responseType = 'blob';
    //     request.onload = () => {
    //         //pass the Blob response to the method
    //         this.blobToBase64(request.response);
    //     };
    //     request.send();
    // }

    // updateSearchParams() {

    // }

    searchPdfFile(isSearch: any) {
        this.isBusy = true;
        this.currentPayload.fileName = isSearch ? this.pdfName : this.currentPayload.fileName;
        this.currentPayload.pageIndex = this.pageIndex.toString()
        this.fileSearchService
            .getFiles(this.apiDetails[0].api_url + 'api/Files/Search', this.currentPayload)
            .subscribe((response: any) => {
                this.isBusy = false;
                this.pdfList = response;
                // console.log(this.pdfList);
                this.totalCount = this.pdfList.totalFiles ? this.pdfList.totalFiles : 0;
                this.pdfList = this.pdfList.fileNames ? this.pdfList.fileNames.map((o: any) => ({
                    file: this.parseFileName(o),
                })) : [];
                // console.log(this.pdfList);
            });
    }

    onPageChange(e: any) {
        this.skip = e.skip;
        this.pageSize = e.take;
        this.pageIndex = Math.floor(this.skip / this.pageSize) + 1;
        this.searchPdfFile(this.canSearch);
    }

    formatingString(str: string) {
        return str.replace('/', '\\');
    }

    // closeWindow() {
    //     window.close();
    // }

    keyPress(event: any) {
        var keycode = (event.keyCode ? event.keyCode : event.which);
        if (keycode == '13') {
            this.searchPdfFile(this.canSearch);
            return false;
        }
        return true;
    }

    public CopyContent(e: any) {
        // http://localhost:4200/#/mapviewer?regname=Manhattan&maptype=e_m_and_s&type=mono&filename=1-J.pdf
        let filename: any;
        let file: any = e.file;
        file = file.replaceAll(' > ', '\\');
        if (file.indexOf('\\') > 0) {
            let fileParts = file.split('\\');
            filename = fileParts[fileParts.length - 1].split('|')[0].trim();
        }
        else {
            filename = file.split('|')[0].trim();
        }

        let filePath: any = this.currentPayload.filePath + '\\' + file.replace(filename, '');
        let params: any = filePath.split('\\');
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
