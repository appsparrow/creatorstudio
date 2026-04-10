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
    <div className="inline-flex rounded-lg border border-gray-700 bg-gray-900/60 p-0.5">
      <button
        onClick={() => onChange('auto')}
        disabled={disabled}
        className={cn(
          'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          mode === 'auto'
            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
            : 'text-gray-400 hover:text-gray-200 border border-transparent'
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
            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
            : 'text-gray-400 hover:text-gray-200 border border-transparent'
        )}
      >
        HITL
      </button>
    </div>
  );
}
