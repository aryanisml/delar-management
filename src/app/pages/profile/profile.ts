import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, CardModule, InputTextModule, ButtonModule, TagModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class ProfileComponent {
  private supabase = inject(SupabaseService);

  userInfo = signal({ email: '', id: '' });
  role = signal('');

  userName = computed(() => this.userInfo().email.split('@')[0] || 'User');
  userLetter = computed(() => this.userName()[0]?.toUpperCase() || 'U');

  async ngOnInit() {
  const user: any = await this.supabase.getCurrentUser(); // Adding ': any' is a quick fix for the demo
  if (user) {
    this.userInfo.set({ 
      email: user.email || '', 
      id: user.id || '' 
    });
    this.role.set(user.user_metadata?.['role'] || 'dealer');
  }
  }
}