import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * OpenAI-compatible chat types. In local dev the browser posts a Groq-native
 * chat-completion body to the same-origin /groq-proxy path; the Angular dev-server
 * proxy injects the Authorization header (from GROQ_API_KEY) and forwards to Groq, so
 * the key never reaches the browser. The reply is read from choices[0].message.
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
/** Extra attempts when Groq can't parse Llama's tool call AND we can't recover it. */
const MAX_TOOL_FORMAT_RETRIES = 1;

@Injectable({ providedIn: 'root' })
export class AgentLlmClient {
  private readonly endpoint = environment.agentApiUrl;
  private readonly model = environment.agentModel;
  private recoveredCallSeq = 0;

  /** Posts a Groq-native chat-completion request and resolves the assistant reply. */
  async chat(request: ChatRequest): Promise<LlmMessage> {
    return this.send(request, 0);
  }

  private async send(request: ChatRequest, attempt: number): Promise<LlmMessage> {
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
      throw new Error(
        `Could not reach the assistant service (${err?.message || 'network error'}). Is \`npm start\` running?`
      );
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const apiError = errorBody?.error ?? null;

      // Known Groq/Llama bug: the model intermittently emits a tool call as raw text
      // ("<function=NAME {json}></function>") instead of structured JSON, so Groq returns
      // 400 tool_use_failed. Recover the call from `failed_generation` and carry on.
      const recovered = this.recoverToolCalls(apiError?.failed_generation);
      if (recovered.length) {
        return { role: 'assistant', content: null, tool_calls: recovered };
      }

      // If we couldn't recover, the malformed generation is nondeterministic — retry once.
      if (apiError?.code === 'tool_use_failed' && attempt < MAX_TOOL_FORMAT_RETRIES) {
        return this.send(request, attempt + 1);
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          'Assistant auth failed. Set a valid GEMINI_API_KEY in .env / .env.local and restart `npm start`.'
        );
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

    // Defensive: occasionally the raw function text comes back 200 inside `content`.
    if (
      (!message.tool_calls || !message.tool_calls.length) &&
      typeof message.content === 'string' &&
      message.content.includes('<function=')
    ) {
      const recovered = this.recoverToolCalls(message.content);
      if (recovered.length) {
        return { role: 'assistant', content: null, tool_calls: recovered };
      }
    }

    return message;
  }

  /**
   * Recovers tool calls from Groq's raw Llama tool-call text, e.g.
   * `<function=search_customers {"query":"..."}></function>`. Uses balanced-brace
   * scanning so nested argument objects (create_booking) are captured intact.
   */
  private recoverToolCalls(text: unknown): LlmToolCall[] {
    if (typeof text !== 'string' || !text.includes('<function=')) {
      return [];
    }

    const calls: LlmToolCall[] = [];
    const namePattern = /<function=([a-zA-Z0-9_]+)/g;
    let match: RegExpExecArray | null;
    while ((match = namePattern.exec(text)) !== null) {
      const name = match[1];
      const start = text.indexOf('{', namePattern.lastIndex);
      if (start === -1) {
        continue;
      }
      let depth = 0;
      let end = -1;
      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{') {
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end === -1) {
        continue;
      }
      calls.push({
        id: `recovered_${this.recoveredCallSeq++}`,
        type: 'function',
        function: { name, arguments: text.slice(start, end + 1) },
      });
    }
    return calls;
  }
}
