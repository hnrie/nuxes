import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  UIMessage,
  ChatMessage,
  AgentStep,
  AttachedFile,
  AppSettings,
  Conversation,
  ToolCall,
} from '../types';
import { chatCompletionStream, chatCompletion } from '../services/api';
import { executeSubagentCall, formatSubagentResponse } from '../agents';
import { DEFAULT_SYSTEM_PROMPT, MAX_AGENT_ITERATIONS } from '../config/models';

function generateId(): string {
  return Math.random().toString(36).substring(2, 14);
}

function generateTitle(content: string): string {
  return content.length > 50 ? content.substring(0, 50) + '…' : content;
}

function sanitizeConversationTitle(rawTitle: string, fallbackTitle: string): string {
  const singleLine = rawTitle
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#$>*_~`\[\]()]/g, ' ')
    .replace(/\$[^$]+\$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const shortened = singleLine
    .split(' ')
    .filter(Boolean)
    .slice(0, 6)
    .join(' ')
    .trim();

  return shortened.length > 0 ? shortened : fallbackTitle;
}

const chatStateStorageKey = 'nuxes chat state v1';

type PersistedAgentStep = Omit<AgentStep, 'startedAt' | 'completedAt'> & {
  startedAt: string;
  completedAt?: string;
};

type PersistedUIMessage = Omit<UIMessage, 'timestamp' | 'agentSteps'> & {
  timestamp: string;
  agentSteps?: PersistedAgentStep[];
};

type PersistedConversation = Omit<Conversation, 'createdAt' | 'updatedAt' | 'messages'> & {
  createdAt: string;
  updatedAt: string;
  messages: PersistedUIMessage[];
};

type PersistedChatState = {
  conversations: PersistedConversation[];
  activeConvId: string | null;
};

type HydratedChatState = {
  conversations: Conversation[];
  activeConvId: string | null;
};

function serializeConversation(conversation: Conversation): PersistedConversation {
  return {
    ...conversation,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messages: conversation.messages.map((message) => ({
      ...message,
      timestamp: message.timestamp.toISOString(),
      agentSteps: message.agentSteps?.map((step) => ({
        ...step,
        startedAt: step.startedAt.toISOString(),
        completedAt: step.completedAt?.toISOString(),
      })),
    })),
  };
}

function deserializeConversation(conversation: PersistedConversation): Conversation {
  return {
    ...conversation,
    createdAt: new Date(conversation.createdAt),
    updatedAt: new Date(conversation.updatedAt),
    messages: conversation.messages.map((message) => ({
      ...message,
      timestamp: new Date(message.timestamp),
      agentSteps: message.agentSteps?.map((step) => ({
        ...step,
        startedAt: new Date(step.startedAt),
        completedAt: step.completedAt ? new Date(step.completedAt) : undefined,
      })),
    })),
  };
}

function loadChatState(): HydratedChatState {
  if (typeof window === 'undefined') {
    return { conversations: [], activeConvId: null };
  }

  const raw = window.localStorage.getItem(chatStateStorageKey);
  if (!raw) {
    return { conversations: [], activeConvId: null };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedChatState>;
    const persistedConversations = Array.isArray(parsed.conversations) ? parsed.conversations : [];
    const conversations = persistedConversations.map((conversation) =>
      deserializeConversation(conversation),
    );
    const activeConvId =
      typeof parsed.activeConvId === 'string' || parsed.activeConvId === null
        ? parsed.activeConvId
        : null;
    return { conversations, activeConvId };
  } catch {
    return { conversations: [], activeConvId: null };
  }
}

function saveChatState(state: HydratedChatState) {
  if (typeof window === 'undefined') return;
  const payload: PersistedChatState = {
    conversations: state.conversations.map((conversation) => serializeConversation(conversation)),
    activeConvId: state.activeConvId,
  };
  window.localStorage.setItem(chatStateStorageKey, JSON.stringify(payload));
}

type FallbackToolParseResult = {
  toolCalls: ToolCall[];
  displayContent: string;
  needsClarification: boolean;
  clarificationPrompt?: string;
};

function normalizeToolName(rawName: string): string | null {
  const normalized = rawName.trim().toLowerCase();
  if (normalized === 'web_search') return 'web_search';
  if (normalized === 'analyze_file') return 'analyze_file';
  if (normalized === 'run_code') return 'run_code';
  return null;
}

export function detectToolIntentOnly(content: string): boolean {
  const normalized = content.toLowerCase();
  return [
    /\blet me search\b/,
    /\bi will search\b/,
    /\bi'll search\b/,
    /\bi will look up\b/,
    /\bi'll look up\b/,
    /\bi can search\b/,
    /\bsearching for\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function parseFallbackToolCalls(content: string): FallbackToolParseResult {
  const toolCalls: ToolCall[] = [];
  const interpretedNames: string[] = [];
  const blocksToStrip: Array<{ start: number; end: number }> = [];

  const appendParsedToolCall = (name: string, argumentsObject: Record<string, unknown>) => {
    toolCalls.push({
      id: generateId(),
      type: 'function',
      function: {
        name,
        arguments: JSON.stringify(argumentsObject),
      },
    });
    interpretedNames.push(name);
  };

  const parseJsonToolPayload = (jsonPayload: string) => {
    try {
      const parsed = JSON.parse(jsonPayload) as
        | {
            name?: unknown;
            arguments?: unknown;
            tool?: { name?: unknown; arguments?: unknown };
          }
        | null;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;

      const rawName = typeof parsed.name === 'string'
        ? parsed.name
        : typeof parsed.tool?.name === 'string'
          ? parsed.tool.name
          : null;
      if (!rawName) return;

      const normalizedName = normalizeToolName(rawName);
      if (!normalizedName) return;

      const rawArguments = parsed.arguments ?? parsed.tool?.arguments;
      if (!rawArguments || typeof rawArguments !== 'object' || Array.isArray(rawArguments)) return;

      appendParsedToolCall(normalizedName, rawArguments as Record<string, unknown>);
      return true;
    } catch {
      return;
    }
  };

  const xmlPattern = /<(web_search|analyze_file|run_code)>([\s\S]*?)<\/\1>/gi;
  let xmlMatch = xmlPattern.exec(content);
  while (xmlMatch) {
    const mappedName = normalizeToolName(xmlMatch[1] ?? '');
    if (mappedName) {
      const innerContent = xmlMatch[2] ?? '';
      const args: Record<string, string> = {};
      const fieldPattern = /<([a-zA-Z_][\w-]*)>([\s\S]*?)<\/\1>/g;
      let fieldMatch = fieldPattern.exec(innerContent);
      while (fieldMatch) {
        const key = (fieldMatch[1] ?? '').trim();
        const value = (fieldMatch[2] ?? '').trim();
        if (key.length > 0) {
          args[key] = value;
        }
        fieldMatch = fieldPattern.exec(innerContent);
      }

      toolCalls.push({
        id: generateId(),
        type: 'function',
        function: {
          name: mappedName,
          arguments: JSON.stringify(args),
        },
      });
      interpretedNames.push(mappedName);
      blocksToStrip.push({
        start: xmlMatch.index,
        end: xmlMatch.index + xmlMatch[0].length,
      });
    }
    xmlMatch = xmlPattern.exec(content);
  }

  const toolPattern = /<tool\s+name="([^"]+)"\s*>([\s\S]*?)<\/tool>/gi;
  let toolMatch = toolPattern.exec(content);
  while (toolMatch) {
    const mappedName = normalizeToolName(toolMatch[1] ?? '');
    if (mappedName) {
      const rawArguments = (toolMatch[2] ?? '').trim();
      toolCalls.push({
        id: generateId(),
        type: 'function',
        function: {
          name: mappedName,
          arguments: rawArguments.length > 0 ? rawArguments : '{}',
        },
      });
      interpretedNames.push(mappedName);
      blocksToStrip.push({
        start: toolMatch.index,
        end: toolMatch.index + toolMatch[0].length,
      });
    }
    toolMatch = toolPattern.exec(content);
  }

  const fencedJsonPattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fencedJsonMatch = fencedJsonPattern.exec(content);
  while (fencedJsonMatch) {
    const jsonPayload = (fencedJsonMatch[1] ?? '').trim();
    if (jsonPayload.length > 0 && parseJsonToolPayload(jsonPayload)) {
      blocksToStrip.push({
        start: fencedJsonMatch.index,
        end: fencedJsonMatch.index + fencedJsonMatch[0].length,
      });
    }
    fencedJsonMatch = fencedJsonPattern.exec(content);
  }

  const trimmedContent = content.trim();
  if (trimmedContent.length > 0 && parseJsonToolPayload(trimmedContent)) {
    const start = content.indexOf(trimmedContent);
    blocksToStrip.push({
      start,
      end: start + trimmedContent.length,
    });
  }

  blocksToStrip.sort((a, b) => a.start - b.start);

  let displayContent = '';
  let cursor = 0;
  for (const block of blocksToStrip) {
    if (block.start < cursor) continue;
    displayContent += content.slice(cursor, block.start);
    cursor = block.end;
  }
  displayContent += content.slice(cursor);

  const cleanText = displayContent.replace(/\n{3,}/g, '\n\n').trim();
  const uniqueNames = Array.from(new Set(interpretedNames));
  if (uniqueNames.length > 0) {
    const interpretedText = `Interpreted tool request: ${uniqueNames.join(', ')}`;
    displayContent = cleanText.length > 0 ? `${cleanText}\n\n${interpretedText}` : interpretedText;
    return {
      toolCalls,
      displayContent,
      needsClarification: false,
    };
  }

  if (detectToolIntentOnly(content)) {
    const queryMatch = content.match(/(?:search|look up)(?:\s+for)?\s+(.+?)(?:[.!?]|$)/i);
    const query = queryMatch?.[1]?.trim();
    if (query && query.length > 3 && !/\b(something|it|that|this)\b/i.test(query)) {
      return {
        toolCalls: [
          {
            id: generateId(),
            type: 'function',
            function: {
              name: 'web_search',
              arguments: JSON.stringify({ query }),
            },
          },
        ],
        displayContent: content,
        needsClarification: false,
      };
    }

    return {
      toolCalls: [],
      displayContent: content,
      needsClarification: true,
      clarificationPrompt: 'I can run web_search, but I need a specific query. What should I search for?',
    };
  }

  return {
    toolCalls,
    displayContent: content,
    needsClarification: false,
  };
}


export function shouldAttemptArgumentRepair(toolMessages: ChatMessage[], retryCount: number, maxRetries: number): boolean {
  if (retryCount >= maxRetries) return false;
  return toolMessages.some((message) => {
    try {
      if (typeof message.content !== 'string') return false;
      const parsed = JSON.parse(message.content) as { errorCode?: string };
      return parsed.errorCode === 'invalid_arguments';
    } catch {
      return false;
    }
  });
}

// ─── Tool Execution ──────────────────────────────────────────────────────────

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useChat(settings: AppSettings) {
  const hydratedStateRef = useRef<HydratedChatState>(loadChatState());
  const [conversations, setConversations] = useState<Conversation[]>(
    hydratedStateRef.current.conversations,
  );
  const [activeConvId, setActiveConvId] = useState<string | null>(hydratedStateRef.current.activeConvId);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeConvId) ?? null;

  useEffect(() => {
    saveChatState({ conversations, activeConvId });
  }, [conversations, activeConvId]);

  const generateConversationTitle = useCallback(
    async (firstMessage: string) => {
      const fallbackTitle = generateTitle(firstMessage);
      try {
        const response = await chatCompletion({
          model: 'claude-haiku-4-5-20251001',
          messages: [
            {
              role: 'system',
              content: 'You only generate conversation titles. Do not answer the user message. Return exactly one short plain-text title with at most 6 words.',
            },
            { role: 'user', content: firstMessage },
          ],
          temperature: 0.2,
        });
        const title = response.choices[0]?.message?.content?.trim() ?? '';
        return sanitizeConversationTitle(title, fallbackTitle);
      } catch {
        return fallbackTitle;
      }
    },
    [],
  );

  // ─── Mutation helpers ──────────────────────────────────────────────────────

  const upsertConversation = useCallback((conv: Conversation) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conv.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = conv;
        return next;
      }
      return [conv, ...prev];
    });
  }, []);

  const updateMessage = useCallback(
    (convId: string, msgId: string, update: Partial<UIMessage>) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === msgId ? { ...m, ...update } : m,
                ),
              }
            : c,
        ),
      );
    },
    [],
  );

  // ─── Build API messages from UI ────────────────────────────────────────────

  const buildApiMessages = useCallback(
    (conv: Conversation, attachments: AttachedFile[]): ChatMessage[] => {
      const messages: ChatMessage[] = [
        { role: 'system', content: settings.systemPrompt || DEFAULT_SYSTEM_PROMPT },
      ];

      for (const msg of conv.messages.filter((m) => !m.isStreaming && !m.error)) {
        if (msg.role === 'user') {
          const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

          if (msg.content) {
            content.push({ type: 'text', text: msg.content });
          }

          // Attach files from this message
          const msgFiles = msg.attachments ?? attachments;
          for (const f of msgFiles) {
            if (f.isImage) {
              const dataUrl = `data:${f.type};base64,${f.content}`;
              content.push({ type: 'image_url', image_url: { url: dataUrl } });
            } else if (f.content) {
              content.push({
                type: 'text',
                text: `\n[Attached file: ${f.name}]\n${f.content.substring(0, 4000)}`,
              });
            }
          }

          messages.push({
            role: 'user',
            content: content.length === 1 && content[0].type === 'text'
              ? (content[0].text ?? '')
              : content as ChatMessage['content'],
          });
        } else if (msg.role === 'assistant') {
          messages.push({ role: 'assistant', content: msg.content });
        }
      }

      return messages;
    },
    [settings.systemPrompt],
  );

  // ─── Main send message function ────────────────────────────────────────────

  const sendMessage = useCallback(
    async (userText: string, attachments: AttachedFile[]) => {
      if (isLoading) return;

      const userMsgId = generateId();
      const assistantMsgId = generateId();

      // Create or get conversation
      let conv: Conversation;
      if (!activeConvId) {
        conv = {
          id: generateId(),
          title: generateTitle(userText),
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          model: settings.selectedModel,
        };
        setActiveConvId(conv.id);
      } else {
        conv = conversations.find((c) => c.id === activeConvId) ?? {
          id: activeConvId,
          title: generateTitle(userText),
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          model: settings.selectedModel,
        };
      }

      const fallbackTitle = generateTitle(userText);
      const firstUserMessageOnly = conv.messages.filter((message) => message.role === 'user').length === 0;
      const shouldGenerateTitle = firstUserMessageOnly && (!conv.title || conv.title === fallbackTitle);

      // Add user message
      const userMsg: UIMessage = {
        id: userMsgId,
        role: 'user',
        content: userText,
        attachments,
        timestamp: new Date(),
      };

      // Add placeholder assistant message
      const assistantMsg: UIMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        agentSteps: [],
        isStreaming: true,
        timestamp: new Date(),
      };

      const updatedConv: Conversation = {
        ...conv,
        messages: [...conv.messages, userMsg, assistantMsg],
        updatedAt: new Date(),
      };

      upsertConversation(updatedConv);

      if (shouldGenerateTitle) {
        void generateConversationTitle(userText).then((nextTitle) => {
          setConversations((prev) =>
            prev.map((conversation) => {
              if (conversation.id !== updatedConv.id) return conversation;
              const currentTitle = conversation.title;
              if (currentTitle && currentTitle !== fallbackTitle) return conversation;
              if (!nextTitle || nextTitle === currentTitle) return conversation;
              return {
                ...conversation,
                title: nextTitle,
                updatedAt: new Date(),
              };
            }),
          );
        });
      }

      setIsLoading(true);

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        // Build history including the new user message
        const historyConv: Conversation = {
          ...updatedConv,
          messages: updatedConv.messages.filter((m) => m.id !== assistantMsgId),
        };

        const apiMessages = buildApiMessages(historyConv, attachments);
        const enabledToolNames = [
          ...(settings.webSearchEnabled ? ['web_search'] : []),
          ...(settings.fileAnalysisEnabled ? ['analyze_file'] : []),
          ...(settings.codeExecutionEnabled ? ['run_code'] : []),
        ];
        const useTools = enabledToolNames.length > 0;

        let streamContent = '';
        const agentSteps: AgentStep[] = [];
        let iterationCount = 0;
        let continuationRepairAttempts = 0;
        let argumentRepairAttempts = 0;
        const currentMessages = [...apiMessages];
        const maxContinuationRepairs = 2;
        const maxArgumentRepairs = 2;

        const updateStreamingMessage = () => {
          updateMessage(updatedConv.id, assistantMsgId, {
            content: streamContent,
            agentSteps: [...agentSteps],
            isStreaming: true,
          });
        };

        while (iterationCount < MAX_AGENT_ITERATIONS) {
          iterationCount += 1;
          const seenToolCallIds = new Set<string>();
          const toolQueue: ToolCall[] = [];
          const recognizedToolCalls: ToolCall[] = [];
          const toolResultMessages: ChatMessage[] = [];
          let processingQueue: Promise<void> | null = null;

          const toToolCalls = (tcs: NonNullable<ToolCall[]>) =>
            tcs.map((tc) => ({
              id: tc.id ?? generateId(),
              type: 'function' as const,
              function: {
                name: tc.function?.name ?? '',
                arguments: tc.function?.arguments ?? '{}',
              },
            }));

          const enqueueToolCalls = (incomingCalls: ToolCall[] | null | undefined) => {
            if (!incomingCalls || incomingCalls.length === 0) return;
            for (const toolCall of incomingCalls) {
              const normalizedId = toolCall.id && toolCall.id.length > 0
                ? toolCall.id
                : `${toolCall.function.name}:${toolCall.function.arguments}`;
              if (seenToolCallIds.has(normalizedId)) continue;
              seenToolCallIds.add(normalizedId);
              recognizedToolCalls.push({ ...toolCall, id: normalizedId });
              toolQueue.push({ ...toolCall, id: normalizedId });
            }
            if (!processingQueue) {
              processingQueue = (async () => {
                while (toolQueue.length > 0) {
                  const tc = toolQueue.shift();
                  if (!tc) continue;
                  const step: AgentStep = {
                    id: generateId(),
                    toolName: tc.function.name,
                    toolCallId: tc.id,
                    input: tc.function.arguments,
                    status: 'running',
                    startedAt: new Date(),
                  };
                  agentSteps.push(step);
                  updateStreamingMessage();

                  const execution = await executeSubagentCall(tc, { attachedFiles: attachments, mainAgentModel: settings.selectedModel });
                  const result = formatSubagentResponse(execution);

                  step.output = result;
                  step.status = execution.ok ? 'done' : 'error';
                  step.completedAt = new Date(execution.metadata.endTime);
                  step.retries = execution.metadata.retries;
                  step.failures = execution.metadata.failures;
                  updateStreamingMessage();

                  toolResultMessages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    name: tc.function.name,
                    content: result,
                  });
                }
              })();
            }
          };

          if (settings.streamingEnabled) {
            await chatCompletionStream(
              {
                model: settings.selectedModel,
                messages: currentMessages,
                temperature: settings.temperature,
                stream: true,
                useTools,
                enabledToolNames,
              },
              (chunk) => {
                streamContent += chunk;
                updateStreamingMessage();
              },
              (tcs) => {
                if (!tcs || tcs.length === 0) return;
                enqueueToolCalls(toToolCalls(tcs as unknown as ToolCall[]));
              },
              (tcs) => {
                if (!tcs || tcs.length === 0) return;
                enqueueToolCalls(toToolCalls(tcs as unknown as ToolCall[]));
              },
              abort.signal,
            );
          } else {
            const res = await chatCompletion({
              model: settings.selectedModel,
              messages: currentMessages,
              temperature: settings.temperature,
              useTools,
              enabledToolNames,
            });

            const choice = res.choices[0];
            if (choice?.message?.content) {
              streamContent = choice.message.content;
            }
            enqueueToolCalls(choice?.message?.tool_calls ?? []);
          }

          if (processingQueue) {
            await processingQueue;
          }

          let pendingToolCalls = recognizedToolCalls;

          if (pendingToolCalls.length === 0 && streamContent) {
            const fallback = parseFallbackToolCalls(streamContent);
            if (fallback.toolCalls.length > 0) {
              pendingToolCalls = fallback.toolCalls;
              enqueueToolCalls(pendingToolCalls);
              if (processingQueue) {
                await processingQueue;
              }
              streamContent = fallback.displayContent;
              updateStreamingMessage();
            } else if (fallback.needsClarification && fallback.clarificationPrompt) {
              streamContent = fallback.clarificationPrompt;
              break;
            }
          }

          if (pendingToolCalls.length === 0) {
            if (useTools && detectToolIntentOnly(streamContent) && continuationRepairAttempts < maxContinuationRepairs) {
              continuationRepairAttempts += 1;
              currentMessages.push({ role: 'assistant', content: streamContent });
              currentMessages.push({
                role: 'user',
                content: 'respond only with a valid function tool call. output must be strict json with a top-level object and no markdown or extra text',
              });
              streamContent = '';
              continue;
            }
            break;
          }

          currentMessages.push({
            role: 'assistant',
            content: streamContent,
            tool_calls: pendingToolCalls,
          });

          currentMessages.push(...toolResultMessages);

          if (shouldAttemptArgumentRepair(toolResultMessages, argumentRepairAttempts, maxArgumentRepairs)) {
            argumentRepairAttempts += 1;
            currentMessages.push({
              role: 'user',
              content: 'your tool call arguments were invalid. respond only with a corrected function tool call. output must be strict json with a top-level object and no markdown or extra text',
            });
            streamContent = '';
            continue;
          }

          streamContent = '';
        }

        // Final update – done streaming
        updateMessage(updatedConv.id, assistantMsgId, {
          content: streamContent || '*(No response)*',
          agentSteps: agentSteps.length > 0 ? agentSteps : undefined,
          isStreaming: false,
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          updateMessage(updatedConv.id, assistantMsgId, {
            content: '*(Response cancelled)*',
            isStreaming: false,
          });
        } else {
          updateMessage(updatedConv.id, assistantMsgId, {
            content: '',
            isStreaming: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [
      isLoading,
      activeConvId,
      conversations,
      settings,
      upsertConversation,
      buildApiMessages,
      updateMessage,
      generateConversationTitle,
    ],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const newConversation = useCallback(() => {
    setActiveConvId(null);
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) setActiveConvId(null);
    },
    [activeConvId],
  );

  const selectConversation = useCallback((id: string) => {
    setActiveConvId(id);
  }, []);

  return {
    conversations,
    activeConversation,
    isLoading,
    sendMessage,
    stopGeneration,
    newConversation,
    deleteConversation,
    selectConversation,
  };
}
