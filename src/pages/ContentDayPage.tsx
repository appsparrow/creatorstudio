import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchDays, saveDay } from '../services/api';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { PLATFORMS, CONTENT_TYPES, STYLE_OPTIONS, STORY_ARCS, CAPTION_TONES, CONTENT_STATUSES } from '../constants';
import type { ContentDay } from '../types';

export default function ContentDayPage() {
  const { personaId, dayId } = useParams();
  const navigate = useNavigate();
  const [day, setDay] = useState<ContentDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDays()
      .then((allDays) => {
        const found = allDays.find((d: ContentDay) => d.id === dayId);
        setDay(found ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dayId]);

  const update = (field: keyof ContentDay, value: unknown) => {
    if (!day) return;
    setDay({ ...day, [field]: value } as ContentDay);
  };

  const handleSave = async () => {
    if (!day) return;
    setSaving(true);
    try {
      await saveDay(day);
    } catch (err) {
      console.error('Failed to save:', err);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (!day) {
    return <div className="p-8 text-gray-400">Content day not found</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/persona/${personaId}/calendar`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to calendar</span>
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Scheduling */}
          <Section title="Scheduling">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Day #" value={String(day.dayNumber)} onChange={(v) => update('dayNumber', Number(v) || 0)} type="number" />
              <Field label="Date" value={day.date} onChange={(v) => update('date', v)} type="date" />
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Content Type</label>
                <select
                  value={day.contentType}
                  onChange={(e) => update('contentType', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Status</label>
                <select
                  value={day.status}
                  onChange={(e) => update('status', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-sm text-gray-400 mb-1 block">Platforms</label>
              <div className="flex gap-2">
                {PLATFORMS.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={day.platforms.includes(p)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...day.platforms, p]
                          : day.platforms.filter((x) => x !== p);
                        update('platforms', next);
                      }}
                      className="rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500/50"
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          </Section>

          {/* Story Arc + Tone (MVP1) */}
          <Section title="Story & Tone">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Story Arc</label>
                <select
                  value={day.storyArc || ''}
                  onChange={(e) => update('storyArc', e.target.value || undefined)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="">Select arc...</option>
                  {STORY_ARCS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Caption Tone</label>
                <select
                  value={day.captionTone || ''}
                  onChange={(e) => update('captionTone', e.target.value || undefined)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="">Select tone...</option>
                  {CAPTION_TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </Section>

          {/* Content */}
          <Section title="Content">
            <div className="space-y-4">
              <Field label="Theme" value={day.theme} onChange={(v) => update('theme', v)} />
              <TextArea label="Scene Description" value={day.sceneDescription} onChange={(v) => update('sceneDescription', v)} rows={3} />
              <TextArea label="On-Screen Text" value={day.onScreenText} onChange={(v) => update('onScreenText', v)} rows={3} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Style Option" value={day.styleOption || ''} onChange={(v) => update('styleOption', v)} />
                <Field label="Hairstyle" value={day.hairstyle || ''} onChange={(v) => update('hairstyle', v)} />
              </div>
            </div>
          </Section>

          {/* Copy */}
          <Section title="Copy & Text">
            <div className="space-y-4">
              <TextArea label="Caption" value={day.caption} onChange={(v) => update('caption', v)} rows={4} />
              <Field label="Hook" value={day.hook} onChange={(v) => update('hook', v)} />
              <Field label="Hashtags" value={day.hashtags} onChange={(v) => update('hashtags', v)} />
              <Field label="CTA" value={day.cta} onChange={(v) => update('cta', v)} />
            </div>
          </Section>

          {/* Metadata */}
          <Section title="Metadata">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Location" value={day.location} onChange={(v) => update('location', v)} />
              <Field label="Music Suggestion" value={day.musicSuggestion} onChange={(v) => update('musicSuggestion', v)} />
              <TextArea label="Notes" value={day.notes} onChange={(v) => update('notes', v)} rows={3} className="md:col-span-2" />
            </div>
          </Section>
        </div>

        {/* Right column — Preview */}
        <div className="space-y-4">
          <Section title="Media Preview">
            {day.generatedImageUrl ? (
              <img src={day.generatedImageUrl} alt="Generated" className="w-full rounded-lg border border-gray-700" />
            ) : (
              <div className="aspect-[9/16] bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center text-gray-500 text-sm">
                No image generated
              </div>
            )}
            {day.generatedVideoUrl && (
              <video src={day.generatedVideoUrl} controls className="w-full rounded-lg border border-gray-700 mt-2" />
            )}
          </Section>

          <Section title="Workflow">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={day.isGoodToPost || false}
                onChange={(e) => update('isGoodToPost', e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500/50"
              />
              Good to post
            </label>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', className = '' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-sm text-gray-400 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 3, className = '' }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-sm text-gray-400 mb-1 block">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm resize-none"
      />
    </div>
  );
}
