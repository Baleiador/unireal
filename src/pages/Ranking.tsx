import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { supabase } from '../lib/supabase';
import { Trophy, Medal, Crown } from 'lucide-react';
import { useExchangeRate } from '../hooks/useExchangeRate';

type Profile = {
  id: string;
  full_name: string;
  balance: number;
  grade: string | null;
};

export function Ranking() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState<string>('Todos');
  const { formatValue: formatBRL } = useExchangeRate();

  const GRADES = [
    'Todos',
    '6º Ano',
    '7º Ano',
    '8º Ano',
    '9º Ano',
    '1º Ano (Ensino Médio)',
    '2º Ano (Ensino Médio)',
    '3º Ano (Ensino Médio)',
  ];

  useEffect(() => {
    fetchRanking();
  }, [selectedGrade]);

  const fetchRanking = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, balance, grade')
        .eq('is_admin', false)
        .order('balance', { ascending: false })
        .limit(50);

      if (selectedGrade !== 'Todos') {
        query = query.eq('grade', selectedGrade);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  const podium = profiles.slice(0, 3);
  const others = profiles.slice(3);

  return (
    <div className="space-y-12 pb-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
              <Trophy className="w-6 h-6" />
            </div>
            <h1 className="text-4xl font-black text-black tracking-tight underline decoration-brand-orange/30">Destaques da Escola</h1>
          </div>
          <p className="text-gray-500 font-medium text-lg">Os maiores patrimônios do colégio em tempo real.</p>
        </div>
        
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-2">
          <span className="text-[10px] font-black uppercase text-gray-400 px-3 tracking-widest">Filtrar:</span>
          <select
            className="px-4 py-2 rounded-xl bg-gray-50 border-none outline-none font-black text-xs uppercase tracking-wider text-gray-700 appearance-none cursor-pointer hover:bg-gray-100 transition-all"
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
          >
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="py-20 text-center animate-pulse">
          <div className="w-12 h-12 bg-brand-orange/20 rounded-full mx-auto mb-4 border-2 border-brand-orange/30 border-t-brand-orange animate-spin" />
          <p className="text-gray-400 font-black uppercase text-xs tracking-widest">Sincronizando Ranking...</p>
        </div>
      ) : profiles.length === 0 ? (
        <Card className="p-20 text-center border-dashed border-2 bg-gray-50 border-gray-200">
           <Trophy className="w-12 h-12 text-gray-200 mx-auto mb-4" />
           <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">Nenhum aluno encontrado para este filtro.</p>
        </Card>
      ) : (
        <div className="space-y-12">
          {/* Podium */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-4xl mx-auto px-4">
            {/* 2nd Place */}
            {podium[1] && (
              <div className="order-2 md:order-1 flex flex-col items-center">
                <div className="relative mb-4">
                  <div className="w-24 h-24 rounded-3xl bg-gray-100 border-4 border-gray-200 flex items-center justify-center text-gray-400 shadow-xl p-1 overflow-hidden">
                    <img 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${podium[1].id}`} 
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-3 -right-3 w-10 h-10 bg-gray-200 rounded-2xl flex items-center justify-center text-gray-500 font-black border-4 border-white shadow-lg">2</div>
                </div>
                <div className="text-center mb-4">
                  <p className="font-black text-black truncate max-w-[150px]">{podium[1].full_name}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{podium[1].grade}</p>
                </div>
                <div className="w-full bg-gray-200 h-24 rounded-t-3xl shadow-lg border-x border-t border-gray-300 flex items-center justify-center">
                  <span className="text-gray-400 font-black text-xs uppercase tracking-widest opacity-50">Prata</span>
                </div>
              </div>
            )}

            {/* 1st Place */}
            {podium[0] && (
              <div className="order-1 md:order-2 flex flex-col items-center">
                <Crown className="w-8 h-8 text-yellow-500 mb-2 animate-bounce" />
                <div className="relative mb-4">
                  <div className="w-32 h-32 rounded-[40px] bg-yellow-50 border-4 border-yellow-400 flex items-center justify-center text-yellow-600 shadow-2xl p-1 overflow-hidden ring-8 ring-yellow-400/10">
                    <img 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${podium[0].id}`} 
                      alt="avatar"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="absolute -bottom-4 -right-4 w-14 h-14 bg-yellow-400 rounded-[22px] flex items-center justify-center text-white font-black border-4 border-white shadow-xl text-xl">1</div>
                </div>
                <div className="text-center mb-6">
                  <p className="font-black text-lg text-black">{podium[0].full_name}</p>
                  <p className="text-xs text-brand-orange font-bold uppercase tracking-tighter">{podium[0].grade}</p>
                </div>
                <div className="w-full bg-yellow-400/90 h-40 rounded-t-[40px] shadow-2xl border-x border-t border-yellow-500 flex flex-col items-center justify-center gap-1">
                   <p className="text-white text-2xl font-black">{podium[0].balance.toLocaleString()} UR</p>
                   <span className="text-yellow-100 font-black text-[10px] uppercase tracking-[0.3em] opacity-80">Ouro</span>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {podium[2] && (
              <div className="order-3 md:order-3 flex flex-col items-center">
                <div className="relative mb-4">
                  <div className="w-24 h-24 rounded-3xl bg-orange-50 border-4 border-orange-200 flex items-center justify-center text-orange-400 shadow-xl p-1 overflow-hidden">
                    <img 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${podium[2].id}`} 
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-3 -right-3 w-10 h-10 bg-orange-200 rounded-2xl flex items-center justify-center text-orange-600 font-black border-4 border-white shadow-lg">3</div>
                </div>
                <div className="text-center mb-4">
                  <p className="font-black text-black truncate max-w-[150px]">{podium[2].full_name}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{podium[2].grade}</p>
                </div>
                <div className="w-full bg-orange-200 h-20 rounded-t-3xl shadow-lg border-x border-t border-orange-300 flex items-center justify-center">
                  <span className="text-orange-400 font-black text-[10px] uppercase tracking-widest opacity-50">Bronze</span>
                </div>
              </div>
            )}
          </div>

          {/* Others List */}
          <div className="max-w-4xl mx-auto space-y-3">
             <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] pl-6 mb-4">Elite Financeira</h3>
             {others.map((profile, index) => (
                <div 
                  key={profile.id} 
                  className="bg-white p-4 sm:p-6 rounded-[28px] border border-gray-100 shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center font-black text-gray-400 text-sm border border-gray-100 group-hover:bg-brand-orange group-hover:text-white group-hover:border-brand-orange transition-all duration-300">
                      {index + 4}
                    </div>
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm">
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`} 
                        className="w-full h-full"
                        alt="avatar"
                      />
                    </div>
                    <div>
                      <p className="font-black text-black tracking-tight">{profile.full_name}</p>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{profile.grade}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-black">
                      {profile.balance.toLocaleString()} <span className="text-[10px] text-gray-400 uppercase">UR</span>
                    </p>
                    <p className="text-[10px] font-bold text-brand-orange uppercase">{formatBRL(profile.balance)}</p>
                  </div>
                </div>
             ))}
          </div>
        </div>
      )}
    </div>
  );
}
