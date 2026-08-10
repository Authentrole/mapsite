import {
  Component,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconsModule } from '@progress/kendo-angular-icons';
import { chevronDoubleLeftIcon, chevronDoubleRightIcon, SVGIcon } from '@progress/kendo-svg-icons';
import {
  DrawerComponent,
  DrawerItem,
  DrawerMode,
  DrawerSelectEvent,
  LayoutModule,
} from '@progress/kendo-angular-layout';
import {
  Router
} from '@angular/router';
import { NavcontentComponent } from '../navcontent/navcontent.component';
import { ButtonModule } from '@progress/kendo-angular-buttons';

interface Item {
  text: string;
  path: string;
  icon: string;
  selected?: boolean;
}

@Component({
  // encapsulation: ViewEncapsulation.None,
  selector: 'app-sidenav',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    LayoutModule,
    IconsModule,
    NavcontentComponent,
  ],
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.scss',
})
export class SidenavComponent implements OnInit, OnDestroy {
  @ViewChild('drawer') drawer: DrawerComponent | undefined;
  @ViewChild('navContent') navContent: NavcontentComponent | undefined;

  @Input() selectedMapsCommodity: any;
  @Input() notifyToggleData: any;
  @Input() PDFList: any;

  public items: Array<DrawerItem> = [];
  public mode: DrawerMode = 'push';
  public mini = true;
  public expanded: boolean = true;
  public selected: string = 'Electric';
  public stylePos: any;
  public showIcon: SVGIcon = chevronDoubleRightIcon;
  public hideIcon: SVGIcon = chevronDoubleLeftIcon;
  /**
   *
   */
  constructor(private router: Router) {
    // let routeIems = this.mapItems(router.config);
    // routeIems.forEach((element) => {
    //   if (element.text) {
    //     if (router.url && router.url == element.path) {
    //       element.selected = true;
    //       this.selected = element.text;
    //     } else {
    //       element.selected = false;
    //     }
    //     this.items.push(element);
    //   }
    // });
    this.items.push({ text: 'Disclaimer Message' });
  }

  ngOnInit(): void {
    window.addEventListener('resize', () => {
      this.setSideMenu();
    });
  }

  ngOnDestroy() {
    window.removeEventListener('resize', () => { });
  }

  setSideMenu() {
    const pageWidth = window.innerWidth;
    if (pageWidth <= 770) {
      this.mode = 'overlay';
      this.mini = false;
      this.stylePos = { top: 'calc(2.75 * (1.5vh + 1.1vw)) !important' };
    } else {
      this.mode = 'push';
      this.mini = true;
      this.stylePos = {};
    }
  }

  public onSelect(ev: DrawerSelectEvent): void {
    this.selected = ev.item.text;
    this.router.navigate([ev.item.path]);
  }

  public mapItems(routes: any): Item[] {
    return routes.map((item: any) => {
      return {
        icon: item.data ? (item.data.icon ? item.data.icon : '') : '',
        text: item.title ? item.title : '',
        path: item.path ? item.path : '',
      };
    });
  }

  public showResults(data: any) {
    this.navContent!.PDFList = data;
    this.navContent!.showResults(data);
  }

}
