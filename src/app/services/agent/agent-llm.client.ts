import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * OpenAI-compatible chat types. The browser never holds the LLM key — it posts to
 * the server-side proxy (api/agent-llm.js), which forwards to Groq and returns the
 * assistant message verbatim (including any tool_calls).
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

@Injectable({ providedIn: 'root' })
export class AgentLlmClient {
  private readonly endpoint = environment.agentApiUrl;

  /** Sends the conversation to the proxy and resolves the assistant reply. */
  async chat(request: ChatRequest): Promise<LlmMessage> {
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: request.messages,
          tools: request.tools,
          tool_choice: request.tool_choice,
        }),
      });
    } catch (err: any) {
      throw new Error(`Could not reach the assistant service (${err?.message || 'network error'}).`);
    }

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = body?.detail ? JSON.stringify(body.detail) : body?.error || '';
      } catch {
        detail = await response.text().catch(() => '');
      }
      if (response.status === 404) {
        throw new Error(
          'Assistant endpoint not found. /api/agent-llm only runs on Vercel (or `vercel dev`), not under plain `ng serve`.'
        );
      }
      throw new Error(`Assistant service error (${response.status}). ${detail}`.trim());
    }

    const data = await response.json();
    if (!data?.message) {
      throw new Error('Assistant returned an empty response.');
    }
    return data.message as LlmMessage;
  }
}
