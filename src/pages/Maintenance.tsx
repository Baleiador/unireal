import React from 'react';
import { Hammer, Lock, Megaphone } from 'lucide-react';
import { Button } from '../components/Button';
import { supabase } from '../lib/supabase';

export function Maintenance({ message }: { message: string }) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 text-white overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-orange blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-600 blur-[120px] animate-pulse delay-700" />
      </div>

      <div className="max-w-xl w-full text-center relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="mb-10 inline-flex items-center justify-center w-24 h-24 bg-brand-orange/20 rounded-3xl border border-brand-orange/30 shadow-2xl shadow-brand-orange/20">
          <Lock className="w-12 h-12 text-brand-orange" />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">
          Acesso <span className="text-brand-orange">Suspenso</span> Temporariamente
        </h1>
        
        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-3xl mb-10 shadow-xl">
          <div className="flex items-center gap-3 text-brand-orange mb-4 justify-center uppercase text-xs font-black tracking-widest">
            <Megaphone className="w-4 h-4" />
            Comunicado da Gestão
          </div>
          <p className="text-gray-300 text-lg leading-relaxed whitespace-pre-line italic font-medium">
            "{message || 'O sistema está passando por ajustes técnicos. Por favor, tente novamente mais tarde.'}"
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <div className="p-4 bg-white/5 rounded-2xl flex items-center gap-3 border border-white/5 text-sm text-gray-400">
            <Hammer className="w-5 h-5 text-brand-orange" />
            <span>Estamos trabalhando para sua melhor experiência.</span>
          </div>
        </div>

        <button 
          onClick={handleSignOut}
          className="mt-12 text-gray-500 hover:text-white transition-colors uppercase text-xs font-black tracking-widest border-b border-transparent hover:border-white pb-1"
        >
          Sair da Conta
        </button>
      </div>
      
      <div className="absolute bottom-10 left-10 text-[10px] font-bold text-white/20 uppercase tracking-[0.5em] hidden lg:block">
        Unireal Maintenance Protocol v1.0
      </div>
    </div>
  );
}
