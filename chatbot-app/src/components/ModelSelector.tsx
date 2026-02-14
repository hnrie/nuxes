import { useState } from 'react';
import { ChevronDown, Zap } from 'lucide-react';
import { MODELS } from '../config/models';

interface ModelSelectorProps {
  selectedModel: string;
  onSelect: (modelId: string) => void;
}

export default function ModelSelector({ selectedModel, onSelect }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const current = MODELS.find((m) => m.id === selectedModel) ?? MODELS[0];

  const speedClass = (s: string) =>
    s === 'fast' ? 'speed-fast' : s === 'medium' ? 'speed-medium' : 'speed-slow';

  return (
    <div className="model-selector">
      <button className="model-trigger" onClick={() => setOpen((o) => !o)}>
        <Zap size={13} />
        <span className="model-trigger-name">{current.name}</span>
        <ChevronDown size={13} className={`model-chevron${open ? ' open' : ''}`} />
      </button>

      {open && (
        <>
          <div className="model-backdrop" onClick={() => setOpen(false)} />
          <div className="model-dropdown">
            {MODELS.map((m) => (
              <button
                key={m.id}
                className={`model-option${m.id === selectedModel ? ' selected' : ''}`}
                onClick={() => { onSelect(m.id); setOpen(false); }}
              >
                <div className="model-option-header">
                  <span className="model-option-name">{m.name}</span>
                  <span className={`model-speed ${speedClass(m.speed)}`}>{m.speed}</span>
                </div>
                <span className="model-option-desc">{m.description}</span>
                <span className="model-option-ctx">{m.contextWindow} context</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
