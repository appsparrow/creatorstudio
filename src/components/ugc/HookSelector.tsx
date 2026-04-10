import React from 'react';
import { cn } from '../../lib/utils';
import type { HookVariation } from '../../types/ugc';

interface HookSelectorProps {
  hooks: HookVariation[];
  selectedHook: string;
  onSelect: (hook: string) => void;
}

export default function HookSelector({ hooks, selectedHook, onSelect }: HookSelectorProps) {
  const sorted = [...hooks].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-1.5">
      {sorted.map((h, i) => (
        <button
          key={i}
          onClick={() => onSelect(h.hook)}
          className={cn(
            'w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-start gap-3',
            selectedHook === h.hook
              ? 'border-accent-500/50 bg-accent-500/10'
              : 'border-border bg-surface-50/40 hover:border-border-light'
          )}
        >
          <div className={cn(
            'mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
            selectedHook === h.hook ? 'border-accent-400 bg-accent-500/20' : 'border-border-light'
          )}>
            {selectedHook === h.hook && <div className="w-2 h-2 rounded-full bg-accent-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-sm',
              selectedHook === h.hook ? 'text-text-primary' : 'text-text-secondary'
            )}>
              "{h.hook}"
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">{h.rationale}</p>
          </div>
          <span className={cn(
            'text-xs font-bold tabular-nums px-1.5 py-0.5 rounded',
            h.score >= 9 ? 'text-emerald-400 bg-emerald-500/10' :
            h.score >= 7 ? 'text-amber-400 bg-amber-500/10' :
            'text-text-muted bg-surface-200'
          )}>
            {h.score}
          </span>
        </button>
      ))}
    </div>
  );
}
