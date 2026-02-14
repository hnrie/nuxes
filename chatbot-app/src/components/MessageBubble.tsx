import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { User, Bot, AlertTriangle, Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { UIMessage } from '../types';
import AgentProgress from './AgentProgress';
import { getFileIcon, formatFileSize } from '../services/fileUtils';

interface MessageBubbleProps {
  message: UIMessage;
}

interface CopyButtonProps {
  text: string;
  label: string;
  className: string;
}

function extractCodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractCodeText).join('');
  }

  if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return extractCodeText(props?.children ?? '');
  }

  return '';
}

function CopyButton({ text, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      className={`${className}${copied ? ' copied' : ''}`}
      onClick={copy}
      title={label}
      aria-label={label}
      type="button"
    >
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
          {message.content && (
            <CopyButton
              text={message.content}
              label="Copy message"
              className="message-copy-btn"
            />
          )}
        </div>

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

        {isAssistant && message.agentSteps && message.agentSteps.length > 0 && (
          <AgentProgress steps={message.agentSteps} />
        )}

        {message.error && (
          <div className="message-error">
            <AlertTriangle size={14} />
            <span>{message.error}</span>
          </div>
        )}

        {message.content ? (
          <div className={`message-content ${isUser ? 'user-content' : 'assistant-content'}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeHighlight]}
              components={{
                pre: ({ children, ...props }) => {
                  const codeText = extractCodeText(children).replace(/\n$/, '');
                  return (
                    <div className="code-block-wrapper">
                      <pre {...props}>{children}</pre>
                      {codeText && (
                        <CopyButton
                          text={codeText}
                          label="Copy code"
                          className="copy-btn"
                        />
                      )}
                    </div>
                  );
                },
                a: ({ href, children, ...props }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>

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
