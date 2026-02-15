interface RenderedTitleProps {
  title: string;
  className?: string;
}

function cleantitle(title: string): string {
  return title
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$[^$]+\$/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function RenderedTitle({ title, className }: RenderedTitleProps) {
  return <span className={`rendered-title ${className ?? ''}`.trim()}>{cleantitle(title)}</span>;
}
