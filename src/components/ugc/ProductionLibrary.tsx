import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Zap, Film, MapPin, GitBranch, Star,
  ChevronDown, ChevronUp, Check, Clipboard, ClipboardCheck,
  BookOpen, TrendingUp, LayoutGrid, List,
  Pencil, Save, X, Plus, Trash2, Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../services/supabase';

// =============================================================================
// Types
// =============================================================================

interface LibraryItem {
  id: string;
  item_type: string;
  slug: string;
  label: string;
  data: Record<string, unknown>;
  platform: 'tiktok' | 'instagram' | 'both';
  performance_score: number;
  usage_count: number;
  is_active: boolean;
  sort_order: number;
}

type LibrarySection = 'hooks' | 'formats' | 'decision_tree' | 'settings_guide';

const SECTIONS: { key: LibrarySection; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'hooks', label: 'Viral Hooks', icon: <Zap className="w-4 h-4" />, desc: '8 proven hook formats' },
  { key: 'formats', label: 'Content Formats', icon: <Film className="w-4 h-4" />, desc: '6 video structures' },
  { key: 'decision_tree', label: 'Decision Tree', icon: <GitBranch className="w-4 h-4" />, desc: 'Category → format mapping' },
  { key: 'settings_guide', label: 'Settings Guide', icon: <MapPin className="w-4 h-4" />, desc: 'Locations & environment' },
];

// =============================================================================
// Shared data hook
// =============================================================================

function useLibraryItems() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('production_library')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setItems(data);
        setLoading(false);
      });
  }, []);

  const hooks = items.filter(i => i.item_type === 'viral_hook');
  const formats = items.filter(i => i.item_type === 'content_format');
  const rules = items.filter(i => i.item_type === 'decision_rule');
  const locations = items.filter(i => i.item_type === 'location_setting');

  return { items, loading, hooks, formats, rules, locations };
}

// =============================================================================
// ProductionLibrarySidebar — section nav only, stays in sidebar
// =============================================================================

interface ProductionLibrarySidebarProps {
  onClose: () => void;
  activeSection: LibrarySection | null;
  onSelectSection: (section: LibrarySection | null) => void;
}

export function ProductionLibrarySidebar({ onClose, activeSection, onSelectSection }: ProductionLibrarySidebarProps) {
  const { loading, hooks, formats, rules, locations } = useLibraryItems();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <BookOpen className="w-6 h-6 text-accent-400 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-5 py-4 border-b border-border">
        <button onClick={onClose} className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Posts
        </button>
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent-400" /> Production Library
        </h3>
        <p className="text-[11px] text-text-muted mt-1">Click a section to explore</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {SECTIONS.map(section => {
          const count = section.key === 'hooks' ? hooks.length
            : section.key === 'formats' ? formats.length
            : section.key === 'decision_tree' ? rules.length
            : locations.length;

          const isActive = activeSection === section.key;

          return (
            <button
              key={section.key}
              onClick={() => onSelectSection(isActive ? null : section.key)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left group',
                isActive
                  ? 'border-accent-500/50 bg-accent-500/10'
                  : 'border-border bg-surface-50/40 hover:border-accent-500/30 hover:bg-surface-50/60'
              )}
            >
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
                isActive ? 'bg-accent-500/30 text-accent-300' : 'bg-accent-500/10 text-accent-400 group-hover:bg-accent-500/20'
              )}>
                {section.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', isActive ? 'text-accent-200' : 'text-text-primary')}>{section.label}</p>
                <p className="text-[11px] text-text-muted">{section.desc}</p>
              </div>
              <span className="text-xs text-text-dim bg-surface-200 px-2 py-0.5 rounded-full">{count}</span>
            </button>
          );
        })}

        {/* Stats */}
        <div className="mt-4 px-4 py-3 rounded-xl border border-border/50 bg-surface-0/40">
          <p className="text-[10px] text-text-dim uppercase tracking-wider mb-2">Library Stats</p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div><p className="text-lg font-bold text-accent-400">{hooks.length}</p><p className="text-[10px] text-text-muted">Hooks</p></div>
            <div><p className="text-lg font-bold text-accent-400">{formats.length}</p><p className="text-[10px] text-text-muted">Formats</p></div>
            <div><p className="text-lg font-bold text-accent-400">{rules.length}</p><p className="text-[10px] text-text-muted">Rules</p></div>
            <div><p className="text-lg font-bold text-accent-400">{locations.length}</p><p className="text-[10px] text-text-muted">Settings</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ProductionLibraryCanvas — detail views, renders in main canvas
// =============================================================================

interface ProductionLibraryCanvasProps {
  activeSection: LibrarySection | null;
  onSelectSection: (section: LibrarySection | null) => void;
}

export function ProductionLibraryCanvas({ activeSection, onSelectSection }: ProductionLibraryCanvasProps) {
  const { loading, hooks, formats, rules, locations } = useLibraryItems();
  const [platformFilter, setPlatformFilter] = useState<'all' | 'tiktok' | 'instagram'>('all');

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <BookOpen className="w-8 h-8 text-accent-400 animate-pulse" />
      </div>
    );
  }

  if (!activeSection) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-accent-500/10 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-accent-400" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">Production Library</h2>
          <p className="text-sm text-text-muted mb-6">Your knowledge engine for content production. Select a section from the sidebar to explore hooks, formats, decision trees, and location settings.</p>
          <div className="grid grid-cols-2 gap-3">
            {SECTIONS.map(section => (
              <button
                key={section.key}
                onClick={() => onSelectSection(section.key)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-surface-50/40 hover:border-accent-500/30 hover:bg-surface-50/60 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center text-accent-400">
                  {section.icon}
                </div>
                <span className="text-sm font-medium text-text-primary">{section.label}</span>
                <span className="text-[11px] text-text-muted">{section.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const sectionMeta = SECTIONS.find(s => s.key === activeSection);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <span className="text-accent-400">{sectionMeta?.icon}</span>
            {sectionMeta?.label}
          </h2>
          <p className="text-xs text-text-muted mt-0.5">{sectionMeta?.desc}</p>
        </div>
        {(activeSection === 'hooks' || activeSection === 'formats') && (
          <div className="flex bg-surface-200 rounded-lg overflow-hidden">
            {(['all', 'tiktok', 'instagram'] as const).map(p => (
              <button key={p} onClick={() => setPlatformFilter(p)}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                  platformFilter === p ? 'bg-accent-500/20 text-accent-300' : 'text-text-muted hover:text-text-secondary'
                )}>
                {p === 'all' ? 'All' : p === 'tiktok' ? 'TikTok' : 'IG'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {activeSection === 'hooks' && <HooksView items={hooks} platformFilter={platformFilter} />}
          {activeSection === 'formats' && <FormatsView items={formats} platformFilter={platformFilter} />}
          {activeSection === 'decision_tree' && <DecisionTreeView items={rules} />}
          {activeSection === 'settings_guide' && <SettingsGuideView items={locations} />}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Legacy default export (kept for backwards compatibility if needed)
// =============================================================================

interface ProductionLibraryProps {
  onClose: () => void;
}

export default function ProductionLibrary({ onClose }: ProductionLibraryProps) {
  const [activeSection, setActiveSection] = useState<LibrarySection | null>(null);
  return (
    <ProductionLibrarySidebar
      onClose={onClose}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
    />
  );
}

// =============================================================================
// Hooks View
// =============================================================================

function HooksView({ items, platformFilter }: { items: LibraryItem[]; platformFilter: string }) {
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (item: LibraryItem) => {
    setEditingId(item.id);
    setEditData({ ...item.data });
  };

  const saveEdit = async (item: LibraryItem) => {
    setSaving(true);
    await supabase.from('production_library').update({ data: editData }).eq('id', item.id);
    item.data = editData;
    setEditingId(null);
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      {items.map(item => {
        const isEditing = editingId === item.id;
        const d = isEditing ? editData : (item.data as any);
        const isExpanded = expandedSlug === item.slug || isEditing;
        const dimmed = platformFilter !== 'all' && item.platform !== 'both' && item.platform !== platformFilter;

        return (
          <div
            key={item.slug}
            className={cn(
              'border rounded-xl overflow-hidden transition-all',
              isEditing ? 'border-amber-500/40 bg-surface-50/60' : isExpanded ? 'border-accent-500/40 bg-surface-50/60' : 'border-border bg-surface-50/30',
              dimmed && 'opacity-40'
            )}
          >
            <button onClick={() => !isEditing && setExpandedSlug(isExpanded ? null : item.slug)} className="w-full px-4 py-3 text-left flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-accent-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{item.label}</span>
                  <PlatformTag platform={item.platform} />
                  <span className="ml-auto text-xs font-bold text-accent-400">{item.performance_score}</span>
                </div>
                <p className="text-[11px] text-text-muted mt-0.5 font-mono truncate">{d.structure}</p>
              </div>
              {!isEditing && (isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />)}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                {/* Edit / View toggle */}
                <div className="flex items-center justify-end gap-2">
                  {isEditing ? (
                    <>
                      <button onClick={() => saveEdit(item)} disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-text-primary transition-colors">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary transition-colors">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={() => startEdit(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted border border-border-light hover:text-text-primary hover:border-border-light transition-colors">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <EditField label="Structure" value={d.structure} onChange={v => setEditData({ ...editData, structure: v })} mono />
                    <EditField label="Psychology" value={d.psychology || ''} onChange={v => setEditData({ ...editData, psychology: v })} />
                    <EditField label="Tips" value={d.tips || ''} onChange={v => setEditData({ ...editData, tips: v })} />
                    <EditField label="Trigger Condition" value={d.triggerCondition || ''} onChange={v => setEditData({ ...editData, triggerCondition: v })} mono />
                    <div>
                      <MiniLabel>Best For (comma separated)</MiniLabel>
                      <input value={(d.bestFor || []).join(', ')} onChange={e => setEditData({ ...editData, bestFor: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
                        className="w-full mt-1 bg-surface-0 border border-border-light rounded-lg px-3 py-2 text-xs text-text-secondary outline-none focus:ring-1 focus:ring-accent-500/50" />
                    </div>
                    <div>
                      <MiniLabel>Examples (one per line)</MiniLabel>
                      <textarea value={(d.examples || []).join('\n')} onChange={e => setEditData({ ...editData, examples: e.target.value.split('\n').filter(Boolean) })}
                        rows={4} className="w-full mt-1 bg-surface-0 border border-border-light rounded-lg px-3 py-2 text-xs text-text-secondary outline-none focus:ring-1 focus:ring-accent-500/50 resize-y" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <MiniLabel>Structure</MiniLabel>
                      <p className="text-xs text-accent-300 font-mono bg-surface-0 rounded-lg px-3 py-2 mt-1">{d.structure}</p>
                    </div>
                    <div>
                      <MiniLabel>Best For</MiniLabel>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(d.bestFor || []).map((b: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-surface-200 text-text-secondary border border-border-light">{b}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <MiniLabel>Examples</MiniLabel>
                      <div className="space-y-1.5 mt-1">
                        {(d.examples || []).map((ex: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className="text-text-dim mt-0.5">{i + 1}.</span>
                            <span className="text-text-secondary italic">"{ex}"</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {d.psychology && (
                      <div>
                        <MiniLabel>Psychology</MiniLabel>
                        <p className="text-[11px] text-text-muted mt-1">{d.psychology}</p>
                      </div>
                    )}
                    {d.tips && (
                      <div>
                        <MiniLabel>Tips</MiniLabel>
                        <p className="text-[11px] text-amber-300/80 mt-1">{d.tips}</p>
                      </div>
                    )}
                    {d.triggerCondition && (
                      <div className="text-[10px] text-text-dim font-mono bg-surface-0 rounded px-2 py-1">
                        Trigger: {d.triggerCondition}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Formats View
// =============================================================================

function FormatsView({ items, platformFilter }: { items: LibraryItem[]; platformFilter: string }) {
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {items.map(item => {
        const d = item.data as any;
        const isExpanded = expandedSlug === item.slug;
        const dimmed = platformFilter !== 'all' && item.platform !== 'both' && item.platform !== platformFilter;

        return (
          <div
            key={item.slug}
            className={cn(
              'border rounded-xl overflow-hidden transition-all',
              isExpanded ? 'border-accent-500/40 bg-surface-50/60' : 'border-border bg-surface-50/30',
              dimmed && 'opacity-40'
            )}
          >
            <button onClick={() => setExpandedSlug(isExpanded ? null : item.slug)} className="w-full px-4 py-3 text-left flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Film className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{item.label}</span>
                  <PlatformTag platform={item.platform} />
                  <span className="ml-auto text-xs text-text-muted">{d.duration}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(d.bestFor || []).slice(0, 3).map((b: string, i: number) => (
                    <span key={i} className="text-[10px] text-text-muted">{b}{i < 2 && (d.bestFor || []).length > i + 1 ? ' ·' : ''}</span>
                  ))}
                </div>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
            </button>

            {isExpanded && d.timing && (
              <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                <div>
                  <MiniLabel>Timing Breakdown</MiniLabel>
                  <div className="space-y-1 mt-1.5">
                    {Object.entries(d.timing).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="w-16 text-accent-400 font-medium capitalize">{key}</span>
                        <span className="text-text-secondary">{val as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-text-muted">
                  <span>Words: {d.wordCount}</span>
                  <span>Score: <span className="text-accent-400 font-bold">{item.performance_score}</span></span>
                </div>
                {d.tips && (
                  <p className="text-[11px] text-amber-300/80">{d.tips}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Decision Tree View
// =============================================================================

function DecisionTreeView({ items }: { items: LibraryItem[] }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-text-muted mb-3">Product category → recommended hook + format + setting</p>
      {items.map(item => {
        const d = item.data as any;
        return (
          <div key={item.slug} className="border border-border rounded-xl p-4 bg-surface-50/30 space-y-2.5">
            <p className="text-sm font-medium text-text-primary">{item.label}</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-accent-500/10 border border-accent-500/20 rounded-lg px-2.5 py-2">
                <p className="text-[9px] text-accent-500 uppercase">Hook</p>
                <p className="text-xs text-accent-300 font-medium mt-0.5">{(d.recommendedHook || '').replace('hook_', '').replace(/_/g, ' ')}</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-2">
                <p className="text-[9px] text-blue-500 uppercase">Format</p>
                <p className="text-xs text-blue-300 font-medium mt-0.5">{(d.recommendedFormat || '').replace('format_', '').replace(/_/g, ' ')}</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-2">
                <p className="text-[9px] text-emerald-500 uppercase">Setting</p>
                <p className="text-xs text-emerald-300 font-medium mt-0.5">{(d.recommendedSetting || '').replace('setting_', '').replace(/_/g, ' ')}</p>
              </div>
            </div>
            <p className="text-[11px] text-text-muted">{d.reasoning}</p>
            {d.alternateHook && (
              <p className="text-[10px] text-text-dim">Alt hook: {d.alternateHook.replace('hook_', '').replace(/_/g, ' ')}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Settings Guide View
// =============================================================================

function SettingsGuideView({ items }: { items: LibraryItem[] }) {
  return (
    <div className="space-y-3">
      {items.map(item => {
        const d = item.data as any;
        return (
          <div key={item.slug} className="border border-border rounded-xl p-4 bg-surface-50/30 space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <p className="text-sm font-medium text-text-primary">{item.label}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(d.forCategories || []).map((c: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-surface-200 text-text-secondary border border-border-light">{c}</span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div><span className="text-text-dim">Visual:</span> <span className="text-text-muted">{d.visual}</span></div>
              <div><span className="text-text-dim">Outfit:</span> <span className="text-text-muted">{d.outfit}</span></div>
              <div><span className="text-text-dim">Lighting:</span> <span className="text-text-muted">{d.lighting}</span></div>
              <div><span className="text-text-dim">Mood:</span> <span className="text-text-muted">{d.mood}</span></div>
            </div>
            {d.props && (
              <div className="flex flex-wrap gap-1 mt-1">
                {(d.props as string[]).map((p, i) => (
                  <span key={i} className="text-[10px] text-text-muted bg-surface-200/60 px-1.5 py-0.5 rounded">{p}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function PlatformTag({ platform }: { platform: string }) {
  if (platform === 'both') return null;
  return (
    <span className={cn(
      'px-1.5 py-0.5 rounded text-[9px] font-medium border',
      platform === 'tiktok' ? 'text-text-muted border-border-light bg-surface-200' : 'text-pink-400 border-pink-500/20 bg-pink-500/10'
    )}>
      {platform === 'tiktok' ? 'TikTok' : 'IG'}
    </span>
  );
}

function MiniLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium">{children}</p>;
}

function EditField({ label, value, onChange, mono }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <div>
      <MiniLabel>{label}</MiniLabel>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn('w-full mt-1 bg-surface-0 border border-border-light rounded-lg px-3 py-2 text-xs text-text-secondary outline-none focus:ring-1 focus:ring-accent-500/50', mono && 'font-mono')}
      />
    </div>
  );
}
