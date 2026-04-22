import React from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
import { LayoutDashboard, Trophy, Send, LogOut, User, PlusCircle, QrCode } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Layout() {
  const { profile } = useAuth();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Meu QR Code', path: '/my-qr', icon: QrCode },
    { name: 'Ranking', path: '/ranking', icon: Trophy },
    { name: 'Transferir', path: '/transfer', icon: Send },
  ];

  if (profile?.is_admin) {
    navItems.push({ name: 'Gerar Moedas', path: '/admin', icon: PlusCircle });
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-brand-gray">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <Logo />
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  isActive 
                    ? 'bg-brand-orange/10 text-brand-orange' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-black'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-brand-orange' : 'text-gray-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-brand-orange/20 flex items-center justify-center text-brand-orange font-bold">
              {profile?.full_name?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-black truncate flex items-center gap-1">
                {profile?.full_name || 'Aluno'}
                {profile?.is_admin && <span className="bg-brand-orange text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">Prof</span>}
              </p>
              <p className="text-xs text-gray-500 truncate">{profile?.is_admin ? 'Moedas Infinitas' : `${profile?.balance || 0} Unireais`}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
