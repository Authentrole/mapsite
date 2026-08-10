import { ChangeDetectorRef, Component, inject, OnInit, ViewChild } from '@angular/core';

import { LngHistoryComponent } from '../../feature/components/lng-history/lng-history.component';
import { LngDetailComponent } from '../../feature/components/lng-detail/lng-detail.component';
import { LayoutModule, SelectEvent, TabStripComponent } from "@progress/kendo-angular-layout";
import { AppBarModule } from "@progress/kendo-angular-navigation";
import { CoreService } from '../../core/services/core.service';
import { ButtonsModule } from "@progress/kendo-angular-buttons";
import { ConfigService } from '../../core/services/config.service';


@Component({
  selector: 'app-lsng',
  standalone: true,
  imports: [
    LngDetailComponent,
    LngHistoryComponent,
    LayoutModule,
    AppBarModule,
    ButtonsModule
  ],
  templateUrl: './lsng.component.html',
  styleUrl: './lsng.component.scss'
})

export class LsngComponent {

  public coreService: CoreService = inject(CoreService);
  public configService: ConfigService = inject(ConfigService);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  @ViewChild('tabstrip') public tabstrip!: TabStripComponent;
  @ViewChild('lsngDetail') public lsngDetail!: LngDetailComponent;
  // Variable to store the child's data for use in Tab 1
  public selectedLayout: any = null;
  appEnv: any;

  ngOnInit(): void {
    this.recentTheme();
    // this.coreService.isBusy = true;
    this.coreService.setBusy(true);

    this.configService.getConfig('config')
      .subscribe((appConfig: any) => {
        this.appEnv = appConfig[0].app_env;
      });
  }

  public recentTheme() {
    let theme: any = localStorage.getItem('MAPS_DarkMode');
    if (theme) {
      this.coreService.recentTheme(JSON.parse(theme).mode);
    }
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


  public currentTabIndex = 0;

  public onTabSelect(e: SelectEvent): void {
    this.currentTabIndex = e.index;
  }

  public isTabActive(index: number): boolean {
    return this.currentTabIndex === index;
  }

  // Event handler triggered by the child component
  public loadLayoutData(eventData: any): void {
    this.selectedLayout = eventData; // Capture data

    if (this.tabstrip) {
      this.tabstrip.selectTab(0); // Switch to the first tab (index 0)
      //Explicitly call your method since tabSelect won't auto-fire
      this.onTabSelect({ index: 0, title: 'Layout Number Generator' } as SelectEvent);

      this.cdr.detectChanges(); // Trigger change detection to update the view
      this.lsngDetail.SelectedLayout = eventData;
      this.lsngDetail.initForm(); // Call the method in the child component to load data
    }
  }
}
