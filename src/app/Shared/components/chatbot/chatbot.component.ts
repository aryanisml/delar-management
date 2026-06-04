import { Component, OnInit, OnDestroy, inject, ViewChild, AfterViewChecked, ElementRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { DividerModule } from 'primeng/divider';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import {
  ChatbotLLMService,
  ChatMessage,
  LLMConfig,
  LLMProvider,
} from '../../../services/chatbot-llm.service';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    DividerModule,
    ScrollPanelModule,
    SkeletonModule,
    ToastModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss'],
  providers: [MessageService],
})
export class ChatbotComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('messageContainer') messageContainer!: ElementRef;

  private chatbotService = inject(ChatbotLLMService) as ChatbotLLMService;
  private messageService = inject(MessageService) as MessageService;
  private destroy$ = new Subject<void>();

  messages: ChatMessage[] = [];
  loading = false;
  userMessage = '';
  showConfigDialog = false;

  // LLM Config form
  selectedProvider: LLMProvider = 'groq';
  apiKey = '';
  model = 'mixtral-8x7b-32768';
  temperature = 0.7;
  maxTokens = 2048;

  providers: Array<{ label: string; value: LLMProvider }> = [
    { label: 'OpenAI (GPT-4, GPT-3.5)', value: 'openai' },
    { label: 'Anthropic (Claude)', value: 'anthropic' },
    { label: 'Google (Gemini)', value: 'google' },
    { label: 'Groq (Mixtral)', value: 'groq' },
    { label: 'Ollama (Local)', value: 'ollama' },
  ];

  modelOptions: { [key in LLMProvider]: string[] } = {
    openai: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
    groq: ['mixtral-8x7b-32768', 'llama-2-70b-4096'],
    ollama: ['mistral', 'llama2', 'neural-chat', 'starling-lm'],
  };

  baseUrlPlaceholder: {[key in LLMProvider]: string} = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta',
    groq: 'https://api.groq.com/openai/v1',
    ollama: 'http://localhost:11434',
  };

  baseUrl = '';
  isConfigured = false;
  testingConnection = false;

  ngOnInit() {
    // Subscribe to messages
    this.chatbotService.messages$.pipe(takeUntil(this.destroy$)).subscribe((msgs: ChatMessage[]) => {
      this.messages = msgs;
      setTimeout(() => this.scrollToBottom(), 100);
    });

    // Subscribe to loading state
    this.chatbotService.loading$.pipe(takeUntil(this.destroy$)).subscribe((loading: boolean) => {
      this.loading = loading;
    });

    // Subscribe to errors
    this.chatbotService.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe((error: string | null) => {
        if (error) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error,
            life: 5000,
          });
        }
      });

    // Check if already configured
    const config = this.chatbotService.getLLMConfig();
    if (config) {
      this.isConfigured = true;
      this.selectedProvider = config.provider;
      this.model = config.model;
      this.temperature = config.temperature || 0.7;
      this.maxTokens = config.maxTokens || 2048;
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  saveLLMConfig() {
    if (!this.apiKey && this.selectedProvider !== 'ollama') {
      this.messageService.add({
        severity: 'warn',
        summary: 'Warning',
        detail: 'API Key is required',
      });
      return;
    }

    if (!this.model) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please select a model',
      });
      return;
    }

    const config: LLMConfig = {
      provider: this.selectedProvider,
      apiKey: this.apiKey,
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      baseUrl: this.baseUrl || undefined,
    };

    this.chatbotService.setLLMConfig(config);
    this.isConfigured = true;
    this.showConfigDialog = false;

    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: 'LLM configured successfully!',
    });

    // Add welcome message
    this.chatbotService.clearMessages();
  }

  openConfigDialog() {
    this.showConfigDialog = true;
  }

  async testConnection() {
    if (!this.apiKey && this.selectedProvider !== 'ollama') {
      this.messageService.add({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please enter your API key',
      });
      return;
    }

    if (!this.model) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please select a model',
      });
      return;
    }

    this.testingConnection = true;

    try {
      const config: LLMConfig = {
        provider: this.selectedProvider,
        apiKey: this.apiKey,
        model: this.model,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        baseUrl: this.baseUrl || undefined,
      };

      // Create temp service with this config to test
      const testMessages = [
        { role: 'user', content: 'Hello, are you working?' },
      ];

      const response = await this.testLLMConnection(testMessages, config);

      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: `✅ Connected to ${this.selectedProvider}! Response: "${response.substring(0, 50)}..."`,
        life: 5000,
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Connection Failed',
        detail: error.message || 'Could not connect to the LLM. Please check your API key.',
        life: 5000,
      });
      console.error('Connection test error:', error);
    } finally {
      this.testingConnection = false;
    }
  }

  private async testLLMConnection(messages: any[], config: LLMConfig): Promise<string> {
    if (config.provider === 'groq') {
      const payload = {
        model: config.model || 'mixtral-8x7b-32768',
        messages,
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 256,
      };

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `${response.statusText}: ${errorData.error?.message || JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } else if (config.provider === 'openai') {
      const payload = {
        model: config.model || 'gpt-4-turbo',
        messages,
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 256,
      };

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `${response.statusText}: ${errorData.error?.message || JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();
      return data.choices[0].message.content;
    }

    throw new Error('Connection test not implemented for this provider');
  }

  async sendMessage() {
    if (!this.userMessage.trim()) {
      return;
    }

    if (!this.isConfigured) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please configure LLM first',
      });
      return;
    }

    const message = this.userMessage;
    this.userMessage = '';

    await this.chatbotService.sendMessage(message);
  }

  onProviderChange() {
    this.baseUrl = '';
    this.model = '';
  }

  getAvailableModels(): string[] {
    return this.modelOptions[this.selectedProvider] || [];
  }

  getMessageClass(message: ChatMessage): string {
    if (message.role === 'user') {
      return 'user-message';
    } else if (message.role === 'tool') {
      return 'tool-message';
    } else {
      return 'assistant-message';
    }
  }

  formatToolCall(toolName: string, args: any): string {
    return `${toolName}: ${JSON.stringify(args, null, 2)}`;
  }

  formatToolResult(result: any): string {
    if (typeof result === 'string') {
      return result;
    }
    return JSON.stringify(result, null, 2);
  }

  private scrollToBottom(): void {
    try {
      if (this.messageContainer) {
        this.messageContainer.nativeElement.scrollTop =
          this.messageContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.log('Scroll to bottom error', err);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
