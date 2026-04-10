import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, Check, Loader2, Clock, AlertCircle, Package, Zap, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import ModeToggle from '../components/ugc/ModeToggle';
import type { UGCPipelineMode, UGCPipelineRun } from '../types/ugc';

// Mock data — will be replaced with API calls
import mockRunData from '../../ugc/sample-data/bbl-serum-package.json';

const MOCK_RUNS: UGCPipelineRun[] = [
  mockRunData as unknown as UGCPipelineRun,
];

const STATUS_CONFIG = {
  complete: { icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Complete' },
  running:  { icon: Loader2, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Running' },
  error:    { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Error' },
};

export default function UGCPipelinePage() {
  const { personaId } = useParams();
  const [mode, setMode] = useState<UGCPipelineMode>('hitl');
  const runs = MOCK_RUNS;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-violet-400" />
            UGC Video Factory
          </h2>
          <p className="text-sm text-gray-400 mt-1">Generate product-to-video content packages</p>
        </div>
        <div className="flex items-center gap-3">
          <ModeToggle mode={mode} onChange={setMode} />
          <Link
            to={`/persona/${personaId}/ugc/new`}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-lg transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            New Video Package
          </Link>
        </div>
      </div>

      {/* Runs list */}
      {runs.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No video packages yet</p>
          <p className="text-sm mt-2">Paste a product URL to generate your first UGC content package</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} personaId={personaId!} />
          ))}
        </div>
      )}
    </div>
  );
}

function RunCard({ run, personaId }: { run: UGCPipelineRun; personaId: string }) {
  const cfg = STATUS_CONFIG[run.status];
  const StatusIcon = cfg.icon;
  const completedSteps = run.steps.filter(s => s.status === 'complete' || s.status === 'edited').length;
  const totalSteps = run.steps.length;
  const pct = Math.round((completedSteps / totalSteps) * 100);

  const hookFormat = run.strategy?.hookFormat;
  const selectedHook = run.script?.selectedHook;
  const productName = run.productIntel?.productName ?? 'Untitled Product';
  const price = run.productIntel?.price;
  const duration = run.script?.estimatedDuration;

  const startDate = run.startedAt
    ? new Date(run.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  return (
    <Link
      to={`/persona/${personaId}/ugc/${run.id}`}
      className={cn(
        'block border rounded-xl p-5 transition-all hover:border-violet-500/40 hover:bg-gray-900/60 group',
        cfg.border, 'bg-gray-900/40'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-white truncate">{productName}</h3>
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              cfg.bg, cfg.color
            )}>
              <StatusIcon className={cn('w-3 h-3', run.status === 'running' && 'animate-spin')} />
              {cfg.label}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
            {startDate && <span>{startDate}</span>}
            {hookFormat && <><span className="text-gray-700">·</span><span>{hookFormat}</span></>}
            {duration && <><span className="text-gray-700">·</span><span>{duration}</span></>}
            {price != null && <><span className="text-gray-700">·</span><span>${price}</span></>}
            <span className="text-gray-700">·</span>
            <span>{completedSteps}/{totalSteps} steps</span>
          </div>

          {/* Hook preview */}
          {selectedHook && (
            <p className="text-sm text-gray-300 mt-2 line-clamp-1">
              Hook: "{selectedHook}"
            </p>
          )}

          {/* Progress bar for running */}
          {run.status === 'running' && (
            <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>

        <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-violet-400 transition-colors mt-1 flex-shrink-0" />
      </div>

      {/* Actions (only for complete runs) */}
      {run.status === 'complete' && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-800">
          <span className="text-xs text-violet-400 font-medium group-hover:text-violet-300">View Package</span>
          <span className="text-gray-700">·</span>
          <span className="text-xs text-gray-500">Create Post</span>
          <span className="text-gray-700">·</span>
          <span className="text-xs text-gray-500">Regenerate</span>
        </div>
      )}
    </Link>
  );
}
