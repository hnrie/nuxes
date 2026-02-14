import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface RenderedTitleProps {
  title: string;
  className?: string;
}

export default function RenderedTitle({ title, className }: RenderedTitleProps) {
  return (
    <ReactMarkdown
      className={`rendered-title ${className ?? ''}`.trim()}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <span>{children}</span>,
        a: ({ href, children, ...props }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
          </a>
        ),
      }}
    >
      {title}
    </ReactMarkdown>
  );
}
