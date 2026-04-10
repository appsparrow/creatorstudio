import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Save, RotateCcw, ChevronDown, ChevronUp,
  Sparkles, Zap, Share2, Pencil, X, Check,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';

interface Prompt {
  id: string;
  slug: string;
  label: string;
  category: 'studio' | 'ugc' | 'shared';
  model: 'sonnet' | 'haiku';
  template: string;
  default_template: string;
  variables: string[];
  description: string | null;
  updated_at: string;
}

const CATEGORY_CONFIG = {
  shared: { label: 'Shared', icon: Share2, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  studio: { label: 'Studio', icon: Sparkles, color: 'text-brand-400', bg: 'bg-brand-500/10', border: 'border-brand-500/20' },
  ugc:    { label: 'UGC', icon: Zap, color: 'text-accent-400', bg: 'bg-accent-500/10', border: 'border-accent-500/20' },
};

export default function PromptsManager() {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editedTemplate, setEditedTemplate] = useState('');
  const [editedModel, setEditedModel] = useState<'sonnet' | 'haiku'>('sonnet');
  const [saving, setSaving] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('ugc');

  useEffect(() => {
    if (!user) return;
    const fetchPrompts = async () => {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('category')
        .order('slug');
      if (data) setPrompts(data);
      setLoading(false);
    };
    fetchPrompts();
  }, [user]);

  const startEditing = (prompt: Prompt) => {
    setEditingSlug(prompt.slug);
    setEditedTemplate(prompt.template);
    setEditedModel(prompt.model);
  };

  const cancelEditing = () => {
    setEditingSlug(null);
    setEditedTemplate('');
  };

  const savePrompt = async (prompt: Prompt) => {
    setSaving(true);
    const { error } = await supabase
      .from('prompts')
      .update({ template: editedTemplate, model: editedModel })
      .eq('id', prompt.id);

    if (!error) {
      setPrompts(prev => prev.map(p =>
        p.id === prompt.id ? { ...p, template: editedTemplate, model: editedModel } : p
      ));
      setEditingSlug(null);
    }
    setSaving(false);
  };

  const resetPrompt = async (prompt: Prompt) => {
    setSaving(true);
    const { error } = await supabase
      .from('prompts')
      .update({ template: prompt.default_template })
      .eq('id', prompt.id);

    if (!error) {
      setPrompts(prev => prev.map(p =>
        p.id === prompt.id ? { ...p, template: p.default_template } : p
      ));
      if (editingSlug === prompt.slug) {
        setEditedTemplate(prompt.default_template);
      }
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="py-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-accent-400 animate-spin" />
      </div>
    );
  }

  const grouped = {
    shared: prompts.filter(p => p.category === 'shared'),
    studio: prompts.filter(p => p.category === 'studio'),
    ugc: prompts.filter(p => p.category === 'ugc'),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">AI Prompts</h3>
        <span className="text-[10px] text-text-dim">{prompts.length} prompts</span>
      </div>

      {(['shared', 'studio', 'ugc'] as const).map(cat => {
        const cfg = CATEGORY_CONFIG[cat];
        const Icon = cfg.icon;
        const isExpanded = expandedCategory === cat;
        const catPrompts = grouped[cat];
        if (catPrompts.length === 0) return null;

        return (
          <div key={cat} className={cn('border rounded-xl', cfg.border)}>
            <button
              onClick={() => setExpandedCategory(isExpanded ? null : cat)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <Icon className={cn('w-4 h-4', cfg.color)} />
              <span className="text-sm font-medium text-text-primary flex-1">{cfg.label}</span>
              <span className="text-xs text-text-muted">{catPrompts.length}</span>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
            </button>

            {isExpanded && (
              <div className="border-t border-border/50 divide-y divide-border/30">
                {catPrompts.map(prompt => (
                  <div key={prompt.slug} className="px-4 py-3">
                    {editingSlug === prompt.slug ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-text-primary">{prompt.label}</span>
                          <div className="flex items-center gap-2">
                            <select
                              value={editedModel}
                              onChange={e => setEditedModel(e.target.value as 'sonnet' | 'haiku')}
                              className="bg-surface-200 border border-border-light rounded-lg px-2 py-1 text-xs text-text-secondary outline-none"
                            >
                              <option value="sonnet">Sonnet</option>
                              <option value="haiku">Haiku</option>
                            </select>
                          </div>
                        </div>
                        <textarea
                          value={editedTemplate}
                          onChange={e => setEditedTemplate(e.target.value)}
                          className="w-full bg-surface-0 border border-border-light rounded-lg px-3 py-2 text-xs text-text-secondary font-mono leading-relaxed outline-none focus:ring-1 focus:ring-accent-500/50 resize-y min-h-[200px]"
                          rows={12}
                        />
                        {prompt.variables && prompt.variables.length > 0 && (
                          <div>
                            <p className="text-[10px] text-text-muted mb-1">Available variables:</p>
                            <div className="flex flex-wrap gap-1">
                              {prompt.variables.map((v: string, i: number) => (
                                <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-200 text-accent-400 border border-border-light cursor-pointer hover:bg-surface-300"
                                  onClick={() => {
                                    setEditedTemplate(prev => prev + `{{${v}}}`);
                                  }}
                                >
                                  {`{{${v}}}`}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => savePrompt(prompt)}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-600 hover:bg-accent-500 text-white transition-colors"
                          >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => resetPrompt(prompt)}
                            disabled={saving || prompt.template === prompt.default_template}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-amber-400 disabled:opacity-30 transition-colors"
                            title="Reset to default"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reset
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-text-primary">{prompt.label}</span>
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-medium',
                              prompt.model === 'sonnet' ? 'bg-accent-500/10 text-accent-400' : 'bg-surface-200 text-text-muted'
                            )}>
                              {prompt.model}
                            </span>
                            {prompt.template !== prompt.default_template && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400">customized</span>
                            )}
                          </div>
                          {prompt.description && (
                            <p className="text-[11px] text-text-muted mt-0.5 truncate">{prompt.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => startEditing(prompt)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary hover:bg-surface-200 transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
