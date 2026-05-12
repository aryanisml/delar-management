import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, InputTextModule, ButtonModule, TagModule, ToastModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  providers: [MessageService],
})
export class ProfileComponent {
  private supabase = inject(SupabaseService);
  private messageService = inject(MessageService);

  readonly userInfo = signal({ email: '', id: '', created_at: '' });
  readonly role = signal('dealer');
  readonly profileForm = signal({ full_name: '', phone: '', city: '' });
  readonly saving = signal(false);

  readonly userName = computed(() => this.profileForm().full_name || this.userInfo().email.split('@')[0] || 'User');
  readonly userLetter = computed(() => this.userName()[0]?.toUpperCase() || 'U');

  async ngOnInit() {
    const user: any = await this.supabase.getCurrentUser();
    if (!user) {
      return;
    }

    const { data: dealer } = await this.supabase.getDealerProfile(user.id);
    const role = await this.supabase.getUserRole(user.id);

    this.userInfo.set({
      email: user.email || '',
      id: user.id || '',
      created_at: user.created_at || '',
    });
    this.role.set(role || 'dealer');
    this.profileForm.set({
      full_name: user.user_metadata?.['full_name'] || dealer?.contact_name || '',
      phone: user.user_metadata?.['phone'] || dealer?.phone || '',
      city: user.user_metadata?.['city'] || dealer?.city || '',
    });
  }

  async updateProfile() {
    const user = await this.supabase.getCurrentUser();
    if (!user) {
      return;
    }

    this.saving.set(true);
    const form = this.profileForm();

    const [{ error: metadataError }, { error: dealerError }] = await Promise.all([
      this.supabase.updateUserMetadata(form),
      this.supabase.upsertDealerProfile({
        user_id: user.id,
        company_name: 'AutoFlow Dealer',
        contact_name: form.full_name,
        phone: form.phone,
        city: form.city,
      }),
    ]);

    this.saving.set(false);

    if (metadataError || dealerError) {
      this.messageService.add({
        severity: 'error',
        summary: 'Update failed',
        detail: metadataError?.message || dealerError?.message || 'Could not update profile.',
      });
      return;
    }

    this.messageService.add({ severity: 'success', summary: 'Profile updated', detail: 'Your profile changes have been saved.' });
  }

  async changePassword() {
    const email = this.userInfo().email;
    if (!email) {
      return;
    }

    const { error } = await this.supabase.resetPasswordForEmail(email);
    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Reset failed', detail: error.message || 'Could not send password reset email.' });
      return;
    }

    this.messageService.add({ severity: 'success', summary: 'Password reset sent', detail: 'Check your inbox for the reset link.' });
  }
}
