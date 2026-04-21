import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private document = inject(DOCUMENT);
  private readonly storageKey = 'dealer-management-theme';
  private readonly dark = signal(false);

  readonly isDark = computed(() => this.dark());

  constructor() {
    const stored = this.safeStorageGet();
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches;

    this.dark.set(stored ? stored === 'dark' : prefersDark);

    effect(() => {
      const enabled = this.dark();
      this.document.body.classList.toggle('dark-theme', enabled);
      this.safeStorageSet(enabled ? 'dark' : 'light');
    });
  }

  toggle() {
    this.dark.update((value) => !value);
  }

  private safeStorageGet() {
    try {
      return window.localStorage.getItem(this.storageKey);
    } catch {
      return null;
    }
  }

  private safeStorageSet(value: string) {
    try {
      window.localStorage.setItem(this.storageKey, value);
    } catch {
      // Theme still works for the current session when storage is blocked.
    }
  }
}
