import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { providePrimeNG } from 'primeng/config';
import { provideRouter } from '@angular/router';

import { App } from './app/app';
import { routes } from './app/app.routes';

bootstrapApplication(App, {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    providePrimeNG({
      ripple: true
    })
  ]
}).catch(err => console.error(err));
