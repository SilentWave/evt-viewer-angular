import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { VerseProseSelectComponent } from './verse-prose-select.component';

describe('VerseProseSelectComponent', () => {
  let component: VerseProseSelectComponent;
  let fixture: ComponentFixture<VerseProseSelectComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ VerseProseSelectComponent ],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VerseProseSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
