import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const linkClass = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition ${
    isActive ? 'bg-wc-accent text-wc-navyDarker' : 'text-gray-300 hover:text-white'
  }`;

const Layout = () => {
  const { player, isAdmin, signOut } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 bg-wc-navyDarker/90 backdrop-blur border-b border-wc-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-lg">🏆 One More Shot</span>
          <nav className="flex items-center gap-1">
            <NavLink to="/picks" className={linkClass}>Picks</NavLink>
            <NavLink to="/standings" className={linkClass}>Standings</NavLink>
            {isAdmin && <NavLink to="/admin" className={linkClass}>Admin</NavLink>}
          </nav>
        </div>
        {player && (
          <div className="max-w-3xl mx-auto px-4 pb-2 flex items-center justify-between text-xs text-gray-400">
            <span>Signed in as {player.display_name}</span>
            <button onClick={signOut} className="hover:text-white">Sign out</button>
          </div>
        )}
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
