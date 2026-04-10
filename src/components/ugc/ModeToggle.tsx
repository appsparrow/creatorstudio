import React from 'react';
import { cn } from '../../lib/utils';
import type { UGCPipelineMode } from '../../types/ugc';

interface ModeToggleProps {
  mode: UGCPipelineMode;
  onChange: (mode: UGCPipelineMode) => void;
  disabled?: boolean;
}

export default function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-border-light bg-surface-50/60 p-0.5">
      <button
        onClick={() => onChange('auto')}
        disabled={disabled}
        className={cn(
          'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          mode === 'auto'
            ? 'bg-accent-500/20 text-accent-300 border border-accent-500/40'
            : 'text-text-muted hover:text-text-primary border border-transparent'
        )}
      >
        Auto
      </button>
      <button
        onClick={() => onChange('hitl')}
        disabled={disabled}
        className={cn(
          'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          mode === 'hitl'
            ? 'bg-accent-500/20 text-accent-300 border border-accent-500/40'
            : 'text-text-muted hover:text-text-primary border border-transparent'
        )}
      >
        HITL
      </button>
    </div>
  );
}
