import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommonNotificationComponent } from './common-notification.component';

describe('CommonNotificationComponent', () => {
  let component: CommonNotificationComponent;
  let fixture: ComponentFixture<CommonNotificationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonNotificationComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CommonNotificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
