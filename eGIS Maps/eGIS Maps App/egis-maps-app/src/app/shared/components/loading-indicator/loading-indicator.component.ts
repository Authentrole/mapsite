import { Component, Input } from '@angular/core';
import { IndicatorsModule } from '@progress/kendo-angular-indicators';

@Component({
  selector: 'app-loading-indicator',
  standalone: true,
  imports: [IndicatorsModule],
  templateUrl: './loading-indicator.component.html',
  styleUrl: './loading-indicator.component.scss',
})
export class LoadingIndicatorComponent {
  @Input() isLoading: boolean = true;
  @Input() size: any = 300;
  @Input() type: any = 'infinite-spinner';
    // | 'infinite-spinner'
    // | 'converging-spinner'
    // | 'pulsing' = 'pulsing';
}
