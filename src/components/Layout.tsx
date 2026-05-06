import React from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
import { LayoutDashboard, Trophy, Send, LogOut, User, PlusCircle, QrCode, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Layout() {
  const { profile } = useAuth();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Investimentos', path: '/investments', icon: TrendingUp },
    { name: 'Ranking', path: '/ranking', icon: Trophy },
    { name: 'Transferir', path: '/transfer', icon: Send },
    { name: 'Meu QR', path: '/my-qr', icon: QrCode },
  ];

  if (profile?.is_admin) {
    navItems.push({ name: 'Professor', path: '/admin', icon: PlusCircle });
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 md:pb-10">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-8">
            <Link to="/" className="flex items-center">
              <Logo className="scale-90 sm:scale-100 origin-left" />
            </Link>
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${
                      isActive 
                        ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/30 scale-105' 
                        : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-xs font-black text-gray-400 tracking-widest uppercase">
                {profile?.is_admin ? 'Professor' : 'Saldo Atual'}
              </span>
              <span className="text-sm font-black text-black">
                {profile?.is_admin ? 'Controle Total' : `${(profile?.balance || 0).toLocaleString()} UR`}
              </span>
            </div>
            
            <div className="group relative">
              <button className="w-10 h-10 rounded-full bg-brand-orange/10 text-brand-orange flex items-center justify-center font-black border-2 border-brand-orange/20 hover:border-brand-orange transition-all">
                {profile?.full_name?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
              </button>
              
              <div className="absolute right-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 min-w-[200px]">
                  <div className="p-3 border-b border-gray-50 mb-1">
                    <p className="text-sm font-black text-black truncate">{profile?.full_name}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{profile?.is_admin ? 'Administrador' : 'Estudante'}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 w-full rounded-xl font-bold text-red-500 hover:bg-red-50 transition-colors text-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair da Conta
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with floating behavior */}
      <main className="max-w-7xl mx-auto px-4 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Outlet />
      </main>

      {/* Mobile Bottom Bar */}
      <nav className="lg:hidden fixed bottom-6 left-4 right-4 z-50 bg-white/90 backdrop-blur-lg border border-gray-100 shadow-2xl rounded-3xl p-2 flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${
                isActive 
                  ? 'bg-brand-orange text-white scale-110 shadow-lg shadow-brand-orange/30' 
                  : 'text-gray-400'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[8px] font-black uppercase tracking-tighter">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
