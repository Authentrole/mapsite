import { AfterViewInit, Component, EventEmitter, Input, Output } from '@angular/core';
import { FilterService } from '@progress/kendo-angular-grid';
import { distinct, filterBy, FilterDescriptor } from '@progress/kendo-data-query';
import { LabelComponent, LabelModule } from '@progress/kendo-angular-label';
import moment from 'moment';
import _ from 'lodash';
import { CommonModule } from '@angular/common';

interface CompositeFilterDescriptor {
  logic: "or" | "and";
  filters: Array<any>;
}

@Component({
  standalone: true,
  selector: 'egis-grid-filter',
  templateUrl: './grid-filter.component.html',
  styleUrls: ['./grid-filter.component.scss'],
  imports: [CommonModule, LabelModule]
})
export class GridFilterComponent implements AfterViewInit{

  @Input() public isPrimitive: boolean | undefined;
  @Input() public currentFilter: CompositeFilterDescriptor | undefined;
  @Input() public data:any;
  @Input() public textField:any;
  @Input() public valueField:any;
  @Input() public filterService: FilterService | undefined;
  @Input() public field: string='';
  @Input() public config: any;
  @Output() public valueChange = new EventEmitter<number[]>();

  public currentData: unknown[]=[];
  public showFilter = true;
  private value: unknown[] = [];

  isSelectAll:boolean = false;
  selectedItems:any = [];

  public textAccessor = (dataItem: any): string =>
    this.isPrimitive ? dataItem : dataItem[this.textField];
  public valueAccessor = (dataItem: any): any =>
    this.isPrimitive ? dataItem : dataItem[this.valueField];

  public ngAfterViewInit(): void {
    this.currentData = this.data;
    this.value = this.currentFilter!.filters.map(
      (f: FilterDescriptor) => f.value ? f.value : '(Blank)'
    );

    this.showFilter =
      typeof this.textAccessor(this.currentData[0]) === "string";
  }

  public isItemSelected(item: unknown): boolean {
    let itemSelected:boolean = false;
    if(this.config.isDate){
      // let dateFormat = this.config.date_format;
      // dateFormat = dateFormat ? dateFormat : 'MM/DD/YYYY hh:mm A';
      let dateFormat = 'MM/DD/YYYY hh:mm A';
    // }
    // if(this.field.toLowerCase().includes('date')){
      itemSelected = this.value.some((x:any) => moment(x).format(dateFormat) === moment(this.valueAccessor(item)).format(dateFormat));//this.valueAccessor(item));
    }
    else{
      itemSelected = this.value.some((x) => x === this.valueAccessor(item));
    }
    if(itemSelected){
      this.selectedItems.push(item);
     }
    //  else{
    //   this.selectedItems = _.remove(this.selectedItems,(a:any)=>{
    //     return a == item
    //   });
    //  } 

    this.selectedItems = _.uniq(this.selectedItems);
    this.isSelectAll = _.uniq(this.selectedItems).length == this.currentData.length;
    return itemSelected
  }

  public onSelectionChange(item: unknown, li: HTMLLIElement): void {   
    this.selectItem(item);
    this.onFocus(li);
  }

  selectItem(item:unknown){
    if (this.value.some((x) => x === item)) {
      this.value = this.value.filter((x) => x !== item);
      this.selectedItems = _.remove(this.selectedItems,(a:any)=>{
        return a == item
      });
      
    } else {
      this.value.push(item);
      this.selectedItems.push(item);
    }
    this.selectedItems = _.uniq(this.selectedItems);
    this.isSelectAll = _.uniq(this.selectedItems).length == this.currentData.length;

    // if(this.config.isDate){
    //   // let dateFormat = this.config.date_format;
    //   // dateFormat = dateFormat ? dateFormat : 'MM/DD/YYYY hh:mm A';
    //   let dateFormat = 'MM/DD/YYYY hh:mm A';
    //   this.value.push(new Date(moment(this.valueAccessor(item)).format(dateFormat)));
    // }

    //let filterOperator:any=this.config.isDate ? 'contains' : 'eq';

    this.filterService!.filter({
      filters: this.value.map((value) => ({
        field: this.field,
        operator: 'eq',
        value,
      })),
      logic: "or",
    });
  }

  public onInput(e: Event): void {
    this.currentData = distinct(
      [
        ...this.currentData.filter((dataItem) =>
          this.value.some((val) => val === this.valueAccessor(dataItem))
        ),
        ...filterBy(this.data, {
          operator: "contains",
          field: this.textField,
          value: (e.target as HTMLInputElement).value,
        }),
      ],
      this.textField
    );
  }

  public onFocus(li: HTMLLIElement): void {
    const ul = li.parentNode as HTMLUListElement;
    const below =
      ul.scrollTop + ul.offsetHeight < li.offsetTop + li.offsetHeight;
    const above = li.offsetTop < ul.scrollTop;

    // Scroll to focused checkbox
    if (above) {
      ul.scrollTop = li.offsetTop;
    }

    if (below) {
      ul.scrollTop += li.offsetHeight;
    }
  }

  onSelectAll(): void{
    this.isSelectAll = !this.isSelectAll;
    this.currentData.forEach(element => {
      this.selectItem(element);
    });
    
  }

  public get isAllSeleced() {
    return (
      _.uniq(this.selectedItems).length !== 0 && _.uniq(this.selectedItems).length !== this.currentData.length
    );
  }
}
