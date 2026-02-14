import { BASE_URL, API_KEY } from '../config/models';
import { getAgentTools } from '../agents';
import type {
  ChatMessage,
  ChatCompletionChunk,
  ChatCompletionResponse,
} from '../types';

// ─── Tool Definitions for Agents ────────────────────────────────────────────

export const AGENT_TOOLS = getAgentTools();

// ─── API Request ─────────────────────────────────────────────────────────────

interface RequestOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  stream?: boolean;
  useTools?: boolean;
  enabledToolNames?: string[];
}


function getEnabledTools(options: RequestOptions) {
  if (!options.useTools) return [];
  if (!options.enabledToolNames || options.enabledToolNames.length === 0) return AGENT_TOOLS;
  const enabled = new Set(options.enabledToolNames);
  return AGENT_TOOLS.filter((tool) => enabled.has(tool.function.name));
}

export async function chatCompletionStream(
  options: RequestOptions,
  onChunk: (text: string) => void,
  onToolCalls: (toolCalls: ChatCompletionChunk['choices'][0]['delta']['tool_calls']) => void,
  onToolCallReady: (toolCalls: ChatCompletionChunk['choices'][0]['delta']['tool_calls']) => void,
  signal?: AbortSignal,
): Promise<{ finishReason: string | null }> {
  const tools = getEnabledTools(options);
  const body = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    stream: true,
    ...(tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
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

  const pendingToolCalls: Record<
    number,
    { id: string; type: string; function: { name: string; arguments: string } }
  > = {};
  const completedToolCallIndexes = new Set<number>();

  const hasCompleteJsonPayload = (rawArguments: string) => {
    let trimmedStart = 0;
    while (trimmedStart < rawArguments.length && /\s/.test(rawArguments[trimmedStart])) {
      trimmedStart += 1;
    }
    if (trimmedStart >= rawArguments.length) return false;

    const firstChar = rawArguments[trimmedStart];
    if (firstChar !== '{' && firstChar !== '[') return false;

    let braceBalance = 0;
    let bracketBalance = 0;
    let inString = false;
    let escaped = false;

    for (let i = trimmedStart; i < rawArguments.length; i += 1) {
      const char = rawArguments[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') braceBalance += 1;
      if (char === '}') braceBalance -= 1;
      if (char === '[') bracketBalance += 1;
      if (char === ']') bracketBalance -= 1;

      if (braceBalance < 0 || bracketBalance < 0) return false;
    }

    if (inString || braceBalance !== 0 || bracketBalance !== 0) return false;

    try {
      JSON.parse(rawArguments.slice(trimmedStart));
      return true;
    } catch {
      return false;
    }
  };

  const getCompletedToolCalls = () => {
    const completed: NonNullable<ChatCompletionChunk['choices'][0]['delta']['tool_calls']> = [];
    const sortedIndexes = Object.keys(pendingToolCalls)
      .map((index) => Number(index))
      .sort((a, b) => a - b);

    for (const idx of sortedIndexes) {
      if (completedToolCallIndexes.has(idx)) continue;
      const toolCall = pendingToolCalls[idx];
      if (!toolCall?.function.arguments) continue;
      if (!hasCompleteJsonPayload(toolCall.function.arguments)) continue;

      completedToolCallIndexes.add(idx);
      completed.push({
        index: idx,
        id: toolCall.id,
        type: toolCall.type,
        function: {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        },
      });
      delete pendingToolCalls[idx];
    }

    return completed;
  };

  const emitPendingToolCalls = () => {
    const pendingIndexes = Object.keys(pendingToolCalls)
      .map((index) => Number(index))
      .sort((a, b) => a - b);

    if (pendingIndexes.length === 0) return false;

    const toolCallArray: NonNullable<ChatCompletionChunk['choices'][0]['delta']['tool_calls']> =
      pendingIndexes.map((idx) => {
        const toolCall = pendingToolCalls[idx];
        return {
          index: idx,
          id: toolCall.id,
          type: toolCall.type,
          function: {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments,
          },
        };
      });

    onToolCalls(toolCallArray);
    return true;
  };

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
          if (choice.finish_reason === 'tool_calls') {
            if (emitPendingToolCalls()) {
              await reader.cancel();
            }
            return { finishReason };
          }
        }

        const delta = choice.delta;

        if (delta.content) {
          onChunk(delta.content);
        }

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

          const completedToolCalls = getCompletedToolCalls();
          if (completedToolCalls.length > 0) {
            onToolCallReady(completedToolCalls);
            onToolCalls(completedToolCalls);
            await reader.cancel();
            return { finishReason };
          }
        }
      } catch {
      }
    }
  }

  emitPendingToolCalls();

  return { finishReason };
}

// Non-streaming version (used for tool result follow-ups)
export async function chatCompletion(options: RequestOptions): Promise<ChatCompletionResponse> {
  const tools = getEnabledTools(options);
  const body = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    stream: false,
    ...(tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
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
