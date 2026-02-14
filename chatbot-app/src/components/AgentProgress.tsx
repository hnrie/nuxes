import { Search, Code, FileText, Loader, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { AgentStep } from '../types';

const TOOL_ICONS: Record<string, React.ReactNode> = {
  web_search: <Search size={13} />,
  run_code: <Code size={13} />,
  analyze_file: <FileText size={13} />,
};

const TOOL_LABELS: Record<string, string> = {
  web_search: 'Web Search',
  run_code: 'Run Code',
  analyze_file: 'Analyze File',
};

function parseInput(name: string, args: string): string {
  try {
    const parsed: Record<string, unknown> = JSON.parse(args);
    if (name === 'web_search') return String(parsed.query ?? args);
    if (name === 'run_code') return String(parsed.description ?? 'Running code…');
    if (name === 'analyze_file') return String(parsed.filename ?? args);
    return args;
  } catch {
    return args;
  }
}

function StepItem({ step }: { step: AgentStep }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon =
    step.status === 'running' ? (
      <Loader size={12} className="spin" />
    ) : step.status === 'done' ? (
      <CheckCircle size={12} />
    ) : (
      <AlertCircle size={12} />
    );

  const label = TOOL_LABELS[step.toolName] ?? step.toolName;
  const inputPreview = parseInput(step.toolName, step.input);

  return (
    <div className={`agent-step status-${step.status}`}>
      <div className="agent-step-header" onClick={() => step.output && setExpanded((v) => !v)}>
        <span className="agent-step-icon">{TOOL_ICONS[step.toolName] ?? <Code size={13} />}</span>
        <span className="agent-step-label">{label}</span>
        <span className="agent-step-input" title={inputPreview}>
          {inputPreview.length > 48 ? inputPreview.substring(0, 48) + '…' : inputPreview}
        </span>
        <span className="agent-step-status">{statusIcon}</span>
        {step.output && (
          <ChevronDown size={12} className={`agent-step-chevron ${expanded ? 'open' : ''}`} />
        )}
      </div>

      {expanded && step.output && (
        <div className="agent-step-output">
          <pre>{step.output.substring(0, 1200)}{step.output.length > 1200 ? '\n…' : ''}</pre>
        </div>
      )}
    </div>
  );
}

interface AgentProgressProps {
  steps: AgentStep[];
}

export default function AgentProgress({ steps }: AgentProgressProps) {
  if (steps.length === 0) return null;

  const running = steps.filter((s) => s.status === 'running').length;

  return (
    <div className="agent-progress">
      <div className="agent-progress-title">
        {running > 0 ? (
          <>
            <Loader size={12} className="spin" />
            <span>Running agent tasks…</span>
          </>
        ) : (
          <>
            <CheckCircle size={12} />
            <span>Agent completed {steps.length} task{steps.length !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>
      <div className="agent-steps-list">
        {steps.map((step) => (
          <StepItem key={step.id} step={step} />
        ))}
      </div>
    </div>
  );
}
