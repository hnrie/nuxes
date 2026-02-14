import { useState, useRef, useCallback, type KeyboardEvent, type DragEvent } from 'react';
import { Paperclip, Send, Square, Globe } from 'lucide-react';
import type { AttachedFile } from '../types';
import { processFile } from '../services/fileUtils';

interface InputBarProps {
  onSend: (text: string, attachments: AttachedFile[]) => void;
  onStop: () => void;
  isLoading: boolean;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
}

export default function InputBar({
  onSend,
  onStop,
  isLoading,
  webSearchEnabled,
  onToggleWebSearch,
}: InputBarProps) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = (text.trim().length > 0 || files.length > 0) && !isLoading;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(text.trim(), files);
    setText('');
    setFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [canSend, onSend, text, files]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const addFiles = async (fileList: FileList) => {
    const processed = await Promise.all(Array.from(fileList).map(processFile));
    setFiles((prev) => [...prev, ...processed]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDragOver = (e: DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const fmtSize = (n: number) =>
    n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

  return (
    <div
      className={`input-bar-container${dragging ? ' dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="drag-overlay">
          <Paperclip size={28} />
          Drop files to attach
        </div>
      )}

      {/* Toolbar */}
      <div className="input-toolbar">
        <button
          className={`toolbar-btn${webSearchEnabled ? ' active' : ''}`}
          onClick={onToggleWebSearch}
          title="Toggle web search tool"
        >
          <Globe size={13} />
          Web Search Tool
        </button>
      </div>

      {/* Attachments */}
      {files.length > 0 && (
        <div className="attachment-strip">
          {files.map((f) => (
            <div key={f.id} className="attachment-item">
              {f.isImage ? (
                <img src={`data:${f.type};base64,${f.content}`} alt={f.name} className="attachment-thumb" />
              ) : (
                <span className="attachment-file-icon">📄</span>
              )}
              <div className="attachment-info">
                <span className="attachment-name">{f.name}</span>
                <span className="attachment-size">{fmtSize(f.size)}</span>
              </div>
              <button className="attachment-remove" onClick={() => removeFile(f.id)}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="input-row">
        <button
          className="attach-btn"
          onClick={() => fileRef.current?.click()}
          disabled={isLoading}
          title="Attach file"
        >
          <Paperclip size={18} />
        </button>

        <textarea
          ref={textareaRef}
          className="message-textarea"
          placeholder="Message Nexus AI…"
          rows={1}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKey}
          disabled={isLoading}
        />

        {isLoading ? (
          <button className="send-btn stop-btn" onClick={onStop} title="Stop">
            <Square size={14} />
          </button>
        ) : (
          <button
            className={`send-btn${canSend ? ' ready' : ''}`}
            onClick={handleSend}
            disabled={!canSend}
            title="Send"
          >
            <Send size={15} />
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        className="file-input-hidden"
        multiple
        onChange={handleFileInput}
      />
    </div>
  );
}
