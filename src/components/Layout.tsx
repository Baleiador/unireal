import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
import { LayoutDashboard, Trophy, Send, LogOut, User, PlusCircle, QrCode, TrendingUp, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

export function Layout() {
  const { profile } = useAuth();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown when navigation happens
  useEffect(() => {
    setIsProfileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Investimentos', path: '/investments', icon: TrendingUp },
    { name: 'Ranking', path: '/ranking', icon: Trophy },
    { name: 'Transferir', path: '/transfer', icon: Send },
    { name: 'Meu QR', path: '/my-qr', icon: QrCode },
    { name: 'Perfil', path: '/profile', icon: User },
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
            
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`flex items-center gap-2 p-1 pr-3 rounded-full transition-all border-2 ${
                  isProfileOpen 
                    ? 'bg-brand-orange/5 border-brand-orange' 
                    : 'bg-white border-transparent hover:bg-gray-50'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-brand-orange/10 text-brand-orange flex items-center justify-center font-black border-2 border-brand-orange/20 overflow-hidden shrink-0">
                  {profile?.avatar_url ? (
                    <img 
                      src={profile.avatar_url} 
                      alt="avatar" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    profile?.full_name?.charAt(0).toUpperCase() || <User className="w-5 h-5" />
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute right-0 top-full pt-2 z-50 shadow-2xl"
                  >
                    <div className="bg-white rounded-[24px] shadow-2xl border border-gray-100 p-2 min-w-[240px]">
                      <div className="p-4 border-b border-gray-50 mb-1 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 overflow-hidden shrink-0">
                           {profile?.avatar_url ? (
                            <img 
                              src={profile.avatar_url} 
                              alt="avatar" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-brand-orange font-black">
                              {profile?.full_name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <p className="text-sm font-black text-black truncate">{profile?.full_name}</p>
                          <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest leading-none mt-1">
                            {profile?.is_admin ? 'Administrador' : 'Estudante'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Link
                          to="/profile"
                          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                            <User className="w-4 h-4" />
                          </div>
                          Meu Perfil
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl font-bold text-red-500 hover:bg-red-50 transition-colors text-sm"
                        >
                          <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center">
                            <LogOut className="w-4 h-4" />
                          </div>
                          Sair da Conta
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
