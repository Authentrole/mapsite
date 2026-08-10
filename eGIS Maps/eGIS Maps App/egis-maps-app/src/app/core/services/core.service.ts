import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CoreService {
  public theme: any;
  // public isBusy: boolean = false;
  
  private _isBusy = new BehaviorSubject<boolean>(false);
  isBusy$ = this._isBusy.asObservable();

  constructor() { }

  setBusy(val: boolean) {
    this._isBusy.next(val);
  }

  public ToggleTheme() {
    const themeEl: any = document.getElementById('themeEl');
    if (themeEl.href.toString().indexOf('dark') >= 0) {
      themeEl.href = 'assets/styles/kendo-theme-bootstrap/bootstrap-main.css';
      this.theme = 'light';
    } else {
      themeEl.href =
        'assets/styles/kendo-theme-bootstrap/bootstrap-main-dark.css';
      this.theme = 'dark';
    }
  }

  public recentTheme(theme: string) {
    const themeEl: any = document.getElementById('themeEl');
    if (theme === "dark") {
      themeEl.href =
        'assets/styles/kendo-theme-bootstrap/bootstrap-main-dark.css';
      this.theme = theme;
    } else {
      themeEl.href = 'assets/styles/kendo-theme-bootstrap/bootstrap-main.css';
      this.theme = theme;
    }
  }
}
