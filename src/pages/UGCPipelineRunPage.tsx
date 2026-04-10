import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, ChevronDown, ChevronUp, Check, Loader2,
  Pause, AlertCircle, Pencil, DollarSign, Tag, Star, TrendingUp,
  Clock, MapPin, Shirt, Hash, MessageSquare, Play, Volume2,
  Image, Copy, Eye, Camera, Mic, FileText, Send, ExternalLink,
} from 'lucide-react';
import { cn } from '../lib/utils';
import PipelineProgress from '../components/ugc/PipelineProgress';
import ModeToggle from '../components/ugc/ModeToggle';
import HookSelector from '../components/ugc/HookSelector';
import type {
  UGCPipelineRun, UGCPipelineMode, UGCStepStatus, UGCStepName,
  ProductIntel, ContentStrategy, VideoScript, VisualPackage, AudioPackage, MetadataPackage,
} from '../types/ugc';

import mockRunData from '../../ugc/sample-data/bbl-serum-package.json';

const mockRun = mockRunData as unknown as UGCPipelineRun;

export default function UGCPipelineRunPage() {
  const { personaId, runId } = useParams();
  const isNew = runId === 'new';

  const [mode, setMode] = useState<UGCPipelineMode>(mockRun.mode);
  const [productUrl, setProductUrl] = useState(isNew ? '' : mockRun.productUrl);
  const [run, setRun] = useState<UGCPipelineRun | null>(isNew ? null : mockRun);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({
    script: true, // default expand script step
  });
  const [selectedHook, setSelectedHook] = useState(mockRun.script?.selectedHook ?? '');

  const toggleStep = (name: string) => {
    setExpandedSteps(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleGenerate = () => {
    // For mock: simulate loading then show the mock data
    setRun(mockRun);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back nav + mode toggle */}
      <div className="flex items-center justify-between">
        <Link
          to={`/persona/${personaId}/ugc`}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to UGC
        </Link>
        <ModeToggle mode={mode} onChange={setMode} disabled={run != null && run.status === 'running'} />
      </div>

      {/* URL Input */}
      <div className="flex gap-3">
        <input
          type="url"
          value={productUrl}
          onChange={e => setProductUrl(e.target.value)}
          placeholder="Paste product URL (Amazon, TikTok Shop...) or describe the product"
          className="flex-1 bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 text-sm outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50"
        />
        <button
          onClick={handleGenerate}
          disabled={!productUrl.trim()}
          className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm font-semibold text-white transition-colors flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Generate
        </button>
      </div>

      {/* Pipeline content */}
      {run && (
        <>
          {/* Progress bar */}
          <PipelineProgress steps={run.steps} />

          {/* Step cards */}
          <div className="space-y-3">
            {/* Step 1: Product Intel */}
            {run.productIntel && (
              <StepCard
                name="product_intel"
                step={run.steps[0]}
                expanded={expandedSteps.product_intel}
                onToggle={() => toggleStep('product_intel')}
                summary={`${run.productIntel.productName} · $${run.productIntel.price} · ${run.productIntel.category}`}
              >
                <ProductIntelView data={run.productIntel} />
              </StepCard>
            )}

            {/* Step 2: Strategy */}
            {run.strategy && (
              <StepCard
                name="strategy"
                step={run.steps[1]}
                expanded={expandedSteps.strategy}
                onToggle={() => toggleStep('strategy')}
                summary={`${run.strategy.hookFormat} · ${run.strategy.contentFormat} · ${run.strategy.videoLength}`}
                reviewGate
              >
                <StrategyView data={run.strategy} />
              </StepCard>
            )}

            {/* Step 3: Script */}
            {run.script && (
              <StepCard
                name="script"
                step={run.steps[2]}
                expanded={expandedSteps.script}
                onToggle={() => toggleStep('script')}
                summary={`"${run.script.selectedHook}" · ${run.script.totalWordCount} words · ${run.script.estimatedDuration}`}
                reviewGate
              >
                <ScriptView
                  data={run.script}
                  selectedHook={selectedHook}
                  onSelectHook={setSelectedHook}
                />
              </StepCard>
            )}

            {/* Step 4: Visuals */}
            {run.visuals && (
              <StepCard
                name="visuals"
                step={run.steps[3]}
                expanded={expandedSteps.visuals}
                onToggle={() => toggleStep('visuals')}
                summary={`${run.visuals.shotPrompts.length} shots · ${run.visuals.imageGenerationSettings.aspectRatio} · ${run.visuals.imageGenerationSettings.style}`}
              >
                <VisualsView data={run.visuals} />
              </StepCard>
            )}

            {/* Step 5: Audio */}
            {run.audio && (
              <StepCard
                name="audio"
                step={run.steps[4]}
                expanded={expandedSteps.audio}
                onToggle={() => toggleStep('audio')}
                summary={`${run.audio.trendingSoundOptions.find(s => s.recommended)?.soundName ?? 'No sound'} · ElevenLabs ready`}
              >
                <AudioView data={run.audio} />
              </StepCard>
            )}

            {/* Step 6: Metadata */}
            {run.metadata && (
              <StepCard
                name="metadata"
                step={run.steps[5]}
                expanded={expandedSteps.metadata}
                onToggle={() => toggleStep('metadata')}
                summary={`TikTok + Instagram · ${run.metadata.tiktok.hashtags.length} hashtags`}
              >
                <MetadataView data={run.metadata} />
              </StepCard>
            )}
          </div>

          {/* Bottom actions */}
          {run.status === 'complete' && (
            <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
              <button className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold text-white transition-colors flex items-center gap-2">
                <Send className="w-4 h-4" />
                Create Post in Calendar
              </button>
              <button className="px-4 py-2.5 rounded-xl border border-gray-700 text-sm font-medium text-gray-300 hover:border-gray-500 hover:text-white transition-colors flex items-center gap-2">
                <Copy className="w-4 h-4" />
                Export JSON
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// Step Card wrapper
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

interface StepCardProps {
  name: UGCStepName;
  step: { status: UGCStepStatus; durationMs?: number };
  expanded?: boolean;
  onToggle: () => void;
  summary: string;
  reviewGate?: boolean;
  children: React.ReactNode;
}

function StepCard({ name, step, expanded, onToggle, summary, reviewGate, children }: StepCardProps) {
  const statusStyle = STATUS_STYLES[step.status];
  const stepInfo = STEP_LABELS[name];

  return (
    <div className={cn('border rounded-xl transition-all', statusStyle.ring, 'bg-gray-900/40')}>
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        {/* Status icon */}
        <div className="flex-shrink-0">{statusStyle.icon}</div>

        {/* Step info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">{stepInfo.icon}</span>
            <span className="text-sm font-medium text-white">{stepInfo.label}</span>
            {reviewGate && step.status === 'complete' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-500/15 text-violet-400 border border-violet-500/20">
                <Eye className="w-2.5 h-2.5" /> Review
              </span>
            )}
            {step.durationMs != null && (
              <span className="text-[11px] text-gray-600">({(step.durationMs / 1000).toFixed(1)}s)</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{summary}</p>
        </div>

        {/* Expand chevron */}
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-500" />
          : <ChevronDown className="w-4 h-4 text-gray-500" />
        }
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t border-gray-800/50">
          {children}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Step 1: Product Intel
// =============================================================================

function ProductIntelView({ data }: { data: ProductIntel }) {
  return (
    <div className="space-y-4 pt-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-base font-semibold text-white">{data.productName}</h4>
          <p className="text-sm text-gray-400">{data.brand} · {data.category} / {data.subcategory}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-400">${data.price}</p>
          <p className="text-xs text-gray-500">{data.currency} · {data.size}</p>
        </div>
      </div>

      {/* Key features */}
      <div>
        <Label>Key Features</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {data.keyFeatures.map((f, i) => (
            <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-gray-800 text-gray-300 border border-gray-700">{f}</span>
          ))}
        </div>
      </div>

      {/* Primary benefit */}
      <div>
        <Label>Primary Benefit</Label>
        <p className="text-sm text-gray-300 mt-1">{data.primaryBenefit}</p>
      </div>

      {/* Pain points */}
      <div>
        <Label>Pain Points Solved</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {data.painPointsSolved.map((p, i) => (
            <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-rose-500/10 text-rose-300 border border-rose-500/20">{p}</span>
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Positive Reviews</Label>
          <ul className="mt-1 space-y-1">
            {data.reviewSentiment.positive.map((r, i) => (
              <li key={i} className="text-xs text-emerald-300 flex items-start gap-1.5">
                <span className="text-emerald-500 mt-0.5">+</span> {r}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Label>Negative Reviews</Label>
          <ul className="mt-1 space-y-1">
            {data.reviewSentiment.negative.map((r, i) => (
              <li key={i} className="text-xs text-red-300 flex items-start gap-1.5">
                <span className="text-red-500 mt-0.5">-</span> {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Competitors */}
      <div>
        <Label>Competitors</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {data.competitorProducts.map((c, i) => (
            <span key={i} className="px-2.5 py-1 rounded-lg text-xs bg-gray-800 text-gray-300 border border-gray-700">
              {c.name} · <span className="text-gray-500">${c.price}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-800/50">
        <span>Target: {data.targetAudience}</span>
        {data.trendingStatus && (
          <span className="flex items-center gap-1 text-amber-400">
            <TrendingUp className="w-3 h-3" /> Trending
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Step 2: Strategy
// =============================================================================

function StrategyView({ data }: { data: ContentStrategy }) {
  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <InfoBlock label="Hook Format" value={data.hookFormat} note={data.hookRationale} highlight />
        <InfoBlock label="Content Format" value={data.contentFormat} note={data.contentRationale} />
        <InfoBlock label="Video Length" value={data.videoLength} />
        <InfoBlock label="Setting" value={data.setting} icon={<MapPin className="w-3.5 h-3.5" />} />
        <InfoBlock label="Character Outfit" value={data.characterOutfit} icon={<Shirt className="w-3.5 h-3.5" />} />
        <InfoBlock label="Optimal Posting" value={data.optimalPostingTime} note={data.postingRationale} icon={<Clock className="w-3.5 h-3.5" />} />
      </div>

      {/* Hashtag strategy */}
      <div>
        <Label>Hashtag Strategy</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {Object.entries(data.hashtagStrategy).map(([type, tag]) => (
            <span key={type} className="px-2.5 py-1 rounded-full text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20">
              {tag} <span className="text-violet-500 text-[10px]">({type})</span>
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
  const sections = [
    { key: 'hookSection', label: 'Hook', ...data.fullScript.hookSection },
    { key: 'productSection', label: 'Product', ...data.fullScript.productSection },
    { key: 'trustSection', label: 'Trust', ...data.fullScript.trustSection },
    { key: 'ctaSection', label: 'CTA', ...data.fullScript.ctaSection },
  ];

  return (
    <div className="space-y-5 pt-4">
      {/* Script sections */}
      <div>
        <Label>Full Script</Label>
        <div className="mt-2 space-y-2">
          {sections.map(sec => (
            <div key={sec.key} className="border border-gray-800 rounded-lg p-3 bg-gray-950/40">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-violet-400">{sec.label}</span>
                <span className="text-[10px] text-gray-600">{sec.timing} · {sec.wordCount} words</span>
              </div>
              <p className="text-sm text-gray-200 leading-relaxed">{sec.voiceover}</p>
              <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
                <span className="flex items-center gap-1"><TypeIcon className="w-3 h-3" /> {sec.textOverlay}</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {sec.visualCue}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span>Total: {data.totalWordCount} words</span>
          <span>~{data.estimatedDuration}</span>
        </div>
      </div>

      {/* Hook selector */}
      <div>
        <Label>Hook Variations (pick one)</Label>
        <div className="mt-2">
          <HookSelector
            hooks={data.hookVariants}
            selectedHook={selectedHook}
            onSelect={onSelectHook}
          />
        </div>
      </div>

      {/* ElevenLabs preview */}
      <div>
        <Label>ElevenLabs Script</Label>
        <pre className="mt-1 text-xs text-gray-400 bg-gray-950 border border-gray-800 rounded-lg p-3 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
          {data.elevenlabsFullScript}
        </pre>
      </div>
    </div>
  );
}

// =============================================================================
// Step 4: Visuals
// =============================================================================

function VisualsView({ data }: { data: VisualPackage }) {
  return (
    <div className="space-y-4 pt-4">
      {/* Base character prompt */}
      <div>
        <Label>Base Character Prompt</Label>
        <p className="text-xs text-gray-400 bg-gray-950 border border-gray-800 rounded-lg p-3 mt-1 leading-relaxed">
          {data.baseCharacterPrompt}
        </p>
      </div>

      {/* Shot prompts */}
      <div>
        <Label>Shot Prompts ({data.shotPrompts.length} shots)</Label>
        <div className="mt-2 space-y-2">
          {data.shotPrompts.map((shot, i) => (
            <div key={shot.shotId} className="border border-gray-800 rounded-lg p-3 bg-gray-950/40">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-500/15 text-violet-400 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <span className="text-sm font-medium text-white capitalize">{shot.purpose.replace(/_/g, ' ')}</span>
                </div>
                <span className="text-[10px] text-gray-600">{shot.timing}</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{shot.fullPrompt}</p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500">
                <span>{shot.lighting}</span>
                <span>Props: {shot.props.join(', ')}</span>
              </div>
              <button className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors">
                <Image className="w-3 h-3" />
                Generate Image
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Consistency checklist */}
      <div>
        <Label>Consistency Checklist</Label>
        <ul className="mt-1 space-y-1">
          {data.consistencyChecklist.map((item, i) => (
            <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
              <Check className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" /> {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Image settings */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        {Object.entries(data.imageGenerationSettings).map(([k, v]) => (
          <span key={k} className="px-2 py-1 rounded bg-gray-800 border border-gray-700">{k}: {v}</span>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Step 5: Audio
// =============================================================================

function AudioView({ data }: { data: AudioPackage }) {
  const voiceSettings = data.elevenlabsPayload.voiceSettings;
  const recommended = data.trendingSoundOptions.find(s => s.recommended);

  return (
    <div className="space-y-4 pt-4">
      {/* ElevenLabs */}
      <div>
        <Label>ElevenLabs Voice Settings</Label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <MiniStat label="Stability" value={voiceSettings.stability.toString()} />
          <MiniStat label="Similarity Boost" value={voiceSettings.similarityBoost.toString()} />
          <MiniStat label="Style" value={voiceSettings.style.toString()} />
          <MiniStat label="Speaker Boost" value={voiceSettings.useSpeakerBoost ? 'On' : 'Off'} />
          {data.elevenlabsPayload.speed && (
            <MiniStat label="Speed" value={`${data.elevenlabsPayload.speed}x`} />
          )}
          <MiniStat label="Format" value={data.elevenlabsPayload.outputFormat} />
        </div>
        {data.elevenlabsPayload.recommendedStockVoice && (
          <p className="text-xs text-gray-500 mt-2">
            Recommended voice: <span className="text-violet-400">{data.elevenlabsPayload.recommendedStockVoice.name}</span>
          </p>
        )}
      </div>

      {/* Trending sounds */}
      <div>
        <Label>Sound Options</Label>
        <div className="mt-2 space-y-2">
          {data.trendingSoundOptions.map((sound, i) => (
            <div
              key={i}
              className={cn(
                'border rounded-lg p-3',
                sound.recommended
                  ? 'border-violet-500/30 bg-violet-500/5'
                  : 'border-gray-800 bg-gray-950/40'
              )}
            >
              <div className="flex items-center gap-2">
                <Volume2 className={cn('w-3.5 h-3.5', sound.recommended ? 'text-violet-400' : 'text-gray-500')} />
                <span className="text-sm font-medium text-white">{sound.soundName}</span>
                {sound.recommended && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-500/15 text-violet-400">Recommended</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">{sound.notes}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mixing instructions */}
      <div>
        <Label>Audio Mixing</Label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <MiniStat label="Voiceover Volume" value={data.audioMixingInstructions.voiceoverVolume} />
          <MiniStat label="Background Volume" value={data.audioMixingInstructions.backgroundSoundVolume} />
          <MiniStat label="Fade In" value={data.audioMixingInstructions.fadeInDuration} />
          <MiniStat label="Fade Out" value={data.audioMixingInstructions.fadeOutDuration} />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Step 6: Metadata
// =============================================================================

function MetadataView({ data }: { data: MetadataPackage }) {
  return (
    <div className="space-y-5 pt-4">
      {/* TikTok */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-white">TikTok</span>
          <span className="text-[10px] text-gray-600">{data.tiktok.titleCharCount} chars</span>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <p className="text-sm text-gray-300 mt-1">{data.tiktok.title}</p>
          </div>

          <div>
            <Label>Caption</Label>
            <p className="text-sm text-gray-300 mt-1 whitespace-pre-line">{data.tiktok.caption}</p>
          </div>

          <div>
            <Label>Hashtags</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {data.tiktok.hashtags.map((h, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-full text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20"
                  title={h.rationale}
                >
                  {h.tag} <span className="text-violet-500 text-[10px]">({h.type})</span>
                </span>
              ))}
            </div>
          </div>

          <div>
            <Label>Posting Schedule</Label>
            <p className="text-sm text-gray-300 mt-1">
              {data.tiktok.postingSchedule.optimalTime} on {data.tiktok.postingSchedule.dayOfWeek}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{data.tiktok.postingSchedule.rationale}</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Backup: {data.tiktok.postingSchedule.backupTimes.join(', ')}
            </p>
          </div>

          <div>
            <Label>Engagement Strategy</Label>
            <div className="mt-1 space-y-2">
              <div className="border border-gray-800 rounded-lg p-3 bg-gray-950/40">
                <p className="text-[11px] text-gray-500 mb-1">Pinned Comment</p>
                <p className="text-sm text-gray-300">{data.tiktok.engagementStrategy.pinComment}</p>
              </div>
              {data.tiktok.engagementStrategy.autoReplyTriggers.map((trigger, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-400 font-mono whitespace-nowrap">"{trigger.keyword}"</span>
                  <span className="text-gray-500">{trigger.response}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Instagram */}
      <div className="pt-4 border-t border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-white">Instagram</span>
          <span className="text-[10px] text-gray-600">{data.instagram.hashtagsCount} hashtags</span>
        </div>

        <div>
          <Label>Caption</Label>
          <p className="text-sm text-gray-300 mt-1 whitespace-pre-line leading-relaxed">{data.instagram.caption}</p>
        </div>

        {data.instagram.brandMentions.length > 0 && (
          <div className="mt-3">
            <Label>Brand Mentions</Label>
            <div className="flex gap-1.5 mt-1">
              {data.instagram.brandMentions.map((m, i) => (
                <span key={i} className="px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20">{m}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Shared UI helpers
// =============================================================================

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">{children}</p>;
}

function TypeIcon({ className }: { className?: string }) {
  return <span className={cn('inline-block', className)}>T</span>;
}

function InfoBlock({ label, value, note, icon, highlight }: {
  label: string;
  value: string;
  note?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'border rounded-lg p-3',
      highlight ? 'border-violet-500/30 bg-violet-500/5' : 'border-gray-800 bg-gray-950/40'
    )}>
      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">{label}</p>
      <p className={cn('text-sm font-medium mt-1 flex items-center gap-1.5', highlight ? 'text-violet-300' : 'text-white')}>
        {icon && <span className="text-gray-500">{icon}</span>}
        {value}
      </p>
      {note && <p className="text-[11px] text-gray-500 mt-1">{note}</p>}
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
