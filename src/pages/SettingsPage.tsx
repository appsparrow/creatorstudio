import React, { useEffect, useState } from 'react';
import { fetchUserSettings, saveUserSettings } from '../services/api';
import { Save, Loader2, Key, Globe, Clock } from 'lucide-react';
import type { UserSettings } from '../types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUserSettings()
      .then((data) => setSettings(data ?? {}))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof UserSettings, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveUserSettings(settings);
    } catch (err) {
      console.error('Failed to save settings:', err);
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

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>

      {/* API Keys */}
      <Section title="API Keys" icon={<Key className="w-4 h-4" />}>
        <div className="space-y-4">
          <SecretField label="NanoBanana API Key" value={settings.nanobananaApiKey || ''} onChange={(v) => update('nanobananaApiKey', v)} />
          <SecretField label="Kling API Key" value={settings.klingApiKey || ''} onChange={(v) => update('klingApiKey', v)} />
          <SecretField label="Kling API Secret" value={settings.klingApiSecret || ''} onChange={(v) => update('klingApiSecret', v)} />
          <SecretField label="Blotato API Key" value={settings.blotatoApiKey || ''} onChange={(v) => update('blotatoApiKey', v)} />
        </div>
      </Section>

      {/* Google Drive */}
      <Section title="Google Drive" icon={<Globe className="w-4 h-4" />}>
        <Field label="Drive Folder URL" value={settings.driveFolderUrl || ''} onChange={(v) => update('driveFolderUrl', v)} placeholder="https://drive.google.com/drive/folders/..." />
      </Section>

      {/* Publishing */}
      <Section title="Publishing" icon={<Clock className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Posting Mode</label>
            <select
              value={settings.postingMode || 'manual'}
              onChange={(e) => update('postingMode', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            >
              <option value="manual">Manual</option>
              <option value="auto">Auto-schedule</option>
            </select>
          </div>
          <Field label="Posts Per Day" value={String(settings.postsPerDay || 1)} onChange={(v) => update('postsPerDay', Number(v) || 1)} type="number" />
          <Field label="Posting Time" value={settings.postingTime || ''} onChange={(v) => update('postingTime', v)} type="time" />
          <Field label="Posting End Time" value={settings.postingEndTime || ''} onChange={(v) => update('postingEndTime', v)} type="time" />
        </div>
        <div className="mt-4">
          <Field label="Public Tunnel URL" value={settings.publicTunnelUrl || ''} onChange={(v) => update('publicTunnelUrl', v)} placeholder="https://your-tunnel.ngrok.io" />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm text-gray-400 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm"
      />
    </div>
  );
}

function SecretField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="text-sm text-gray-400 mb-1 block">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-16 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm"
          placeholder="Enter key..."
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white px-2 py-1"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
}
