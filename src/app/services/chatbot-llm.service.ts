import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { CHATBOT_TOOLS, ToolName } from './llm-tools';
import { SupabaseService } from './supabase';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: ToolName;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  toolName: ToolName;
  result: any;
  error?: string;
}

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'groq';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

interface ChaoMessage {
  role: string;
  content: string | object[];
}

@Injectable({ providedIn: 'root' })
export class ChatbotLLMService {
  private http = inject(HttpClient);
  private supabase = inject(SupabaseService);

  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private loadingSubject = new BehaviorSubject(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  messages$ = this.messagesSubject.asObservable();
  loading$ = this.loadingSubject.asObservable();
  error$ = this.errorSubject.asObservable();

  private chatbotConfig: LLMConfig | null = null;

  constructor() {
    this.initializeConfig();
  }

  private initializeConfig() {
    // Load from environment or localStorage
    const savedConfig = localStorage.getItem('llm-config');
    if (savedConfig) {
      this.chatbotConfig = JSON.parse(savedConfig);
    }
  }

  setLLMConfig(config: LLMConfig) {
    this.chatbotConfig = config;
    localStorage.setItem('llm-config', JSON.stringify(config));
  }

  getLLMConfig(): LLMConfig | null {
    return this.chatbotConfig;
  }

  /**
   * Send a message and get a response with tool calling support
   */
  async sendMessage(userMessage: string): Promise<void> {
    if (!this.chatbotConfig) {
      this.errorSubject.next('LLM not configured. Please set up your LLM API key.');
      return;
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    this.addMessage(userMsg);

    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    try {
      // Get LLM response with tool calling
      const response = await this.getLLMResponse(userMessage);

      if (response.toolCalls && response.toolCalls.length > 0) {
        // Add assistant message with tool calls
        const assistantMsg: ChatMessage = {
          id: this.generateId(),
          role: 'assistant',
          content: response.assistantMessage,
          timestamp: new Date(),
          toolCalls: response.toolCalls,
        };
        this.addMessage(assistantMsg);

        // Execute tools
        const toolResults = await this.executeTools(response.toolCalls);

        // Add tool results
        const toolMsg: ChatMessage = {
          id: this.generateId(),
          role: 'tool',
          content: 'Tool results',
          timestamp: new Date(),
          toolResults,
        };
        this.addMessage(toolMsg);

        // Get final response from LLM with tool results
        const finalResponse = await this.getLLMResponseWithToolResults(
          userMessage,
          assistantMsg,
          toolResults
        );

        const finalMsg: ChatMessage = {
          id: this.generateId(),
          role: 'assistant',
          content: finalResponse,
          timestamp: new Date(),
        };
        this.addMessage(finalMsg);
      } else {
        // Direct response without tools
        const assistantMsg: ChatMessage = {
          id: this.generateId(),
          role: 'assistant',
          content: response.assistantMessage,
          timestamp: new Date(),
        };
        this.addMessage(assistantMsg);
      }
    } catch (error: any) {
      const errorMessage =
        error.message || 'Failed to get response from LLM. Please try again.';
      this.errorSubject.next(errorMessage);
      console.error('Chatbot error:', error);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  private async getLLMResponse(userMessage: string): Promise<{
    assistantMessage: string;
    toolCalls?: ToolCall[];
  }> {
    if (!this.chatbotConfig) {
      throw new Error('LLM config not set');
    }

    const messages: ChaoMessage[] = this.messagesSubject
      .value.filter((m) => m.role !== 'tool')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    messages.push({ role: 'user', content: userMessage });

    switch (this.chatbotConfig.provider) {
      case 'openai':
        return this.handleOpenAIResponse(messages);
      case 'anthropic':
        return this.handleAnthropicResponse(messages);
      case 'google':
        return this.handleGoogleResponse(messages);
      case 'ollama':
        return this.handleOllamaResponse(messages);
      case 'groq':
        return this.handleGroqResponse(messages);
      default:
        throw new Error(`Unknown provider: ${this.chatbotConfig.provider}`);
    }
  }

  private async getLLMResponseWithToolResults(
    userMessage: string,
    assistantMsg: ChatMessage,
    toolResults: ToolResult[]
  ): Promise<string> {
    if (!this.chatbotConfig) {
      throw new Error('LLM config not set');
    }

    // Build conversation with tool results
    const messages: ChaoMessage[] = [];
    messages.push({ role: 'user', content: userMessage });
    messages.push({ role: 'assistant', content: assistantMsg.content });

    // Add tool results
    const toolResultContent = toolResults
      .map(
        (tr) =>
          `Tool: ${tr.toolName}\nResult: ${JSON.stringify(tr.result || tr.error)}`
      )
      .join('\n\n');

    messages.push({ role: 'user', content: `Tool Results:\n${toolResultContent}` });

    switch (this.chatbotConfig.provider) {
      case 'openai':
        return this.getLLMResponseText(messages, 'openai');
      case 'anthropic':
        return this.getLLMResponseText(messages, 'anthropic');
      case 'google':
        return this.getLLMResponseText(messages, 'google');
      case 'ollama':
        return this.getLLMResponseText(messages, 'ollama');
      case 'groq':
        return this.getLLMResponseText(messages, 'groq');
      default:
        throw new Error(`Unknown provider: ${this.chatbotConfig.provider}`);
    }
  }

  private async getLLMResponseText(
    messages: ChaoMessage[],
    provider: LLMProvider
  ): Promise<string> {
    if (!this.chatbotConfig) {
      throw new Error('LLM config not set');
    }

    let result: { assistantMessage: string; toolCalls?: ToolCall[] };

    switch (provider) {
      case 'openai':
        result = await this.callOpenAI(messages, false);
        break;
      case 'anthropic':
        result = await this.callAnthropic(messages, false);
        break;
      case 'google':
        result = await this.callGoogle(messages, false);
        break;
      case 'ollama':
        result = await this.callOllama(messages, false);
        break;
      case 'groq':
        result = await this.callGroq(messages, false);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
    return result.assistantMessage;
  }

  private async handleOpenAIResponse(messages: ChaoMessage[]): Promise<{
    assistantMessage: string;
    toolCalls?: ToolCall[];
  }> {
    return this.callOpenAI(messages, true);
  }

  private async handleAnthropicResponse(messages: ChaoMessage[]): Promise<{
    assistantMessage: string;
    toolCalls?: ToolCall[];
  }> {
    return this.callAnthropic(messages, true);
  }

  private async handleGoogleResponse(messages: ChaoMessage[]): Promise<{
    assistantMessage: string;
    toolCalls?: ToolCall[];
  }> {
    return this.callGoogle(messages, true);
  }

  private async handleOllamaResponse(messages: ChaoMessage[]): Promise<{
    assistantMessage: string;
    toolCalls?: ToolCall[];
  }> {
    return this.callOllama(messages, true);
  }

  private async handleGroqResponse(messages: ChaoMessage[]): Promise<{
    assistantMessage: string;
    toolCalls?: ToolCall[];
  }> {
    return this.callGroq(messages, true);
  }

  private async callOpenAI(
    messages: ChaoMessage[],
    withTools: boolean
  ): Promise<{
    assistantMessage: string;
    toolCalls?: ToolCall[];
  }> {
    if (!this.chatbotConfig) {
      throw new Error('LLM config not set');
    }

    const payload: any = {
      model: this.chatbotConfig.model || 'gpt-4-turbo',
      messages,
      temperature: this.chatbotConfig.temperature || 0.7,
      max_tokens: this.chatbotConfig.maxTokens || 2048,
    };

    if (withTools) {
      payload.tools = CHATBOT_TOOLS.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      payload.tool_choice = 'auto';
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.chatbotConfig.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    if (withTools && message.tool_calls) {
      return {
        assistantMessage: message.content || '',
        toolCalls: message.tool_calls.map(
          (tc: any) =>
            ({
              id: tc.id,
              name: tc.function.name,
              arguments: JSON.parse(tc.function.arguments),
            } as ToolCall)
        ),
      };
    }

    return {
      assistantMessage: message.content || '',
    };
  }

  private async callAnthropic(
    messages: ChaoMessage[],
    withTools: boolean
  ): Promise<{
    assistantMessage: string;
    toolCalls?: ToolCall[];
  }> {
    if (!this.chatbotConfig) {
      throw new Error('LLM config not set');
    }

    const payload: any = {
      model: this.chatbotConfig.model || 'claude-3-sonnet-20240229',
      messages,
      max_tokens: this.chatbotConfig.maxTokens || 2048,
    };

    if (withTools) {
      payload.tools = CHATBOT_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: 'object',
          properties: tool.parameters.properties,
          required: tool.parameters.required,
        },
      }));
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.chatbotConfig.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    const toolCalls: ToolCall[] = [];
    let assistantMessage = '';

    for (const block of data.content || []) {
      if (block.type === 'text') {
        assistantMessage += block.text;
      } else if (block.type === 'tool_use' && withTools) {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input,
        });
      }
    }

    return {
      assistantMessage,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  private async callGoogle(
    messages: ChaoMessage[],
    withTools: boolean
  ): Promise<{
    assistantMessage: string;
    toolCalls?: ToolCall[];
  }> {
    if (!this.chatbotConfig) {
      throw new Error('LLM config not set');
    }

    // Google Gemini API
    const baseUrl = this.chatbotConfig.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const payload: any = {
      contents: messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
      })),
      generationConfig: {
        temperature: this.chatbotConfig.temperature || 0.7,
        maxOutputTokens: this.chatbotConfig.maxTokens || 2048,
      },
    };

    if (withTools) {
      payload.tools = [
        {
          functionDeclarations: CHATBOT_TOOLS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
        },
      ];
    }

    const url = `${baseUrl}/models/${
      this.chatbotConfig.model || 'gemini-1.5-pro'
    }:generateContent?key=${this.chatbotConfig.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`);
    }

    const data = await response.json();
    const candidate = data.candidates[0];
    const toolCalls: ToolCall[] = [];
    let assistantMessage = '';

    for (const part of candidate.content.parts || []) {
      if (part.text) {
        assistantMessage += part.text;
      } else if (part.functionCall && withTools) {
        toolCalls.push({
          id: this.generateId(),
          name: part.functionCall.name,
          arguments: part.functionCall.args || {},
        });
      }
    }

    return {
      assistantMessage,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  private async callOllama(
    messages: ChaoMessage[],
    _withTools: boolean
  ): Promise<{
    assistantMessage: string;
    toolCalls?: ToolCall[];
  }> {
    if (!this.chatbotConfig) {
      throw new Error('LLM config not set');
    }

    const baseUrl = this.chatbotConfig.baseUrl || 'http://localhost:11434';
    const payload = {
      model: this.chatbotConfig.model || 'mistral',
      messages: messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
      stream: false,
    };

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      assistantMessage: data.message?.content || '',
    };
  }

  private async callGroq(
    messages: ChaoMessage[],
    withTools: boolean
  ): Promise<{
    assistantMessage: string;
    toolCalls?: ToolCall[];
  }> {
    if (!this.chatbotConfig) {
      throw new Error('LLM config not set');
    }

    const payload: any = {
      model: this.chatbotConfig.model || 'mixtral-8x7b-32768',
      messages,
      temperature: this.chatbotConfig.temperature || 0.7,
      max_tokens: this.chatbotConfig.maxTokens || 2048,
    };

    if (withTools) {
      payload.tools = CHATBOT_TOOLS.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      payload.tool_choice = 'auto';
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.chatbotConfig.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Groq API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      throw new Error(`Groq API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    if (withTools && message.tool_calls) {
      return {
        assistantMessage: message.content || '',
        toolCalls: message.tool_calls.map(
          (tc: any) =>
            ({
              id: tc.id,
              name: tc.function.name,
              arguments: JSON.parse(tc.function.arguments),
            } as ToolCall)
        ),
      };
    }

    return {
      assistantMessage: message.content || '',
    };
  }

  private async executeTools(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeTool(toolCall.name, toolCall.arguments);
        results.push({
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          result,
        });
      } catch (error: any) {
        results.push({
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          result: null,
          error: error.message || 'Tool execution failed',
        });
      }
    }

    return results;
  }

  private async executeTool(toolName: ToolName, args: Record<string, any>): Promise<any> {
    switch (toolName) {
      case 'search_customers':
        return this.toolSearchCustomers(args as { query: string; limit?: number });
      case 'search_vehicles':
        return this.toolSearchVehicles(args as {
          brand?: string;
          model?: string;
          location?: string;
          min_price?: number;
          max_price?: number;
          vehicle_type?: string;
          limit?: number;
        });
      case 'get_vehicle_details':
        return this.toolGetVehicleDetails(args as { vehicle_id: string });
      case 'get_customer_details':
        return this.toolGetCustomerDetails(args as { customer_id?: string; email?: string });
      case 'check_availability':
        return this.toolCheckAvailability(args as { vehicle_id: string; start_date: string; end_date: string });
      case 'create_booking':
        return this.toolCreateBooking(args as {
          customer_id: string;
          vehicle_id: string;
          start_date: string;
          end_date: string;
          pickup_location: string;
          dropoff_location?: string;
          special_requests?: string;
        });
      case 'get_booking_status':
        return this.toolGetBookingStatus(args as { booking_id: string });
      case 'calculate_booking_price':
        return this.toolCalculateBookingPrice(args as {
          vehicle_id: string;
          start_date: string;
          end_date: string;
          promo_code?: string;
        });
      case 'get_customer_bookings':
        return this.toolGetCustomerBookings(args as { customer_id: string; status?: string });
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // Tool implementations - these call your existing Supabase services
  private async toolSearchCustomers(args: {
    query: string;
    limit?: number;
  }): Promise<any> {
    // TODO: Implement using your customer search service
    // This is a placeholder - replace with your actual Supabase queries
    const { data, error } = await this.supabase.supabase
      .from('customers')
      .select('*')
      .or(`full_name.ilike.%${args.query}%,email.ilike.%${args.query}%,mobile.ilike.%${args.query}%`)
      .limit(args.limit || 10);

    if (error) throw error;
    return data || [];
  }

  private async toolSearchVehicles(args: {
    brand?: string;
    model?: string;
    location?: string;
    min_price?: number;
    max_price?: number;
    vehicle_type?: string;
    limit?: number;
  }): Promise<any> {
    // TODO: Implement using your vehicle search service
    let query = this.supabase.supabase.from('vehicles').select('*').eq('status', 'available');

    if (args.brand) query = query.ilike('brand', `%${args.brand}%`);
    if (args.model) query = query.ilike('model', `%${args.model}%`);
    if (args.location) query = query.ilike('location', `%${args.location}%`);
    if (args.vehicle_type) query = query.eq('type', args.vehicle_type);
    if (args.min_price) query = query.gte('daily_rate', args.min_price);
    if (args.max_price) query = query.lte('daily_rate', args.max_price);

    const { data, error } = await query.limit(args.limit || 10);

    if (error) throw error;
    return data || [];
  }

  private async toolGetVehicleDetails(args: { vehicle_id: string }): Promise<any> {
    const { data, error } = await this.supabase.supabase
      .from('vehicles')
      .select('*')
      .eq('id', args.vehicle_id)
      .single();

    if (error) throw error;
    return data;
  }

  private async toolGetCustomerDetails(args: {
    customer_id?: string;
    email?: string;
  }): Promise<any> {
    let query = this.supabase.supabase.from('customers').select('*');

    if (args.customer_id) query = query.eq('id', args.customer_id);
    else if (args.email) query = query.eq('email', args.email);
    else throw new Error('Either customer_id or email is required');

    const { data, error } = await query.single();

    if (error) throw error;
    return data;
  }

  private async toolCheckAvailability(args: {
    vehicle_id: string;
    start_date: string;
    end_date: string;
  }): Promise<any> {
    const { data, error } = await this.supabase.supabase
      .from('bookings')
      .select('*')
      .eq('vehicle_id', args.vehicle_id)
      .eq('status', 'confirmed')
      .or(`end_date.gte.${args.start_date},start_date.lte.${args.end_date}`);

    if (error) throw error;
    return {
      available: (data || []).length === 0,
      conflictingBookings: data || [],
    };
  }

  private async toolCreateBooking(args: {
    customer_id: string;
    vehicle_id: string;
    start_date: string;
    end_date: string;
    pickup_location: string;
    dropoff_location?: string;
    special_requests?: string;
  }): Promise<any> {
    const { data, error } = await this.supabase.supabase
      .from('bookings')
      .insert([
        {
          customer_id: args.customer_id,
          vehicle_id: args.vehicle_id,
          start_date: args.start_date,
          end_date: args.end_date,
          pickup_location: args.pickup_location,
          dropoff_location: args.dropoff_location || args.pickup_location,
          special_requests: args.special_requests,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  private async toolGetBookingStatus(args: { booking_id: string }): Promise<any> {
    const { data, error } = await this.supabase.supabase
      .from('bookings')
      .select('*')
      .eq('id', args.booking_id)
      .single();

    if (error) throw error;
    return data;
  }

  private async toolCalculateBookingPrice(args: {
    vehicle_id: string;
    start_date: string;
    end_date: string;
    promo_code?: string;
  }): Promise<any> {
    // Get vehicle rate
    const { data: vehicle } = await this.supabase.supabase
      .from('vehicles')
      .select('daily_rate')
      .eq('id', args.vehicle_id)
      .single();

    if (!vehicle) throw new Error('Vehicle not found');

    // Calculate days
    const start = new Date(args.start_date);
    const end = new Date(args.end_date);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const basePrice = (vehicle as any).daily_rate * days;
    let discount = 0;

    // Check promo code
    if (args.promo_code) {
      const { data: promo } = await this.supabase.supabase
        .from('promo_codes')
        .select('discount_percentage')
        .eq('code', args.promo_code)
        .single();

      if (promo) {
        discount = (basePrice * (promo as any).discount_percentage) / 100;
      }
    }

    const tax = (basePrice - discount) * 0.18; // Assuming 18% tax
    const total = basePrice - discount + tax;

    return {
      basePrice,
      discount,
      tax,
      total,
      days,
    };
  }

  private async toolGetCustomerBookings(args: {
    customer_id: string;
    status?: string;
  }): Promise<any> {
    let query = this.supabase.supabase.from('bookings').select('*').eq('customer_id', args.customer_id);

    if (args.status) query = query.eq('status', args.status);

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  private addMessage(message: ChatMessage) {
    const current = this.messagesSubject.value;
    this.messagesSubject.next([...current, message]);
  }

  clearMessages() {
    this.messagesSubject.next([]);
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
