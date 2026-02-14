import { BASE_URL, API_KEY } from '../config/models';
import type {
  ChatMessage,
  ChatCompletionChunk,
  ChatCompletionResponse,
} from '../types';

// ─── Tool Definitions for Agents ────────────────────────────────────────────

export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: 'Search the web for current information, news, facts, or any topic. Use this when you need up-to-date information that may not be in your training data.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to look up. Be specific and concise.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'analyze_file',
      description: 'Analyze a file that the user has attached. Returns the file content or analysis.',
      parameters: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'The name of the file to analyze',
          },
          instruction: {
            type: 'string',
            description: 'What specific analysis to perform on the file',
          },
        },
        required: ['filename', 'instruction'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_code',
      description: 'Execute JavaScript code in a sandboxed environment and return the result.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'The JavaScript code to execute',
          },
          description: {
            type: 'string',
            description: 'A brief description of what this code does',
          },
        },
        required: ['code', 'description'],
      },
    },
  },
] as const;

// ─── API Request ─────────────────────────────────────────────────────────────

interface RequestOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  stream?: boolean;
  useTools?: boolean;
}

export async function chatCompletionStream(
  options: RequestOptions,
  onChunk: (text: string) => void,
  onToolCalls: (toolCalls: ChatCompletionChunk['choices'][0]['delta']['tool_calls']) => void,
  signal?: AbortSignal,
): Promise<{ finishReason: string | null }> {
  const body = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    stream: true,
    ...(options.useTools ? { tools: AGENT_TOOLS, tool_choice: 'auto' } : {}),
  };

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finishReason: string | null = null;

  // Accumulate tool call arguments across chunks
  const pendingToolCalls: Record<
    number,
    { id: string; type: string; function: { name: string; arguments: string } }
  > = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const chunk: ChatCompletionChunk = JSON.parse(trimmed.slice(6));
        const choice = chunk.choices[0];
        if (!choice) continue;

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }

        const delta = choice.delta;

        // Accumulate text content
        if (delta.content) {
          onChunk(delta.content);
        }

        // Accumulate tool calls
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!pendingToolCalls[idx]) {
              pendingToolCalls[idx] = {
                id: tc.id ?? '',
                type: tc.type ?? 'function',
                function: { name: tc.function?.name ?? '', arguments: '' },
              };
            }
            if (tc.id) pendingToolCalls[idx].id = tc.id;
            if (tc.function?.name) pendingToolCalls[idx].function.name = tc.function.name;
            if (tc.function?.arguments) {
              pendingToolCalls[idx].function.arguments += tc.function.arguments;
            }
          }
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }

  // If we have completed tool calls, pass them back
  if (Object.keys(pendingToolCalls).length > 0) {
    const toolCallArray = Object.values(pendingToolCalls).map((tc) => ({
      index: 0,
      id: tc.id,
      type: tc.type,
      function: tc.function,
    }));
    onToolCalls(toolCallArray);
  }

  return { finishReason };
}

// Non-streaming version (used for tool result follow-ups)
export async function chatCompletion(options: RequestOptions): Promise<ChatCompletionResponse> {
  const body = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    stream: false,
    ...(options.useTools ? { tools: AGENT_TOOLS, tool_choice: 'auto' } : {}),
  };

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  return response.json() as Promise<ChatCompletionResponse>;
}
