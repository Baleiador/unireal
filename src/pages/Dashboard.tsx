import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Input } from '../components/Input';
import { supabase } from '../lib/supabase';
import { ArrowDownLeft, ArrowUpRight, Coins, Trophy, QrCode, TrendingUpDown, Clock, TrendingUp } from 'lucide-react';
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
  const [, setTick] = useState(0);

  useEffect(() => {
    if (profile) {
      fetchActivities();
      fetchInvestments();
      fetchSelic();
    }
  }, [profile, showAll]);

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
      const virtualSeconds = (now / 1000) - timeOffset;
      const point: any = {
        time: i === 15 ? 'Agora' : `-${(15 - i) * 2}m`,
      };

      investments.forEach(inv => {
        const volatility = getVolatilityByType(inv.type);
        const seed = inv.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        // Base value for the point (simplified normalized to 100 on buy date, or just oscillating around 100 for visual)
        const wave = getOrganicOscillation(virtualSeconds, seed, volatility || 0.02);
        point[inv.id] = Number((100 * (1 + wave)).toFixed(2));
      });
      
      data.push(point);
    }
    return data;
  };

  const chartData = getChartData();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-black mb-2">Olá, {profile?.full_name?.split(' ')[0]}! 👋</h1>
        <p className="text-gray-500">Confira seu saldo e atividades recentes.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Balance Card */}
        <Card className="md:col-span-2 bg-gradient-to-br from-brand-orange to-orange-600 text-white border-none shadow-lg shadow-brand-orange/20">
          <CardContent className="p-8 flex flex-col justify-between h-full">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Coins className="w-8 h-8 text-white" />
              </div>
              <span className="text-xl font-medium text-white/90">
                {profile?.is_admin ? 'Modo Professor' : 'Saldo Atual'}
              </span>
            </div>
            <div>
              <div className="text-6xl font-black tracking-tighter mb-2">
                {profile?.is_admin ? '∞' : (profile?.balance || 0)}
              </div>
              <p className="text-white/80 font-medium tracking-wide uppercase text-sm">
                {profile?.is_admin ? 'Moedas Infinitas' : 'Unireais'}
              </p>
              {!profile?.is_admin && (
                <p className="text-white/60 text-sm mt-3 font-medium bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-md">
                  Equivale a <span className="text-white font-bold">{formatBRL(profile?.balance || 0)}</span> para a feira
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="flex flex-col gap-4">
          <Link to={profile?.is_admin ? "/admin" : "/transfer"}>
            <Card className="hover:border-brand-orange/50 transition-all cursor-pointer border-brand-orange/10 shadow-sm hover:shadow-md hover:-translate-y-1">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-brand-orange shrink-0">
                  <ArrowUpRight className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-black leading-tight">
                    {profile?.is_admin ? 'Gerar Moedas' : 'Transferir'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {profile?.is_admin ? 'Premiar alunos' : 'Enviar para colegas'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {!profile?.is_admin && (
            <Link to="/my-qr">
              <Card className="hover:border-brand-orange/50 transition-all cursor-pointer border-brand-orange/10 shadow-sm hover:shadow-md hover:-translate-y-1">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-brand-orange shrink-0">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-black leading-tight">Receber</h3>
                    <p className="text-xs text-gray-500">Mostrar meu código QR</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          <Link to="/ranking">
            <Card className="hover:border-brand-orange/50 transition-all cursor-pointer border-brand-orange/10 shadow-sm hover:shadow-md hover:-translate-y-1">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-brand-orange shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-black leading-tight">Ranking</h3>
                  <p className="text-xs text-gray-500">Ver líderes</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Investment Evolution Chart */}
        {!profile?.is_admin && investments.length > 0 && (
          <div className="lg:col-span-3">
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader className="bg-gray-50/50 pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUpDown className="w-5 h-5 text-brand-orange" />
                      Análise da Carteira
                    </CardTitle>
                    <p className="text-xs text-gray-500 mt-1">
                      Visualize a performance individual ou comparativa (Escala 100).
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedInvId('all')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        selectedInvId === 'all' 
                          ? 'bg-brand-orange text-white shadow-md shadow-brand-orange/20' 
                          : 'bg-white text-gray-500 border border-gray-200 hover:border-brand-orange'
                      }`}
                    >
                      Todos
                    </button>
                    {investments.map(inv => (
                      <button
                        key={inv.id}
                        onClick={() => setSelectedInvId(inv.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                          selectedInvId === inv.id 
                            ? 'bg-gray-900 text-white shadow-md' 
                            : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-900'
                        }`}
                      >
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: getInvestmentColor(inv.type) }}
                        />
                        {inv.type}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedInvId !== 'all' && (
                  <div className="mt-4 p-3 bg-white rounded-xl border border-gray-100 flex items-center justify-between animate-in fade-in zoom-in-95">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: getInvestmentColor(investments.find(i => i.id === selectedInvId)?.type || '') }}
                      >
                        <Coins className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Ativo Selecionado</p>
                        <p className="text-sm font-black text-gray-900">{investments.find(i => i.id === selectedInvId)?.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Valor Atual Estimado</p>
                      <p className="text-sm font-black text-brand-orange">
                        {calculateCurrentAmount(investments.find(i => i.id === selectedInvId)!, selicRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} UR
                      </p>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {selectedInvId === 'all' ? (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                        <XAxis 
                          dataKey="time" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#9ca3af' }} 
                        />
                        <YAxis 
                          domain={['auto', 'auto']} 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#9ca3af' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '12px', 
                            border: 'none', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            fontSize: '12px'
                          }}
                          formatter={(value, name) => {
                            const inv = investments.find(i => i.id === name);
                            return [`${value} UR`, inv?.type || name];
                          }}
                        />
                        <Legend 
                          verticalAlign="top" 
                          height={36}
                          iconType="circle"
                          formatter={(value) => {
                            const inv = investments.find(i => i.id === value);
                            return <span className="text-[10px] font-bold text-gray-400 uppercase">{inv?.type}</span>;
                          }}
                        />
                        {investments.map(inv => (
                          <Line
                            key={inv.id}
                            type="monotone"
                            dataKey={inv.id}
                            name={inv.id}
                            stroke={getInvestmentColor(inv.type)}
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6 }}
                            animationDuration={500}
                          />
                        ))}
                      </LineChart>
                    ) : (
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="selectedColor" x1="0" y1="0" x2="0" y2="1">
                            <stop 
                              offset="5%" 
                              stopColor={getInvestmentColor(investments.find(i => i.id === selectedInvId)?.type || '')} 
                              stopOpacity={0.3}
                            />
                            <stop 
                              offset="95%" 
                              stopColor={getInvestmentColor(investments.find(i => i.id === selectedInvId)?.type || '')} 
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                        <XAxis 
                          dataKey="time" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#9ca3af' }} 
                        />
                        <YAxis 
                          domain={['auto', 'auto']} 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#9ca3af' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '12px', 
                            border: 'none', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                          formatter={(value) => [`${value} UR`, 'Valor Base']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey={selectedInvId} 
                          stroke={getInvestmentColor(investments.find(i => i.id === selectedInvId)?.type || '')} 
                          strokeWidth={4}
                          fillOpacity={1} 
                          fill="url(#selectedColor)" 
                          animationDuration={500}
                        />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Activities */}
        <div className="lg:col-span-2">
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-gray-50/50 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Fluxo de Caixa</CardTitle>
                  <p className="text-xs text-gray-500 mt-1">Histórico unificado de transfers e investimentos.</p>
                </div>
                <button 
                  onClick={() => setShowAll(!showAll)}
                  className="text-brand-orange text-xs font-black uppercase tracking-widest bg-orange-100 hover:bg-brand-orange hover:text-white px-3 py-1.5 rounded-full transition-all"
                >
                  {showAll ? 'Ver menos' : 'Ver tudo'}
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-gray-400 font-medium">
                  <div className="animate-spin w-6 h-6 border-2 border-brand-orange border-t-transparent rounded-full mx-auto mb-4" />
                  Sincronizando atividades...
                </div>
              ) : activities.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                    <Clock className="w-8 h-8" />
                  </div>
                  <p className="text-gray-500 font-medium text-sm">Nenhuma movimentação para exibir.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {activities.map((act) => {
                    const isRedemption = act.type === 'redemption';
                    return (
                      <div key={act.id} className="group p-5 flex items-center justify-between hover:bg-gray-50 transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                            isRedemption 
                              ? 'bg-purple-50 text-purple-600' 
                              : act.is_received ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {isRedemption ? (
                              <TrendingUp className="w-6 h-6" />
                            ) : act.is_received ? (
                              <ArrowDownLeft className="w-6 h-6" />
                            ) : (
                              <ArrowUpRight className="w-6 h-6" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-900">
                                {isRedemption 
                                  ? 'Resgate de Ativo' 
                                  : act.is_received ? 'Recebido de' : 'Enviado para'}
                              </p>
                              {isRedemption && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-black uppercase rounded-md tracking-wider">
                                  {act.category_name}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 font-medium">
                              {isRedemption ? 'Rendimento de capital' : act.participant_name}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tight">
                              {new Date(act.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-black tracking-tighter ${
                            isRedemption || act.is_received ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {isRedemption || act.is_received ? '+' : '-'}{act.amount.toLocaleString('en-US')}
                            <span className="ml-1 text-[10px] uppercase font-bold">UR</span>
                          </div>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">{isRedemption ? 'Lucro Bruto' : 'Transferência'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Exchange Info Widget */}
        <Card className="bg-brand-orange/5 border-brand-orange/10 h-fit">
          <CardHeader>
            <CardTitle className="text-brand-orange flex items-center gap-2">
              <TrendingUpDown className="w-5 h-5" />
              Câmbio para a Feira
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center p-6 bg-white rounded-3xl shadow-sm border border-brand-orange/10">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-2">Cotação do Dia</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-black text-black">1 UR</span>
                <span className="text-brand-orange font-bold text-xl">=</span>
                <span className="text-3xl font-black text-black">R$ {liveRate.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 font-bold italic tracking-tight">Cada 100 Unireais valem {formatBRL(100)}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-700">Calculadora Rápida</h4>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => {
                      setCalcMode('UR_TO_BRL');
                      setCalcValue('');
                    }}
                    className={`px-3 py-1 text-[10px] font-black uppercase rounded-md transition-all ${
                      calcMode === 'UR_TO_BRL' ? 'bg-white text-brand-orange shadow-sm' : 'text-gray-400'
                    }`}
                  >
                    UR → R$
                  </button>
                  <button
                    onClick={() => {
                      setCalcMode('BRL_TO_UR');
                      setCalcValue('');
                    }}
                    className={`px-3 py-1 text-[10px] font-black uppercase rounded-md transition-all ${
                      calcMode === 'BRL_TO_UR' ? 'bg-white text-brand-orange shadow-sm' : 'text-gray-400'
                    }`}
                  >
                    R$ → UR
                  </button>
                </div>
              </div>
              
              <div className="relative">
                <Input 
                  type="number"
                  placeholder={calcMode === 'UR_TO_BRL' ? "Quantos UR você tem?" : "Quantos Reais você tem?"}
                  className="bg-white pr-12 text-lg font-bold border-gray-200 focus:border-brand-orange transition-colors"
                  value={calcValue}
                  onChange={(e) => setCalcValue(e.target.value)}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs uppercase">
                  {calcMode === 'UR_TO_BRL' ? 'UR' : 'R$'}
                </span>
              </div>
              
              {calcValue && (
                <div className="p-4 bg-gray-900 text-white rounded-2xl text-center animate-in zoom-in-95 duration-200 shadow-lg">
                  <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1">
                    {calcMode === 'UR_TO_BRL' ? 'Valor Estimado em Reais' : 'Valor Estimado em Unireais'}
                  </p>
                  <p className="text-2xl font-black">
                    {calcMode === 'UR_TO_BRL' 
                      ? formatBRL(Number(calcValue)) 
                      : `${(Number(calcValue) / liveRate).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} UR`
                    }
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider text-xs">Exemplos para a Feira</h4>
              <div className="p-3 bg-white/50 rounded-xl border border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Bala / Doce Simples (100 UR)</span>
                <span className="text-black font-black">{formatBRL(100)}</span>
              </div>
              <div className="p-3 bg-white/50 rounded-xl border border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Refrigerante / Suco (500 UR)</span>
                <span className="text-black font-black">{formatBRL(500)}</span>
              </div>
              <div className="p-3 bg-white/50 rounded-xl border border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Lanche Completo (1.500 UR)</span>
                <span className="text-black font-black">{formatBRL(1500)}</span>
              </div>
            </div>

            <div className="p-4 bg-orange-100 rounded-xl">
              <p className="text-[10px] text-brand-orange leading-relaxed font-medium">
                A cotação pode mudar! Fique de olho e use seus <strong>Investimentos</strong> para fazer seu saldo render até o dia da feira.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
