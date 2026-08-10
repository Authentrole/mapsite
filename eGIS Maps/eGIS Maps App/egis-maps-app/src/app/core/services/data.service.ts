import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private dataSubject = new BehaviorSubject<any>(null);
  private toggleNotify = new BehaviorSubject<boolean>(this.getSavedState());
  private commodityNameSubject = new BehaviorSubject<string>('');
 
  data$ = this.dataSubject.asObservable();
  toggleData$ = this.toggleNotify.asObservable();
  commodityName$ = this.commodityNameSubject.asObservable();

  getCurrentCommodity(): Observable<any> {
    return this.commodityName$;
  }

  toggle() {
    const newState = !this.toggleNotify.value;
    this.toggleNotify.next(newState);
    this.saveState(newState);
  }

  private getSavedState(): boolean {
    const savedState = localStorage.getItem('MAPS_Notifications');
    return savedState ? JSON.parse(savedState).mode == 'on' ? true : false : false;
  }

  private saveState(state: boolean) {
    let recentState:any={mode:state ? 'on' : 'off'};
    localStorage.setItem('MAPS_Notifications', JSON.stringify(recentState));
  }

  selectedCommodityData(data: string) {
    this.commodityNameSubject.next(data);
  }

  setData(data: any) {
    this.dataSubject.next(data);
  }

  passData(data: any) {
    this.dataSubject.next(JSON.parse(data));
  }

  setPagerData(data: any) {
    this.dataSubject.next(data);
  }

  

  // notiftyData(data: any) {
  //   this.toggleNotify.next(data);
  // }
}
