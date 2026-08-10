import { Injectable, inject } from '@angular/core';
import {
  NotificationService,
  NotificationSettings,
} from '@progress/kendo-angular-notification';

@Injectable({
  providedIn: 'root',
})
export class NotifyService {
  private notificationQueue: NotificationSettings[] = [];
  private isShowingNotification: boolean = false;

  
  constructor(private notificationService: NotificationService) {
  }

  private showNextNotification() {
    if (this.notificationQueue.length > 0 && !this.isShowingNotification) {
      this.isShowingNotification = true;
      const nextNotification = this.notificationQueue.shift();
      if (nextNotification) {
        setTimeout(() => {
          this.isShowingNotification = false;
          this.showNextNotification();
        }, 1000);

        this.notificationService.show(nextNotification);
      }
    }
  }

  showNotification(
    message: string,
    type: 'success' | 'warning' | 'info' | 'error'
  ) {
    const notification: NotificationSettings = {
      content: message,
      animation: { type: 'fade', duration: 300 },
      position: { horizontal: 'right', vertical: 'top' },
      type: { style: type, icon: true },
      closable: false,
      hideAfter: 3000,
    };
    this.notificationQueue.push(notification);
    this.showNextNotification();
  }

  dismissNotification(notification: NotificationOptions) {
    this.notificationQueue = this.notificationQueue.filter(
      (n) => n !== notification
    );
  }
}
