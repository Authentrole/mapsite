import { Directive, HostListener } from '@angular/core';

@Directive({
  selector: '[appDisableRightClick]',
  standalone: true
})
export class DisableRightClickDirective { 

  @HostListener('contextmenu', ['$event'])
  onRightClick(event: MouseEvent): void {
    event.preventDefault(); // Prevents the default browser context menu
  }

  constructor() { }
}
