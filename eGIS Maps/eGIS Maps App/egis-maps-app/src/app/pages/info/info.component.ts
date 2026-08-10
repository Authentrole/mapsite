import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, afterEveryRender, inject } from '@angular/core';
import { HeaderComponent } from '../../core/components/header/header.component';
import { FooterComponent } from '../../core/components/footer/footer.component';
import { CardModule } from '@progress/kendo-angular-layout';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { ConfigService } from '../../core/services/config.service';
import _ from 'lodash';
import { AuthorizationService } from '../../core/services/authorization.service';
import { CoreService } from '../../core/services/core.service';

@Component({
  selector: 'app-info',
  standalone: true,
  templateUrl: './info.component.html',
  styleUrl: './info.component.scss',
  imports: [CommonModule, HeaderComponent, FooterComponent, CardModule]
})
export class InfoComponent implements OnInit {
  isUnauthAccess: boolean = false;
  supportPortalURL: string = 'https://egissupport.conedison.net';
  supportTeamDL: String = 'mailto://dlegissupport@coned.com';
  pageContent: any;

  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  public configService: ConfigService = inject(ConfigService);
  public coreService: CoreService = inject(CoreService);
  public dataService: DataService = inject(DataService);
  public authorizationService: AuthorizationService = inject(AuthorizationService);
  @ViewChild('supportContainer') supportContainer: ElementRef | undefined;
  evntLstnr: any;

  constructor(private route: ActivatedRoute) {
    afterEveryRender(() => {
      if (this.supportContainer?.nativeElement.querySelector('.qlink')) {
        this.supportContainer?.nativeElement.querySelectorAll('.qlink').forEach((element: any) => {
          // element.addEventListener('click', this.navigateToLink.bind(this));
          element.removeEventListener('click', this.evntLstnr);
          element.addEventListener('click', this.evntLstnr = ((e: any) => { this.navigateToLink(e); return false; }));
        });
      }
    });
  }

  ngOnInit(): void {
    let param = this.route.snapshot.paramMap.get('isAuthError');
    this.isUnauthAccess = param ? param == 'true' ? true : false : true;
    let pageName: any = this.isUnauthAccess ? 'unauth' : param == 'lsng' ? 'unauth-lsng' : 'info-error';

    this.configService.getTemplate(pageName).subscribe((res: any) => {
      this.pageContent = res;
      // this.coreService.isBusy = false;
      this.coreService.setBusy(false);

      this.cdr.detectChanges();
    });
  }

  navigateToLink(e: any) {
    let linkName = e.currentTarget.classList[e.currentTarget.classList.length - 1];

    this.configService.getNavItem('header').subscribe((response: any) => {
      let supportPortalLinks = _.filter(response, { "name": linkName });
      supportPortalLinks = supportPortalLinks && supportPortalLinks.length > 0 ? supportPortalLinks : _.filter(response, { "name": linkName.trim().replaceAll('_', ' ') });
      if (supportPortalLinks && supportPortalLinks.length > 0) {
        this.configService.openLink(supportPortalLinks[0].url, false);
      }
      else {
        console.log('URL not found');
      }
    });
  }
}
