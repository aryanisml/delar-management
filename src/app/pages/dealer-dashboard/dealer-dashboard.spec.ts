import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DealerDashboard } from './dealer-dashboard';

describe('DealerDashboard', () => {
  let component: DealerDashboard;
  let fixture: ComponentFixture<DealerDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DealerDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DealerDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
