import { CommonModule, formatDate } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { LayoutModule } from '@progress/kendo-angular-layout';
import moment from 'moment';
import { DialogContentBase, DialogRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import _ from 'lodash';

@Component({
  selector: 'app-common-notification',
  standalone: true,
  imports: [LayoutModule,CommonModule,ButtonsModule],
  templateUrl: './common-notification.component.html',
  styleUrl: './common-notification.component.css'
})
export class CommonNotificationComponent extends DialogContentBase implements OnInit, AfterViewInit {
  @Input() modalData: any = [];
  subject!: string;
  @Input() showEmails!: boolean;
  @Input() announcementType : string | undefined;
  @Input() ragImages : any | undefined;
  @Input() commodityNameApps:any | undefined;
  @ViewChild('modalContent') modalContent: ElementRef | undefined;
  contentToMail: any;

  public isHistory:boolean=false;
  public commodityApps:any=[];

  ngOnInit() {
    const fromDate: string | null = this.modalData.fromDate ? formatDate(this.modalData.fromDate, 'EEEE MM/dd/yyyy hh:mm a', 'en-US') : '';
    const toDate: string | null = this.modalData.toDate ? formatDate(this.modalData.toDate, 'EEEE MM/dd/yyyy hh:mm a', 'en-US') : '';
    const from = fromDate !== '' ? " from " + fromDate : "";
    const to = toDate !== '' ? " to " + toDate : "";
    const mailSubject = this.modalData.title.indexOf('Outage') >= 0 ? "eGIS " + this.modalData.title + " Notification" : "eGIS " + this.modalData.title;
    const outageTxt = this.modalData.title.indexOf('Outage') >= 0 ? 'Outage' : '';
    this.subject = mailSubject + " : " + outageTxt + " on eGIS " + this.modalData.commodities + ' in ' + this.modalData.environments + ' environment(s)' + from + to;
    if(outageTxt){
      this.subject = this.modalData.additionalmsg === null || this.modalData.additionalmsg === undefined || this.modalData.additionalmsg === '' ? this.subject : "Update : " + this.subject;
      this.subject = this.modalData.isCompleted == 1 && this.modalData.completionmsg ? "eGIS " + this.modalData.title + " Completion Notification : All applications are available on " + this.modalData.environments : this.subject;  
    }
    // this.modalData.applications=this.modalData.applications.split(',').sort().join(',');

    this.modalData.commodities.split(',').forEach((commodity:any) => {
    //   this.commodityApps[commodity.trim()]= _.filter(this.modalData.applications.split(','),(app)=>{
    //                                             return app.indexOf(commodity.trim()) > 0
    //                                           });
    //   this.commodityApps[commodity.trim()]= _.sortBy(this.commodityApps[commodity.trim()],'id');

    this.commodityNameApps[commodity.trim()] = _.sortBy(this.commodityNameApps[commodity.trim()],'id');
        // this.commodityApps[commodity.trim()] = _.filter(this.commodityNameApps[commodity.trim()],(app)=>{
        //   return this.modalData.applications.indexOf(app.name) >=0
        // });
                        
          this.commodityApps[commodity.trim()]= _.filter(this.modalData.applications.split(','),(app)=>{
                                                return _.map(this.commodityNameApps[commodity.trim()],'name').indexOf(app.split('|')[0]) >= 0
                                              });

    }); 

    // (_.groupBy(this.modalData.applications,(app)=>{return app.indexOf('Gas') > 0 ? 'Gas' : 'Electric'}))
  }

  override ngAfterViewInit() {
    // let contentDiv = this.modalContent?.nativeElement;
    // contentDiv = getComputedStyle(contentDiv);
    // console.log(contentDiv);
  }

  cloneWithInterpolationValues(element: HTMLElement): string {
    const clonedElement = element.cloneNode(true) as HTMLElement;
    this.updateInterpolationValues(clonedElement);

    return clonedElement.outerHTML;
  }

  updateInterpolationValues(element: HTMLElement) {
    element.childNodes.forEach((c: any) => {
      if (c.nodeType === 3 && c.nodeValue.includes('{{')) {
        const interpolationValue = this.extractInterpolationValue(c.nodeValue);
        c.nodeValue = c.nodeValue.replace('{{${interpolationValue}}}', interpolationValue);
      } else if (c.nodeType === 1) {
        this.handleSpecialCases(c as HTMLElement);
        this.updateInterpolationValues(c as HTMLElement);
      }
    });
  }

  handleSpecialCases(e: HTMLElement) {
    const ngForDir = this.getNgForAttributes(e);
    ngForDir?.forEach((a: any) => {
      const loopVar = a.split(' ')[2];
      const iterable = a.split(' ')[1].trim();
      const ngForContent = e.innerHTML.trim();
      const clonedContent = ngForContent.replace('{{${loopVar}}}', '{{${iterable}}}');
      e.innerHTML = clonedContent;
    });
    ngForDir.forEach((a: any) => {
      e.removeAttribute('*${a}');
    });

    const ngIfDir = this.getNgIfAttributes(e);
    ngIfDir?.forEach((a: any) => {
      const ngIfType = e.getAttribute('*${a}');
      if (ngIfType) {
        const ngIfValue = this.extractInterpolationValue(ngIfType);
        e.removeAttribute('*${a}');
        const ngIfContent = e.innerHTML.trim();
        const clonedContent = ngIfContent.replace('{{${ngIfValue}}}', '{{true}}');
        e.innerHTML = clonedContent;
      }
    });
  }

  getNgIfAttributes(e: HTMLElement): string[] {
    const ngIfAttributes: string[] = [];
    Array.from(e.attributes).forEach((a: any) => {
      if (a.name.startsWith('*ngIf')) {
        ngIfAttributes.push(a.name.substring(1));
      }
    });
    return ngIfAttributes;
  }

  getNgForAttributes(e: HTMLElement): string[] {
    const ngForAttributes: string[] = [];
    Array.from(e.attributes).forEach((a: any) => {
      if (a.name.startsWith('*ngFor')) {
        ngForAttributes.push(a.name.substring(1));
      }
    });
    return ngForAttributes;
  }

  removeAngularAttributesAndComments(htmlString: string): string {
    const doc = new DOMParser().parseFromString(htmlString, 'text/html');
    // doc.querySelectorAll('button').forEach((b: any) => {
    //   b.removeChild(b);
    // });
    this.removeAngularAttributes(doc.body);
    return doc.body.innerHTML;
  }

  removeAngularAttributes(element: HTMLElement) {
    element.removeAttribute('_ngContent');
    element.removeAttribute('ng-star-inserted');
    element.removeAttribute('ng-reflect-ng-if');
    element.removeAttribute('ng-reflect-ng-for-of');
    Array.from(element.attributes).forEach((a: any) => {
      if (a.name.startsWith('ng') || a.name.startsWith('_ng') || a.name.startsWith('class')
        || a.name.startsWith('button')) {
        element.removeAttribute(a.name);
      }
    });

    element.querySelectorAll('*').forEach((c: any) => {
      this.removeAngularAttributes(c as HTMLElement);
    });
  }

  extractInterpolationValue(text: string) {
    const regex = /{{(.*?)}}/;
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  }

  public onCloseAction(): void {
    
    this.modalData = [];
    const contentDiv = this.modalContent?.nativeElement;
    if (contentDiv) {
      // contentDiv.childNodes[0]?.remove();
      // contentDiv.childNodes[1]?.remove();
      // contentDiv.childNodes[8]?.remove();
      contentDiv.childNodes.forEach((o: any) => {
        if (o instanceof HTMLHRElement) {
          o.remove();
        }
      });
    }
    // console.log(contentDiv);
    const clonedContent = this.cloneWithInterpolationValues(contentDiv);
    // console.log(clonedContent);
    const cleanedContent = this.removeAngularAttributesAndComments(clonedContent);
    // console.log(cleanedContent);
    this.contentToMail = [{ htmlBody: cleanedContent, subject: this.subject, enableButton: true }];
    this.dialog.close({ text: 'Yes' });
  }
}
