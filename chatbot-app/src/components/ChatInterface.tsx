import { useEffect, useRef, useCallback } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import type { Conversation, AttachedFile, AppSettings } from '../types';
import MessageBubble from './MessageBubble';
import InputBar from './InputBar';
import ModelSelector from './ModelSelector';

interface ChatInterfaceProps {
  conversation: Conversation | null;
  isLoading: boolean;
  settings: AppSettings;
  onSend: (text: string, attachments: AttachedFile[]) => void;
  onStop: () => void;
  onModelChange: (modelId: string) => void;
  onToggleWebSearch: () => void;
}

const SUGGESTED_PROMPTS = [
  { icon: '🔍', text: 'Search the latest AI research' },
  { icon: '💻', text: 'Help me debug this code' },
  { icon: '📝', text: 'Summarize an attached document' },
  { icon: '🧪', text: 'Run a calculation and explain it' },
];

export default function ChatInterface({
  conversation,
  isLoading,
  settings,
  onSend,
  onStop,
  onModelChange,
  onToggleWebSearch,
}: ChatInterfaceProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [conversation?.id, scrollToBottom]);

  useEffect(() => {
    if (isLoading) scrollToBottom(true);
  }, [isLoading, scrollToBottom]);

  // Scroll when streaming content updates
  useEffect(() => {
    const msgs = conversation?.messages ?? [];
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg?.isStreaming) scrollToBottom(false);
  }, [conversation?.messages, scrollToBottom]);

  const hasMessages = (conversation?.messages.length ?? 0) > 0;

  return (
    <div className="chat-interface">
      {/* Top bar */}
      <div className="chat-topbar">
        <div className="chat-topbar-left">
          <div className="chat-title-area">
            {conversation ? (
              <h1 className="chat-title">{conversation.title}</h1>
            ) : (
              <div className="chat-title-logo">
                <div className="logo-mark-small" aria-hidden="true" />
                <span>Nexus AI</span>
              </div>
            )}
          </div>
        </div>
        <div className="chat-topbar-right">
          <ModelSelector
            selectedModel={settings.selectedModel}
            onSelect={onModelChange}
          />
        </div>
      </div>

      {/* Messages area */}
      <div className="messages-area" ref={scrollContainerRef}>
        {!hasMessages ? (
          <WelcomeScreen onPrompt={(p) => onSend(p, [])} />
        ) : (
          <div className="messages-list">
            {(conversation?.messages ?? []).map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="input-area">
        <InputBar
          onSend={onSend}
          onStop={onStop}
          isLoading={isLoading}
          webSearchEnabled={settings.webSearchEnabled}
          onToggleWebSearch={onToggleWebSearch}
        />
        <p className="input-disclaimer">
          Nexus may make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}

// ─── Welcome Screen ───────────────────────────────────────────────────────────

interface WelcomeScreenProps {
  onPrompt: (text: string) => void;
}

function WelcomeScreen({ onPrompt }: WelcomeScreenProps) {
  return (
    <div className="welcome-screen">
      <div className="welcome-hero">
        <div className="welcome-icon-wrap" aria-hidden="true">
          <Bot size={40} />
          <Sparkles size={20} className="welcome-sparkle" />
        </div>
        <h2 className="welcome-title">Welcome to Nexus AI</h2>
        <p className="welcome-subtitle">
          Powered by Claude. Search the web, analyze files, run code, and orchestrate tasks.
        </p>
      </div>

      <div className="welcome-prompts">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p.text}
            className="prompt-chip"
            onClick={() => onPrompt(p.text)}
          >
            <span className="prompt-chip-icon">{p.icon}</span>
            <span>{p.text}</span>
          </button>
        ))}
      </div>

      <div className="welcome-features">
        <div className="feature-pill">🔍 Web Search</div>
        <div className="feature-pill">📎 File Attachments</div>
        <div className="feature-pill">🤖 Subagents</div>
        <div className="feature-pill">💻 Code Execution</div>
      </div>
    </div>
  );
}
