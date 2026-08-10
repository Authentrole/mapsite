import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuicklinksComponent } from './quicklinks.component';

describe('QuicklinksComponent', () => {
  let component: QuicklinksComponent;
  let fixture: ComponentFixture<QuicklinksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuicklinksComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(QuicklinksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
