import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Input } from '../components/Input';
import { supabase } from '../lib/supabase';
import { ArrowDownLeft, ArrowUpRight, Coins, Trophy, QrCode, TrendingUpDown, Clock, TrendingUp, Megaphone, X as CloseIcon } from 'lucide-react';
import { Link } from 'react-router';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  Investment, 
  calculateCurrentAmount, 
  getOrganicOscillation, 
  getVolatilityByType,
  getInvestmentColor 
} from '../lib/investment-utils';

type Transaction = {
  id: string;
  amount: number;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  sender: { full_name: string };
  receiver: { full_name: string };
};

type TransactionItem = {
  id: string;
  amount: number;
  created_at: string;
  type: 'transfer' | 'redemption';
  is_received: boolean;
  participant_name?: string;
  category_name?: string;
};

export function Dashboard() {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<TransactionItem[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const { rate: liveRate, formatValue: formatBRL } = useExchangeRate();
  const [calcValue, setCalcValue] = useState<string>('');
  const [calcMode, setCalcMode] = useState<'UR_TO_BRL' | 'BRL_TO_UR'>('UR_TO_BRL');
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [selectedInvId, setSelectedInvId] = useState<string | 'all'>('all');
  const [selicRate, setSelicRate] = useState<number>(10.5);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [closedAnns, setClosedAnns] = useState<string[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (profile) {
      fetchActivities();
      fetchInvestments();
      fetchSelic();
      fetchAnnouncements();
    }
  }, [profile, showAll]);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        if (error.code === '42P01') return; // Table not created yet
        throw error;
      }
      
      // Filter in JS for simplicity with array targeting
      const filtered = (data || []).filter(ann => 
        ann.target_grades.includes('TODOS') || 
        (profile?.grade && ann.target_grades.includes(profile.grade))
      );
      
      setAnnouncements(filtered);
    } catch (err) {
      console.error("Error fetching announcements:", err);
    }
  };

  // Update chart every 5 seconds for "real-time" feel
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      // Fetch transfers
      const { data: transfers, error: txError } = await supabase
        .from('transactions')
        .select(`
          id, amount, created_at, sender_id, receiver_id,
          sender:profiles!sender_id(full_name),
          receiver:profiles!receiver_id(full_name)
        `)
        .or(`sender_id.eq.${profile?.id},receiver_id.eq.${profile?.id}`)
        .order('created_at', { ascending: false })
        .limit(showAll ? 100 : 5);

      if (txError) throw txError;

      // Fetch redemptions
      const { data: redemptions, error: invError } = await supabase
        .from('investments')
        .select('id, redeemed_amount, redeemed_at, type')
        .eq('user_id', profile?.id)
        .not('redeemed_at', 'is', null)
        .order('redeemed_at', { ascending: false })
        .limit(showAll ? 100 : 5);

      if (invError) throw invError;

      // Map and unify
      const unified: TransactionItem[] = [
        ...(transfers || []).map((tx: any) => ({
          id: tx.id,
          amount: tx.amount,
          created_at: tx.created_at,
          type: 'transfer' as const,
          is_received: tx.receiver_id === profile?.id,
          participant_name: (tx.receiver_id === profile?.id 
            ? (Array.isArray(tx.sender) ? tx.sender[0]?.full_name : tx.sender?.full_name)
            : (Array.isArray(tx.receiver) ? tx.receiver[0]?.full_name : tx.receiver?.full_name))
        })),
        ...(redemptions || []).map(inv => ({
          id: inv.id,
          amount: inv.redeemed_amount || 0,
          created_at: inv.redeemed_at!,
          type: 'redemption' as const,
          is_received: true, // Redemptions always add money to balance
          category_name: inv.type
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setActivities(showAll ? unified : unified.slice(0, 5));
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvestments = async () => {
    try {
      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', profile?.id)
        .is('redeemed_at', null);

      if (error) throw error;
      setInvestments(data as Investment[]);
    } catch (error) {
      console.error('Error fetching investments:', error);
    }
  };

  const fetchSelic = async () => {
    try {
      const res = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json');
      const data = await res.json();
      if (data && data.length > 0 && data[0].valor) {
        setSelicRate(Number(data[0].valor));
      }
    } catch {
      console.warn("Using fallback SELIC 10.50%");
    }
  };

  // Generate multi-series chart data
  const getChartData = () => {
    if (investments.length === 0) return [];
    
    const data = [];
    const now = Date.now();
    
    // Generate 15 points (every 2 minutes for 30 mins)
    for (let i = 0; i <= 15; i++) {
      const timeOffset = (15 - i) * 120; // Seconds back
      const date = new Date(now - (timeOffset * 1000));
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      const point: any = {
        time: `${hours}:${minutes}`,
        timestamp: date.getTime(),
      };

      investments.forEach(inv => {
        const volatility = getVolatilityByType(inv.type);
        const seed = inv.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const wave = getOrganicOscillation(date.getTime() / 1000, seed, volatility || 0.02);
        // We use the type as the key for better tooltip display
        point[inv.type] = Number((100 * (1 + wave)).toFixed(2));
      });
      
      data.push(point);
    }
    return data;
  };

  const chartData = getChartData();

  return (
    <div className="space-y-10 pb-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-black tracking-tight mb-2">
            Olá, {profile?.full_name?.split(' ')[0]}! <span className="animate-pulse">👋</span>
          </h1>
          <p className="text-gray-500 font-medium text-base md:text-lg">Seu resumo financeiro e atividades recentes.</p>
        </div>
        {!profile?.is_admin && (
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-[24px] md:rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 w-fit">
            <div className="text-left">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Valor na Feira</p>
              <p className="text-lg md:text-xl font-black text-brand-orange">{formatBRL(profile?.balance || 0)}</p>
            </div>
          </div>
        )}
      </header>

      {/* Announcements */}
      {announcements.filter(a => !closedAnns.includes(a.id)).length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {announcements.filter(a => !closedAnns.includes(a.id)).map(ann => (
            <div 
              key={ann.id} 
              className="bg-black text-white p-6 rounded-[32px] shadow-2xl relative overflow-hidden group hover:scale-[1.01] transition-transform"
            >
              <div className="absolute top-0 right-0 p-12 bg-brand-orange/20 rounded-full -mr-6 -mt-6 blur-3xl" />
              <div className="relative z-10 flex items-start gap-4">
                <div className="w-12 h-12 bg-brand-orange rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-brand-orange/40">
                  <Megaphone className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <h3 className="font-black text-xl tracking-tight">{ann.title}</h3>
                    <button 
                      onClick={() => setClosedAnns([...closedAnns, ann.id])}
                      className="text-white/20 hover:text-white transition-colors"
                    >
                      <CloseIcon className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-white/60 leading-relaxed font-medium">{ann.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Stats Block */}
        <div className="lg:col-span-8 flex flex-col gap-6 md:gap-8">
          <Card className="bg-gradient-to-br from-brand-orange via-[#FF9D52] to-[#F27D26] text-white border-none min-h-[220px] md:min-h-[280px] p-1 shadow-2xl shadow-brand-orange/20 relative group">
            <div className="absolute top-0 right-0 p-24 md:p-32 bg-white/10 rounded-full -mr-12 md:-mr-16 -mt-12 md:-mt-16 blur-2xl group-hover:scale-110 transition-transform duration-700" />
            <CardContent className="p-6 md:p-10 flex flex-col justify-between h-full relative z-10">
              <div>
                <p className="text-[10px] md:text-sm font-black uppercase tracking-[0.2em] text-white/70 mb-4 md:mb-8">
                  Patrimônio Consolidado
                </p>
                <div className="flex items-baseline gap-2 md:gap-4">
                  <h2 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter">
                    {profile?.is_admin ? '∞' : (profile?.balance || 0).toLocaleString()}
                  </h2>
                  <span className="text-xl md:text-2xl font-black text-white/50 uppercase">UR</span>
                </div>
              </div>
              
              {!profile?.is_admin && (
                <div className="flex items-center gap-2 mt-6 md:mt-8">
                  <span className="px-3 py-1.5 md:px-4 md:py-2 bg-white/20 backdrop-blur-md rounded-full text-[10px] md:text-sm font-black border border-white/10">
                    Estudante
                  </span>
                  <span className="px-3 py-1.5 md:px-4 md:py-2 bg-white/20 backdrop-blur-md rounded-full text-[10px] md:text-sm font-black border border-white/10">
                    {profile?.grade || 'Sem Turma'}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to={profile?.is_admin ? "/admin" : "/transfer"} className="block group">
              <div className="bg-white p-4 md:p-6 rounded-[28px] md:rounded-[32px] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col h-full">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-orange-50 text-brand-orange flex items-center justify-center mb-3 md:mb-4 transition-transform group-hover:scale-110">
                  <ArrowUpRight className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <p className="font-black text-black leading-tight uppercase text-[10px] md:text-xs tracking-widest mb-1">Mover</p>
                <p className="text-gray-400 font-bold text-[8px] md:text-[10px] uppercase">{profile?.is_admin ? 'Gerar' : 'Enviar'}</p>
              </div>
            </Link>

            <Link to="/investments" className="block group">
              <div className="bg-white p-4 md:p-6 rounded-[28px] md:rounded-[32px] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col h-full">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 md:mb-4 transition-transform group-hover:scale-110">
                  <TrendingUp className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <p className="font-black text-black leading-tight uppercase text-[10px] md:text-xs tracking-widest mb-1">Investir</p>
                <p className="text-gray-400 font-bold text-[8px] md:text-[10px] uppercase">Rendimento</p>
              </div>
            </Link>

            <Link to="/my-qr" className="block group">
              <div className="bg-white p-4 md:p-6 rounded-[28px] md:rounded-[32px] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col h-full">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 md:mb-4 transition-transform group-hover:scale-110">
                  <QrCode className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <p className="font-black text-black leading-tight uppercase text-[10px] md:text-xs tracking-widest mb-1">Receber</p>
                <p className="text-gray-400 font-bold text-[8px] md:text-[10px] uppercase">QR Code</p>
              </div>
            </Link>

            <Link to="/ranking" className="block group">
              <div className="bg-white p-4 md:p-6 rounded-[28px] md:rounded-[32px] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col h-full">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-yellow-50 text-yellow-600 flex items-center justify-center mb-3 md:mb-4 transition-transform group-hover:scale-110">
                  <Trophy className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <p className="font-black text-black leading-tight uppercase text-[10px] md:text-xs tracking-widest mb-1">Ranking</p>
                <p className="text-gray-400 font-bold text-[8px] md:text-[10px] uppercase">Escola</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Sidebar Blocks */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card className="border-none shadow-xl bg-gray-900 text-white p-2">
            <CardHeader className="border-white/5 pb-2">
              <CardTitle className="text-white text-md flex items-center gap-2">
                <TrendingUpDown className="w-5 h-5 text-brand-orange" />
                Câmbio Atual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 px-4">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5 text-center">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">Cotação 1:1</p>
                <p className="text-4xl font-black tracking-tighter">R$ {liveRate.toFixed(2)}</p>
                <p className="text-[10px] text-brand-orange font-bold mt-2 uppercase">Mercado em Alta</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded-full" />
                    <span className="text-xs font-bold">SELIC</span>
                  </div>
                  <span className="text-xs font-black">{selicRate.toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl font-bold">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full" />
                    <span className="text-xs font-bold">CDI</span>
                  </div>
                  <span className="text-xs font-black">{(selicRate - 0.1).toFixed(2)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-none shadow-xl">
            <CardHeader className="border-gray-50">
              <CardTitle className="text-md font-black flex items-center gap-2">
                <Clock className="w-5 h-5 text-brand-orange" />
                Últimas Atividades
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activities.length === 0 ? (
                <div className="p-10 text-center text-gray-300 font-bold uppercase text-[10px] tracking-widest">
                  Sem movimentos
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {activities.slice(0, 4).map(act => (
                    <div key={act.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${act.is_received ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {act.is_received ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-black truncate max-w-[120px]">
                            {act.participant_name || act.category_name}
                          </p>
                          <p className="text-[8px] font-bold text-gray-400">{new Date(act.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-black ${act.is_received ? 'text-green-600' : 'text-red-500'}`}>
                        {act.is_received ? '+' : '-'}{act.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analytical Section */}
      {!profile?.is_admin && investments.length > 0 && (
        <Card className="border-none shadow-2xl p-2 bg-white">
          <CardHeader className="border-gray-50">
            <CardTitle className="flex items-center gap-2">
              <TrendingUpDown className="w-6 h-6 text-brand-orange" />
              Evolução dos Investimentos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-8">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    {Array.from(new Set(investments.map(i => i.type))).map((type) => {
                      const safeId = type.replace(/[^a-z0-9]/gi, '-');
                      return (
                        <linearGradient key={`grad-${type}`} id={`color-${safeId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={getInvestmentColor(type)} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={getInvestmentColor(type)} stopOpacity={0}/>
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 'bold', fill: '#9ca3af' }}
                    dy={10}
                  />
                  <YAxis 
                    hide
                    domain={['dataMin - 10', 'dataMax + 10']}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '20px', 
                      border: 'none', 
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                      padding: '12px 16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(8px)'
                    }}
                    itemStyle={{ fontWeight: '900', textTransform: 'uppercase', fontSize: '10px' }}
                    labelStyle={{ fontWeight: '900', color: '#000', marginBottom: '4px', fontSize: '12px' }}
                  />
                  {/* Distinct investments by type */}
                  {Array.from(new Set(investments.map(i => i.type))).map((type) => {
                    const safeId = type.replace(/[^a-z0-9]/gi, '-');
                    return (
                      <Area 
                        key={type}
                        type="monotone" 
                        dataKey={type} 
                        name={type}
                        stroke={getInvestmentColor(type)} 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill={`url(#color-${safeId})`}
                        animationDuration={1500}
                        connectNulls
                      />
                    );
                  })}
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    iconType="circle"
                    content={(props) => {
                      const { payload } = props;
                      return (
                        <div className="flex flex-wrap justify-end gap-x-4 gap-y-2 mb-6">
                          {payload?.map((entry: any, index: number) => (
                            <div key={`item-${index}`} className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                              <span className="text-[9px] font-black text-gray-400 tracking-tight uppercase whitespace-nowrap">
                                {entry.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
