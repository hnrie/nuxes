import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { User, Bot, AlertTriangle, Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';
import type { UIMessage } from '../types';
import AgentProgress from './AgentProgress';
import { getFileIcon, formatFileSize } from '../services/fileUtils';

interface MessageBubbleProps {
  message: UIMessage;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button className="copy-btn" onClick={copy} title="Copy code" aria-label="Copy code">
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const formattedTime = message.timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
      <div className="message-avatar">
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className="message-body">
        <div className="message-meta">
          <span className="message-author">{isUser ? 'You' : 'Nexus'}</span>
          <span className="message-time">{formattedTime}</span>
        </div>

        {/* File attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((file) => (
              <div key={file.id} className="attachment-chip">
                <span className="attachment-icon">{getFileIcon(file.type, file.name)}</span>
                <span className="attachment-name">{file.name}</span>
                <span className="attachment-size">{formatFileSize(file.size)}</span>
                {file.isImage && (
                  <img
                    src={`data:${file.type};base64,${file.content}`}
                    alt={file.name}
                    className="attachment-preview"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Agent steps */}
        {isAssistant && message.agentSteps && message.agentSteps.length > 0 && (
          <AgentProgress steps={message.agentSteps} />
        )}

        {/* Error state */}
        {message.error && (
          <div className="message-error">
            <AlertTriangle size={14} />
            <span>{message.error}</span>
          </div>
        )}

        {/* Message content */}
        {message.content ? (
          <div className={`message-content ${isUser ? 'user-content' : 'assistant-content'}`}>
            {isAssistant ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  // Code blocks with copy button
                  pre: ({ children, ...props }) => {
                    const codeEl = Array.isArray(children) ? children[0] : children;
                    const codeText =
                      typeof codeEl === 'object' &&
                      codeEl !== null &&
                      'props' in codeEl
                        ? String((codeEl as { props: { children?: unknown } }).props.children ?? '')
                        : '';
                    return (
                      <div className="code-block-wrapper">
                        <pre {...props}>{children}</pre>
                        {codeText && <CopyButton text={codeText.trim()} />}
                      </div>
                    );
                  },
                  // Open links in new tab
                  a: ({ href, children, ...props }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : (
              <p className="user-text">{message.content}</p>
            )}

            {/* Streaming cursor */}
            {message.isStreaming && <span className="stream-cursor" aria-hidden="true" />}
          </div>
        ) : message.isStreaming ? (
          <div className="message-thinking">
            <span className="thinking-dot" />
            <span className="thinking-dot" />
            <span className="thinking-dot" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
