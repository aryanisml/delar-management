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

@Injectable({ providedIn: 'root' })
export class AgentLlmClient {
  private readonly endpoint = environment.agentApiUrl;
  private readonly model = environment.agentModel;

  /** Posts a chat-completion request and resolves the assistant reply. */
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

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      throw new Error(`Could not reach the assistant service (${err?.message || 'network error'}).`);
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const apiError = errorBody?.error ?? null;
      if (response.status === 401 || response.status === 403) {
        throw new Error('Assistant auth failed. Check the GEMINI_API_KEY configured for the proxy/function.');
      }
      const raw = apiError?.message ?? apiError ?? errorBody?.message ?? '';
      const detail = typeof raw === 'string' ? raw : JSON.stringify(raw);
      throw new Error(`Assistant service error (${response.status}). ${detail}`.trim());
    }

    const data = await response.json();
    const message: LlmMessage | undefined = data?.choices?.[0]?.message;
    if (!message) {
      throw new Error('Assistant returned an empty response.');
    }
    return message;
  }
}
