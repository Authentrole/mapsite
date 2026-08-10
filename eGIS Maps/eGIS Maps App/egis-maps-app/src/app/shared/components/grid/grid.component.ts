import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, inject, Input, NgZone, Output,  ViewChild, Type } from '@angular/core';
import { Subscription, take } from 'rxjs';
import { CardModule, LayoutModule } from '@progress/kendo-angular-layout';
import { AddEvent, ColumnComponent, DataBindingDirective, EditEvent, ExcelExportEvent, GridModule, GridComponent,RemoveEvent, RowClassArgs,ExcelModule } from '@progress/kendo-angular-grid';
import { CompositeFilterDescriptor, distinct, filterBy, process, SortDescriptor } from "@progress/kendo-data-query";
import moment from 'moment';
import _ from 'lodash';

import { FormsModule } from '@angular/forms';

import { ButtonModule, ButtonsModule } from '@progress/kendo-angular-buttons';
import { DialogCloseResult, DialogService, DialogModule } from '@progress/kendo-angular-dialog';

import { InputsModule } from '@progress/kendo-angular-inputs';

import { GridButtonConfig } from '../../models/grid-buttons';

import { ICON_SETTINGS, IconsModule } from '@progress/kendo-angular-icons';
import { CommonService } from '../../../core/services/common.service';
import { ConfigService } from '../../../core/services/config.service';

import { ExcelExportData,ExcelExportModule } from '@progress/kendo-angular-excel-export';

import { GridFilterComponent } from "../grid-filter/grid-filter.component";
import { maxWidthIcon } from '@progress/kendo-svg-icons';
// interface HighlightItem {
//   itemKey: any;
//   columnKey?: any;
// }

@Component({
  selector: 'egis-grid',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonsModule, IconsModule, LayoutModule, DialogModule, CardModule, GridModule, GridFilterComponent,InputsModule, ExcelExportModule,ExcelModule ],
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.scss',
  providers:[]
})
export class EGISGridComponent {

  @Input() GridData: any[] = [];
  @Input() GridName: any = '';
  @Input() GridColumns: any = [];
  @Input() RowCallback: any;
  @Input() CanExport: boolean = true;
  @Input() Filterable: boolean = true;
  @Input() Pageable: boolean = true;
  @Input() Resizable: boolean = true;
  @Input() Sortable: boolean = true;
  @Input() PageAction: string = '';

  @Input() GridHeight: any = '50vh';
  @Input() AutoResize: boolean = true;
  @Input() FileName: string = '';
  @Input() BaseURLs: any = {};
  @Input() ActionButtons: GridButtonConfig[] | undefined;
  @Input() ToolbarButtons: GridButtonConfig[] | undefined;
  @Input() HasComponent: boolean | undefined;
  @Input() filterText: any = '';
  @Input() filter: CompositeFilterDescriptor = { logic: "and", filters: [] };

  @Input() showButton: any;

  
  @Output() public ActionButtonClick = new EventEmitter<{ id: string, rowData: any }>;
  @Output() public ToolBarButtonClick = new EventEmitter<{ id: string, gridData: any }>;
  @Output() public RequestAccessClick = new EventEmitter<{ data: any }>;

  @ViewChild('dataGrid') public dataGrid: GridComponent | any;
  @ViewChild(DataBindingDirective) dataBinding: DataBindingDirective | any;
  @ViewChild('excelExport', { static: false })
  public excelExport: any;

  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  public dataGridView: any[] = [];
  public filteredGridData: any[] = [];
  public pageSize = 25;
  public skip = 0;
  public loading = true;
  public IsFavoriteToggleOn: boolean = false;
  public IsToggleAllFavorite: boolean = false;
  public height: any;
  public toggleShowMore: boolean = false;
 
  public sort: SortDescriptor[] = [];
  public allExpanded = false;


  private commonService: CommonService = inject(CommonService);  
  private configService: ConfigService = inject(ConfigService);

  default_date_format: string = 'MM/dd/yyyy h:mm a';
  default_moment_format: string = 'MM/DD/YYYY hh:mm A';

  constructor(private ngZone: NgZone) {
    this.exportData = this.exportData.bind(this);
  }

  // ngOnInit() { 
  ngOnChanges() {
    this.RowCallback = this.RowCallback ? this.RowCallback : this.rowCallback
    this.FileName = this.FileName ? this.FileName : this.GridName + '_Details';
    this.configService.getConfig('grid_columns').subscribe((config: any) => {
      let configColumns = _.filter(config, { page: this.GridName });
      this.GridColumns = configColumns && configColumns.length > 0 ? configColumns[0].columns : this.GridColumns;
      // if (this.GridData.length > 0)
        this.loadData(this.GridData ?? []);
    });
  }

  public rowCallback = (context: RowClassArgs) => {
    return { 'grid-row': true };
  }

  formatDate(columnConfig: any, rowData: any): string | undefined {
    let dateFormat: any;
    if (columnConfig.date_format_condition) {
      let fieldName = columnConfig.date_format_condition.split('=')[0].trim();
      if (rowData[fieldName] && rowData[fieldName].toString() == columnConfig.date_format_condition.split('=')[1].trim()) {
        dateFormat = columnConfig.date_format ? columnConfig.date_format.replace('DD', 'dd') : this.default_date_format;
      }
      else {
        dateFormat = this.default_date_format;
      }
    }
    else {
      dateFormat = columnConfig.date_format ? columnConfig.date_format.replace('DD', 'dd') : this.default_date_format;
    }
    return dateFormat;

  }

  public loadData(gridData: any) {
    this.dataGridView = [];
    this.cdr.detectChanges();
    this.GridData = gridData;
    let dateColmns: any = _.filter(this.GridColumns, { isDate: true });

    if (!this.Sortable) {
      this.sort = []
    }

    if (gridData && gridData.length > 0) {
      gridData.map((r: any) => {
        this.GridColumns.forEach((gridCol: any) => {
          if (this.sort.length == 0 && this.Sortable) {
            if (gridCol.sort) {
              let sortDir = gridCol.sort_direction ? gridCol.sort_direction : 'asc';
              this.sort.push({ field: gridCol.name, dir: sortDir });
            }
          }
          if (gridCol.isDate) {
            let dateFormat: any;
            if (gridCol.date_format_condition) {
              let fieldName = gridCol.date_format_condition.split('=')[0].trim();
              if (r[fieldName] && r[fieldName].toString() == gridCol.date_format_condition.split('=')[1].trim()) {
                dateFormat = gridCol.date_format ? gridCol.date_format : this.default_moment_format;
              }
              else {
                dateFormat = this.default_moment_format;
              }
            }
            else {
              dateFormat = gridCol.date_format ? gridCol.date_format : this.default_moment_format;
            }

            r[gridCol.name] = this.commonService.formatDate(r[gridCol.name], dateFormat);
          }
          else {
            if (r[gridCol.name] || r[gridCol.name] === false || r[gridCol.name] === 0) {
              r[gridCol.name] = r[gridCol.name];
            }
            else {
              r[gridCol.name] = null;
            }

          }
        });
        // dateColmns.forEach((dateCol: any) => {
        //   let dateFormat:any;
        //   if(dateCol.date_format_condition){
        //     let fieldName = dateCol.date_format_condition.split('=')[0].trim();
        //     if(r[fieldName] && r[fieldName].toString() == dateCol.date_format_condition.split('=')[1].trim()){
        //       dateFormat = dateCol.date_format ? dateCol.date_format : this.default_moment_format;
        //     }
        //     else{
        //       dateFormat = this.default_moment_format;
        //     }
        //   }
        //   else{
        //     dateFormat = dateCol.date_format ? dateCol.date_format : this.default_moment_format;
        //   }

        //   r[dateCol.name] = this.commonService.formatDate(r[dateCol.name],dateFormat);
        // });
        return { ...r }
      });
      if (this.sort.length == 0 && this.Sortable) {
        this.sort.push({ field: this.GridColumns[0].name, dir: 'asc' });
      }
    }
    this.dataGridView = gridData;
    this.filteredGridData = gridData;
    //this.height = this.gridHeight ? this.gridHeight : 500;
    this.height = { height: this.GridHeight, width: '100%' };
    this.displayFilteredData();
    this.cdr.detectChanges();
    //if (this.AutoResize) {
      this.fitColumns();
    //}
    this.loading = false;
  }

  public exportData(): ExcelExportData {
    const result: ExcelExportData = {
      data: this.dataGridView
    };

    return result;
  }

  private exportFlag: boolean = false;

  public onExcelExport(e: any): void {
    if (!this.exportFlag) {
      // Show the hidden column       
      this.dataGrid.columns.forEach((col: any) => {
        col.hidden = false;
      });

      e.preventDefault(); // Prevent default export
      this.exportFlag = true;

      setTimeout(() => {
        this.dataGrid.pageSize = this.dataGrid.data.length;
        this.dataGrid.saveAsExcel(); // Trigger the export
      });
    }
    else {
      this.dataGrid.pageSize = this.pageSize;
      // Hide the column again after the export is triggered
      this.dataGrid.columns.forEach((col: any) => {
        let colConfig: any = _.filter(this.GridColumns, { name: col.field })[0];
        if (colConfig && colConfig.hidden) {
          col.hidden = true;
        }
      });
      this.exportFlag = false;
    }
  }

  public toggleSelectAll(event: any): void {
    const isChecked = event.target.checked;
    this.dataGridView.forEach((item: any) => item.selected = isChecked);
  }
  //Added for Asset Dashboard
  public getSelectedRecords(): any[] {
    return this.dataGridView.filter(item => item.selected);
  }


 

  displayFilteredData() {
    this.filterData();
    if (this.filter.filters.length > 0) {
      this.filter.filters.forEach((fltr: any) => {
        fltr.filters.forEach((sfltr: any) => {
          let dateColmns: any = _.filter(this.GridColumns, { isDate: true, name: sfltr.field });
          sfltr.value = sfltr.value == '(Blank)' ? null : dateColmns.length > 0 ? new Date(sfltr.value) : sfltr.value;// moment(sfltr.value).format('MM/DD/YYYY hh:mm A') == sfltr.value ? sfltr.value :
        });
      });
      this.dataGridView = filterBy(this.filteredGridData, this.filter);
    }

    if (this.IsFavoriteToggleOn) {
      var favoriteServers = this.dataGridView.filter((item: { favorite: any; }) => item.favorite);
      this.dataGridView = favoriteServers;
    }
    this.dataBinding.skip = 0;
    this.IsToggleAllFavorite = (this.dataGridView.length == _.map(this.dataGridView, 'favorite').length) ? _.uniq(_.map(this.dataGridView, 'favorite')).length > 1 ? false : _.uniq(_.map(this.dataGridView, 'favorite'))[0] : false;
  }

  public onFavoritesButtonClick(event: any): void {
    this.IsFavoriteToggleOn = !this.IsFavoriteToggleOn;
    this.displayFilteredData();
  }

  public onFilter(input: any): void {
    this.filterText = input;
    this.displayFilteredData();

    if (this.filterText && this.filterText.trim() !== '') {
      this.allExpanded = true;
      this.dataGridView.forEach((rowData: any) => {
        rowData.showMore = true;
      });
    } else {
      this.allExpanded = false;
      this.dataGridView.forEach((rowData: any) => {
        rowData.showMore = false;
      });
    }

    if (this.dataGrid) {
      this.cdr.detectChanges();
      this.fitColumns();
    }
  }

  private filterData() {
    if (this.filterText) {
      let filterColumns: any = [];
      if (this.GridData && this.GridData.length > 0) {
        this.GridColumns.forEach((element: any) => {
          filterColumns.push({
            field: element.name,
            operator: 'contains',
            value: this.filterText
          });
        });

        this.dataGridView = process(this.GridData, {
          filter: {
            logic: 'or',
            filters: filterColumns
          },
        }).data;

        this.dataBinding.skip = 0;
      }
    }
    else {
      this.dataGridView = this.GridData;
    }
    this.filteredGridData = this.dataGridView;
  }

  public filterChange(filter: CompositeFilterDescriptor): void {
    this.filter = filter;
    this.displayFilteredData();
  }

  public distinctPrimitive(fieldName: string): unknown[] {
    // let colValues: any = distinct(this.dataGridView, fieldName).map((item: any) => item[fieldName]);
    let colValues:any = _.uniq(_.map(this.dataGridView,(item:any)=>item[fieldName]));
    let dateColmns: any = _.filter(this.GridColumns, { isDate: true, name: fieldName });
    let dateFormat: any = dateColmns && dateColmns.length > 0 ? dateColmns[0].date_format : this.default_moment_format;
    dateFormat = dateFormat ? dateFormat : this.default_moment_format;
    let filterMenuVals: any = [];
    let hasNull: Boolean = false;
    colValues.forEach((val: any) => {
      if ((val || val === false || val === 0)) {
        if (dateColmns.length > 0) {
          if (!filterMenuVals.includes(moment(val).format(this.default_moment_format))) {
            if (!moment(val).format(this.default_moment_format).toUpperCase().trim().endsWith('12:00 AM')) {
              filterMenuVals.push(moment(val).format(this.default_moment_format));
            }
            else {
              if (!filterMenuVals.includes(moment(val).format(dateFormat))) {
                filterMenuVals.push(moment(val).format(dateFormat));
              }
            }
          }
        }
        else {
          if (!filterMenuVals.includes(val.toString().trim())) {
            filterMenuVals.push(val.toString().trim());
          }
        }
      }
      else {
        hasNull = true;
      }
    });


    filterMenuVals = _.uniq(filterMenuVals);
    filterMenuVals = this.commonService.sortArray(filterMenuVals);

    if (hasNull) {
      filterMenuVals.push('(Blank)');
    }
    return filterMenuVals;
  }

  public clearFilters() {
    this.filterText = null;
    this.filter = { logic: "and", filters: [] };
    this.dataGridView = this.GridData;
    this.filteredGridData = this.GridData;
    this.IsFavoriteToggleOn = false;
    this.IsToggleAllFavorite = false;
  }

  private fitColumns(): void {
    this.ngZone.onStable.asObservable().pipe(take(1)).subscribe(() => {
      if (this.dataGrid) {
        this.dataGrid.autoFitColumns();
      }
    });
  }

  public onActionButtonClick(buttonId: any, rowData: any): void {
    this.ActionButtonClick.emit({ id: buttonId, rowData: rowData });
  }

  public onToolBarButtonClick(buttonId: any, gridData: any): void {
    this.ToolBarButtonClick.emit({ id: buttonId, gridData: gridData });
  }

  public toggleShowMoreForRow(rowData: any): void {
    rowData.showMore = !rowData.showMore;

    this.recalculateAllExpandedState();

    if (this.dataGrid) {
      this.cdr.detectChanges();
      this.fitColumns();
    }
  }

  public toggleShowAll(): void {
    const shouldExpand = !this.allExpanded;

    this.dataGridView.forEach((rowData: any) => {
      rowData.showMore = shouldExpand;
    });

    this.allExpanded = shouldExpand;

    if (this.dataGrid) {
      this.cdr.detectChanges();
      this.fitColumns();
    }
  }

  private recalculateAllExpandedState(): void {
    if (!this.dataGridView || this.dataGridView.length === 0) {
      this.allExpanded = false;
      return;
    }

    const expandableRows = this.dataGridView.filter((row: any) => {
      const details = row.details;
      return typeof details === 'string' && details.split('||').length > 5;
    });

    if (expandableRows.length === 0) {
      this.allExpanded = false;
      return;
    }

    const allExpanded = expandableRows.every(row => row.showMore === true);
    const allCollapsed = expandableRows.every(row => row.showMore === false);

    if (allExpanded) {
      this.allExpanded = true;
    } else if (allCollapsed) {
      this.allExpanded = false;
    }
  }

  onRequestAccessClicked(payload: any) {
    this.RequestAccessClick.emit(payload);
  }

}