import React, { useState, useCallback } from 'react';
import {
  Plus, Check, Loader2, Clock, AlertCircle, Package, Zap,
  ChevronRight, ChevronDown, ChevronUp, ArrowLeft, Sparkles,
  Tag, TrendingUp, FileText, Camera, Mic, Hash, Eye, Pause,
  Pencil, MapPin, Shirt, Volume2, Image, Copy, Send, ExternalLink,
  Clipboard, ClipboardCheck,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import PipelineProgress from './PipelineProgress';
import ModeToggle from './ModeToggle';
import HookSelector from './HookSelector';
import type {
  UGCPipelineRun, UGCPipelineMode, UGCStepStatus, UGCStepName,
  ProductIntel, ContentStrategy, VideoScript, VisualPackage, AudioPackage, MetadataPackage,
} from '../../types/ugc';
import type { Persona } from '../../types';

// Import mock data
import mockRunData from '../../../ugc/sample-data/bbl-serum-package.json';

const mockRun = mockRunData as unknown as UGCPipelineRun;

interface UGCPipelineViewProps {
  personaId: string | null;
  persona: Persona | null;
  onCreatePost?: (run: UGCPipelineRun) => void;
}

export default function UGCPipelineView({ personaId, persona, onCreatePost }: UGCPipelineViewProps) {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  if (!personaId || !persona) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Zap className="w-12 h-12 mx-auto mb-3 text-gray-700" />
          <p className="text-lg">Select a persona to use UGC</p>
        </div>
      </div>
    );
  }

  if (activeRunId) {
    return <RunDetailView runId={activeRunId} persona={persona} onBack={() => setActiveRunId(null)} onCreatePost={onCreatePost} />;
  }

  return <RunListView personaId={personaId} onSelectRun={setActiveRunId} onNewRun={() => setActiveRunId('new')} />;
}

// =============================================================================
// List View — shows all pipeline runs for this persona
// =============================================================================

const MOCK_RUNS: UGCPipelineRun[] = [mockRun];

const STATUS_CONFIG = {
  complete: { icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Complete' },
  running:  { icon: Loader2, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Running' },
  error:    { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Error' },
};

function RunListView({ personaId, onSelectRun, onNewRun }: {
  personaId: string;
  onSelectRun: (id: string) => void;
  onNewRun: () => void;
}) {
  const runs = MOCK_RUNS;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-400" />
              UGC Video Factory
            </h2>
            <p className="text-sm text-gray-400 mt-1">Generate product-to-video content packages</p>
          </div>
          <button
            onClick={onNewRun}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-lg transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            New Video Package
          </button>
        </div>

        {/* Runs */}
        {runs.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No video packages yet</p>
            <p className="text-sm mt-2">Click "New Video Package" to generate your first UGC content package</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map(run => {
              const cfg = STATUS_CONFIG[run.status];
              const StatusIcon = cfg.icon;
              const completedSteps = run.steps.filter(s => s.status === 'complete' || s.status === 'edited').length;
              const pct = Math.round((completedSteps / run.steps.length) * 100);

              return (
                <button
                  key={run.id}
                  onClick={() => onSelectRun(run.id)}
                  className={cn(
                    'w-full text-left border rounded-xl p-5 transition-all hover:border-violet-500/40 hover:bg-gray-900/60 group',
                    cfg.border, 'bg-gray-900/40'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-white truncate">{run.productIntel?.productName ?? 'Untitled'}</h3>
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.bg, cfg.color)}>
                          <StatusIcon className={cn('w-3 h-3', run.status === 'running' && 'animate-spin')} />
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                        {run.startedAt && <span>{new Date(run.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                        {run.strategy?.hookFormat && <><span className="text-gray-700">·</span><span>{run.strategy.hookFormat}</span></>}
                        {run.script?.estimatedDuration && <><span className="text-gray-700">·</span><span>{run.script.estimatedDuration}</span></>}
                        {run.productIntel?.price != null && <><span className="text-gray-700">·</span><span>${run.productIntel.price}</span></>}
                        <span className="text-gray-700">·</span>
                        <span>{completedSteps}/{run.steps.length} steps</span>
                      </div>
                      {run.script?.selectedHook && (
                        <p className="text-sm text-gray-300 mt-2 line-clamp-1">Hook: "{run.script.selectedHook}"</p>
                      )}
                      {run.status === 'running' && (
                        <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-violet-500 to-rose-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-violet-400 transition-colors mt-1 flex-shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Run Detail View — shows pipeline steps for a single run
// =============================================================================

const STEP_TABS: { name: UGCStepName; label: string; icon: React.ReactNode }[] = [
  { name: 'product_intel', label: 'Product Intel', icon: <Tag className="w-3.5 h-3.5" /> },
  { name: 'strategy', label: 'Strategy', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { name: 'script', label: 'Script', icon: <FileText className="w-3.5 h-3.5" /> },
  { name: 'visuals', label: 'Visuals', icon: <Camera className="w-3.5 h-3.5" /> },
  { name: 'audio', label: 'Audio', icon: <Mic className="w-3.5 h-3.5" /> },
  { name: 'metadata', label: 'Metadata', icon: <Hash className="w-3.5 h-3.5" /> },
];

function RunDetailView({ runId, persona, onBack, onCreatePost }: {
  runId: string;
  persona: Persona;
  onBack: () => void;
  onCreatePost?: (run: UGCPipelineRun) => void;
}) {
  const isNew = runId === 'new';
  const [mode, setMode] = useState<UGCPipelineMode>('hitl');
  const [productUrl, setProductUrl] = useState(isNew ? '' : mockRun.productUrl);
  const [run, setRun] = useState<UGCPipelineRun | null>(isNew ? null : mockRun);
  const [activeTab, setActiveTab] = useState<UGCStepName>('product_intel');
  const [selectedHook, setSelectedHook] = useState(mockRun.script?.selectedHook ?? '');
  const [postCreated, setPostCreated] = useState(false);

  const handleGenerate = () => setRun(mockRun);

  const handleCreatePost = () => {
    if (run && onCreatePost) {
      onCreatePost(run);
      setPostCreated(true);
    }
  };

  const getStepStatus = (name: UGCStepName) => {
    return run?.steps.find(s => s.name === name)?.status ?? 'pending';
  };

  const getStepDuration = (name: UGCStepName) => {
    const ms = run?.steps.find(s => s.name === name)?.durationMs;
    return ms != null ? `${(ms / 1000).toFixed(1)}s` : null;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar — product info + actions */}
      <div className="flex-shrink-0 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          {/* Row 1: Back + product name + mode */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              {run?.productIntel ? (
                <div>
                  <h2 className="text-base font-semibold text-white">{run.productIntel.productName}</h2>
                  <p className="text-xs text-gray-500">{run.productIntel.brand} · ${run.productIntel.price} · {run.productIntel.category}</p>
                </div>
              ) : (
                <h2 className="text-base font-semibold text-white">New Video Package</h2>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ModeToggle mode={mode} onChange={setMode} disabled={run != null && run.status === 'running'} />
              {run?.status === 'complete' && (
                postCreated ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-400">
                    <Check className="w-3.5 h-3.5" /> Posted
                  </div>
                ) : (
                  <button onClick={handleCreatePost} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-colors">
                    <Send className="w-3.5 h-3.5" /> Create Post
                  </button>
                )
              )}
            </div>
          </div>

          {/* Row 2: URL input (for new runs) */}
          {!run && (
            <div className="flex gap-3 mb-3">
              <input
                type="text"
                value={productUrl}
                onChange={e => setProductUrl(e.target.value)}
                placeholder="Paste product URL or describe the product..."
                className="flex-1 bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 text-sm outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50"
              />
              <button
                onClick={handleGenerate}
                disabled={!productUrl.trim()}
                className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm font-semibold text-white transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Generate
              </button>
            </div>
          )}

          {/* Row 3: Step tabs */}
          {run && (
            <nav className="flex gap-1 -mb-px overflow-x-auto scrollbar-hide">
              {STEP_TABS.map(tab => {
                const status = getStepStatus(tab.name);
                const duration = getStepDuration(tab.name);
                const isActive = activeTab === tab.name;
                const isComplete = status === 'complete' || status === 'edited';
                const isRunning = status === 'running';
                const isPending = status === 'pending';

                return (
                  <button
                    key={tab.name}
                    onClick={() => setActiveTab(tab.name)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap',
                      isActive
                        ? 'border-violet-500 text-violet-300'
                        : 'border-transparent hover:border-gray-600',
                      isPending && !isActive ? 'text-gray-600' : '',
                      isComplete && !isActive ? 'text-gray-300' : '',
                      isRunning && !isActive ? 'text-amber-400' : '',
                    )}
                  >
                    {isComplete ? <Check className="w-3 h-3 text-emerald-400" /> :
                     isRunning ? <Loader2 className="w-3 h-3 animate-spin text-amber-400" /> :
                     <span className="text-gray-500">{tab.icon}</span>}
                    {tab.label}
                    {duration && isComplete && (
                      <span className="text-[10px] text-gray-600">({duration})</span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>

      {/* Content area — one step at a time */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          {/* Pre-generate: pipeline description */}
          {!run && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <PipelineStepInfo icon={<Tag className="w-4 h-4" />} label="Product Intel" desc="Extracts features, benefits, reviews, competitors, pricing from your product URL or description" model="haiku" />
                <PipelineStepInfo icon={<TrendingUp className="w-4 h-4" />} label="Strategy" desc="Picks hook format (price reveal, POV, discovery), content format, setting, outfit, posting time" model="sonnet" />
                <PipelineStepInfo icon={<FileText className="w-4 h-4" />} label="Script" desc="Writes 10 scored hooks, picks the best, creates a timed 4-section video script with voiceover tags" model="sonnet" />
                <PipelineStepInfo icon={<Camera className="w-4 h-4" />} label="Visual Prompts" desc="5 shot prompts with character locking from persona — copy to Freepik or Higgsfield" model="sonnet" />
                <PipelineStepInfo icon={<Mic className="w-4 h-4" />} label="Audio Direction" desc="ElevenLabs payload, trending sounds, mixing instructions" model="haiku" />
                <PipelineStepInfo icon={<Hash className="w-4 h-4" />} label="Metadata" desc="TikTok title, caption, 5 hashtags, posting schedule, pinned comment, auto-replies + Instagram caption" model="haiku" />
              </div>
              <p className="text-[11px] text-gray-600 text-center">
                Persona: <span className="text-gray-400">{persona.identity.fullName}</span> — character lock ensures visual consistency across all shots
              </p>
            </div>
          )}

          {/* Post-generate: active tab content */}
          {run && (
            <div>
              {activeTab === 'product_intel' && run.productIntel && <ProductIntelView data={run.productIntel} />}
              {activeTab === 'strategy' && run.strategy && <StrategyView data={run.strategy} />}
              {activeTab === 'script' && run.script && <ScriptView data={run.script} selectedHook={selectedHook} onSelectHook={setSelectedHook} />}
              {activeTab === 'visuals' && run.visuals && <VisualsView data={run.visuals} persona={persona} />}
              {activeTab === 'audio' && run.audio && <AudioView data={run.audio} />}
              {activeTab === 'metadata' && run.metadata && <MetadataView data={run.metadata} />}

              {/* No data for this step yet */}
              {activeTab === 'product_intel' && !run.productIntel && <StepPending label="Product Intel" />}
              {activeTab === 'strategy' && !run.strategy && <StepPending label="Strategy" />}
              {activeTab === 'script' && !run.script && <StepPending label="Script" />}
              {activeTab === 'visuals' && !run.visuals && <StepPending label="Visual Prompts" />}
              {activeTab === 'audio' && !run.audio && <StepPending label="Audio Direction" />}
              {activeTab === 'metadata' && !run.metadata && <StepPending label="Metadata" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepPending({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-gray-600">
      <div className="text-center">
        <Loader2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm">{label} — waiting for previous steps</p>
      </div>
    </div>
  );
}

// =============================================================================
// Step Card
// =============================================================================

const STATUS_STYLES: Record<UGCStepStatus, { icon: React.ReactNode; ring: string }> = {
  pending:  { icon: <span className="w-2 h-2 rounded-full bg-gray-600" />, ring: 'border-gray-800' },
  running:  { icon: <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />, ring: 'border-amber-500/40' },
  complete: { icon: <Check className="w-4 h-4 text-emerald-400" />, ring: 'border-emerald-500/30' },
  paused:   { icon: <Pause className="w-4 h-4 text-violet-400" />, ring: 'border-violet-500/40' },
  error:    { icon: <AlertCircle className="w-4 h-4 text-red-400" />, ring: 'border-red-500/40' },
  edited:   { icon: <Pencil className="w-4 h-4 text-blue-400" />, ring: 'border-blue-500/30' },
};

const STEP_LABELS: Record<UGCStepName, { label: string; icon: React.ReactNode }> = {
  product_intel: { label: 'Product Intel', icon: <Tag className="w-4 h-4" /> },
  strategy:      { label: 'Strategy', icon: <TrendingUp className="w-4 h-4" /> },
  script:        { label: 'Script', icon: <FileText className="w-4 h-4" /> },
  visuals:       { label: 'Visual Prompts', icon: <Camera className="w-4 h-4" /> },
  audio:         { label: 'Audio Direction', icon: <Mic className="w-4 h-4" /> },
  metadata:      { label: 'Metadata', icon: <Hash className="w-4 h-4" /> },
};

function StepCard({ name, step, expanded, onToggle, summary, reviewGate, children }: {
  name: UGCStepName;
  step: { status: UGCStepStatus; durationMs?: number };
  expanded?: boolean;
  onToggle: () => void;
  summary: string;
  reviewGate?: boolean;
  children: React.ReactNode;
}) {
  const ss = STATUS_STYLES[step.status];
  const info = STEP_LABELS[name];

  return (
    <div className={cn('border rounded-xl transition-all', ss.ring, 'bg-gray-900/40')}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-5 py-4 text-left">
        <div className="flex-shrink-0">{ss.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">{info.icon}</span>
            <span className="text-sm font-medium text-white">{info.label}</span>
            {reviewGate && step.status === 'complete' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-500/15 text-violet-400 border border-violet-500/20">
                <Eye className="w-2.5 h-2.5" /> Review
              </span>
            )}
            {step.durationMs != null && step.status !== 'pending' && step.status !== 'running' && (
              <span className="text-[11px] text-gray-600">({(step.durationMs / 1000).toFixed(1)}s)</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{summary}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t border-gray-800/50">{children}</div>
      )}
    </div>
  );
}

// =============================================================================
// Step 1: Product Intel
// =============================================================================

function ProductIntelView({ data }: { data: ProductIntel }) {
  return (
    <div className="space-y-5">
      {/* Hero row */}
      <div className="flex items-start gap-4 border border-gray-800 rounded-xl p-4 bg-gray-900/40">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-lg font-semibold text-white">{data.productName}</h4>
            {data.trendingStatus && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <TrendingUp className="w-3 h-3" /> Trending
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400">{data.brand} · {data.category}</p>
          <p className="text-sm text-gray-300 mt-2">{data.primaryBenefit}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-bold text-emerald-400">${data.price}</p>
          <p className="text-xs text-gray-500">{data.size}</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left */}
        <div className="space-y-4">
          <div>
            <SectionLabel>Key Features</SectionLabel>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {data.keyFeatures.map((f, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-gray-800 text-gray-300 border border-gray-700">{f}</span>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Pain Points Solved</SectionLabel>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {data.painPointsSolved.map((p, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-rose-500/10 text-rose-300 border border-rose-500/20">{p}</span>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Competitors</SectionLabel>
            <div className="space-y-1 mt-1.5">
              {data.competitorProducts.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-gray-800/50">
                  <span className="text-gray-300">{c.name}</span>
                  <span className="text-gray-500">${c.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Right */}
        <div className="space-y-4">
          <div className="border border-emerald-500/20 rounded-lg p-3 bg-emerald-500/5">
            <SectionLabel>Positive Reviews</SectionLabel>
            <ul className="mt-1.5 space-y-1">
              {data.reviewSentiment.positive.map((r, i) => (
                <li key={i} className="text-xs text-emerald-300 flex items-start gap-1.5">
                  <Check className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" /> {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-red-500/20 rounded-lg p-3 bg-red-500/5">
            <SectionLabel>Negative Reviews</SectionLabel>
            <ul className="mt-1.5 space-y-1">
              {data.reviewSentiment.negative.map((r, i) => (
                <li key={i} className="text-xs text-red-300 flex items-start gap-1.5">
                  <AlertCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" /> {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-gray-800 rounded-lg p-3 bg-gray-950/40">
            <SectionLabel>Target Audience</SectionLabel>
            <p className="text-sm text-gray-300 mt-1">{data.targetAudience}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Step 2: Strategy
// =============================================================================

function StrategyView({ data }: { data: ContentStrategy }) {
  return (
    <div className="space-y-5">
      {/* Primary decision */}
      <div className="border border-violet-500/30 rounded-xl p-4 bg-violet-500/5">
        <div className="flex items-center justify-between">
          <div>
            <SectionLabel>Hook Format</SectionLabel>
            <p className="text-lg font-semibold text-violet-300 mt-1 capitalize">{data.hookFormat.replace(/_/g, ' ')}</p>
          </div>
          <div className="text-right">
            <SectionLabel>Content Format</SectionLabel>
            <p className="text-lg font-semibold text-white mt-1 capitalize">{data.contentFormat.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">{data.hookRationale}</p>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-3">
        <InfoBlock label="Video Length" value={data.videoLength} />
        <InfoBlock label="Setting" value={data.setting.replace(/_/g, ' ')} />
        <InfoBlock label="Posting Time" value={data.optimalPostingTime} />
      </div>

      <div className="border border-gray-800 rounded-lg p-3 bg-gray-950/40">
        <SectionLabel>Character Outfit</SectionLabel>
        <p className="text-sm text-gray-300 mt-1">{data.characterOutfit}</p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <SectionLabel>Hashtag Strategy</SectionLabel>
          <CopyButton text={Object.values(data.hashtagStrategy).join(' ')} label="Copy All" />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {Object.entries(data.hashtagStrategy).map(([type, tag]) => (
            <span key={type} className="px-2.5 py-1 rounded-full text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20">
              {tag} <span className="text-violet-500/60 text-[10px]">({type})</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Step 3: Script
// =============================================================================

function ScriptView({ data, selectedHook, onSelectHook }: {
  data: VideoScript;
  selectedHook: string;
  onSelectHook: (h: string) => void;
}) {
  const [showAllHooks, setShowAllHooks] = useState(false);
  const sections = [
    { key: 'hook', label: 'Hook', color: 'text-rose-400', bg: 'border-rose-500/20', ...data.fullScript.hookSection },
    { key: 'product', label: 'Product', color: 'text-blue-400', bg: 'border-blue-500/20', ...data.fullScript.productSection },
    { key: 'trust', label: 'Trust', color: 'text-amber-400', bg: 'border-amber-500/20', ...data.fullScript.trustSection },
    { key: 'cta', label: 'CTA', color: 'text-emerald-400', bg: 'border-emerald-500/20', ...data.fullScript.ctaSection },
  ];

  const topHooks = showAllHooks ? data.hookVariants : data.hookVariants.filter(h => h.score >= 8).slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Script timeline */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Video Script ({data.estimatedDuration})</SectionLabel>
          <span className="text-xs text-gray-500">{data.totalWordCount} words</span>
        </div>
        <div className="space-y-1">
          {sections.map(sec => (
            <div key={sec.key} className={cn('border rounded-lg p-3 bg-gray-950/40', sec.bg)}>
              <div className="flex items-center gap-3 mb-1">
                <span className={cn('text-[10px] font-bold uppercase tracking-wider', sec.color)}>{sec.label}</span>
                <span className="text-[10px] text-gray-600 font-mono">{sec.timing}</span>
                <span className="text-[10px] text-gray-700 ml-auto">{sec.wordCount}w</span>
              </div>
              <p className="text-sm text-gray-200 leading-relaxed">{sec.voiceover}</p>
              <p className="text-[11px] text-gray-600 mt-1.5">Overlay: {sec.textOverlay}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Hook selector — compact */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Hook Variations</SectionLabel>
          <button onClick={() => setShowAllHooks(!showAllHooks)} className="text-[11px] text-violet-400 hover:text-violet-300">
            {showAllHooks ? 'Show top hooks' : `Show all ${data.hookVariants.length}`}
          </button>
        </div>
        <HookSelector hooks={topHooks} selectedHook={selectedHook} onSelect={onSelectHook} />
      </div>

      {/* ElevenLabs script — collapsed */}
      <div className="border border-gray-800 rounded-lg p-3 bg-gray-950/40">
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>ElevenLabs Script</SectionLabel>
          <CopyButton text={data.elevenlabsFullScript} label="Copy Script" />
        </div>
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{data.elevenlabsFullScript}</p>
      </div>
    </div>
  );
}

// =============================================================================
// Step 4: Visuals
// =============================================================================

function VisualsView({ data, persona }: { data: VisualPackage; persona?: Persona | null }) {
  const [expandedShot, setExpandedShot] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      {/* Persona references + character prompt */}
      <div className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
        <div className="flex items-start gap-4">
          {/* Reference images */}
          {persona?.referenceImageUrls && persona.referenceImageUrls.length > 0 && (
            <div className="flex gap-1.5 flex-shrink-0">
              {persona.referenceImageUrls.slice(0, 3).map((url, i) => (
                <img key={i} src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-700" />
              ))}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <SectionLabel>Character Lock</SectionLabel>
              <CopyButton text={data.baseCharacterPrompt} />
            </div>
            <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{data.baseCharacterPrompt}</p>
          </div>
        </div>
      </div>

      {/* Shot cards — compact grid */}
      <div>
        <SectionLabel>Shot Prompts ({data.shotPrompts.length} shots)</SectionLabel>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {data.shotPrompts.map((shot, i) => {
            const isExpanded = expandedShot === shot.shotId;
            return (
              <div key={shot.shotId} className="border border-gray-800 rounded-lg bg-gray-950/40 overflow-hidden">
                {/* Shot header — always visible */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="w-7 h-7 rounded-full bg-violet-500/15 text-violet-400 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white capitalize">{shot.purpose.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-gray-600 font-mono">{shot.timing}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{shot.compositionNotes}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <CopyButton text={shot.fullPrompt} label="Copy" />
                    <button
                      onClick={() => setExpandedShot(isExpanded ? null : shot.shotId)}
                      className="px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                {/* Expanded: full prompt */}
                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-gray-800/50">
                    <p className="text-xs text-gray-400 leading-relaxed mt-2">{shot.fullPrompt}</p>
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-600">
                      <span>Lighting: {shot.lighting}</span>
                      <span>Props: {shot.props.join(', ')}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Consistency */}
      <div className="border border-gray-800 rounded-lg p-3 bg-gray-950/40">
        <SectionLabel>Consistency Checklist</SectionLabel>
        <div className="grid grid-cols-2 gap-1 mt-1.5">
          {data.consistencyChecklist.map((item, i) => (
            <span key={i} className="text-[11px] text-gray-400 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" /> {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Step 5: Audio
// =============================================================================

function AudioView({ data }: { data: AudioPackage }) {
  return (
    <div className="space-y-5">
      {/* Voice settings + recommended voice */}
      <div className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>ElevenLabs Voice</SectionLabel>
          {data.elevenlabsPayload.recommendedStockVoice && (
            <span className="text-xs text-violet-400 font-medium">{data.elevenlabsPayload.recommendedStockVoice.name}</span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-3">
          <MiniStat label="Stability" value={String(data.elevenlabsPayload.voiceSettings.stability)} />
          <MiniStat label="Similarity" value={String(data.elevenlabsPayload.voiceSettings.similarityBoost)} />
          <MiniStat label="Style" value={String(data.elevenlabsPayload.voiceSettings.style)} />
          <MiniStat label="Format" value={data.elevenlabsPayload.outputFormat.split('_')[0]} />
        </div>
      </div>

      {/* Sound options */}
      <div>
        <SectionLabel>Background Sound</SectionLabel>
        <div className="mt-2 space-y-2">
          {data.trendingSoundOptions.map((sound, i) => (
            <div key={i} className={cn('flex items-start gap-3 border rounded-lg p-3', sound.recommended ? 'border-violet-500/30 bg-violet-500/5' : 'border-gray-800 bg-gray-950/40')}>
              <Volume2 className={cn('w-4 h-4 mt-0.5 flex-shrink-0', sound.recommended ? 'text-violet-400' : 'text-gray-600')} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{sound.soundName}</span>
                  {sound.recommended && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-500/15 text-violet-400">Recommended</span>}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">{sound.notes}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mixing */}
      <div className="grid grid-cols-4 gap-3">
        <MiniStat label="Voice Vol" value={data.audioMixingInstructions.voiceoverVolume} />
        <MiniStat label="BG Vol" value={data.audioMixingInstructions.backgroundSoundVolume} />
        <MiniStat label="Fade In" value={data.audioMixingInstructions.fadeInDuration} />
        <MiniStat label="Fade Out" value={data.audioMixingInstructions.fadeOutDuration} />
      </div>
    </div>
  );
}

// =============================================================================
// Step 6: Metadata
// =============================================================================

function MetadataView({ data }: { data: MetadataPackage }) {
  const [platform, setPlatform] = useState<'tiktok' | 'instagram'>('tiktok');

  return (
    <div className="space-y-4">
      {/* Platform toggle */}
      <div className="flex bg-gray-800 rounded-lg overflow-hidden w-fit">
        <button onClick={() => setPlatform('tiktok')} className={cn('px-4 py-2 text-sm font-medium transition-colors', platform === 'tiktok' ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white')}>
          TikTok
        </button>
        <button onClick={() => setPlatform('instagram')} className={cn('px-4 py-2 text-sm font-medium transition-colors', platform === 'instagram' ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white')}>
          Instagram
        </button>
      </div>

      {platform === 'tiktok' ? (
        <div className="space-y-4">
          {/* Title */}
          <div className="border border-gray-800 rounded-lg p-4 bg-gray-950/40">
            <div className="flex items-center justify-between mb-1">
              <SectionLabel>Title</SectionLabel>
              <CopyButton text={data.tiktok.title} />
            </div>
            <p className="text-sm text-gray-200">{data.tiktok.title}</p>
          </div>

          {/* Caption */}
          <div className="border border-gray-800 rounded-lg p-4 bg-gray-950/40">
            <div className="flex items-center justify-between mb-1">
              <SectionLabel>Caption</SectionLabel>
              <CopyButton text={data.tiktok.caption} />
            </div>
            <p className="text-sm text-gray-200 whitespace-pre-line leading-relaxed">{data.tiktok.caption}</p>
          </div>

          {/* Hashtags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <SectionLabel>Hashtags</SectionLabel>
              <CopyButton text={data.tiktok.hashtags.map(h => h.tag).join(' ')} label="Copy All" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.tiktok.hashtags.map((h, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20">{h.tag}</span>
              ))}
            </div>
          </div>

          {/* Posting + Engagement side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-gray-800 rounded-lg p-3 bg-gray-950/40">
              <SectionLabel>Posting Schedule</SectionLabel>
              <p className="text-sm text-white mt-1 font-medium">{data.tiktok.postingSchedule.optimalTime}</p>
              <p className="text-xs text-gray-400">{data.tiktok.postingSchedule.dayOfWeek}</p>
              <p className="text-[11px] text-gray-600 mt-1">{data.tiktok.postingSchedule.rationale}</p>
            </div>
            <div className="border border-gray-800 rounded-lg p-3 bg-gray-950/40">
              <div className="flex items-center justify-between">
                <SectionLabel>Pinned Comment</SectionLabel>
                <CopyButton text={data.tiktok.engagementStrategy.pinComment} />
              </div>
              <p className="text-sm text-gray-300 mt-1 italic leading-relaxed">"{data.tiktok.engagementStrategy.pinComment}"</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-gray-800 rounded-lg p-4 bg-gray-950/40">
            <div className="flex items-center justify-between mb-1">
              <SectionLabel>Caption</SectionLabel>
              <CopyButton text={data.instagram.caption} />
            </div>
            <p className="text-sm text-gray-200 whitespace-pre-line leading-relaxed">{data.instagram.caption}</p>
          </div>
          {data.instagram.brandMentions.length > 0 && (
            <div>
              <SectionLabel>Brand Mentions</SectionLabel>
              <div className="flex gap-1.5 mt-1.5">
                {data.instagram.brandMentions.map((m, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20">{m}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Shared helpers
// =============================================================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">{children}</p>;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
        copied
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : 'bg-gray-800/60 text-gray-400 border-gray-700 hover:text-white hover:border-gray-500'
      )}
    >
      {copied ? <ClipboardCheck className="w-3 h-3" /> : <Clipboard className="w-3 h-3" />}
      {copied ? 'Copied!' : (label || 'Copy')}
    </button>
  );
}

function InfoBlock({ label, value, note, highlight }: { label: string; value: string; note?: string; highlight?: boolean }) {
  return (
    <div className={cn('border rounded-lg p-3', highlight ? 'border-violet-500/30 bg-violet-500/5' : 'border-gray-800 bg-gray-950/40')}>
      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">{label}</p>
      <p className={cn('text-sm font-medium mt-1', highlight ? 'text-violet-300' : 'text-white')}>{value}</p>
      {note && <p className="text-[11px] text-gray-500 mt-1">{note}</p>}
    </div>
  );
}

function PipelineStepInfo({ icon, label, desc, model }: { icon: React.ReactNode; label: string; desc: string; model: 'sonnet' | 'haiku' }) {
  return (
    <div className="border border-gray-800 rounded-lg p-3 bg-gray-950/40 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-violet-400">{icon}</span>
        <span className="text-xs font-medium text-white">{label}</span>
        <span className={cn(
          'ml-auto px-1.5 py-0.5 rounded text-[9px] font-medium',
          model === 'sonnet' ? 'bg-violet-500/10 text-violet-400' : 'bg-gray-800 text-gray-500'
        )}>
          {model}
        </span>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-800 rounded-lg p-2.5 bg-gray-950/40">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="text-sm font-medium text-white mt-0.5">{value}</p>
    </div>
  );
}
