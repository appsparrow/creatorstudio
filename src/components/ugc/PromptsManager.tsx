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
  studio: { label: 'Studio', icon: Sparkles, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  ugc:    { label: 'UGC', icon: Zap, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
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

  // Fetch prompts
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
        <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
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
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">AI Prompts</h3>
        <span className="text-[10px] text-gray-600">{prompts.length} prompts</span>
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
              <span className="text-sm font-medium text-white flex-1">{cfg.label}</span>
              <span className="text-xs text-gray-500">{catPrompts.length}</span>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>

            {isExpanded && (
              <div className="border-t border-gray-800/50 divide-y divide-gray-800/30">
                {catPrompts.map(prompt => (
                  <div key={prompt.slug} className="px-4 py-3">
                    {editingSlug === prompt.slug ? (
                      // Edit mode
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{prompt.label}</span>
                          <div className="flex items-center gap-2">
                            <select
                              value={editedModel}
                              onChange={e => setEditedModel(e.target.value as 'sonnet' | 'haiku')}
                              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 outline-none"
                            >
                              <option value="sonnet">Sonnet</option>
                              <option value="haiku">Haiku</option>
                            </select>
                          </div>
                        </div>
                        <textarea
                          value={editedTemplate}
                          onChange={e => setEditedTemplate(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono leading-relaxed outline-none focus:ring-1 focus:ring-violet-500/50 resize-y min-h-[200px]"
                          rows={12}
                        />
                        {prompt.variables && prompt.variables.length > 0 && (
                          <div>
                            <p className="text-[10px] text-gray-500 mb-1">Available variables:</p>
                            <div className="flex flex-wrap gap-1">
                              {prompt.variables.map((v: string, i: number) => (
                                <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-800 text-violet-400 border border-gray-700 cursor-pointer hover:bg-gray-700"
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
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                          >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => resetPrompt(prompt)}
                            disabled={saving || prompt.template === prompt.default_template}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-amber-400 disabled:opacity-30 transition-colors"
                            title="Reset to default"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reset
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-200">{prompt.label}</span>
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-medium',
                              prompt.model === 'sonnet' ? 'bg-violet-500/10 text-violet-400' : 'bg-gray-800 text-gray-400'
                            )}>
                              {prompt.model}
                            </span>
                            {prompt.template !== prompt.default_template && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400">customized</span>
                            )}
                          </div>
                          {prompt.description && (
                            <p className="text-[11px] text-gray-500 mt-0.5 truncate">{prompt.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => startEditing(prompt)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
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
