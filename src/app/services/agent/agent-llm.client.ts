import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * OpenAI-compatible chat types. The browser POSTs to /api/agent-llm; in dev the dev-server
 * proxy forwards it to Gemini, in prod the Vercel function does — either way the key is
 * injected server-side and the reply is read from choices[0].message.
 */

export interface LlmToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: LlmToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface LlmToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatRequest {
  messages: LlmMessage[];
  tools?: LlmToolSchema[];
  tool_choice?: 'auto' | 'none' | 'required';
}

/** Low temperature keeps tool selection and field extraction deterministic. */
const AGENT_TEMPERATURE = 0.1;
/** Statuses worth retrying — transient upstream hiccups (overload / rate / gateway). */
const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

@Injectable({ providedIn: 'root' })
export class AgentLlmClient {
  private readonly endpoint = environment.agentApiUrl;
  private readonly model = environment.agentModel;

  /** Posts a chat-completion request, retries transient failures, and resolves the reply. */
  async chat(request: ChatRequest): Promise<LlmMessage> {
    const body: Record<string, unknown> = {
      model: this.model,
      temperature: AGENT_TEMPERATURE,
      messages: request.messages,
    };
    if (request.tools && request.tools.length) {
      body['tools'] = request.tools;
      body['tool_choice'] = request.tool_choice ?? 'auto';
    }
    const payload = JSON.stringify(body);

    let lastMessage = 'The assistant is unavailable right now. Please try again.';

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let response: Response;
      try {
        response = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
      } catch {
        lastMessage = "Couldn't reach the assistant. Check your connection and try again.";
        if (attempt < MAX_RETRIES) {
          await this.delay(attempt);
          continue;
        }
        throw new Error(lastMessage);
      }

      if (response.ok) {
        const data = await response.json().catch(() => null);
        const message: LlmMessage | undefined = data?.choices?.[0]?.message;
        if (message) {
          return message;
        }
        lastMessage = 'The assistant returned an empty response. Please try again.';
        if (attempt < MAX_RETRIES) {
          await this.delay(attempt);
          continue;
        }
        throw new Error(lastMessage);
      }

      const errorBody = await response.json().catch(() => null);
      const detail = this.extractDetail(errorBody);
      lastMessage = this.friendlyError(response.status, detail);

      // Retry transient upstream errors. A dev-proxy / network blip reaching Gemini
      // (e.g. DNS ENOTFOUND) surfaces as a 500 — retry that too, but NOT the 500 that
      // means the server key isn't configured (that won't recover on retry).
      const keyNotConfigured =
        response.status === 500 && /gemini_api_key|not set|not configured/i.test(detail);
      const retriable =
        TRANSIENT_STATUSES.has(response.status) || (response.status === 500 && !keyNotConfigured);
      if (retriable && attempt < MAX_RETRIES) {
        await this.delay(attempt);
        continue;
      }
      throw new Error(lastMessage);
    }

    throw new Error(lastMessage);
  }

  /** Maps an HTTP status + upstream detail to a clear, non-technical message for advisors. */
  private friendlyError(status: number, detail: string): string {
    const text = detail.toLowerCase();
    if (status === 500 && (text.includes('gemini_api_key') || text.includes('not set') || text.includes('not configured'))) {
      return 'The Booking Assistant isn’t set up on the server yet — an administrator needs to add the API key. It will work here automatically once that’s done.';
    }
    if (status === 401 || status === 403) {
      return 'The assistant’s API key is missing, invalid, or was revoked. An administrator needs to set a valid key on the server.';
    }
    if (status === 429) {
      return 'The assistant is busy right now (rate limit). Please wait a few seconds and try again.';
    }
    if (status === 503 || status === 502 || status === 504) {
      return 'The assistant is temporarily overloaded. Please try again in a moment.';
    }
    return `The assistant ran into a problem${detail ? ` (${detail})` : ` (error ${status})`}. Please try again.`;
  }

  private extractDetail(errorBody: any): string {
    const raw = errorBody?.error?.message ?? errorBody?.error ?? errorBody?.message ?? '';
    return typeof raw === 'string' ? raw : JSON.stringify(raw);
  }

  private delay(attempt: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, RETRY_BASE_MS * (attempt + 1)));
  }
}
