import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChatbotComponent } from '../../Shared/components/chatbot/chatbot.component';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-chatbot-page',
  standalone: true,
  imports: [CommonModule, ChatbotComponent, ButtonModule],
  template: `
    <div class="chatbot-page-wrapper">
      <!-- Topbar -->
      <div class="chatbot-topbar">
        <div class="topbar-content">
          <h2>AI Assistant</h2>
          <div class="topbar-actions">
            <button pButton type="button" icon="pi pi-arrow-left" (click)="goBack()" class="p-button-text p-button-plain"></button>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="chatbot-page-container">
        <app-chatbot></app-chatbot>
      </div>
    </div>
  `,
  styles: [`
    .chatbot-page-wrapper {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #f9fafb;
    }

    .chatbot-topbar {
      background: white;
      border-bottom: 1px solid #e5e7eb;
      padding: 16px 24px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .topbar-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }

    .topbar-content h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #111827;
    }

    .topbar-actions {
      display: flex;
      gap: 8px;
    }

    .chatbot-page-container {
      flex: 1;
      overflow: hidden;
      padding: 16px;

      @media (max-width: 768px) {
        padding: 8px;
      }
    }
  `],
})
export class ChatbotPageComponent {
  private router = inject(Router);

  goBack() {
    // Navigate back to dealer dashboard or admin dashboard based on role
    const isDealerPath = localStorage.getItem('userRole') === 'dealer';
    this.router.navigate([isDealerPath ? '/dealer/dashboard' : '/admin/dashboard']);
  }
}

