import { Component, ViewEncapsulation, inject } from '@angular/core';
import { AppBarModule } from '@progress/kendo-angular-navigation';
import { CoreService } from '../../services/core.service';
import { AuthorizationService } from '../../services/authorization.service';
import { CommonModule } from '@angular/common';

@Component({
  // encapsulation: ViewEncapsulation.None,
  selector: 'app-footer',
  standalone: true,
  imports: [AppBarModule,CommonModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  public theme: any;
  coreService: CoreService;
  public authorizationService: AuthorizationService = inject(
    AuthorizationService
  );
  constructor(coreService: CoreService) {
    this.coreService = coreService;
  }
}
