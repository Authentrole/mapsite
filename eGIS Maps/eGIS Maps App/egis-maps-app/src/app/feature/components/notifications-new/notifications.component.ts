import { ChangeDetectorRef, Component, Input, OnInit, ViewChild, inject } from '@angular/core';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DropDownsModule, DropDownListComponent } from '@progress/kendo-angular-dropdowns';
import { CardModule, LayoutModule } from '@progress/kendo-angular-layout';
import { ConfigService } from '../../../core/services/config.service';
import { UamNewService } from '../../../core/services/uam-service.service';
import { AuthenticationGaurd } from '../../../core/services/auth-guard';
import { AuthorizationService } from '../../../core/services/authorization.service';
import { DataService } from '../../../core/services/data.service';
import { NotifyService } from '../../../core/components/notify/notify.service';
import { IconsModule } from '@progress/kendo-angular-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  ListViewModule,
  PagerSettings,
  PagerPosition,
  PagerType,
} from '@progress/kendo-angular-listview';
import { PagerModule } from '@progress/kendo-angular-pager';
import { Subscription, forkJoin } from 'rxjs';
import _ from 'lodash';
import moment from 'moment';
import { ScrollViewModule, ScrollViewPagerOverlay } from '@progress/kendo-angular-scrollview';
import { DialogService, DialogsModule, WindowModule, WindowService } from '@progress/kendo-angular-dialog';
import { CommonNotificationComponent } from '../common-notification/common-notification.component';
import { Title } from '@angular/platform-browser';
import { CoreService } from '../../../core/services/core.service';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    CommonModule,
    InputsModule,
    LabelModule,
    FormsModule,
    ReactiveFormsModule,
    DropDownsModule,
    CardModule,
    IconsModule,
    FontAwesomeModule,
    ButtonsModule,
    ListViewModule,
    LayoutModule,
    DialogsModule,
    WindowModule,
    PagerModule,
    ScrollViewModule,
  ],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css'
})
export class NotificationsComponent implements OnInit {
  @ViewChild("sv") private scrollView: any;
  @ViewChild("sv2") private scrollView2: any;
  @Input() toggleNotifications: boolean = false;
  public endless = true;
  public ispaused = false;
  public arrows = true;
  public pageable = false;
  public announcementPageable = false;
  public pagerOverlay: ScrollViewPagerOverlay = "none";
  public width = "100%";
  public height = "300px";
  public outageHeight = "300px";
  public announcementHeight = "250px";
  public hcHeight = '200px';

  public appUpdates: any[] = [
    {
      "title": "Notification",
      "message": "",
      "applications": "",
      "environments": "",
      "regions": "",
      "commodities": "",
      "fromDate": "",
      "toDate": "",
      "isActive": "",
      "isCompleted": ""
    }
  ];

  public notifications: any[] = [
    {
      "title": "Notification",
      "message": "",
      "applications": "",
      "environments": "",
      "regions": "",
      "commodities": "",
      "fromDate": "",
      "toDate": "",
      "isActive": "1",
      "isCompleted": "0"
    }
  ];

  public currentNotification: any;
  public selected_notification: any =
    {
      "title": "Notification",
      "message": "",
      "applications": "",
      "environments": "",
      "regions": "",
      "commodities": "",
      "fromDate": "",
      "toDate": "",
      "isActive": "1",
      "isCompleted": "0"
    };

  public appUpdateMsg: any;
  public appUpdateMsgList: any = [];

  public opened = false;

  public appList: any = [];
  public appDataOrg: any = [];
  public commodityList: any = [];
  public commodityNameApps: any = [];

  public ragImages: any;

  public dialogService: DialogService = inject(DialogService);
  public configService: ConfigService = inject(ConfigService);
  public coreService: CoreService = inject(CoreService);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private route: ActivatedRoute = inject(ActivatedRoute);
  public dataService: DataService = inject(DataService);
  public uamNewService: UamNewService = inject(UamNewService);
  public notifyService: NotifyService = inject(NotifyService);
  public authorizationService: AuthorizationService = inject(AuthorizationService);
  @ViewChild('region', { static: true }) regionControl!: DropDownListComponent;
  expandPanel: boolean = true;

  ngOnInit(): void {

    this.GetNotifications();
    forkJoin(
      this.configService.GetRAGImages(),
      this.uamNewService.GetCommodities(),
      this.uamNewService.GetApplications()
    ).subscribe(([imgData, commodityData, appData]: any) => {
      this.ragImages = imgData;

      this.commodityList = commodityData;


      this.appList = appData;
      this.appDataOrg = appData;
    });


  }

  openDialogForm(): void {
    const dialogRef = this.dialogService.open({
      content: CommonNotificationComponent,
      width: '90vw'
    });

    this.selected_notification = this.scrollView.data[this.scrollView.activeIndex];

    let unavailableApps: string[] = [];
    let partialApps: string[] = [];
    this.selected_notification.applications.split(',').forEach((app: string) => {
      if (app.indexOf('|un') >= 0) {
        unavailableApps.push(app.split('|')[0]);
      }
      else if (app.indexOf('|pa') >= 0) {
        partialApps.push(app.split('|')[0]);
      }
    });

    this.selected_notification.unavailableApps = unavailableApps.join(',');
    this.selected_notification.partialApps = partialApps.join(',');

    this.selected_notification.commodities = this.selected_notification.commodities.replace(/,/g, ', ');
    this.selected_notification.environments = this.selected_notification.environments.replace(/,/g, ', ');

    // this.selected_notification.applications = this.selected_notification.applications.split(',');
    // this.selected_notification.applications = this.selected_notification.applications.sort();



    this.commodityNameApps = [];
    let commodityNames = this.selected_notification.commodities.split(',');

    commodityNames.forEach((commodityName: any, ind: number) => {
      let selectedCommodity = _.filter(this.commodityList, (commodity) => {
        return commodity.commodity == commodityName.trim();
      })
      this.commodityNameApps[commodityNames[ind].trim()] = _.filter(this.appDataOrg, (app) => {
        return app.commodityId == selectedCommodity[0].id && this.selected_notification.applications.indexOf(app.name) >= 0
      });

      this.commodityNameApps[commodityNames[ind].trim()] = _.sortBy(this.commodityNameApps[commodityNames[ind].trim()], 'id');
      // this.commodityNameApps[commodityNames[ind]] = _.map(this.commodityNameApps[commodityNames[ind]],'name');

    });


    const modalInstance = dialogRef.content.instance as CommonNotificationComponent;
    modalInstance.showEmails = false;
    modalInstance.modalData = this.selected_notification;
    modalInstance.announcementType = this.authorizationService.config.announcement_notification_type;
    modalInstance.ragImages = this.ragImages;
    modalInstance.commodityNameApps = this.commodityNameApps;



  }

  private interval: any;
  private notificationInterval: any;
  private announcementInterval: any;
  private notificationIntervalTime = 600000;



  GetNotifications() {

    clearInterval(this.notificationInterval);
    clearInterval(this.interval);

    this.uamNewService.GetNotifications().subscribe(data => {
      // console.log(data);

      if (data) {
        // this.notifications = data;
        this.notifications = _.sortBy(data, 'title');
        if (this.toggleNotifications) {
          this.notifications = _.filter(data, { title: this.authorizationService.config[0].announcement_notification_type });
          if (this.scrollView) { this.scrollView.activeIndex = 0 };
        }

        this.currentNotification = this.notifications[0];
        if (this.currentNotification && this.currentNotification.title == this.authorizationService.config[0].announcement_notification_type) {
          this.height = this.announcementHeight;
        }
        else {
          this.height = this.outageHeight;
        }
      }
      else {
        this.notifications = [];
        this.currentNotification = null;
      }
      // this.coreService.isBusy = false;
      this.coreService.setBusy(false);

      for (var notInd = 0; notInd < this.notifications.length; notInd++) {
        let curNotification = this.notifications[notInd];
        if (curNotification.title != this.authorizationService.config[0].announcement_notification_type) {
          if (curNotification.isCompleted == 0 && moment(curNotification.toDate) <= moment()) { //.format('DD-MMM-YYYY HH:mm AM') .format('DD-MMM-YYYY HH:mm AM')
            this.notifications[notInd].isCompleted = 1;
            this.notifications[notInd].completionmsg = 'Outage is marked as auto complete';
          }
        }
      }

      if (this.notifications.length > 0) {
        this.interval = setInterval(() => {
          if (!this.ispaused) {
            this.scrollView.next();
            this.currentNotification = this.scrollView.data[this.scrollView.activeIndex];
          }

        }, 15000);
      }

    });

    // this.notificationIntervalTime=600000;
    // this.notificationInterval = setInterval(() => {
    //   this.currentNotification=null;
    //   this.GetNotifications();      
    // }, this.notificationIntervalTime); 
  }


  getCurrentNotification(event: any) {
    this.currentNotification = this.notifications[event];
    if (this.currentNotification.title == this.authorizationService.config[0].announcement_notification_type) {
      this.height = this.announcementHeight;
    }
    else {
      this.height = this.outageHeight;
    }
  }

  GetCommodityApps(applications: string, commodityName: any) {
    let commodityApps: any = [];
    //commodityApps = applications.split(',').sort();
    let selectedCommodity = _.filter(this.commodityList, (commodity) => {
      return commodity.commodity == commodityName.trim();
    })

    commodityApps = _.filter(this.appDataOrg, (app) => {
      return app.commodityId == selectedCommodity[0].id && applications.indexOf(app.name) >= 0
    });

    commodityApps = _.sortBy(commodityApps, 'id');
    commodityApps = _.map(commodityApps, 'name');

    let retCmmodityApps = _.filter(applications.split(','), (app) => {
      return commodityApps.indexOf(app.split('|')[0]) >= 0
    });

    //  this.commodityNameApps = commodityApps;
    return retCmmodityApps;
  }

  formatText(textstring: string) {
    return textstring ? textstring.replace(/,/g, ', ') : textstring;
  }

  public ngOnDestroy(): void {
    clearInterval(this.notificationInterval);
    clearInterval(this.interval);

  }

  public close(status: boolean): void {
    this.opened = false;
    this.ispaused = false;
  }

  public Open(notification: any) {
    this.OpenForm(notification);
  }

  public OpenForm(notification: any) {
    this.opened = true;
    if (notification != null) {
      this.selected_notification = notification;
    }
    else {
      this.selected_notification = this.scrollView.data[this.scrollView.activeIndex];
    }
    let unavailableApps: string[] = [];
    let partialApps: string[] = [];
    this.selected_notification.applications.split(',').forEach((app: string) => {
      if (app.indexOf('|un') >= 0) {
        unavailableApps.push(app.split('|')[0]);
      }
      else if (app.indexOf('|pa') >= 0) {
        partialApps.push(app.split('|')[0]);
      }
    });

    this.selected_notification.unavailableApps = unavailableApps.join(',');
    this.selected_notification.partialApps = partialApps.join(',');


    // if (this.selected_notification.isCompleted=='1'){
    //   this.selected_notification.title=this.selected_notification.title + " Completed"
    // }
    this.ispaused = true;

  }


}
