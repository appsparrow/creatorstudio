import React from 'react';
import { Check, Loader2, Pause, AlertCircle, Pencil } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { UGCPipelineStep, UGCStepStatus } from '../../types/ugc';
import { UGC_STEP_LABELS } from '../../types/ugc';

interface PipelineProgressProps {
  steps: UGCPipelineStep[];
}

const STATUS_CONFIG: Record<UGCStepStatus, { icon: React.ReactNode; color: string; bg: string }> = {
  pending:  { icon: <span className="w-2 h-2 rounded-full bg-gray-600" />, color: 'text-gray-500', bg: 'bg-gray-800/40' },
  running:  { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  complete: { icon: <Check className="w-3.5 h-3.5" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  paused:   { icon: <Pause className="w-3.5 h-3.5" />, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  error:    { icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'text-red-400', bg: 'bg-red-500/10' },
  edited:   { icon: <Pencil className="w-3.5 h-3.5" />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

export default function PipelineProgress({ steps }: PipelineProgressProps) {
  const completed = steps.filter(s => s.status === 'complete' || s.status === 'edited').length;
  const total = steps.length;
  const pct = Math.round((completed / total) * 100);

  return (
    <div className="space-y-3">
      {/* Step pills */}
      <div className="flex flex-wrap gap-2">
        {steps.map((step) => {
          const cfg = STATUS_CONFIG[step.status];
          return (
            <div
              key={step.name}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                cfg.bg, cfg.color,
                step.status === 'pending' ? 'border-gray-800' : 'border-transparent'
              )}
            >
              {cfg.icon}
              <span>{UGC_STEP_LABELS[step.name]}</span>
              {step.durationMs != null && step.status !== 'pending' && step.status !== 'running' && (
                <span className="text-[10px] opacity-60">({(step.durationMs / 1000).toFixed(1)}s)</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-rose-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 tabular-nums w-8 text-right">{pct}%</span>
      </div>
    </div>
  );
}
