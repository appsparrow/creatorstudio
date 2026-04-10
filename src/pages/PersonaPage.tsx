import React from 'react';
import { useParams, NavLink, Outlet } from 'react-router-dom';
import { cn } from '../lib/utils';

const tabs = [
  { to: '', label: 'Profile', end: true },
  { to: 'calendar', label: 'Content Calendar' },
  { to: 'audience', label: 'Target Audience' },
  { to: 'products', label: 'Products' },
  { to: 'ugc', label: 'UGC' },
  { to: 'storyline', label: 'Storyline' },
];

export default function PersonaPage() {
  const { personaId } = useParams();

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="border-b border-gray-800 px-6">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to === '' ? `/persona/${personaId}` : `/persona/${personaId}/${tab.to}`}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-violet-500 text-violet-300'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
