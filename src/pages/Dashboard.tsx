import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { supabase } from '../lib/supabase';
import { ArrowDownLeft, ArrowUpRight, Coins, Trophy, QrCode } from 'lucide-react';
import { Link } from 'react-router';

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

  useEffect(() => {
    if (profile) {
      fetchTransactions();
    }
  }, [profile]);

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

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas Movimentações</CardTitle>
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
                        <p className="text-sm text-gray-500">
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
  );
}
