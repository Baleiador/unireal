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

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-black mb-2 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-brand-orange" />
            Ranking Escolar
          </h1>
          <p className="text-gray-500">Veja quem são os alunos com mais Unireais.</p>
        </div>
        <div>
          <select
            className="px-4 py-2 rounded-xl border border-gray-200 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 outline-none transition-all bg-white font-medium text-gray-700"
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
          >
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </header>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando ranking...</div>
          ) : profiles.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhum aluno encontrado.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {profiles.map((profile, index) => {
                const isTop3 = index < 3;
                return (
                  <div key={profile.id} className={`p-6 flex items-center justify-between transition-colors ${
                    index === 0 ? 'bg-orange-50/50' : 'hover:bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-6">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                        index === 0 ? 'bg-yellow-100 text-yellow-600' :
                        index === 1 ? 'bg-gray-200 text-gray-600' :
                        index === 2 ? 'bg-orange-100 text-orange-600' :
                        'bg-gray-100 text-gray-400'
                      }`}>
                        {index === 0 ? <Crown className="w-6 h-6" /> :
                         index === 1 ? <Medal className="w-6 h-6" /> :
                         index === 2 ? <Medal className="w-6 h-6" /> :
                         `#${index + 1}`}
                      </div>
                      <div>
                        <p className={`font-semibold text-lg ${index === 0 ? 'text-brand-orange' : 'text-black'}`}>
                          {profile.full_name}
                        </p>
                        {profile.grade && (
                          <p className="text-sm text-gray-500">{profile.grade}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-black">
                        {profile.balance} <span className="text-sm font-medium text-gray-400 uppercase">UR</span>
                      </div>
                      <div className="text-[10px] font-bold text-gray-400">
                        {formatBRL(profile.balance)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
