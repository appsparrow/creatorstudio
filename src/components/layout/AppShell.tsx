import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Sparkles, Users, Settings, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-16 lg:w-56 bg-gray-900/80 border-r border-gray-800 flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-4 flex items-center gap-2 border-b border-gray-800">
          <Sparkles className="w-6 h-6 text-violet-400 shrink-0" />
          <span className="text-lg font-semibold hidden lg:block">Creator Studio</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-2 space-y-1">
          <SidebarLink to="/" icon={<Users className="w-5 h-5" />} label="Personas" end />
          <SidebarLink to="/settings" icon={<Settings className="w-5 h-5" />} label="Settings" />
        </nav>

        {/* User / Sign out */}
        <div className="p-3 border-t border-gray-800">
          <div className="hidden lg:block text-xs text-gray-500 truncate mb-2">
            {user?.email}
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors w-full p-2 rounded-lg hover:bg-gray-800"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden lg:block text-sm">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

function SidebarLink({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
          isActive
            ? 'bg-violet-600/20 text-violet-300'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
        )
      }
    >
      {icon}
      <span className="hidden lg:block text-sm font-medium">{label}</span>
    </NavLink>
  );
}
