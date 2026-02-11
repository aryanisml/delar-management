import { Component, Inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from './services/supabase';
import { Auth } from './services/auth';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {

 auth = inject(Auth);
  router = inject(Router);

  async ngOnInit() {
    const role = await this.auth.getUserRole();

    if (role === 'admin') {
      this.router.navigate(['/admin']);
    }
    else  {
      this.router.navigate(['/dealer']);
    }
  }

}

