import React, { useState, useCallback } from 'react';
import {
  Sparkles, Check, Loader2, AlertCircle, Tag, TrendingUp,
  FileText, Camera, Mic, Hash, Eye, Volume2, Image,
  ChevronDown, ChevronUp, Trash2, Clock,
  Clipboard, ClipboardCheck, Send, ExternalLink, Film,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import HookSelector from './HookSelector';
import type { ContentDay, Persona } from '../../types';
import type {
  UGCPipelineRun, UGCStepName,
  ProductIntel, ContentStrategy, VideoScript, VisualPackage, AudioPackage, MetadataPackage,
  HookVariation,
} from '../../types/ugc';

// Try to parse pipeline data from the day's notes field
function parsePipelineData(day: ContentDay): UGCPipelineRun | null {
  try {
    if (!day.notes) return null;
    const parsed = JSON.parse(day.notes);
    if (parsed.productIntel && parsed.steps) return parsed as UGCPipelineRun;
    return null;
  } catch {
    return null;
  }
}

interface UGCPostCardProps {
  day: ContentDay;
  persona: Persona | null;
  onUpdateField: (field: string, value: unknown) => void;
  onDelete: () => void;
}

type TabName = 'product_intel' | 'strategy' | 'script' | 'visuals' | 'audio' | 'metadata';

const TABS: { name: TabName; label: string; icon: React.ReactNode }[] = [
  { name: 'product_intel', label: 'Product Intel', icon: <Tag className="w-3.5 h-3.5" /> },
  { name: 'strategy', label: 'Strategy', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { name: 'script', label: 'Script', icon: <FileText className="w-3.5 h-3.5" /> },
  { name: 'visuals', label: 'Visuals', icon: <Camera className="w-3.5 h-3.5" /> },
  { name: 'audio', label: 'Audio', icon: <Mic className="w-3.5 h-3.5" /> },
  { name: 'metadata', label: 'Metadata', icon: <Hash className="w-3.5 h-3.5" /> },
];

export default function UGCPostCard({ day, persona, onUpdateField, onDelete }: UGCPostCardProps) {
  const pipelineData = parsePipelineData(day);
  const [productUrl, setProductUrl] = useState(day.productUrl || '');
  const [activeTab, setActiveTab] = useState<TabName>('product_intel');
  const [run, setRun] = useState<UGCPipelineRun | null>(pipelineData);
  const [isGenerating, setIsGenerating] = useState(day.status === 'generating');
  const [selectedHook, setSelectedHook] = useState(pipelineData?.script?.selectedHook ?? '');
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [showReadyChecklist, setShowReadyChecklist] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false);
  const [affiliateUrl, setAffiliateUrl] = useState<string>(() => {
    if (day.cta) return day.cta;
    const src = day.productUrl || '';
    return src.includes('amazon.com')
      ? src + (src.includes('?') ? '&' : '?') + 'tag=creatorstudio-20'
      : '';
  });

  // Update when day changes (e.g., pipeline completes)
  React.useEffect(() => {
    const newData = parsePipelineData(day);
    if (newData && (!run || run.id !== newData.id)) {
      setRun(newData);
      setSelectedHook(newData.script?.selectedHook ?? '');
      setIsGenerating(false);
    }
    if (day.status === 'generating') setIsGenerating(true);
    if (day.status === 'completed' && isGenerating) setIsGenerating(false);
  }, [day.notes, day.status]);

  const handleRegenerate = async () => {
    if (!productUrl.trim()) return;
    setIsGenerating(true);
    onUpdateField('status', 'generating');
    onUpdateField('theme', 'Regenerating...');
    try {
      const response = await fetch('/api/ugc/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productUrl, productText: productUrl, personaId: day.personaId, persona, mode: 'auto' }),
      });
      if (!response.ok) throw new Error('Pipeline failed');
      const result = await response.json();
      onUpdateField('notes', JSON.stringify(result));
      onUpdateField('theme', result.productIntel?.productName || '');
      onUpdateField('hook', result.script?.selectedHook || '');
      onUpdateField('status', 'completed');
      setRun(result);
      setSelectedHook(result.script?.selectedHook ?? '');
    } catch (err) {
      console.error('Regenerate error:', err);
      onUpdateField('status', 'draft');
    } finally {
      setIsGenerating(false);
    }
  };

  const getStepStatus = (name: TabName) => {
    if (!run) return 'pending';
    const step = run.steps.find(s => s.name === name);
    return step?.status ?? 'pending';
  };

  const getStepDuration = (name: TabName) => {
    const ms = run?.steps.find(s => s.name === name)?.durationMs;
    return ms != null ? `${(ms / 1000).toFixed(1)}s` : null;
  };

  const handleAffiliateUrlChange = (url: string) => {
    setAffiliateUrl(url);
    onUpdateField('cta', url);
  };

  const hasData = !!run;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 px-6 py-4 space-y-3">
        {/* Show product header if data exists, otherwise show input */}
        {hasData && !isGenerating ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {run.productIntel && (
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-white truncate">{run.productIntel.productName}</h2>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span>{run.productIntel.brand}</span>
                    <span className="text-gray-700">·</span>
                    <span className="text-emerald-400 font-medium">${run.productIntel.price}</span>
                    <span className="text-gray-700">·</span>
                    <span>{run.productIntel.category}</span>
                    {run.productIntel.trendingStatus && (
                      <span className="flex items-center gap-0.5 text-amber-400"><TrendingUp className="w-3 h-3" /> Trending</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Status badge */}
              <StatusBadge status={day.status} />

              {/* Published state — locked, show unpublish option */}
              {day.status === 'published' ? (
                <button
                  onClick={() => onUpdateField('status', 'completed')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-700 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
                >
                  Unpublish
                </button>
              ) : (
                <>
                  {/* Good to Post toggle — opens checklist if not yet approved */}
                  <button
                    onClick={() => {
                      if (day.isGoodToPost) {
                        onUpdateField('isGoodToPost', false);
                      } else {
                        setShowReadyChecklist(true);
                      }
                    }}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      day.isGoodToPost
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'text-gray-500 border-gray-700 hover:text-gray-300 hover:border-gray-500'
                    )}
                  >
                    <Check className="w-3 h-3" />
                    Good to Post
                  </button>

                  {/* Mark as Published — only when good to post */}
                  {day.isGoodToPost && day.status === 'completed' && (
                    <button
                      onClick={() => onUpdateField('status', 'published')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 transition-colors"
                    >
                      <Send className="w-3 h-3" />
                      Mark Published
                    </button>
                  )}
                </>
              )}

              <button
                onClick={() => setShowRegenConfirm(true)}
                disabled={isGenerating || day.status === 'published'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 border border-gray-700 hover:text-white hover:border-gray-500 disabled:opacity-30 transition-colors"
              >
                <Sparkles className="w-3 h-3" /> Regenerate
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              type="text"
              value={productUrl}
              onChange={e => setProductUrl(e.target.value)}
              placeholder="Paste product URL or describe the product..."
              className="flex-1 bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-500 text-sm outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50"
              disabled={isGenerating}
            />
            {isGenerating ? (
              <div className="px-5 py-2.5 rounded-xl bg-violet-600/50 text-sm font-semibold text-white flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Generating...
              </div>
            ) : (
              <button
                onClick={handleRegenerate}
                disabled={!productUrl.trim()}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm font-semibold text-white transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Generate
              </button>
            )}
          </div>
        )}

        {/* Progress bar while generating */}
        {isGenerating && (
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-rose-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        )}

        {/* nothing — product title is now in the header */}

        {/* Step tabs — only shown after generation starts */}
        {(run || isGenerating) && (
          <nav className="flex gap-1 -mb-3 overflow-x-auto scrollbar-hide">
            {TABS.map(tab => {
              const status = getStepStatus(tab.name);
              const duration = getStepDuration(tab.name);
              const isActive = activeTab === tab.name;
              const isComplete = status === 'complete' || status === 'edited';

              return (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap',
                    isActive ? 'border-violet-500 text-violet-300' : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700',
                  )}
                >
                  {isComplete ? <Check className="w-3 h-3 text-emerald-400" /> : <span className="text-gray-600">{tab.icon}</span>}
                  {tab.label}
                  {duration && isComplete && <span className="text-[10px] text-gray-600">({duration})</span>}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Before generation — waiting state */}
        {!run && !isGenerating && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Pipeline not started yet</p>
              <p className="text-gray-600 text-xs mt-1">Use "Regenerate" above to run the pipeline for this product</p>
            </div>
          </div>
        )}
        {/* REMOVED — old pipeline card grid. Generation now starts from the overlay popup */}
        {false && (
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {TABS.map(tab => (
                <div key={tab.name} className="border border-gray-800 rounded-lg p-3 bg-gray-950/40 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-violet-400">{tab.icon}</span>
                    <span className="text-xs font-medium text-gray-300">{tab.label}</span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    {tab.name === 'product_intel' && 'Extracts features, pricing, reviews, competitors'}
                    {tab.name === 'strategy' && 'Picks hook format, content format, setting, outfit'}
                    {tab.name === 'script' && '10 scored hooks + timed 4-section video script'}
                    {tab.name === 'visuals' && '5 shot prompts with character lock — copy to Freepik'}
                    {tab.name === 'audio' && 'ElevenLabs voice settings + trending sounds'}
                    {tab.name === 'metadata' && 'TikTok + Instagram captions, hashtags, schedule'}
                  </p>
                </div>
              ))}
            </div>
            {persona && (
              <p className="text-[11px] text-gray-600 text-center mt-4">
                Persona: <span className="text-gray-400">{persona.identity.fullName}</span>
              </p>
            )}
          </div>
        )}

        {/* Generating state */}
        {isGenerating && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Running pipeline...</p>
              <p className="text-xs text-gray-600 mt-1">Analyzing product, building strategy, writing script...</p>
            </div>
          </div>
        )}

        {/* Tab content */}
        {run && !isGenerating && (
          <div className="max-w-4xl mx-auto">
            {activeTab === 'product_intel' && run.productIntel && <ProductIntelTab data={run.productIntel} productUrl={day.productUrl} affiliateUrl={affiliateUrl} onUpdateField={onUpdateField} onAffiliateChange={handleAffiliateUrlChange} />}
            {activeTab === 'strategy' && run.strategy && <StrategyTab data={run.strategy} />}
            {activeTab === 'script' && run.script && <ScriptTab data={run.script} selectedHook={selectedHook} onSelectHook={setSelectedHook} />}
            {activeTab === 'visuals' && run.visuals && <VisualsTab data={run.visuals} persona={persona} script={run.script} />}
            {activeTab === 'audio' && run.audio && <AudioTab data={run.audio} />}
            {activeTab === 'metadata' && run.metadata && <MetadataTab data={run.metadata} affiliateUrl={affiliateUrl} productName={run.productIntel?.productName} />}
          </div>
        )}

        {/* Danger Zone */}
        <div className="max-w-4xl mx-auto mt-8 mb-2">
          <button
            onClick={() => setDangerZoneOpen(v => !v)}
            className="flex items-center gap-2 text-[11px] text-gray-600 hover:text-red-400 transition-colors"
          >
            {dangerZoneOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Danger Zone
          </button>
          {dangerZoneOpen && (
            <div className="mt-2 border border-red-500/20 rounded-xl p-4 bg-red-950/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-400">Delete video package</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Permanently removes all generated content for this post.</p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-white">Delete this video package?</h3>
            </div>
            <p className="text-sm text-gray-400">This will permanently remove all generated content. This cannot be undone.</p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); onDelete(); }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors"
              >
                Delete permanently
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 text-sm font-medium text-gray-300 hover:border-gray-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate confirmation modal */}
      {showRegenConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowRegenConfirm(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-white">Regenerate content?</h3>
            <p className="text-sm text-gray-400">This will re-run the entire pipeline and replace all generated content. This cannot be undone.</p>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => { setShowRegenConfirm(false); handleRegenerate(); }} className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold text-white transition-colors">Regenerate</button>
              <button onClick={() => setShowRegenConfirm(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 text-sm font-medium text-gray-300 hover:border-gray-500 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Ready to Post checklist modal */}
      {showReadyChecklist && (
        <ReadyToPostChecklist
          onConfirm={() => { setShowReadyChecklist(false); onUpdateField('isGoodToPost', true); }}
          onCancel={() => setShowReadyChecklist(false)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Ready to Post Checklist
// =============================================================================

const CHECKLIST_SECTIONS = [
  {
    title: 'Before Export',
    items: [
      'All images use EXACT same base character prompt',
      'Product clearly visible by second 8',
      'Hook text overlay in first 2 seconds',
      'Voiceover matches on-screen captions exactly',
      'Trending sound layered at 30% volume',
      'Video exported at 1080x1920 (9:16 vertical)',
      'File size under 60MB',
    ],
  },
  {
    title: 'Before Posting',
    items: [
      'Affiliate link added to TikTok Shop tag OR bio',
      'Caption under 150 characters with line breaks',
      '3-5 hashtags only (no keyword stuffing)',
      'Trending sound attached',
      'Scheduled for optimal posting time',
    ],
  },
  {
    title: 'After Posting (within 2 hours)',
    items: [
      'Reply to first 5 comments',
      'Monitor save/share rate in analytics',
      'Note hook type + format performance',
      'Flag for replication if viral (>10k views in 6hrs)',
    ],
  },
];

function ReadyToPostChecklist({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const totalItems = CHECKLIST_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
  const prePostItems = CHECKLIST_SECTIONS.slice(0, 2).reduce((sum, s) => sum + s.items.length, 0);
  const prePostChecked = CHECKLIST_SECTIONS.slice(0, 2).reduce(
    (sum, s) => sum + s.items.filter(item => checked.has(item)).length, 0
  );
  const allPrePostChecked = prePostChecked === prePostItems;

  const toggle = (item: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item); else next.add(item);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-base font-semibold text-white">Ready to Post?</h3>
          <p className="text-xs text-gray-500 mt-1">Review this checklist before marking as ready. Check all "Before" items to confirm.</p>
        </div>

        {/* Checklist */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {CHECKLIST_SECTIONS.map((section, si) => (
            <div key={section.title}>
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium mb-2">{section.title}</p>
              <div className="space-y-1.5">
                {section.items.map(item => {
                  const isChecked = checked.has(item);
                  return (
                    <button
                      key={item}
                      onClick={() => toggle(item)}
                      className="w-full flex items-start gap-3 text-left px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-colors"
                    >
                      <div className={cn(
                        'w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center transition-all',
                        isChecked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
                      )}>
                        {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className={cn('text-sm', isChecked ? 'text-gray-400 line-through' : 'text-gray-200')}>{item}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center gap-3">
          <button
            onClick={onConfirm}
            disabled={!allPrePostChecked}
            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {allPrePostChecked ? 'Confirm — Good to Post' : `Check all items (${prePostChecked}/${prePostItems})`}
          </button>
          <button onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-gray-700 text-sm font-medium text-gray-300 hover:border-gray-500 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Copy button
// =============================================================================

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={cn(
        'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all',
        copied ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'text-gray-500 border-gray-700 hover:text-white hover:border-gray-500'
      )}
    >
      {copied ? <ClipboardCheck className="w-3 h-3" /> : <Clipboard className="w-3 h-3" />}
      {copied ? 'Copied' : (label || 'Copy')}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">{children}</p>;
}

// =============================================================================
// Tab 1: Product Intel
// =============================================================================

function ProductIntelTab({ data, productUrl, affiliateUrl: initialAffUrl, onUpdateField, onAffiliateChange }: {
  data: ProductIntel;
  productUrl?: string;
  affiliateUrl?: string;
  onUpdateField?: (field: string, value: unknown) => void;
  onAffiliateChange?: (url: string) => void;
}) {
  const [editProductUrl, setEditProductUrl] = useState(data.sourceUrl || productUrl || '');
  const [editAffiliateUrl, setEditAffiliateUrl] = useState(() => {
    if (initialAffUrl) return initialAffUrl;
    const src = data.sourceUrl || productUrl || '';
    return src.includes('amazon.com')
      ? src + (src.includes('?') ? '&' : '?') + 'tag=creatorstudio-20'
      : '';
  });
  const [saved, setSaved] = useState(false);

  const handleAffiliateChange = (val: string) => {
    setEditAffiliateUrl(val);
    onAffiliateChange?.(val);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="space-y-5">
      {/* Product & Affiliate URLs — editable */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Product URL</Label>
          <div className="flex gap-1.5 mt-1">
            <input
              type="url"
              value={editProductUrl}
              onChange={e => { setEditProductUrl(e.target.value); onUpdateField?.('productUrl', e.target.value); }}
              className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-violet-500/50"
              placeholder="https://amazon.com/dp/..."
            />
            {editProductUrl && (
              <a href={editProductUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg border border-gray-700 text-gray-500 hover:text-white transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Affiliate Link</Label>
              {saved && <span className="text-[10px] text-emerald-400 animate-pulse">Saved</span>}
            </div>
            <CopyBtn text={editAffiliateUrl} />
          </div>
          <input
            type="url"
            value={editAffiliateUrl}
            onChange={e => handleAffiliateChange(e.target.value)}
            className="w-full mt-1 bg-gray-950 border border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-emerald-300 outline-none focus:ring-1 focus:ring-emerald-500/50"
            placeholder="https://amazon.com/dp/...?tag=your-tag"
          />
          {editAffiliateUrl && (
            <p className="text-[10px] text-gray-600 mt-1">This link will be included in your TikTok & Instagram captions</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div>
            <Label>Key Features</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {data.keyFeatures.map((f, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-gray-800 text-gray-300 border border-gray-700">{f}</span>
              ))}
            </div>
          </div>
          <div>
            <Label>Pain Points Solved</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {data.painPointsSolved.map((p, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-rose-500/10 text-rose-300 border border-rose-500/20">{p}</span>
              ))}
            </div>
          </div>
          <div>
            <Label>Competitors</Label>
            <div className="space-y-1 mt-1.5">
              {data.competitorProducts.map((c, i) => (
                <div key={i} className="flex justify-between text-xs px-3 py-1.5 rounded-lg bg-gray-800/50">
                  <span className="text-gray-300">{c.name}</span>
                  <span className="text-gray-500">${c.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="border border-emerald-500/20 rounded-lg p-3 bg-emerald-500/5">
            <Label>Positive Reviews</Label>
            <ul className="mt-1.5 space-y-1">
              {data.reviewSentiment.positive.map((r, i) => (
                <li key={i} className="text-xs text-emerald-300 flex items-start gap-1.5">
                  <Check className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" /> {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-red-500/20 rounded-lg p-3 bg-red-500/5">
            <Label>Negative Reviews</Label>
            <ul className="mt-1.5 space-y-1">
              {data.reviewSentiment.negative.map((r, i) => (
                <li key={i} className="text-xs text-red-300 flex items-start gap-1.5">
                  <AlertCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" /> {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-gray-800 rounded-lg p-3 bg-gray-950/40">
            <Label>Target Audience</Label>
            <p className="text-sm text-gray-300 mt-1">{data.targetAudience}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Tab 2: Strategy
// =============================================================================

function StrategyTab({ data }: { data: ContentStrategy }) {
  return (
    <div className="space-y-5">
      <div className="border border-violet-500/30 rounded-xl p-4 bg-violet-500/5">
        <div className="flex items-center justify-between">
          <div>
            <Label>Hook Format</Label>
            <p className="text-lg font-semibold text-violet-300 mt-1 capitalize">{data.hookFormat.replace(/_/g, ' ')}</p>
          </div>
          <div className="text-right">
            <Label>Content Format</Label>
            <p className="text-lg font-semibold text-white mt-1 capitalize">{data.contentFormat.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">{data.hookRationale}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Video Length" value={data.videoLength} />
        <Stat label="Setting" value={data.setting.replace(/_/g, ' ')} />
        <Stat label="Posting" value={data.optimalPostingTime} />
      </div>
      <div className="border border-gray-800 rounded-lg p-3 bg-gray-950/40">
        <Label>Character Outfit</Label>
        <p className="text-sm text-gray-300 mt-1">{data.characterOutfit}</p>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label>Hashtags</Label>
          <CopyBtn text={Object.values(data.hashtagStrategy).join(' ')} label="Copy All" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(data.hashtagStrategy).map(([type, tag]) => (
            <span key={type} className="px-2.5 py-1 rounded-full text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20">
              {tag} <span className="text-violet-500/50 text-[10px]">({type})</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Tab 3: Script
// =============================================================================

function ScriptTab({ data, selectedHook, onSelectHook }: { data: VideoScript; selectedHook: string; onSelectHook: (h: string) => void }) {
  const [showAllHooks, setShowAllHooks] = useState(false);
  const sections = [
    { key: 'hook', label: 'HOOK', color: 'border-l-rose-500', ...data.fullScript.hookSection },
    { key: 'product', label: 'PRODUCT', color: 'border-l-blue-500', ...data.fullScript.productSection },
    { key: 'trust', label: 'TRUST', color: 'border-l-amber-500', ...data.fullScript.trustSection },
    { key: 'cta', label: 'CTA', color: 'border-l-emerald-500', ...data.fullScript.ctaSection },
  ];
  const visibleHooks = showAllHooks ? data.hookVariants : data.hookVariants.filter(h => h.score >= 8).slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Label>Video Script ({data.estimatedDuration} · {data.totalWordCount} words)</Label>
        <CopyBtn text={data.elevenlabsFullScript} label="Copy Full Script" />
      </div>
      <div className="space-y-1.5">
        {sections.map(sec => (
          <div key={sec.key} className={cn('border-l-2 rounded-r-lg bg-gray-950/40 border border-gray-800 p-3', sec.color)}>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-[10px] font-bold text-gray-500 tracking-wider w-16">{sec.label}</span>
              <span className="text-[10px] text-gray-700 font-mono">{sec.timing}</span>
              <span className="text-[10px] text-gray-700 ml-auto">{sec.wordCount}w</span>
            </div>
            <p className="text-sm text-gray-200 leading-relaxed">{sec.voiceover}</p>
            <p className="text-[11px] text-gray-600 mt-1">Overlay: {sec.textOverlay}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Hook Variations</Label>
          <button onClick={() => setShowAllHooks(!showAllHooks)} className="text-[11px] text-violet-400 hover:text-violet-300">
            {showAllHooks ? 'Show top' : `All ${data.hookVariants.length}`}
          </button>
        </div>
        <HookSelector hooks={visibleHooks} selectedHook={selectedHook} onSelect={onSelectHook} />
      </div>
    </div>
  );
}

// =============================================================================
// Tab 4: Visuals — storyboard layout
// =============================================================================

function VisualsTab({ data, persona, script }: { data: VisualPackage; persona: Persona | null; script?: VideoScript | null }) {
  const [selectedShot, setSelectedShot] = useState<string | null>(
    data.shotPrompts[0]?.shotId ?? null
  );
  const [consistencyOpen, setConsistencyOpen] = useState(false);

  const selected = data.shotPrompts.find(s => s.shotId === selectedShot) ?? null;
  const selectedIndex = data.shotPrompts.findIndex(s => s.shotId === selectedShot);

  // Derive a video prompt from the image prompt + motion cues
  const buildVideoPrompt = (shot: typeof data.shotPrompts[0]) => {
    if ((shot as any).videoPrompt) return (shot as any).videoPrompt;
    const motion = shot.visualCue ? ` The character ${shot.visualCue}. ` : ' ';
    return `${shot.fullPrompt}${motion}Camera: steady, slight push-in. 9:16 vertical video, smooth natural motion, ${shot.lighting || 'natural lighting'}. Duration: ${shot.timing}.`;
  };

  // Build voiceover text for a shot — use shot.voiceover or derive from script sections
  const buildVoiceover = (shot: typeof data.shotPrompts[0], index: number) => {
    if (shot.voiceover) return shot.voiceover;
    // Derive from script sections based on shot index
    const scriptSections = [
      script?.fullScript?.hookSection,
      script?.fullScript?.productSection,
      null, // features/close-up — no voiceover
      script?.fullScript?.trustSection,
      script?.fullScript?.ctaSection,
    ];
    const section = scriptSections[index];
    if (section?.voiceover) {
      return `She says "${section.voiceover}"`;
    }
    return null;
  };

  return (
    <div className="space-y-5">
      {/* Character lock + references */}
      <div className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
        <div className="flex items-start gap-4">
          {persona?.referenceImageUrls && persona.referenceImageUrls.length > 0 && (
            <div className="flex gap-1.5 flex-shrink-0">
              {persona.referenceImageUrls.slice(0, 3).map((url, i) => (
                <img key={url + i} src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-700" />
              ))}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <Label>Character Lock</Label>
              <CopyBtn text={data.baseCharacterPrompt} />
            </div>
            <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{data.baseCharacterPrompt}</p>
          </div>
        </div>

        {/* Consistency checklist — collapsible, under character lock */}
        {data.consistencyChecklist.length > 0 && (
          <div className="mt-3 border-t border-gray-800/60 pt-3">
            <button
              onClick={() => setConsistencyOpen(v => !v)}
              className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              {consistencyOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Consistency Checklist ({data.consistencyChecklist.length} items)
            </button>
            {consistencyOpen && (
              <div className="grid grid-cols-2 gap-1 mt-2">
                {data.consistencyChecklist.map((item, i) => (
                  <span key={item + i} className="text-[11px] text-gray-400 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" /> {item}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Storyboard row */}
      <div>
        <Label>Storyboard ({data.shotPrompts.length} shots)</Label>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {data.shotPrompts.map((shot, i) => {
            const isSelected = selectedShot === shot.shotId;
            return (
              <button
                key={shot.shotId}
                onClick={() => setSelectedShot(isSelected ? null : shot.shotId)}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center rounded-xl border-2 transition-all overflow-hidden',
                  isSelected
                    ? 'border-violet-500 shadow-lg shadow-violet-500/20'
                    : 'border-gray-700 hover:border-gray-500'
                )}
                style={{ width: 88 }}
              >
                {/* 9:16 phone screen placeholder */}
                <div
                  className={cn(
                    'w-full flex flex-col items-center justify-center gap-1.5 bg-gray-900',
                    isSelected ? 'bg-violet-500/10' : 'bg-gray-900'
                  )}
                  style={{ aspectRatio: '9/16', width: '100%' }}
                >
                  <span className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold',
                    isSelected ? 'bg-violet-500 text-white' : 'bg-gray-800 text-gray-400'
                  )}>{i + 1}</span>
                  <Film className={cn('w-4 h-4', isSelected ? 'text-violet-400' : 'text-gray-600')} />
                </div>
                {/* Label below */}
                <div className="w-full px-1.5 py-1.5 bg-gray-950 text-center">
                  <p className="text-[10px] font-medium text-gray-300 leading-tight capitalize truncate">
                    {shot.purpose.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[9px] text-gray-600 font-mono mt-0.5">{shot.timing}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expanded shot detail */}
      {selected && (
        <div className="border border-violet-500/30 rounded-xl bg-gray-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800/60 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-[11px] font-bold text-white">
              {selectedIndex + 1}
            </span>
            <span className="text-sm font-semibold text-white capitalize">
              {selected.purpose.replace(/_/g, ' ')}
            </span>
            <span className="text-[11px] text-gray-500 font-mono ml-1">({selected.timing})</span>
          </div>

          <div className="p-4 space-y-4">
            {/* Image Prompt */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Image Prompt</Label>
                <CopyBtn text={selected.fullPrompt} />
              </div>
              <p className="text-xs text-gray-300 leading-relaxed bg-gray-950/60 rounded-lg p-3 border border-gray-800">
                {selected.fullPrompt}
              </p>
            </div>

            {/* Video Prompt */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Video Prompt (Kling)</Label>
                <CopyBtn text={buildVideoPrompt(selected)} />
              </div>
              <p className="text-xs text-gray-300 leading-relaxed bg-gray-950/60 rounded-lg p-3 border border-gray-800">
                {buildVideoPrompt(selected)}
              </p>
            </div>

            {/* Audio / Voiceover for this shot */}
            {(() => {
              const vo = buildVoiceover(selected, selectedIndex);
              if (!vo) return null;
              return (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label>Voiceover</Label>
                    <CopyBtn text={vo} />
                  </div>
                  <p className="text-xs text-emerald-300/90 leading-relaxed bg-emerald-500/5 rounded-lg p-3 border border-emerald-500/15 italic">
                    {vo}
                  </p>
                </div>
              );
            })()}

            {/* Scene details — always visible for reference */}
            <div className="grid grid-cols-3 gap-2">
              {selected.compositionNotes && (
                <div className="border border-gray-800 rounded-lg p-2.5 bg-gray-950/40">
                  <p className="text-[10px] text-gray-600 uppercase">Composition</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{selected.compositionNotes}</p>
                </div>
              )}
              {selected.lighting && (
                <div className="border border-gray-800 rounded-lg p-2.5 bg-gray-950/40">
                  <p className="text-[10px] text-gray-600 uppercase">Lighting</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{selected.lighting}</p>
                </div>
              )}
              {selected.props && selected.props.length > 0 && (
                <div className="border border-gray-800 rounded-lg p-2.5 bg-gray-950/40">
                  <p className="text-[10px] text-gray-600 uppercase">Props</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{selected.props.join(', ')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full ElevenLabs audio script */}
      {data.fullAudioScript && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label>Full Audio Script (ElevenLabs)</Label>
            <CopyBtn text={data.fullAudioScript} />
          </div>
          <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">{data.fullAudioScript}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Tab 5: Audio
// =============================================================================

function AudioTab({ data }: { data: AudioPackage }) {
  return (
    <div className="space-y-5">
      <div className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
        <div className="flex items-center justify-between mb-3">
          <Label>ElevenLabs Voice</Label>
          {data.elevenlabsPayload.recommendedStockVoice && (
            <span className="text-xs text-violet-400 font-medium">{data.elevenlabsPayload.recommendedStockVoice.name}</span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Stability" value={String(data.elevenlabsPayload.voiceSettings.stability)} />
          <Stat label="Similarity" value={String(data.elevenlabsPayload.voiceSettings.similarityBoost)} />
          <Stat label="Style" value={String(data.elevenlabsPayload.voiceSettings.style)} />
          <Stat label="Format" value={data.elevenlabsPayload.outputFormat.split('_')[0]} />
        </div>
      </div>
      <div>
        <Label>Background Sound</Label>
        <div className="mt-2 space-y-2">
          {data.trendingSoundOptions.map((sound, i) => (
            <div key={i} className={cn('flex items-start gap-3 border rounded-lg p-3', sound.recommended ? 'border-violet-500/30 bg-violet-500/5' : 'border-gray-800 bg-gray-950/40')}>
              <Volume2 className={cn('w-4 h-4 mt-0.5 flex-shrink-0', sound.recommended ? 'text-violet-400' : 'text-gray-600')} />
              <div>
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
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Voice Vol" value={data.audioMixingInstructions.voiceoverVolume} />
        <Stat label="BG Vol" value={data.audioMixingInstructions.backgroundSoundVolume} />
        <Stat label="Fade In" value={data.audioMixingInstructions.fadeInDuration} />
        <Stat label="Fade Out" value={data.audioMixingInstructions.fadeOutDuration} />
      </div>
    </div>
  );
}

// =============================================================================
// Tab 6: Metadata
// =============================================================================

function MetadataTab({ data, affiliateUrl, productName }: { data: MetadataPackage; affiliateUrl?: string; productName?: string }) {
  const [platform, setPlatform] = useState<'tiktok' | 'instagram'>('tiktok');

  // Build caption with affiliate disclosure appended
  const affiliateDisclosure = affiliateUrl
    ? `\n\nShop ${productName || 'here'}: ${affiliateUrl}\n(I may earn a small commission at no extra cost to you)`
    : '';

  const tiktokCaptionFull = data.tiktok.caption + affiliateDisclosure;
  const instagramCaptionFull = data.instagram.caption + affiliateDisclosure;

  return (
    <div className="space-y-4">
      <div className="flex bg-gray-800 rounded-lg overflow-hidden w-fit">
        <button onClick={() => setPlatform('tiktok')} className={cn('px-4 py-2 text-sm font-medium transition-colors', platform === 'tiktok' ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white')}>TikTok</button>
        <button onClick={() => setPlatform('instagram')} className={cn('px-4 py-2 text-sm font-medium transition-colors', platform === 'instagram' ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white')}>Instagram</button>
      </div>

      {/* Affiliate link banner */}
      {affiliateUrl && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
          <ExternalLink className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-emerald-300 font-medium">Affiliate link included in captions</p>
            <p className="text-[11px] text-gray-500 truncate mt-0.5">{affiliateUrl}</p>
          </div>
          <CopyBtn text={affiliateUrl} />
        </div>
      )}

      {platform === 'tiktok' ? (
        <div className="space-y-4">
          <Card><LabelCopy label="Title" text={data.tiktok.title} /><p className="text-sm text-gray-200 mt-1">{data.tiktok.title}</p></Card>
          <Card>
            <LabelCopy label="Caption" text={tiktokCaptionFull} />
            <p className="text-sm text-gray-200 mt-1 whitespace-pre-line leading-relaxed">{data.tiktok.caption}</p>
            {affiliateUrl && (
              <div className="mt-2 pt-2 border-t border-gray-800">
                <p className="text-sm text-emerald-300">Shop {productName || 'here'}: <span className="underline">{affiliateUrl}</span></p>
                <p className="text-[11px] text-gray-500 italic mt-0.5">(I may earn a small commission at no extra cost to you)</p>
              </div>
            )}
          </Card>
          <div>
            <LabelCopy label="Hashtags" text={data.tiktok.hashtags.map(h => h.tag).join(' ')} copyLabel="Copy All" />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {data.tiktok.hashtags.map((h, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20">{h.tag}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <Label>Posting Schedule</Label>
              <p className="text-sm text-white mt-1 font-medium">{data.tiktok.postingSchedule.optimalTime}</p>
              <p className="text-xs text-gray-400">{data.tiktok.postingSchedule.dayOfWeek}</p>
            </Card>
            <Card>
              <LabelCopy label="Pinned Comment" text={data.tiktok.engagementStrategy.pinComment} />
              <p className="text-sm text-gray-300 mt-1 italic">"{data.tiktok.engagementStrategy.pinComment}"</p>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <LabelCopy label="Caption" text={instagramCaptionFull} />
            <p className="text-sm text-gray-200 mt-1 whitespace-pre-line leading-relaxed">{data.instagram.caption}</p>
            {affiliateUrl && (
              <div className="mt-2 pt-2 border-t border-gray-800">
                <p className="text-sm text-emerald-300">Shop {productName || 'here'}: <span className="underline">{affiliateUrl}</span></p>
                <p className="text-[11px] text-gray-500 italic mt-0.5">(I may earn a small commission at no extra cost to you)</p>
              </div>
            )}
          </Card>
          {data.instagram.brandMentions.length > 0 && (
            <div>
              <Label>Brand Mentions</Label>
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
// Tiny helpers
// =============================================================================

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-800 rounded-lg p-2.5 bg-gray-950/40">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="text-sm font-medium text-white mt-0.5">{value}</p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="border border-gray-800 rounded-lg p-4 bg-gray-950/40">{children}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    draft: { label: 'Draft', cls: 'bg-gray-600/20 text-gray-400 border-gray-600/30' },
    generating: { label: 'Generating', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse' },
    completed: { label: 'Completed', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    published: { label: 'Published', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  };
  const c = cfg[status] || cfg.draft;
  return <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium border', c.cls)}>{c.label}</span>;
}

function LabelCopy({ label, text, copyLabel }: { label: string; text: string; copyLabel?: string }) {
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <CopyBtn text={text} label={copyLabel} />
    </div>
  );
}
