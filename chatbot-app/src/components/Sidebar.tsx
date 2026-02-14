import { useState } from 'react';
import { MessageSquare, Settings, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Conversation, AppSettings } from '../types';
import { MODELS, DEFAULT_SYSTEM_PROMPT } from '../config/models';
import RenderedTitle from './RenderedTitle';

interface SidebarProps {
  conversations: Conversation[];
  activeConvId: string | null;
  settings: AppSettings;
  onNewChat: () => void;
  onSelectConv: (id: string) => void;
  onDeleteConv: (id: string) => void;
  onSettingsChange: (s: AppSettings) => void;
  mobileMode: boolean;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

type Tab = 'chats' | 'settings';

export default function Sidebar({
  conversations,
  activeConvId,
  settings,
  onNewChat,
  onSelectConv,
  onDeleteConv,
  onSettingsChange,
  mobileMode,
  drawerOpen,
  onCloseDrawer,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(true);
  const [tab, setTab] = useState<Tab>('chats');

  const isOpen = mobileMode ? drawerOpen : expanded;

  if (mobileMode) {
    return (
      <>
        <aside className={`sidebar mobile-drawer${isOpen ? ' open' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <div className="sidebar-logo-mark" aria-hidden="true" />
              <span className="sidebar-logo-text">Nexus AI</span>
            </div>
            <div className="sidebar-header-actions">
              <button className="icon-btn" onClick={onNewChat} title="New chat">
                <Plus size={16} />
              </button>
              <button className="icon-btn" onClick={onCloseDrawer} title="Close">
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`sidebar-tab${tab === 'chats' ? ' active' : ''}`}
              onClick={() => setTab('chats')}
            >
              <MessageSquare size={14} />
              Chats
            </button>
            <button
              className={`sidebar-tab${tab === 'settings' ? ' active' : ''}`}
              onClick={() => setTab('settings')}
            >
              <Settings size={14} />
              Settings
            </button>
          </nav>

          <div className="sidebar-content">
            {tab === 'chats' ? (
              conversations.length === 0 ? (
                <div className="conv-empty">
                  <MessageSquare size={28} />
                  <span>No conversations yet</span>
                  <span className="conv-empty-hint">Click + to start a new chat</span>
                </div>
              ) : (
                <ul className="conv-list">
                  {conversations.map((c) => (
                    <li key={c.id} className={`conv-item${c.id === activeConvId ? ' active' : ''}`}>
                      <button className="conv-btn" onClick={() => onSelectConv(c.id)}>
                        <MessageSquare size={14} className="conv-icon" />
                        <RenderedTitle title={c.title} className="conv-title" />
                        <span className="conv-count">{c.messages.length}</span>
                      </button>
                      <button
                        className="conv-delete"
                        onClick={(e) => { e.stopPropagation(); onDeleteConv(c.id); }}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <SettingsPanel settings={settings} onChange={onSettingsChange} />
            )}
          </div>
        </aside>
        {isOpen && <button className="sidebar-backdrop" onClick={onCloseDrawer} aria-label="Close sidebar" />}
      </>
    );
  }

  if (!isOpen) {
    return (
      <aside className="sidebar collapsed">
        <button className="sidebar-expand" onClick={() => setExpanded(true)} title="Expand sidebar">
          <ChevronRight size={18} />
        </button>
        <button className="sidebar-new-collapsed" onClick={onNewChat} title="New chat">
          <Plus size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="sidebar expanded">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark" aria-hidden="true" />
          <span className="sidebar-logo-text">Nexus AI</span>
        </div>
        <div className="sidebar-header-actions">
          <button className="icon-btn" onClick={onNewChat} title="New chat">
            <Plus size={16} />
          </button>
          <button className="icon-btn" onClick={() => setExpanded(false)} title="Collapse">
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`sidebar-tab${tab === 'chats' ? ' active' : ''}`}
          onClick={() => setTab('chats')}
        >
          <MessageSquare size={14} />
          Chats
        </button>
        <button
          className={`sidebar-tab${tab === 'settings' ? ' active' : ''}`}
          onClick={() => setTab('settings')}
        >
          <Settings size={14} />
          Settings
        </button>
      </nav>

      <div className="sidebar-content">
        {tab === 'chats' ? (
          conversations.length === 0 ? (
            <div className="conv-empty">
              <MessageSquare size={28} />
              <span>No conversations yet</span>
              <span className="conv-empty-hint">Click + to start a new chat</span>
            </div>
          ) : (
            <ul className="conv-list">
              {conversations.map((c) => (
                <li key={c.id} className={`conv-item${c.id === activeConvId ? ' active' : ''}`}>
                  <button className="conv-btn" onClick={() => onSelectConv(c.id)}>
                    <MessageSquare size={14} className="conv-icon" />
                    <RenderedTitle title={c.title} className="conv-title" />
                    <span className="conv-count">{c.messages.length}</span>
                  </button>
                  <button
                    className="conv-delete"
                    onClick={(e) => { e.stopPropagation(); onDeleteConv(c.id); }}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <SettingsPanel settings={settings} onChange={onSettingsChange} />
        )}
      </div>
    </aside>
  );
}

function SettingsPanel({ settings, onChange }: { settings: AppSettings; onChange: (s: AppSettings) => void }) {
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    onChange({ ...settings, [k]: v });

  return (
    <div className="settings-panel">
      <div className="settings-group">
        <label className="settings-label">Default Model</label>
        <select
          className="settings-select"
          value={settings.selectedModel}
          onChange={(e) => set('selectedModel', e.target.value)}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <div className="settings-group">
        <label className="settings-label">Temperature — {settings.temperature.toFixed(1)}</label>
        <input
          type="range"
          className="settings-range"
          min={0} max={1} step={0.1}
          value={settings.temperature}
          onChange={(e) => set('temperature', parseFloat(e.target.value))}
        />
        <div className="range-labels"><span>Precise</span><span>Creative</span></div>
      </div>

      <div className="settings-group">
        <div className="settings-toggle-row">
          <span className="settings-label">Web Search</span>
          <button
            className={`toggle-switch${settings.webSearchEnabled ? ' on' : ''}`}
            onClick={() => set('webSearchEnabled', !settings.webSearchEnabled)}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </div>


      <div className="settings-group">
        <div className="settings-toggle-row">
          <span className="settings-label">File Analysis</span>
          <button
            className={`toggle-switch${settings.fileAnalysisEnabled ? ' on' : ''}`}
            onClick={() => set('fileAnalysisEnabled', !settings.fileAnalysisEnabled)}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-toggle-row">
          <span className="settings-label">Code Execution</span>
          <button
            className={`toggle-switch${settings.codeExecutionEnabled ? ' on' : ''}`}
            onClick={() => set('codeExecutionEnabled', !settings.codeExecutionEnabled)}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </div>
      <div className="settings-group">
        <div className="settings-toggle-row">
          <span className="settings-label">Streaming</span>
          <button
            className={`toggle-switch${settings.streamingEnabled ? ' on' : ''}`}
            onClick={() => set('streamingEnabled', !settings.streamingEnabled)}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </div>

      <div className="settings-group">
        <label className="settings-label">System Prompt</label>
        <textarea
          className="settings-textarea"
          rows={6}
          value={settings.systemPrompt}
          onChange={(e) => set('systemPrompt', e.target.value)}
        />
      </div>

      <button
        className="settings-reset"
        onClick={() => set('systemPrompt', DEFAULT_SYSTEM_PROMPT)}
      >
        Reset system prompt
      </button>
    </div>
  );
}
