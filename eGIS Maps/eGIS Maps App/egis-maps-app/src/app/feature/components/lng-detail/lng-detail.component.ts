import { AfterViewInit, ChangeDetectorRef, Component, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { AbstractControl, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { DropDownFilterSettings, DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { LayoutModule } from '@progress/kendo-angular-layout';
import { IconsModule } from '@progress/kendo-angular-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { IndicatorsModule } from '@progress/kendo-angular-indicators';
import { ActionSheetModule, AppBarModule } from "@progress/kendo-angular-navigation";
import { TooltipsModule } from "@progress/kendo-angular-tooltip";
import { ClipboardModule, ClipboardService } from 'ngx-clipboard';

import { forkJoin } from 'rxjs';

import { Router } from '@angular/router';
import _ from 'lodash';

import { AuthorizationService } from '../../../core/services/authorization.service';
import { LsngService } from '../../../pages/lsng/lsng.service';
import { EgisService } from '../../../shared/services/egis.service';
import { CoreService } from '../../../core/services/core.service';
import { ConfigService } from '../../../core/services/config.service';

import { NotifyService } from '../../../core/components/notify/notify.service';


// Custom validator to check if each line follows 5 digits, then / or -, then 5 digits
export function customFormatValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) {
    return null; // Empty field is valid (add Validators.required if needed)
  }

  const lines = control.value.split(/\r?\n/);
  // Regex: exactly 5 digits, followed by either a '/' or '-', followed by exactly 5 digits
  //const regex = /^\d{5}[/,-]\d{5}$/;
  const regex = /^(?=.{1,600}$)\d{5}(?:[,]\d{5}|[/-]\d{1,5})*$/;

  for (const line of lines) {
    if (line.trim() !== '' && !regex.test(line)) {
      return { invalidFormat: true };
    }
  }

  return null;
}

@Component({
  selector: 'app-lng-detail',
  standalone: true,
  imports: [
    ClipboardModule,
    AppBarModule,
    InputsModule,
    LabelModule,
    FormsModule,
    ReactiveFormsModule,
    DropDownsModule,
    IconsModule,
    FontAwesomeModule,
    ButtonsModule,
    LayoutModule,
    IndicatorsModule,
    ActionSheetModule,
    TooltipsModule,
  ],
  templateUrl: './lng-detail.component.html',
  styleUrl: './lng-detail.component.scss'
})
export class LngDetailComponent implements AfterViewInit, OnChanges {


  @Input() SelectedLayout: any;

  public coreService: CoreService = inject(CoreService);
  public configService: ConfigService = inject(ConfigService);
  // private fileSearchService: FileSearchService = inject(FileSearchService);
  private authorizationService: AuthorizationService = inject(AuthorizationService);
  private lsngService: LsngService = inject(LsngService);
  private egisService: EgisService = inject(EgisService);

  public notifyService: NotifyService = inject(NotifyService);
  private clipboardService: ClipboardService = inject(ClipboardService);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private router: Router = inject(Router);
  public fb: FormBuilder = inject(FormBuilder);
  public formGroup!: FormGroup;

  detailsGridData: any;
  SaveBtnText: string = "Generate Layout Number";
  appConfig: any;
  lsngConfig: any;
  tooltipConfig: any;
  LSNGenerated: boolean = false;
  isNewPart: boolean = false;
  enableNewPart: boolean = false;
  showLimitWarning: boolean = false;
  showLimitError: boolean = false;
  networkList: any;
  filteredNetworkList: any;
  municipalList: any;
  filteredMunicipalList: any;
  layoutTypeList: any;
  filteredLayoutTypeList: any;
  layoutClassList: any;
  filteredLayoutClassList: any;
  regionList: any;
  filteredRegionList: any;
  sequenceList: any;
  filteredSequenceList: any;
  yearList = Array.from({ length: 11 }, (_, i) => ({ year: (new Date().getFullYear() - i) }));
  nextYear: any = { year: (new Date().getFullYear() + 1) };
  //lastYear:any = { year: (new Date().getFullYear() - 1) };
  curYear: any = { year: (new Date().getFullYear()) };
  layoutNumber: any;
  layoutAppList: any = [];
  minPartCount: number = 1;
  errorMessage: any = null;

  public filterSettings: DropDownFilterSettings = {
    caseSensitive: false,
    operator: "contains",
  };

  ngOnInit(): void {
    // this.yearList=[];
    // this.yearList.push(this.lastYear);
    // this.yearList.push(this.curYear);
    this.yearList = this.yearList.reverse();
    this.yearList.push(this.nextYear);
    this.initForm();
  }

  ngAfterViewInit(): void {
    // this.cdr.detectChanges();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // this.initForm();
  }

  initForm() {

    this.setFormGroup();
    if (!this.SelectedLayout) {
      forkJoin(
        this.configService.getTemplate("lsng-wr-tooltip"),
        this.configService.getConfig('config'),
        this.configService.getConfig('lsng')
      ).subscribe(([tooltipConfig, appConfig, lsngConfig]) => {
        this.appConfig = appConfig;
        this.lsngConfig = lsngConfig;
        this.tooltipConfig = tooltipConfig;
        this.lsngService.apiURL = this.appConfig[0].api_url + "api/lsng";
        this.egisService.apiURL = this.appConfig[0].api_url + "api/egis";
        this.lsngConfig.layout_Apps.forEach((layoutApp: any) => {
          this.layoutAppList.push({ "AppName": layoutApp });
        });

        this.lsngConfig.ad_groups.some((group: string, index: any) => {
          if (this.authorizationService?.AuthenticatedUser?.userGroups?.includes(group.toUpperCase().trim())) {
            this.loadForm();
            return true;
          }
          else {
            if (index === this.lsngConfig.ad_groups.length - 1) {
              // this.coreService.isBusy = false;
              this.coreService.setBusy(false);

              this.router.navigate(['/info', { isAuthError: 'lsng' }]);
              // /window.location.href = "./#/info";     
              return true;
            }
            return false;
          }
        });
      });
    }
  }

  loadForm() {
    // this.coreService.isBusy = true;
    this.coreService.setBusy(true);

    forkJoin(
      this.lsngService.getNetworks(),
      this.lsngService.getMunicipals(),
      this.lsngService.getLayoutTypes(),
      this.lsngService.getLayoutClasses(),
      this.egisService.getRegions()
    ).subscribe(([networks, municipals, layoutTypes, layoutClasses, regions]) => {
      this.networkList = _.sortBy(networks, 'networkNo');
      this.municipalList = _.sortBy(municipals, 'municipality');
      this.layoutTypeList = _.sortBy(layoutTypes, 'layoutType1');
      this.layoutClassList = _.sortBy(layoutClasses, 'layoutClass');
      this.regionList = _.sortBy(regions, 'borough');

      this.filteredNetworkList = _.uniqBy(this.networkList, 'networkNo');
      this.filteredMunicipalList = _.uniqBy(this.municipalList, 'municipality');
      this.filteredLayoutTypeList = _.uniqBy(this.layoutTypeList, 'layoutType1');
      this.filteredLayoutClassList = _.uniqBy(this.layoutClassList, 'layoutClass');
      this.filteredRegionList = _.uniqBy(this.regionList, 'borough');

      // this.coreService.isBusy = false;
      this.coreService.setBusy(false);

      return true;
    });
  }

  setFormGroup(reset: boolean = false) {
    let municipal: any;
    let year: any = this.curYear.year;
    this.SelectedLayout = reset ? null : this.SelectedLayout;
    this.SaveBtnText = this.SelectedLayout ? "Update Layout Number" : "Generate Layout Number";
    if (!this.SelectedLayout) {
      if (this.formGroup) {
        this.formGroup.reset();
      }
      this.formGroup = this.fb.group({
        year: new FormControl(this.yearList[this.yearList.length - 2], [Validators.required]),
        network: new FormControl(null, [Validators.required]),
        municipal: new FormControl(null),
        layoutType: new FormControl(null, [Validators.required]),
        layoutClass: new FormControl(null, [Validators.required]),
        borough: new FormControl(null, [Validators.required]),
        sequence: new FormControl(null),
        part: new FormControl(null),
        eventNumber: new FormControl(null),
        mcNumber: new FormControl(null),
        wrNumber: new FormControl(null, [Validators.maxLength(600),
          customFormatValidator]),
        newPart: new FormControl(false),
        partCount: new FormControl(1, [Validators.required, Validators.min(this.minPartCount), Validators.max(999)]),
        layoutApp: new FormControl(null, [Validators.required]),
      });
    }
    else {
      this.minPartCount = 0;
      this.SaveBtnText = "Update Layout Number";
      municipal = this.SelectedLayout.layoutNum.split('-')[2].substr(3);
      year = this.curYear.year.toString().substring(0, 2) + this.SelectedLayout.layoutNum.split('-')[0].substr(1);
      this.formGroup = this.fb.group({
        year: new FormControl(_.filter(this.yearList, { year: Number(year) })[0]),
        network: new FormControl(_.filter(this.filteredNetworkList, { networkNo: this.SelectedLayout.networkId })[0]),
        municipal: new FormControl(municipal ? _.filter(this.filteredMunicipalList, { municipality: municipal })[0] : null),
        layoutType: new FormControl(_.filter(this.filteredLayoutTypeList, { layoutType1: this.SelectedLayout.layoutType })[0]),
        layoutClass: new FormControl(_.filter(this.filteredLayoutClassList, { layoutClass: this.SelectedLayout.layoutClass })[0]),
        borough: new FormControl(_.filter(this.filteredRegionList, { shortName: this.SelectedLayout.division })[0]),
        sequence: new FormControl(null),
        part: new FormControl(null),
        eventNumber: new FormControl(this.SelectedLayout.eventNum),
        mcNumber: new FormControl(this.SelectedLayout.mcNum),
        wrNumber: new FormControl(this.SelectedLayout.wrNum, [Validators.maxLength(600),
          customFormatValidator]),
        newPart: new FormControl(false),
        partCount: new FormControl(0, [Validators.required, Validators.min(this.minPartCount), Validators.max(999)]),
        layoutApp: new FormControl(_.filter(this.layoutAppList, { AppName: this.SelectedLayout.layoutApp })[0]),
      });
    }

    this.formGroup.enable();
    this.formGroup.get('municipal')?.setValidators(null);
    this.formGroup.get('municipal')?.disable();
    this.formGroup.get('municipal')?.updateValueAndValidity();

    this.formGroup.get('layoutType')?.disable();
    this.formGroup.get('layoutClass')?.disable();
    this.formGroup.get('newPart')?.disable();
    this.formGroup.get('sequence')?.disable();
    this.formGroup.get('part')?.disable();
    this.formGroup.get('eventNumber')?.disable();
    this.formGroup.get('mcNumber')?.disable();
    this.formGroup.get('network')?.disable();
    this.formGroup.get('layoutApp')?.disable();
    if (!this.SelectedLayout) {
      this.formGroup.get('wrNumber')?.disable();
      this.formGroup.get('partCount')?.disable();
    }
    else {
      this.SelectedLayout.year = year;
      this.lsngService.getLayoutSequences(this.SelectedLayout).subscribe((res: any) => {
        this.sequenceList = _.sortBy(res, 'layoutSeqNum');
        // this.filteredSequenceList = _.uniqBy(this.sequenceList, 'layoutSeqnum');
        if (this.sequenceList.length > 0) {
          let selectedSequences = this.sequenceList.filter((s: any) => s.layoutSeqNum === this.SelectedLayout.layoutSeqnum);
          let selectedParts = _.map(selectedSequences, "layoutPart");
          let maxPart = Math.max(...selectedParts);
          maxPart = maxPart + 1;
          this.formGroup.patchValue({
            sequence: selectedSequences[0],//? _.filter(this.filteredSequenceList,{layoutSeqNum: this.SelectedLayout.layoutSeqNum})[0] : null,
            part: maxPart.toString().padStart(3, '0')
          });
        }
      });
      this.formGroup.get('year')?.disable();
      this.formGroup.get('borough')?.disable();
      this.formGroup.get('wrNumber')?.enable();
      this.formGroup.get('partCount')?.enable();
      this.formGroup.markAllAsTouched();
      // this.formGroup.clearValidators();
      this.formGroup.updateValueAndValidity();

    }


    this.resetFlags();
  }

  resetFlags() {
    this.LSNGenerated = false;
    this.isNewPart = false;
    this.layoutNumber = null;
    this.showLimitError = false;
    this.showLimitWarning = false;
    this.enableNewPart = false;
    this.errorMessage = null;
    this.cdr.detectChanges();
  }


  filterNetwork(value: any) {
    let division: any = this.formGroup.get('borough')?.value?.shortName;
    division = division ? division.toLowerCase() : division;
    this.filteredNetworkList = this.networkList.filter((s: any) => s.division && s.division.toLowerCase() === division);

    this.filteredNetworkList = this.filteredNetworkList.filter((s: any) => {
      return s.networkNo.toLowerCase().includes(value.toLowerCase()) ||
        (s.networkName1 && s.networkName1.toLowerCase().includes(value.toLowerCase()));
    });

    this.filteredNetworkList = _.uniqBy(this.filteredNetworkList, 'networkNo');
  }

  filterMunicipality(value: any) {
    let division: any = this.formGroup.get('borough')?.value?.shortName;
    division = division ? division.toLowerCase() : division;
    this.filteredMunicipalList = this.municipalList.filter((s: any) => s.division && s.division.toLowerCase() === division);

    this.filteredMunicipalList = this.filteredMunicipalList.filter((s: any) => {
      return (s.municipality && s.municipality.toLowerCase().includes(value.toLowerCase())) ||
        (s.muniName && s.muniName.toLowerCase().includes(value.toLowerCase()));
    });

    this.filteredMunicipalList = _.uniqBy(this.filteredMunicipalList, 'municipality');

  }

  filterLayoutType(value: any) {
    this.filteredLayoutTypeList = this.layoutTypeList.filter((s: any) => {
      return (s.layoutType1 && s.layoutType1.toLowerCase().includes(value.toLowerCase())) ||
        (s.layoutTypeDescription && s.layoutTypeDescription.toLowerCase().includes(value.toLowerCase()));
    });


    this.filteredLayoutTypeList = _.uniqBy(this.filteredLayoutTypeList, 'layoutType1');
  }

  validateNewPart(value: any) {
    this.isNewPart = value;
    this.formGroup.patchValue({
      sequence: null,
      part: null
    });
    if (value) {
      this.formGroup.get('sequence')?.setValidators(Validators.required);
      this.formGroup.get('sequence')?.enable();
      this.formGroup.get('sequence')?.updateValueAndValidity();

      this.formGroup.get('part')?.setValidators(Validators.required);
      this.formGroup.get('part')?.disable();
      this.formGroup.get('part')?.updateValueAndValidity();

      // let payload = {
      //   layoutType: this.formGroup.get('layoutType')?.value?.layoutType1,
      //   layoutClass: this.formGroup.get('layoutClass')?.value?.layoutClass,
      //   division: this.formGroup.get('borough')?.value?.shortName,
      //   year: this.formGroup.get('year')?.value?.year
      // }
      // this.lsngService.getLayoutSequences(payload).subscribe((res:any)=>{
      //   this.sequenceList = _.sortBy(res, 'layoutSeqNum');
      //   this.filteredSequenceList = _.uniqBy(this.sequenceList, 'layoutSeqNum');
      //   this.handleSequenceChange(this.formGroup.get('sequence')?.value);
      //   this.cdr.detectChanges();
      // });
    }
    else {
      this.formGroup.get('sequence')?.setValidators(null);
      this.formGroup.get('sequence')?.disable();
      this.formGroup.get('sequence')?.updateValueAndValidity();

      this.formGroup.get('part')?.setValidators(null);
      this.formGroup.get('part')?.disable();
      this.formGroup.get('part')?.updateValueAndValidity();
    }

  }

  handleYearChange(value: any) {
    this.checkForLimit();
  }

  handleBoroughChange(value: any) {
    this.filteredMunicipalList = this.municipalList.filter((s: any) => s.division && s.division.toLowerCase() === value.shortName.toLowerCase());
    this.filteredLayoutClassList = this.layoutClassList.filter((s: any) => s.division && s.division.toLowerCase() === value.shortName.toLowerCase());
    this.filteredNetworkList = this.networkList.filter((s: any) => s.division && s.division.toLowerCase() === value.shortName.toLowerCase());

    this.filteredMunicipalList = _.uniqBy(this.filteredMunicipalList, 'municipality');
    this.filteredLayoutClassList = _.uniqBy(this.filteredLayoutClassList, 'layoutClass');
    this.filteredNetworkList = _.uniqBy(this.filteredNetworkList, 'networkNo');

    this.isNewPart = false;
    this.formGroup.patchValue({
      municipal: null,
      layoutClass: null,
      layoutType: null,
      network: null,
      sequence: null,
      part: null,
      newPart: false
    });

    if (this.lsngConfig.muni_borough.includes(value.shortName)) {
      this.formGroup.get('municipal')?.setValidators(Validators.required);
      this.formGroup.get('municipal')?.enable();
      this.formGroup.get('municipal')?.updateValueAndValidity();
    }
    else {
      this.formGroup.get('municipal')?.setValidators(null);
      this.formGroup.get('municipal')?.disable();
      this.formGroup.get('municipal')?.updateValueAndValidity();
    }
    this.formGroup.get('layoutType')?.enable();
    this.formGroup.get('layoutClass')?.enable();
    this.formGroup.get('network')?.enable();
    this.formGroup.get('eventNumber')?.enable();
    this.formGroup.get('mcNumber')?.enable();
    this.formGroup.get('wrNumber')?.enable();
    this.formGroup.get('partCount')?.enable();
    this.formGroup.get('layoutApp')?.enable();

    this.resetFlags();
    this.checkForLimit();
    this.cdr.detectChanges();
  }

  checkForLimit() {
    this.errorMessage = null;
    let layoutYear: any = this.formGroup.get('year')?.value?.year;
    let layoutType: any = this.formGroup.get('layoutType')?.value?.layoutType1;
    let layoutClass: any = this.formGroup.get('layoutClass')?.value?.layoutClass;
    let division: any = this.formGroup.get('borough')?.value?.shortName;
    let payload = { year: layoutYear, layoutType: layoutType, layoutClass: layoutClass, division: division };
    if (layoutYear && layoutType && layoutClass && division) {
      forkJoin(
        this.lsngService.getLayoutSequences(payload),
        this.lsngService.getLayoutCount(payload))
        .subscribe(([seqRes, countRes]) => {
          let seqData: any = seqRes;
          let countData: any = countRes;
          if (countData) {
            if (countData?.errorMessage) {
              this.errorMessage = countData?.errorMessage;
            }
            else {
              if (countData?.layoutCount <= this.lsngConfig.layout_limit) {
                if (countData?.layoutCount === 0) {
                  this.showLimitError = true;
                  this.showLimitWarning = false;
                }
                else {
                  this.showLimitError = false;
                  this.showLimitWarning = true;
                }
              }
              else {
                this.showLimitError = false;
                this.showLimitWarning = false;
              }

              this.sequenceList = _.sortBy(seqData, 'layoutSeqNum');
              this.filteredSequenceList = _.uniqBy(this.sequenceList, 'layoutSeqNum');
              if (this.filteredSequenceList.length > 0) {
                this.formGroup.get('newPart')?.enable();
                this.handleSequenceChange(this.formGroup.get('sequence')?.value);
              }
              else {
                this.formGroup.get('newPart')?.disable();
                this.formGroup.patchValue({
                  sequence: null,
                  part: null,
                  newPart: false
                });
                this.formGroup.get('sequence')?.setValidators(null);
                this.formGroup.get('sequence')?.disable();
                this.formGroup.get('sequence')?.updateValueAndValidity();

                this.formGroup.get('part')?.setValidators(null);
                this.formGroup.get('part')?.disable();
                this.formGroup.get('part')?.updateValueAndValidity();
              }
            }
          }
          this.cdr.detectChanges();
        });
    }
    else {
      this.formGroup.get('newPart')?.disable();
    }
    this.resetNewPart();

  }

  handleSequenceChange(value: any) {
    if (value) {
      let selectedSequences = this.sequenceList.filter((s: any) => s.layoutSeqNum === value?.layoutSeqNum);
      let selectedParts = _.map(selectedSequences, "layoutPart");
      let maxPart = Math.max(...selectedParts);
      maxPart = maxPart + 1;
      this.formGroup.patchValue({
        part: maxPart.toString().padStart(3, '0')
      });
      this.formGroup.get('part')?.setValidators(Validators.required);
      this.formGroup.get('part')?.enable();
      this.formGroup.get('part')?.updateValueAndValidity();
    }
    else {
      this.formGroup.patchValue({
        part: null
      });
      this.formGroup.get('part')?.setValidators(null);
      this.formGroup.get('part')?.disable();
      this.formGroup.get('part')?.updateValueAndValidity();
    }

    this.cdr.detectChanges();
  }

  resetNewPart() {
    this.formGroup.get('newPart')?.setValue(false);
    this.formGroup.get('newPart')?.updateValueAndValidity();
    // this.isNewPart = false;
    this.validateNewPart(false);
    // this.formGroup.patchValue({
    //   sequence: null,
    //   part: null
    // });
    // this.formGroup.get('sequence')?.setValidators(null);
    // this.formGroup.get('sequence')?.disable();
    // this.formGroup.get('sequence')?.updateValueAndValidity();

    // this.formGroup.get('part')?.setValidators(null);
    // this.formGroup.get('part')?.disable();
    // this.formGroup.get('part')?.updateValueAndValidity();
  }

  checkForNewPart() {
    let layoutYear: any = this.formGroup.get('year')?.value?.year;
    let layoutType: any = this.formGroup.get('layoutType')?.value?.layoutType1;
    let layoutClass: any = this.formGroup.get('layoutClass')?.value?.layoutClass;
    let division: any = this.formGroup.get('borough')?.value?.shortName;
    let payload = { year: layoutYear, layoutType: layoutType, layoutClass: layoutClass, division: division };
    if (layoutYear && layoutType && layoutClass && division) {
      this.enableNewPart = true;
      // 
    }
    else {
      this.enableNewPart = false;

    }
    // this.formGroup.patchValue({
    //     newPart: false
    //   });  
    //   this.formGroup.get('newPart')?.updateValueAndValidity();
    return !this.enableNewPart;
  }

  onKeyDown(event: KeyboardEvent): void {
    // Allow: backspace, delete, tab, escape, enter
    const allowedKeys = ['Backspace', 'Delete', 'End', 'Tab', 'Escape', 'Home', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

    // Allow copy/paste/cut shortcuts (Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X)
    if ((event.ctrlKey || event.metaKey) && ['a', 'c', 'v', 'x'].indexOf(event.key.toLowerCase()) !== -1) {
      return;
    }

    // Regular expression to match allowed characters: 0-9, comma, /, and -
    const regex = /^[0-9,/-]$/;

    if (allowedKeys.includes(event.key) || regex.test(event.key)) {
      return; // Let the event pass
    }

    event.preventDefault(); // Block everything else
  }

  disableSave() {
    // this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid || this.formGroup.pristine) {
      return true;
    }

    if (this.showLimitError || this.showLimitWarning) {
      return true;
    }
    return false;
  }

  generateLSN() {
    this.errorMessage = null;
    if (this.disableSave()) {
      return;
    }
    let wrNumber: any = this.parseWrNumber(this.formGroup.get('wrNumber')?.value);
    wrNumber = _.uniq(wrNumber);

    wrNumber.some((num: string) => {
      if (num.toString().length < 5) {
        this.formGroup.get('wrNumber')?.setErrors({ invalidFormat: true });
        return;
      }
    });

    if (this.formGroup.get('wrNumber')?.hasError('invalidFormat')) {
      return;
    }

    wrNumber = wrNumber.join(',');

    this.formGroup.patchValue({
      wrNumber: wrNumber
    });
    this.formGroup.get('wrNumber')?.updateValueAndValidity();

    let payload = {
      year: this.formGroup.get('year')?.value?.year,
      network: this.formGroup.get('network')?.value?.networkNo,
      municipal: this.formGroup.get('municipal')?.value?.municipality,
      layoutType: this.formGroup.get('layoutType')?.value?.layoutType1,
      layoutClass: this.formGroup.get('layoutClass')?.value?.layoutClass,
      division: this.formGroup.get('borough')?.value?.shortName,
      sequence: this.formGroup.get('sequence')?.value?.layoutSeqNum,
      part: this.formGroup.get('part')?.value,
      eventNumber: this.formGroup.get('eventNumber')?.value?.toString(),
      mcNumber: this.formGroup.get('mcNumber')?.value?.toString(),
      wrNumber: wrNumber,
      partCount: this.formGroup.get('partCount')?.value,
      layoutApp: this.formGroup.get('layoutApp')?.value?.AppName
    };

    // if(this.SelectedLayout){
    //   payload = this.SelectedLayout;
    //   payload.sequence = this.formGroup.get('sequence')?.value?.layoutSeqNum;
    //   payload.part = this.formGroup.get('part')?.value;
    //   payload.wrNumber = wrNumber;
    //   payload.partCount = this.formGroup.get('partCount')?.value;
    // }

    this.lsngService.generateLayoutNumber(payload).subscribe((res: any) => {
      if (res) {
        if (res.errorMessage) {
          this.errorMessage = res.errorMessage;
        }
        else if (res.layoutNumbers && res.layoutNumbers.length > 0) {
          this.layoutNumber = res?.layoutNumbers;
          this.LSNGenerated = true;
          this.formGroup.disable();
        }
      }

    });
  }

  parseWrNumber(wrNumber: string): string {
    if (!wrNumber) {
      return '';
    }
    let wrNumberList = wrNumber.split(/[-]+/).map((num: string) => num.trim()).filter((num: string) => num !== '');
    //  const result = Math.floor(start / 100) * 100 + endModifier;


    let csvNumbers: any = wrNumberList[0].split(/[/,]+/).map((num: string) => num.trim()).filter((num: string) => num !== '');

    let finalNumbers: any = [];
    finalNumbers.push(Number(csvNumbers[0]));
    // for(let csvNum of csvNumbers){
    //   finalNumbers.push(Number(csvNum));
    // }

    // for (let i = 1; i < csvNumbers.length; i++) {
    //   finalNumbers.push(Math.floor(Number(finalNumbers[finalNumbers.length-1]) / 100) * 100 + Number(csvNumbers[i]));
    // }

    let baseNumber: any = Number(csvNumbers[0]);
    let modifiers: any = csvNumbers.slice(1);

    // Using the math approach inside an array map
    let finalCSVNumbers = modifiers.map((mod: any) => {
      const divisor = Math.pow(10, mod.toString().length);
      return Math.floor(baseNumber / divisor) * divisor + Number(mod);
    });
    finalNumbers.push(...finalCSVNumbers.map((num: string) => Number(num)));

    for (let i = 1; i < wrNumberList.length; i++) {
      // Example Usage:
      csvNumbers = wrNumberList[i].split(/[/,]+/).map((num: string) => num.trim()).filter((num: string) => num !== '');
      baseNumber = Number(finalNumbers[finalNumbers.length - 1]);
      modifiers = csvNumbers.slice(1);


      let inputArray: [number, number] = [Number(finalNumbers[finalNumbers.length - 1]), Number(csvNumbers[0])];
      let result = this.generateRangeFromModifierArray(inputArray);
      finalNumbers = finalNumbers.concat(result);
      // finalNumbers.push(...csvNumbers.slice(1).map((num: string) => Number(num)));
      // for (let i = 1; i < csvNumbers.length; i++) {
      //   finalNumbers.push(Math.floor(Number(finalNumbers[finalNumbers.length-1]) / 100) * 100 + Number(csvNumbers[i]));
      // }
      // Using the math approach inside an array map
      finalCSVNumbers = modifiers.map((mod: any) => {
        const divisor = Math.pow(10, mod.toString().length);
        return Math.floor(baseNumber / divisor) * divisor + Number(mod);
      });
      finalNumbers.push(...finalCSVNumbers.map((num: string) => Number(num)));

    }

    return finalNumbers;
  }

  CopyLayoutNumber(layoutNumber: string) {
    // this.clipboardService.copyFromContent(this.layoutNumber);
    // this.notifyService.showNotification("Layout Number copied to clipboard", 'info');    
    this.lsngService.CopyLayoutNumber(layoutNumber);
    this.cdr.detectChanges();
  }

  closeWindow() {
    // this.windowRef.close();
    window.close();
  }

  generateRangeFromModifierArray(input: [number, number]): number[] {
    const [start, modifier] = input;

    // 1. Get the digit length of the modifier
    const modifierLength = modifier.toString().length;

    // 2. Cut off the matching number of digits from the start number
    const prefix = start.toString().slice(0, -modifierLength);

    // 3. Combine them to get the true end number (e.g., "123" + "50" = 12350)
    const end = Number(prefix + modifier);

    // 4. Generate the array from start to end
    const length = Math.abs(end - start) + 1;
    const isDown = start > end;
    let resultArray: number[] = [];
    if (isDown) {
      resultArray.push(start);
      resultArray.push(modifier);
      this.formGroup.get('wrNumber')?.setErrors({ invalidFormat: true });

    }
    else {
      resultArray = Array.from({ length }, (_, i) => start + i);
    }

    return resultArray;
  }
}
