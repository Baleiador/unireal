import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { supabase } from '../lib/supabase';
import { Briefcase, ShoppingCart, Wallet, History, ShieldCheck, TrendingUpDown, CheckCircle, Tag, TrendingUp, Landmark, BarChart3, Info, AlertTriangle } from 'lucide-react';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Investment, 
  calculateCurrentAmount, 
  getOrganicOscillation, 
  calculateCurrentSharePrice
} from '../lib/investment-utils';

type Product = {
  id: string;
  name: string;
  category: 'conservative' | 'moderate' | 'aggressive';
  description: string;
  basePrice: number;
  volatility: number;
  yieldInfo: string;
};

export function Investments() {
  const { profile, refreshProfile } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [selicRate, setSelicRate] = useState<number>(10.5);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const { formatValue: formatBRL } = useExchangeRate();
  
  // Form states
  const [selectedProduct, setSelectedProduct] = useState<string>('tesouro_selic');
  const [quantity, setQuantity] = useState('1');
  const [investing, setInvesting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'market' | 'portfolio' | 'history'>('market');
  const [remainingCooldown, setRemainingCooldown] = useState<number>(0);
  const [, setTick] = useState(0);

  const products: Product[] = [
    { id: 'tesouro_selic', name: 'Tesouro Selic 2029', category: 'conservative', description: 'O título mais seguro do país. Ideal para reserva de emergência.', basePrice: 100, volatility: 0.01, yieldInfo: 'SELIC (10.5% a.a)' },
    { id: 'cdb_110', name: 'CDB Prime 110% CDI', category: 'conservative', description: 'Empréstimo para bancos de primeira linha com retorno superior.', basePrice: 50, volatility: 0.02, yieldInfo: '110% do CDI' },
    { id: 'poupanca', name: 'Poupança Digital', category: 'conservative', description: 'O investimento mais tradicional e simples para iniciantes.', basePrice: 10, volatility: 0.01, yieldInfo: '0.5% ao mês + TR' },
    { id: 'lci_imob', name: 'LCI Imobiliário', category: 'conservative', description: 'Investimento isento em títulos que financiam o mercado de imóveis.', basePrice: 300, volatility: 0.03, yieldInfo: '92% do CDI' },
    { id: 'lca_agro', name: 'LCA Agronegócio', category: 'moderate', description: 'Financie a produção agrícola nacional com isenção de taxas.', basePrice: 200, volatility: 0.06, yieldInfo: '95% do CDI' },
    { id: 'debenture_infra', name: 'Debênture Infra', category: 'moderate', description: 'Títulos de dívida de empresas que constroem a infraestrutura do país.', basePrice: 150, volatility: 0.12, yieldInfo: 'IPCA + 6%' },
    { id: 'etf_global', name: 'ETF Global IVVB11', category: 'moderate', description: 'Replica as 500 maiores empresas dos EUA (S&P 500).', basePrice: 250, volatility: 0.18, yieldInfo: 'Variação Cambial + Bolsas' },
    { id: 'fii_renda', name: 'Fundo Imobiliário', category: 'moderate', description: 'Seja dono de partes de shoppings e galpões e receba proventos.', basePrice: 85, volatility: 0.15, yieldInfo: 'Dividendos Mensais' },
  ];

  const currentProduct = products.find(p => p.id === selectedProduct) || products[0];

  const getProductName = (slug: string) => {
    return products.find(p => p.id === slug)?.name || '';
  };

  const checkCooldown = async (slug: string) => {
    if (!profile) return;
    const typeName = getProductName(slug);
    
    try {
      // Check user's last redemption
      const { data: lastRedeem, error: lastError } = await supabase
        .from('investments')
        .select('redeemed_at')
        .eq('user_id', profile.id)
        .eq('type', typeName)
        .not('redeemed_at', 'is', null)
        .order('redeemed_at', { ascending: false })
        .limit(1);

      if (lastError) throw lastError;

      if (lastRedeem && lastRedeem.length > 0) {
        const lastTime = new Date(lastRedeem[0].redeemed_at).getTime();
        const now = new Date().getTime();
        const secondsPassed = (now - lastTime) / 1000;
        const cooldownNeeded = 86400; // 24 hours lock
        
        if (secondsPassed < cooldownNeeded) {
          setRemainingCooldown(Math.ceil(cooldownNeeded - secondsPassed));
        } else {
          setRemainingCooldown(0);
        }
      } else {
        setRemainingCooldown(0);
      }
    } catch (err) {
      console.error("Error checking cooldown:", err);
    }
  };

  useEffect(() => {
    if (selectedProduct) {
      checkCooldown(selectedProduct);
    }
  }, [selectedProduct]);

  // Tick for countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingCooldown(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const fetchInvestments = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') setDbError(true);
        return;
      }
      setInvestments(data || []);
      setDbError(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSelic();
    fetchInvestments();
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [profile]);

  const handleInvest = async () => {
    if (!profile || !selectedProduct) return;
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg("Quantidade inválida.");
      return;
    }
    
    const totalCost = qty * currentProduct.basePrice;

    if (totalCost > (profile.balance || 0)) {
      setErrorMsg("Saldo insuficiente para esta compra.");
      return;
    }

    setInvesting(true);
    setErrorMsg('');
    setSuccessMsg('');

    // Re-check cooldown just before investing to be safe
    await checkCooldown(selectedProduct);
    if (remainingCooldown > 0) {
      setErrorMsg(`Aguarde o período de resfriamento (${remainingCooldown}s) para comprar este título novamente.`);
      setInvesting(false);
      return;
    }

    try {
      // Create investment record
      const { error: investError } = await supabase
        .from('investments')
        .insert({
          user_id: profile.id,
          type: currentProduct.name,
          amount: totalCost,
          quantity: qty,
          purchase_unit_price: currentProduct.basePrice,
          rate_type: 'FIXED',
          rate_value: 5, // Base default drift
        });

      if (investError) throw investError;

      // Update balance
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ balance: (profile.balance || 0) - totalCost })
        .eq('id', profile.id);

      if (balanceError) throw balanceError;

      setSuccessMsg(`Você comprou ${qty} títulos de ${currentProduct.name}!`);
      setQuantity('1');
      await refreshProfile();
      await fetchInvestments();
      
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error: any) {
      setErrorMsg(error.message || "Erro ao processar compra.");
    } finally {
      setInvesting(false);
    }
  };

  const handleRedeem = async (inv: Investment) => {
    if (inv.redeemed_at) return;
    try {
      const currentVal = calculateCurrentAmount(inv);
      
      const roundedCurrentVal = Math.round(currentVal);
      
      const { error: updateInvError } = await supabase
        .from('investments')
        .update({ 
          redeemed_at: new Date().toISOString(),
          redeemed_amount: roundedCurrentVal
        })
        .eq('id', inv.id);
        
      if (updateInvError) throw updateInvError;
      
      const { data: userData, error: userError } = await supabase.from('profiles').select('balance').eq('id', profile?.id).single();
      if (userError) throw userError;
      
      const newBalance = Math.round((userData?.balance || 0) + currentVal);
      
      const { error: profileUpdateError } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', profile?.id);
      if (profileUpdateError) throw profileUpdateError;
      
      await fetchInvestments();
      await refreshProfile();
      alert(`Você vendeu seus títulos por ${roundedCurrentVal} UR!`);
    } catch(err: any) {
      console.error(err);
      alert(`Erro ao vender: ${err?.message || 'Desconhecido'}`);
    }
  };

  // Calculate portfolio totals
  const activeInvestments = investments.filter(inv => !inv.redeemed_at);
  const totalInvested = activeInvestments.reduce((acc, inv) => acc + inv.amount, 0);
  const totalCurrentValue = activeInvestments.reduce((acc, inv) => acc + calculateCurrentAmount(inv), 0);
  const totalProfit = totalCurrentValue - totalInvested;

  if (dbError) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-red-50 text-red-800 p-6 rounded-2xl border border-red-200">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" />
            Configuração Necessária
          </h2>
          <p className="mb-4">Para usar os investimentos, você precisa criar a tabela no banco de dados.</p>
          <p className="mb-2 font-medium">Rode este código no "SQL Editor" do Supabase:</p>
          <pre className="bg-red-900/10 p-4 rounded-xl text-sm overflow-x-auto whitespace-pre-wrap font-mono">
{`-- 1. Criar a tabela de investimentos (usando numeric para suportar decimais)
CREATE TABLE public.investments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  amount numeric not null,
  rate_type text not null,
  rate_value numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  redeemed_at timestamp with time zone,
  redeemed_amount numeric
);

-- 2. CORRIGIR TABELA PROFILES (IMPORTANTE para evitar erro de syntax integer)
-- Se receber erro ao resgatar, rode este comando para permitir decimais no saldo:
ALTER TABLE public.profiles ALTER COLUMN balance TYPE numeric;

-- 3. Habilitar RLS
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

-- 4. Criar Políticas
CREATE POLICY "Users can view their own investments" 
  ON public.investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own investments" 
  ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own investments"
  ON public.investments FOR UPDATE USING (auth.uid() = user_id);`}
          </pre>
          <Button onClick={fetchInvestments} className="mt-4">Já criei a tabela</Button>
        </div>
      </div>
    );
  }

  const cdiRate = Math.max(selicRate - 0.10, 0).toFixed(2);

  // Generate chart data based on active product
  const getProductChartData = () => {
    if (!selectedProduct) return [];
    
    let volatility = 0.02;
    // Lower volatility as defaults for conservative/moderate

    const data = [];
    const now = Date.now();
    const seed = selectedProduct.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Generate 30 points (representing "recent history")
    for (let i = 0; i <= 30; i++) {
      const timeOffset = (30 - i) * 60; // Offset in seconds (every minute for 30 mins)
      const virtualSeconds = (now / 1000) - timeOffset;
      
      const wave = getOrganicOscillation(virtualSeconds, seed, volatility);
      const value = 100 * (1 + wave);
      
      data.push({
        time: i === 30 ? 'Agora' : `-${30 - i}m`,
        valor: Number(value.toFixed(2)),
      });
    }
    return data;
  };

  const chartData = getProductChartData();

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <Briefcase className="w-10 h-10 text-brand-orange" />
            Mercado de Títulos
          </h1>
          <p className="text-gray-500 mt-1 font-medium">Compre ativos e gerencie sua carteira de investimentos.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveTab('market')}
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'market' ? 'bg-white text-brand-orange shadow-lg' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <ShoppingCart className="w-4 h-4" /> MERCADO
          </button>
          <button 
            onClick={() => setActiveTab('portfolio')}
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'portfolio' ? 'bg-white text-brand-orange shadow-lg' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <Wallet className="w-4 h-4" /> MINHA CARTEIRA
            {activeInvestments.length > 0 && <span className="w-5 h-5 bg-brand-orange text-white text-[10px] rounded-full flex items-center justify-center animate-pulse">{activeInvestments.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-white text-brand-orange shadow-lg' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <History className="w-4 h-4" /> HISTÓRICO
          </button>
        </div>
      </header>

      {activeTab === 'market' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map(product => (
              <div 
                key={product.id} 
                className={`relative overflow-hidden cursor-pointer transition-all border-2 rounded-xl bg-white ${selectedProduct === product.id ? 'border-brand-orange ring-4 ring-brand-orange/10 scale-[1.02]' : 'border-gray-100 hover:border-gray-300'}`}
                onClick={() => setSelectedProduct(product.id)}
              >
                {selectedProduct === product.id && <div className="absolute top-0 right-0 p-3 bg-brand-orange text-white rounded-bl-xl"><CheckCircle className="w-4 h-4" /></div>}
                <div className="p-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                    product.category === 'conservative' ? 'bg-green-50 text-green-600' :
                    product.category === 'moderate' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {product.id === 'crypto_strat' ? <TrendingUpDown className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                  </div>
                  <h3 className="font-black text-lg text-gray-900 mb-1">{product.name}</h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{product.description}</p>
                  <div className="flex items-end justify-between mt-auto">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Expectativa</p>
                      <p className="font-bold text-gray-700">{product.yieldInfo}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Preço/Título</p>
                      <p className="text-xl font-black text-brand-orange">{product.basePrice} UR</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <Card className="sticky top-6 border-none shadow-2xl overflow-hidden bg-white">
              <div className="bg-gray-900 p-8 text-white">
                <div className="flex items-center gap-3 mb-6">
                  <Tag className="w-6 h-6 text-brand-orange" />
                  <h2 className="text-xl font-black uppercase tracking-tight">Ordem de Compra</h2>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Título Selecionado</label>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <p className="font-bold text-lg">{currentProduct.name}</p>
                      <p className="text-xs text-brand-orange font-bold uppercase">Risco Controlado</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Quantidade de Títulos</label>
                    <Input 
                      type="number" 
                      min="1"
                      className="bg-white/10 border-white/20 text-white text-xl font-black h-16 rounded-2xl focus:border-brand-orange transition-all"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                    />
                  </div>

                  <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total a Pagar</p>
                      <p className="text-3xl font-black text-brand-orange">{(Number(quantity) * currentProduct.basePrice).toLocaleString()} UR</p>
                    </div>
                  </div>

                  <Button 
                    className="w-full h-16 rounded-2xl text-lg font-black shadow-xl shadow-brand-orange/20"
                    onClick={handleInvest}
                    disabled={investing || remainingCooldown > 0}
                  >
                    {investing ? 'Processando...' : remainingCooldown > 0 ? `Aguarde ${remainingCooldown}s` : 'Confirmar Compra'}
                  </Button>

                  {errorMsg && <p className="text-red-400 text-xs font-bold animate-pulse text-center">{errorMsg}</p>}
                  {successMsg && <p className="text-green-400 text-xs font-bold text-center">{successMsg}</p>}
                </div>
              </div>
              <CardContent className="p-6 bg-gray-50 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 font-medium">Seu Saldo:</span>
                  <span className="font-black text-gray-900">{profile?.balance?.toLocaleString()} UR</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'portfolio' && (
        <div className="animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card className="bg-white border-orange-100">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-brand-orange">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Investido</p>
                  <p className="text-2xl font-black text-gray-900">{Math.round(totalInvested).toLocaleString()} UR</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-orange-100">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor de Mercado</p>
                  <p className="text-2xl font-black text-green-600">{Math.round(totalCurrentValue).toLocaleString()} UR</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-orange-100">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <TrendingUpDown className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lucro Total</p>
                  <p className={`text-2xl font-black ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalProfit >= 0 ? '+' : ''}{Math.round(totalProfit).toLocaleString()} UR
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
          {activeInvestments.length === 0 ? (
            <Card className="p-20 text-center border-dashed border-2 bg-gray-50">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
                <BarChart3 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Sua carteira está vazia</h2>
              <p className="text-gray-500 max-w-sm mx-auto">Vá ao mercado e compre seus primeiros títulos para começar a lucrar.</p>
              <Button variant="outline" className="mt-8 rounded-xl" onClick={() => setActiveTab('market')}>Ver Mercado</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeInvestments.map(inv => {
                const isDiscontinued = !products.find(p => p.name === inv.type);
                const currentTotal = calculateCurrentAmount(inv);
                const pnl = ((currentTotal - inv.amount) / inv.amount) * 100;
                const unitPrice = currentTotal / (inv.quantity || 1);
                
                return (
                  <div key={inv.id}>
                    <Card className={`group hover:shadow-2xl transition-all border-none bg-white overflow-hidden shadow-sm ${isDiscontinued ? 'ring-2 ring-red-500/20' : ''}`}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg font-black text-gray-900">{inv.type}</CardTitle>
                              {isDiscontinued && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[8px] font-black uppercase rounded-full flex items-center gap-1">
                                  <AlertTriangle className="w-2 h-2" /> Descontinuado
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              {inv.quantity || 1} Títulos • Comprados em {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 ${pnl >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {pnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            {pnl.toFixed(1)}%
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="bg-gray-50 p-6 rounded-2xl flex justify-between items-center relative overflow-hidden">
                          <div className="relative z-10">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor Atual Total</p>
                            <p className={`text-3xl font-black ${pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {Math.round(currentTotal)} <span className="text-sm">UR</span>
                            </p>
                          </div>
                          <div className="text-right relative z-10">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Unitário</p>
                            <p className="font-bold text-gray-900">{unitPrice.toFixed(2)} UR</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="p-3 bg-gray-50 rounded-xl">
                            <p className="text-gray-400 font-bold uppercase tracking-widest mb-1">Custo Total</p>
                            <p className="font-black text-gray-900">{inv.amount} UR</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-xl">
                            <p className="text-gray-400 font-bold uppercase tracking-widest mb-1">Lucro Bruto</p>
                            <p className={`font-black ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {Math.round(currentTotal - inv.amount)} UR
                            </p>
                          </div>
                        </div>

                        <Button 
                          className="w-full h-12 rounded-xl font-bold uppercase tracking-widest text-xs"
                          onClick={() => handleRedeem(inv)}
                        >
                          Vender Títulos
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <CardContent className="p-0">
            {investments.filter(i => !!i.redeemed_at).length === 0 ? (
              <div className="p-20 text-center text-gray-400">Nenhuma operação encerrada.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ativo</th>
                      <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Data</th>
                      <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Investido</th>
                      <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Vendido</th>
                      <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {investments.filter(i => !!i.redeemed_at).map(inv => {
                      const profit = (inv.redeemed_amount || 0) - inv.amount;
                      return (
                        <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-6">
                            <p className="font-bold text-gray-900">{inv.type}</p>
                            <p className="text-xs text-gray-400">{inv.quantity || 1} títulos</p>
                          </td>
                          <td className="p-6 text-sm text-gray-500">
                            {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="p-6 font-bold text-gray-700">{inv.amount} UR</td>
                          <td className="p-6 font-bold text-gray-700">{inv.redeemed_amount} UR</td>
                          <td className={`p-6 font-black ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {profit > 0 ? '+' : ''}{Math.round(profit)} UR
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}