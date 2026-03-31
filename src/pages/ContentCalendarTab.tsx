import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchDays, saveDay, deleteDay as deleteDayApi } from '../services/api';
import { Plus, Loader2, Trash2, CheckCircle2, Clock, Sparkles, Send } from 'lucide-react';
import { generateId } from '../constants';
import { cn } from '../lib/utils';
import type { ContentDay } from '../types';

export default function ContentCalendarTab() {
  const { personaId } = useParams();
  const [days, setDays] = useState<ContentDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDays()
      .then((allDays) => {
        const filtered = allDays.filter((d: ContentDay) => d.personaId === personaId);
        filtered.sort((a: ContentDay, b: ContentDay) => (a.date || '').localeCompare(b.date || '') || a.dayNumber - b.dayNumber);
        setDays(filtered);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [personaId]);

  const handleAddDay = async () => {
    const maxDay = days.reduce((max, d) => Math.max(max, d.dayNumber), 0);
    const lastDate = days.length > 0 ? days[days.length - 1].date : new Date().toISOString().slice(0, 10);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const newDay: ContentDay = {
      id: generateId(),
      dayNumber: maxDay + 1,
      date: nextDate.toISOString().slice(0, 10),
      platforms: ['Instagram'],
      theme: '',
      sceneDescription: '',
      onScreenText: '',
      caption: '',
      hook: '',
      hashtags: '',
      cta: '',
      location: '',
      musicSuggestion: '',
      notes: '',
      contentType: 'Photo',
      status: 'draft',
      personaId: personaId!,
    };

    try {
      await saveDay(newDay);
      setDays((prev) => [...prev, newDay]);
    } catch (err) {
      console.error('Failed to create day:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDayApi(id);
      setDays((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error('Failed to delete day:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Content Calendar</h2>
        <button
          onClick={handleAddDay}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Day
        </button>
      </div>

      {days.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>No content days yet. Create one to start planning.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {days.map((day) => (
            <DayRow key={day.id} day={day} personaId={personaId!} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  draft: { icon: <Clock className="w-3.5 h-3.5" />, color: 'text-gray-400 bg-gray-800', label: 'Draft' },
  generating: { icon: <Sparkles className="w-3.5 h-3.5" />, color: 'text-amber-400 bg-amber-500/10', label: 'Generating' },
  completed: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'text-emerald-400 bg-emerald-500/10', label: 'Completed' },
  published: { icon: <Send className="w-3.5 h-3.5" />, color: 'text-blue-400 bg-blue-500/10', label: 'Published' },
};

function DayRow({ day, personaId, onDelete }: { day: ContentDay; personaId: string; onDelete: (id: string) => void }) {
  const status = statusConfig[day.status] ?? statusConfig.draft;

  return (
    <div className="flex items-center gap-4 bg-gray-900/60 border border-gray-800 rounded-lg px-4 py-3 hover:border-gray-700 transition-colors group">
      <div className="w-8 text-center text-sm text-gray-500 font-mono">
        {day.dayNumber}
      </div>
      <div className="text-sm text-gray-400 w-24 shrink-0">
        {day.date || '--'}
      </div>
      <Link
        to={`/persona/${personaId}/day/${day.id}`}
        className="flex-1 min-w-0 hover:text-violet-300 transition-colors"
      >
        <span className="text-sm font-medium text-white truncate block">
          {day.theme || 'Untitled'}
        </span>
      </Link>
      <span className="text-xs text-gray-500 w-16 text-center">{day.contentType}</span>
      <span className="text-xs text-gray-500 w-20">{day.platforms.join(', ')}</span>
      <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', status.color)}>
        {status.icon}
        {status.label}
      </span>
      <button
        onClick={() => onDelete(day.id)}
        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
