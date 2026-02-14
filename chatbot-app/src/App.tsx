import { useState, useCallback } from 'react';
import type { AppSettings } from './types';
import { DEFAULT_MODEL, DEFAULT_SYSTEM_PROMPT } from './config/models';
import { useChat } from './hooks/useChat';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import 'highlight.js/styles/github-dark.css';

const DEFAULT_SETTINGS: AppSettings = {
  selectedModel: DEFAULT_MODEL,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.7,
  webSearchEnabled: true,
  streamingEnabled: true,
};

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const {
    conversations,
    activeConversation,
    isLoading,
    sendMessage,
    stopGeneration,
    newConversation,
    deleteConversation,
    selectConversation,
  } = useChat(settings);

  const handleModelChange = useCallback((modelId: string) => {
    setSettings((s) => ({ ...s, selectedModel: modelId }));
  }, []);

  const handleToggleWebSearch = useCallback(() => {
    setSettings((s) => ({ ...s, webSearchEnabled: !s.webSearchEnabled }));
  }, []);

  return (
    <div className="app-layout">
      <Sidebar
        conversations={conversations}
        activeConvId={activeConversation?.id ?? null}
        settings={settings}
        onNewChat={newConversation}
        onSelectConv={selectConversation}
        onDeleteConv={deleteConversation}
        onSettingsChange={setSettings}
      />
      <main className="app-main">
        <ChatInterface
          conversation={activeConversation}
          isLoading={isLoading}
          settings={settings}
          onSend={sendMessage}
          onStop={stopGeneration}
          onModelChange={handleModelChange}
          onToggleWebSearch={handleToggleWebSearch}
        />
      </main>
    </div>
  );
}
