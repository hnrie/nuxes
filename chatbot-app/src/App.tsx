import { useState, useCallback, useEffect } from 'react';
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
  fileAnalysisEnabled: true,
  codeExecutionEnabled: true,
  streamingEnabled: true,
};

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [mobileMode, setMobileMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const sync = () => {
      setMobileMode(media.matches);
      if (!media.matches) {
        setDrawerOpen(false);
      }
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const handleModelChange = useCallback((modelId: string) => {
    setSettings((s) => ({ ...s, selectedModel: modelId }));
  }, []);

  const handleToggleWebSearch = useCallback(() => {
    setSettings((s) => ({ ...s, webSearchEnabled: !s.webSearchEnabled }));
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleNewChat = useCallback(() => {
    newConversation();
    closeDrawer();
  }, [newConversation, closeDrawer]);

  const handleSelectConversation = useCallback((id: string) => {
    selectConversation(id);
    closeDrawer();
  }, [selectConversation, closeDrawer]);

  const handleDeleteConversation = useCallback((id: string) => {
    deleteConversation(id);
    closeDrawer();
  }, [deleteConversation, closeDrawer]);

  const handleSendMessage = useCallback((text: string, attachments: Parameters<typeof sendMessage>[1]) => {
    sendMessage(text, attachments);
    closeDrawer();
  }, [sendMessage, closeDrawer]);

  return (
    <div className={`app-layout${mobileMode ? ' mobile-mode' : ''}`}>
      <Sidebar
        conversations={conversations}
        activeConvId={activeConversation?.id ?? null}
        settings={settings}
        onNewChat={handleNewChat}
        onSelectConv={handleSelectConversation}
        onDeleteConv={handleDeleteConversation}
        onSettingsChange={setSettings}
        mobileMode={mobileMode}
        drawerOpen={drawerOpen}
        onCloseDrawer={closeDrawer}
      />
      <main className="app-main">
        <ChatInterface
          conversation={activeConversation}
          isLoading={isLoading}
          settings={settings}
          onSend={handleSendMessage}
          onStop={stopGeneration}
          onModelChange={handleModelChange}
          onToggleWebSearch={handleToggleWebSearch}
          mobileMode={mobileMode}
          onToggleDrawer={() => setDrawerOpen((v) => !v)}
        />
      </main>
    </div>
  );
}
