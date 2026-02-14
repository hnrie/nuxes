import { useState, useCallback, useRef } from 'react';
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

// ─── Tool Execution ──────────────────────────────────────────────────────────

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useChat(settings: AppSettings) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeConvId) ?? null;

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
        const currentMessages = [...apiMessages];

        // Agentic loop
        while (iterationCount < MAX_AGENT_ITERATIONS) {
          iterationCount++;
          let pendingToolCalls: ToolCall[] | null = null;

          if (settings.streamingEnabled) {
            // Stream mode
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
                updateMessage(updatedConv.id, assistantMsgId, {
                  content: streamContent,
                  agentSteps: [...agentSteps],
                  isStreaming: true,
                });
              },
              (tcs) => {
                if (tcs && tcs.length > 0) {
                  pendingToolCalls = tcs.map((tc) => ({
                    id: tc.id ?? generateId(),
                    type: 'function' as const,
                    function: {
                      name: tc.function?.name ?? '',
                      arguments: tc.function?.arguments ?? '{}',
                    },
                  }));
                }
              },
              abort.signal,
            );
          } else {
            // Non-streaming mode
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
            if (choice?.message?.tool_calls) {
              pendingToolCalls = choice.message.tool_calls;
            }
          }

          // If no tool calls, we're done
          if (!pendingToolCalls || pendingToolCalls.length === 0) break;

          // Add assistant's tool call message to history
          currentMessages.push({
            role: 'assistant',
            content: streamContent || null as unknown as string,
            tool_calls: pendingToolCalls,
          });

          // Execute all tool calls
          const toolResultMessages: ChatMessage[] = [];

          for (const tc of pendingToolCalls) {
            const step: AgentStep = {
              id: generateId(),
              toolName: tc.function.name,
              toolCallId: tc.id,
              input: tc.function.arguments,
              status: 'running',
              startedAt: new Date(),
            };
            agentSteps.push(step);
            updateMessage(updatedConv.id, assistantMsgId, {
              content: streamContent,
              agentSteps: [...agentSteps],
              isStreaming: true,
            });

            const execution = await executeSubagentCall(tc, { attachedFiles: attachments });
            const result = formatSubagentResponse(execution);

            step.output = result;
            step.status = execution.ok ? 'done' : 'error';
            step.completedAt = new Date(execution.metadata.endTime);
            step.retries = execution.metadata.retries;
            step.failures = execution.metadata.failures;
            updateMessage(updatedConv.id, assistantMsgId, {
              content: streamContent,
              agentSteps: [...agentSteps],
              isStreaming: true,
            });

            toolResultMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.function.name,
              content: result,
            });
          }

          currentMessages.push(...toolResultMessages);
          // Reset stream content for next iteration
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
