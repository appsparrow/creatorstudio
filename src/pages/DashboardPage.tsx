import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, User, Calendar, Loader2 } from 'lucide-react';
import { fetchPersonas, savePersona } from '../services/api';
import { generateId } from '../constants';
import type { Persona } from '../types';

function newBlankPersona(): Persona {
  const id = `persona_${generateId().slice(0, 8)}`;
  return {
    id,
    identity: { fullName: '', age: 25, gender: '', nationality: '', birthplace: '', profession: '', locations: [] },
    appearance: { height: '', bodyType: '', faceShape: '', eyes: '', hair: '', distinctFeatures: [] },
    psychographic: { coreTraits: [], interests: [], values: [], fears: [], motivations: [], mission: '' },
    backstory: '',
    fashionStyle: { aesthetic: '', signatureItems: [], photographyStyle: '' },
    lifestyle: { routine: '', diet: '', socialMediaPresence: '' },
  };
}

export default function DashboardPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPersonas()
      .then(setPersonas)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreatePersona = async () => {
    const persona = newBlankPersona();
    try {
      await savePersona(persona);
      setPersonas((prev) => [...prev, persona]);
    } catch (err) {
      console.error('Failed to create persona:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Personas</h1>
          <p className="text-gray-400 mt-1">Manage your AI content personas</p>
        </div>
        <button
          onClick={handleCreatePersona}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-lg transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          New Persona
        </button>
      </div>

      {personas.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <User className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No personas yet</p>
          <p className="text-sm mt-1">Create your first AI persona to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personas.map((persona) => (
            <PersonaCard key={persona.id} persona={persona} />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonaCard({ persona }: { persona: Persona }) {
  const name = persona.identity.fullName || 'Unnamed Persona';
  const profession = persona.identity.profession || 'No profession set';
  const imageUrl = persona.referenceImageUrl;

  return (
    <Link
      to={`/persona/${persona.id}`}
      className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 hover:border-violet-500/50 hover:bg-gray-900/80 transition-all group"
    >
      <div className="flex items-start gap-4">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-14 h-14 rounded-full object-cover border-2 border-gray-700 group-hover:border-violet-500/50 transition-colors"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center border-2 border-gray-700">
            <User className="w-6 h-6 text-gray-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{name}</h3>
          <p className="text-sm text-gray-400 truncate">{profession}</p>
          {persona.identity.nationality && (
            <p className="text-xs text-gray-500 mt-1">{persona.identity.nationality}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>View content</span>
        </div>
      </div>
    </Link>
  );
}
