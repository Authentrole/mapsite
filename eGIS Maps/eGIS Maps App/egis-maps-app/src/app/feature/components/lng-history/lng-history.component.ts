import { ChangeDetectorRef, Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { EGISGridComponent } from "../../../shared/components/grid/grid.component";
import { LsngService } from '../../../pages/lsng/lsng.service';
import { AuthorizationService } from '../../../core/services/authorization.service';
import { GridButtonConfig, GridButtons } from '../../../shared/models/grid-buttons';
import _ from 'lodash';
import { CoreService } from '../../../core/services/core.service';
import { forkJoin } from 'rxjs';
import { ConfigService } from '../../../core/services/config.service';
import { EgisService } from '../../../shared/services/egis.service';

@Component({
  selector: 'app-lng-history',
  standalone: true,
  imports: [EGISGridComponent],
  templateUrl: './lng-history.component.html',
  styleUrl: './lng-history.component.scss'
})
export class LngHistoryComponent implements OnInit {

  // @Input() TabStrip:any;
  @Output() public editLayout = new EventEmitter<any>();
  detailsGridData: any;
  appConfig: any;
  lsngConfig: any;

  public actionButtons: GridButtonConfig[] = [];
  public toolbarButtons: GridButtonConfig[] = [];
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  public coreService: CoreService = inject(CoreService);
  public configService: ConfigService = inject(ConfigService);
  private lsngService: LsngService = inject(LsngService);
  private egisService: EgisService = inject(EgisService);
  private authorizationService: AuthorizationService = inject(AuthorizationService);

  constructor() { }
  // ngOnChanges(changes: SimpleChanges): void {
  //     // this.initForm();
  // }

  ngOnInit(): void {
    // if(this.coreService && this.coreService.isBusy !== undefined){
    //   this.coreService.isBusy = true;
    // }

    forkJoin(
      this.configService.getConfig('config'),
      this.configService.getConfig('lsng')
    ).subscribe(([appConfig, lsngConfig]) => {
      this.detailsGridData = [];
      this.appConfig = appConfig;
      this.lsngConfig = lsngConfig;

      const gridButtons = new GridButtons();
      this.actionButtons = _.filter(gridButtons.ActionButtons, ((btn: GridButtonConfig) => {
        return btn.id === 'edit' || btn.id === 'copy';
      }));

      this.actionButtons.forEach((btn: GridButtonConfig) => {
        if (btn.id === 'edit') {
          btn.tooltip = this.lsngConfig.edit_tooltip;
        }
      });
      this.actionButtons.reverse();

      this.toolbarButtons = _.filter(gridButtons.ToolbarButtons, ((btn: GridButtonConfig) => {
        return btn.id === 'refresh';
      }));

      this.lsngService.apiURL = this.appConfig[0].api_url + "api/lsng";
      this.egisService.apiURL = this.appConfig[0].api_url + "api/egis";
      this.loadLayoutHistory();
    });
  }

  loadLayoutHistory() {
    let payload = {
      "layoutType": "",
      "layoutClass": "",
      "division": "",
      "year": 0,
      "createdBy": this.authorizationService.AuthenticatedUser?.userID?.toLowerCase().replace("coned\\", '') || "",
    };
    // this.coreService.isBusy = true;
    this.coreService.setBusy(true);
    this.lsngService.getLayoutHistory(payload).subscribe((data: any) => {
      data = _.map(data, (item) => {
        return _.merge({}, item.layoutnumLog, item.userInfo,
          {
            userName: item.userInfo?.firstName?.toUpperCase() + " " + item.userInfo?.lastName?.toUpperCase(),
            section: item.userInfo?.sectCd + " - " + item.userInfo?.sectLevelName
          });
      });
      this.detailsGridData = data;
      this.cdr.detectChanges();
      // this.coreService.isBusy = false;
      this.coreService.setBusy(false);
    });
  }

  handleActionButton(event: { id: string, rowData: any }) {
    if (event) {
      if (event.id === 'copy') {
        this.lsngService.CopyLayoutNumber(event.rowData.layoutNum);
        this.cdr.detectChanges();
      }
      else if (event.id === 'edit') {
        this.editLayout.emit(event.rowData);
      }
    }
  }

  handleToolbarButton(event: { id: string, gridData: any }) {
    if (event) {
      if (event.id === 'refresh') {
        this.loadLayoutHistory();
      }
    }
  }
}
