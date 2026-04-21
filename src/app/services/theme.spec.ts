import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove('dark-theme');
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    document.body.classList.remove('dark-theme');
    localStorage.clear();
  });

  it('toggles and persists dark theme', () => {
    service.toggle();
    TestBed.flushEffects();

    expect(service.isDark()).toBe(true);
    expect(document.body.classList.contains('dark-theme')).toBe(true);
    expect(localStorage.getItem('dealer-management-theme')).toBe('dark');
  });
});
