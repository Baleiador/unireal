import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { supabase } from '../lib/supabase';
import { ArrowDownLeft, ArrowUpRight, Coins, Trophy, QrCode, TrendingUpDown } from 'lucide-react';
import { Link } from 'react-router';
import { formatBRL, getLiveRate } from '../constants';

type Transaction = {
  id: string;
  amount: number;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  sender: { full_name: string };
  receiver: { full_name: string };
};

export function Dashboard() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveRate, setLiveRate] = useState<number>(0.10);
  const [formattedBalance, setFormattedBalance] = useState<string>('R$ 0,00');

  useEffect(() => {
    if (profile) {
      fetchTransactions();
      updateLiveValues();
    }
  }, [profile]);

  const updateLiveValues = async () => {
    if (profile) {
      const rate = await getLiveRate();
      setLiveRate(rate);
      const formatted = await formatBRL(profile.balance || 0);
      setFormattedBalance(formatted);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id, amount, created_at, sender_id, receiver_id,
          sender:profiles!sender_id(full_name),
          receiver:profiles!receiver_id(full_name)
        `)
        .or(`sender_id.eq.${profile?.id},receiver_id.eq.${profile?.id}`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setTransactions(data as unknown as Transaction[]);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

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
                  Equivale a <span className="text-white font-bold">{formattedBalance}</span> para a feira
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
        {/* Recent Transactions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Últimas Movimentações</CardTitle>
              <Link to="/transfer" className="text-brand-orange text-sm font-bold hover:underline">Ver tudo</Link>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Carregando...</div>
              ) : transactions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Nenhuma movimentação recente.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {transactions.map((tx) => {
                    const isReceived = tx.receiver_id === profile?.id;
                    return (
                      <div key={tx.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            isReceived ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {isReceived ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                          </div>
                          <div>
                            <p className="font-semibold text-black">
                              {isReceived ? 'Recebido de' : 'Enviado para'} {isReceived ? tx.sender?.full_name : tx.receiver?.full_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(tx.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className={`text-lg font-bold ${isReceived ? 'text-green-600' : 'text-red-600'}`}>
                          {isReceived ? '+' : '-'}{tx.amount} UR
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
              Câmbio Sugerido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center p-4 bg-white rounded-2xl shadow-sm border border-brand-orange/10">
              <p className="text-xs text-gray-400 font-bold uppercase mb-1">Cotação Atual</p>
              <p className="text-2xl font-black text-black">1 UR = R$ {liveRate.toFixed(2)}</p>
              <p className="text-[10px] text-gray-400 mt-1 italic">Cada Unireal vale R$ {liveRate.toFixed(2)} reais</p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-gray-700">Tabela de Preços (Simulação)</h4>
              <div className="p-3 bg-white rounded-xl border border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">Snack / Doce (50 UR)</span>
                <span className="text-brand-orange font-black">R$ {(50 * liveRate).toFixed(2)}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">Bebida (40 UR)</span>
                <span className="text-brand-orange font-black">R$ {(40 * liveRate).toFixed(2)}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">Item Colecionável (200 UR)</span>
                <span className="text-brand-orange font-black">R$ {(200 * liveRate).toFixed(2)}</span>
              </div>
            </div>

            <div className="p-4 bg-orange-100 rounded-xl">
              <p className="text-[11px] text-brand-orange leading-relaxed">
                Este câmbio ajuda você a entender o valor real do seu esforço. Use seus <strong>Investimentos</strong> para fazer esse valor crescer até o dia da feira!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
