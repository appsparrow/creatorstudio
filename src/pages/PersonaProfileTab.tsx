import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPersonas, savePersona, deletePersona as deletePersonaApi } from '../services/api';
import { Loader2, Save, Trash2, ArrowLeft } from 'lucide-react';
import type { Persona } from '../types';

export default function PersonaProfileTab() {
  const { personaId } = useParams();
  const navigate = useNavigate();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPersonas()
      .then((personas) => {
        const found = personas.find((p: Persona) => p.id === personaId);
        setPersona(found ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [personaId]);

  const handleSave = async () => {
    if (!persona) return;
    setSaving(true);
    try {
      await savePersona(persona);
    } catch (err) {
      console.error('Failed to save:', err);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!persona || !confirm('Delete this persona and all its content?')) return;
    try {
      await deletePersonaApi(persona.id);
      navigate('/');
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const update = (path: string, value: unknown) => {
    if (!persona) return;
    const keys = path.split('.');
    const updated = structuredClone(persona);
    let obj: any = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    setPersona(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (!persona) {
    return <div className="p-8 text-gray-400">Persona not found</div>;
  }

  const { identity, appearance, psychographic, fashionStyle, lifestyle } = persona;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to personas</span>
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
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
      </div>

      {/* Identity */}
      <Section title="Identity">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Full Name" value={identity.fullName} onChange={(v) => update('identity.fullName', v)} />
          <Field label="Age" value={String(identity.age || '')} onChange={(v) => update('identity.age', Number(v) || 0)} type="number" />
          <Field label="Gender" value={identity.gender} onChange={(v) => update('identity.gender', v)} />
          <Field label="Nationality" value={identity.nationality} onChange={(v) => update('identity.nationality', v)} />
          <Field label="Birthplace" value={identity.birthplace} onChange={(v) => update('identity.birthplace', v)} />
          <Field label="Profession" value={identity.profession} onChange={(v) => update('identity.profession', v)} />
          <Field label="Locations" value={identity.locations.join(', ')} onChange={(v) => update('identity.locations', v.split(',').map((s) => s.trim()).filter(Boolean))} placeholder="Milan, Paris, NYC" />
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Height" value={appearance.height} onChange={(v) => update('appearance.height', v)} />
          <Field label="Body Type" value={appearance.bodyType} onChange={(v) => update('appearance.bodyType', v)} />
          <Field label="Face Shape" value={appearance.faceShape} onChange={(v) => update('appearance.faceShape', v)} />
          <Field label="Eyes" value={appearance.eyes} onChange={(v) => update('appearance.eyes', v)} />
          <Field label="Hair" value={appearance.hair} onChange={(v) => update('appearance.hair', v)} />
          <Field label="Distinct Features" value={appearance.distinctFeatures.join(', ')} onChange={(v) => update('appearance.distinctFeatures', v.split(',').map((s) => s.trim()).filter(Boolean))} />
        </div>
      </Section>

      {/* Psychographic */}
      <Section title="Psychographic">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Core Traits" value={psychographic.coreTraits.join(', ')} onChange={(v) => update('psychographic.coreTraits', v.split(',').map((s) => s.trim()).filter(Boolean))} />
          <Field label="Interests" value={psychographic.interests.join(', ')} onChange={(v) => update('psychographic.interests', v.split(',').map((s) => s.trim()).filter(Boolean))} />
          <Field label="Values" value={psychographic.values.join(', ')} onChange={(v) => update('psychographic.values', v.split(',').map((s) => s.trim()).filter(Boolean))} />
          <Field label="Fears" value={psychographic.fears.join(', ')} onChange={(v) => update('psychographic.fears', v.split(',').map((s) => s.trim()).filter(Boolean))} />
          <Field label="Motivations" value={psychographic.motivations.join(', ')} onChange={(v) => update('psychographic.motivations', v.split(',').map((s) => s.trim()).filter(Boolean))} />
          <Field label="Mission" value={psychographic.mission} onChange={(v) => update('psychographic.mission', v)} className="md:col-span-2" />
        </div>
      </Section>

      {/* Backstory */}
      <Section title="Backstory">
        <textarea
          value={persona.backstory}
          onChange={(e) => update('backstory', e.target.value)}
          rows={4}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
          placeholder="Backstory and origin..."
        />
      </Section>

      {/* Fashion & Style */}
      <Section title="Fashion & Style">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Aesthetic" value={fashionStyle.aesthetic} onChange={(v) => update('fashionStyle.aesthetic', v)} />
          <Field label="Signature Items" value={fashionStyle.signatureItems.join(', ')} onChange={(v) => update('fashionStyle.signatureItems', v.split(',').map((s) => s.trim()).filter(Boolean))} />
          <Field label="Photography Style" value={fashionStyle.photographyStyle} onChange={(v) => update('fashionStyle.photographyStyle', v)} />
        </div>
      </Section>

      {/* Lifestyle */}
      <Section title="Lifestyle">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Routine" value={lifestyle.routine} onChange={(v) => update('lifestyle.routine', v)} />
          <Field label="Diet" value={lifestyle.diet} onChange={(v) => update('lifestyle.diet', v)} />
          <Field label="Pet" value={lifestyle.pet || ''} onChange={(v) => update('lifestyle.pet', v)} />
          <Field label="Social Media Presence" value={lifestyle.socialMediaPresence} onChange={(v) => update('lifestyle.socialMediaPresence', v)} />
        </div>
      </Section>

      {/* Reference Images */}
      <Section title="Reference Images">
        <div className="flex gap-3 flex-wrap">
          {(persona.referenceImageUrls ?? []).map((url, i) => (
            <img key={i} src={url} alt={`Ref ${i + 1}`} className="w-24 h-24 rounded-lg object-cover border border-gray-700" />
          ))}
          {(!persona.referenceImageUrls || persona.referenceImageUrls.length === 0) && (
            <p className="text-gray-500 text-sm">No reference images uploaded</p>
          )}
        </div>
      </Section>

      {/* AI Analysis */}
      <Section title="AI Analysis Rules">
        <textarea
          value={persona.aiAnalysis || ''}
          onChange={(e) => update('aiAnalysis', e.target.value)}
          rows={6}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none font-mono text-sm"
          placeholder="Custom AI rules for generation consistency (JSON or free text)..."
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-lg font-semibold text-white mb-4 border-b border-gray-800 pb-2">{title}</h3>
      {children}
    </section>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder, className = '',
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-sm text-gray-400 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm"
        placeholder={placeholder || label}
      />
    </div>
  );
}
