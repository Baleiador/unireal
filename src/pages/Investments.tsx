import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { supabase } from '../lib/supabase';
import { TrendingUp, Wallet, Landmark, ArrowRight, ShieldCheck, Clock, CheckCircle, TrendingUpDown } from 'lucide-react';
import { useExchangeRate } from '../hooks/useExchangeRate';

type Investment = {
  id: string;
  type: string; // 'CDB', 'LCI', 'LCA'
  amount: number;
  rate_type: string; // 'FIXED', 'CDI'
  rate_value: number; // e.g. 110 (110% CDI) or 12.5 (12.5% a.a)
  created_at: string;
  redeemed_at: string | null;
  redeemed_amount: number | null;
};

// Calculate yield based on time elapsed
const calculateCurrentAmount = (investment: Investment, currentSelic: number) => {
  if (investment.redeemed_at && investment.redeemed_amount) {
    return investment.redeemed_amount;
  }
  
  const startDate = new Date(investment.created_at);
  const now = new Date();
  const millisecondsPassed = now.getTime() - startDate.getTime();
  const daysPassed = millisecondsPassed / (1000 * 60 * 60 * 24);
  const yearsPassed = daysPassed / 365;
  
  let annualRate = 0;
  if (investment.rate_type === 'CDI') {
    const cdi = Math.max(currentSelic - 0.10, 0); 
    annualRate = cdi * (investment.rate_value / 100);
  } else {
    annualRate = investment.rate_value;
  }
  
  const currentAmount = investment.amount * Math.pow(1 + annualRate / 100, yearsPassed);
  return currentAmount;
};

export function Investments() {
  const { profile, refreshProfile } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [selicRate, setSelicRate] = useState<number>(10.5);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const { formatValue: formatBRL } = useExchangeRate();
  
  // Form states
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [amountToInvest, setAmountToInvest] = useState('');
  const [investing, setInvesting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'ativos' | 'resgatados'>('ativos');
  const [, setTick] = useState(0);

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
    const value = Number(amountToInvest);
    if (isNaN(value) || value <= 0) {
      setErrorMsg("Valor inválido.");
      return;
    }
    
    if (value > profile.balance) {
      setErrorMsg("Saldo insuficiente.");
      return;
    }

    setInvesting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Products configuration
      let type = '';
      let rateType = '';
      let rateValue = 0;

      if (selectedProduct === 'cdb_110') {
        type = 'CDB MAX Plus';
        rateType = 'CDI';
        rateValue = 110;
      } else if (selectedProduct === 'lci_fix') {
        type = 'LCI Prefixada';
        rateType = 'FIXED';
        rateValue = 12.0; // 12% a.a
      } else if (selectedProduct === 'cdb_100') {
        type = 'CDB Liquidez Diária';
        rateType = 'CDI';
        rateValue = 100;
      } else if (selectedProduct === 'tesouro_selic') {
        type = 'Tesouro Selic';
        rateType = 'CDI';
        rateValue = 100; // Simplified as 100% of CDI for simulation purposes
      } else if (selectedProduct === 'poupanca') {
        type = 'Poupança';
        rateType = 'CDI';
        rateValue = 70; // Poupança usually yields 70% of Selic when Selic > 8.5%
      } else if (selectedProduct === 'lca_95') {
        type = 'LCA Agronegócio';
        rateType = 'CDI';
        rateValue = 95;
      } else if (selectedProduct === 'cdb_120') {
        type = 'CDB Banco Secundário';
        rateType = 'CDI';
        rateValue = 120;
      } else if (selectedProduct === 'debenture_prefixada') {
        type = 'Debênture de Infraestrutura';
        rateType = 'FIXED';
        rateValue = 15.0; // 15% a.a
      }

      // Decrement balance
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ balance: profile.balance - value })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      // Insert investment
      const { error: investError } = await supabase
        .from('investments')
        .insert({
          user_id: profile.id,
          type,
          amount: value,
          rate_type: rateType,
          rate_value: rateValue
        });

      if (investError) throw investError;

      setSuccessMsg(`Você investiu ${value} UR em ${type}!`);
      setAmountToInvest('');
      setSelectedProduct(null);
      await refreshProfile();
      await fetchInvestments();
      
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error: any) {
      setErrorMsg(error.message || "Erro ao processar investimento.");
    } finally {
      setInvesting(false);
    }
  };

  const handleRedeem = async (inv: Investment) => {
    if (inv.redeemed_at) return;
    try {
      const currentVal = calculateCurrentAmount(inv, selicRate);
      
      // Update investment to redeemed
      const { error: updateInvError } = await supabase
        .from('investments')
        .update({ 
          redeemed_at: new Date().toISOString(),
          redeemed_amount: currentVal
        })
        .eq('id', inv.id);
        
      if (updateInvError) throw updateInvError;
      
      // Update user balance
      const { data: userData, error: userError } = await supabase.from('profiles').select('balance').eq('id', profile?.id).single();
      if (userError) throw userError;
      
      // Using Math.floor to keep precision to 2 decimal places and avoid float issues
      const newBalance = Math.floor(((userData?.balance || 0) + currentVal) * 100) / 100;
      
      const { error: profileUpdateError } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', profile?.id);
      if (profileUpdateError) throw profileUpdateError;
      
      await fetchInvestments();
      await refreshProfile(); // Refresh context
      alert(`Você resgatou ${currentVal.toFixed(2)} UR com sucesso!`);
    } catch(err: any) {
      console.error(err);
      alert(`Erro ao resgatar: ${err?.message || 'Desconhecido'}`);
    }
  };

  // Calculate portfolio totals
  const activeInvestments = investments.filter(inv => !inv.redeemed_at);
  const totalInvested = activeInvestments.reduce((acc, inv) => acc + inv.amount, 0);
  const totalCurrentValue = activeInvestments.reduce((acc, inv) => acc + calculateCurrentAmount(inv, selicRate), 0);
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
{`CREATE TABLE public.investments (
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

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

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

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-black mb-2 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-brand-orange" />
            Corretora Unireal
          </h1>
          <p className="text-gray-500">Faça seu saldo render simulando o mercado financeiro.</p>
        </div>
        <div className="bg-green-50 px-4 py-2 rounded-xl border border-green-200 flex flex-col items-end">
          <span className="text-sm font-bold text-green-700 uppercase tracking-wider">Taxa Selic Atual</span>
          <span className="text-xl font-black text-green-800">{selicRate.toFixed(2)}% a.a.</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Painel de Investimento */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Títulos Disponíveis</CardTitle>
              <p className="text-sm text-gray-500">Compre letras de crédito baseadas na economia real (CDI: {cdiRate}% a.a).</p>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedProduct === 'poupanca' ? 'border-brand-orange bg-orange-50' : 'border-gray-100 hover:border-orange-200'}`}
                onClick={() => setSelectedProduct('poupanca')}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-black flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-gray-400" />
                    Poupança Unireal
                  </h3>
                  <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold w-fit">70% da Selic</span>
                </div>
                <p className="text-sm text-gray-500">O mais tradicional. Rende menos que as outras opções (equivale a {(Number(cdiRate)*0.7).toFixed(2)}% ao ano).</p>
              </div>

              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedProduct === 'tesouro_selic' ? 'border-brand-orange bg-orange-50' : 'border-gray-100 hover:border-orange-200'}`}
                onClick={() => setSelectedProduct('tesouro_selic')}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-black flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-gray-400" />
                    Tesouro Selic
                  </h3>
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold w-fit">100% da Selic</span>
                </div>
                <p className="text-sm text-gray-500">Emprestado ao "Governo", risco baixíssimo. Rende aproximadamente {cdiRate}% ao ano.</p>
              </div>

              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedProduct === 'cdb_100' ? 'border-brand-orange bg-orange-50' : 'border-gray-100 hover:border-orange-200'}`}
                onClick={() => setSelectedProduct('cdb_100')}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-black flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-gray-400" />
                    CDB Liquidez Diária
                  </h3>
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold w-fit">100% do CDI</span>
                </div>
                <p className="text-sm text-gray-500">Ideal para deixar o saldo render. Rende equivalente a {cdiRate}% ao ano.</p>
              </div>

              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedProduct === 'lca_95' ? 'border-brand-orange bg-orange-50' : 'border-gray-100 hover:border-orange-200'}`}
                onClick={() => setSelectedProduct('lca_95')}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-black flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-gray-400" />
                    LCA Agronegócio
                  </h3>
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold w-fit">95% do CDI</span>
                </div>
                <p className="text-sm text-gray-500">Apoie o agronegócio de forma isenta (na vida real). Rende {(Number(cdiRate)*0.95).toFixed(2)}% ao ano.</p>
              </div>

              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedProduct === 'cdb_110' ? 'border-brand-orange bg-orange-50' : 'border-gray-100 hover:border-orange-200'}`}
                onClick={() => setSelectedProduct('cdb_110')}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-black flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-gray-400" />
                    CDB MAX Plus
                  </h3>
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold w-fit">110% do CDI</span>
                </div>
                <p className="text-sm text-gray-500">Rendimento superior atrelado à variação do mercado. Equivale a {(Number(cdiRate)*1.1).toFixed(2)}% ao ano.</p>
              </div>

              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedProduct === 'cdb_120' ? 'border-brand-orange bg-orange-50' : 'border-gray-100 hover:border-orange-200'}`}
                onClick={() => setSelectedProduct('cdb_120')}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-black flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-gray-400" />
                    CDB Banco Secundário
                  </h3>
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold w-fit">120% do CDI</span>
                </div>
                <p className="text-sm text-gray-500">Mais retorno, mas emitido por instituições menores. Rende {(Number(cdiRate)*1.2).toFixed(2)}% ao ano.</p>
              </div>

              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedProduct === 'lci_fix' ? 'border-brand-orange bg-orange-50' : 'border-gray-100 hover:border-orange-200'}`}
                onClick={() => setSelectedProduct('lci_fix')}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-black flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-gray-400" />
                    LCI Prefixada 12%
                  </h3>
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold w-fit">Prefixado</span>
                </div>
                <p className="text-sm text-gray-500">Trave seu ganho em 12,00% ao ano, independentemente se a Selic cair.</p>
              </div>

              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedProduct === 'debenture_prefixada' ? 'border-brand-orange bg-orange-50' : 'border-gray-100 hover:border-orange-200'}`}
                onClick={() => setSelectedProduct('debenture_prefixada')}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-black flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-gray-400" />
                    Debênture de Infra. 15%
                  </h3>
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold w-fit">Prefixado</span>
                </div>
                <p className="text-sm text-gray-500">Empreste direto para grandes projetos. Rende incríveis 15,00% ao ano, mas tem maior risco.</p>
              </div>

            </CardContent>
          </Card>

          {selectedProduct && (
            <Card className="border-brand-orange shadow-lg shadow-brand-orange/10 animate-in fade-in slide-in-from-bottom-4">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quanto deseja investir?</label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="1"
                        placeholder="Ex: 50"
                        className="text-2xl font-bold h-14 pl-4"
                        value={amountToInvest}
                        onChange={(e) => setAmountToInvest(e.target.value)}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold uppercase">
                        UR
                      </span>
                    </div>
                  </div>
                  <Button 
                    className="h-14 px-8 whitespace-nowrap w-full sm:w-auto text-lg" 
                    onClick={handleInvest}
                    disabled={investing}
                  >
                    {investing ? 'Processando...' : 'Aplicar Recursos'}
                    {!investing && <ArrowRight className="w-5 h-5 ml-2" />}
                  </Button>
                </div>
                {errorMsg && <p className="text-red-500 mt-3 text-sm font-medium">{errorMsg}</p>}
                {successMsg && <p className="text-green-600 mt-3 text-sm font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4" />{successMsg}</p>}
                <p className="text-xs text-gray-400 mt-3">Saldo Disponível: <strong>{profile?.balance || 0} UR</strong></p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Minha Carteira */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-md shadow-brand-orange/5 border-orange-100">
            <CardHeader className="bg-gradient-to-br from-brand-orange to-orange-600 rounded-t-xl text-white">
              <CardTitle className="text-lg text-white">Resumo da Carteira</CardTitle>
            </CardHeader>
            <CardContent className="p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Investido</span>
                <div className="text-right">
                  <span className="font-bold text-black block">{totalInvested.toFixed(2)} UR</span>
                  <span className="text-[10px] text-gray-400 font-medium">{formatBRL(totalInvested)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Valor Bruto Novo</span>
                <div className="text-right">
                  <span className="font-black text-brand-orange text-lg block">
                    {totalCurrentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} UR
                  </span>
                  <span className="text-xs text-brand-orange/60 font-bold">{formatBRL(totalCurrentValue)}</span>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-between items-center bg-green-50 p-3 rounded-lg">
                <span className="text-green-700 font-bold text-sm">Lucro Acumulado</span>
                <div className="text-right">
                  <span className="text-green-700 font-black block">+{totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} UR</span>
                  <span className="text-[10px] text-green-600 font-bold">{formatBRL(totalProfit)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="bg-gray-50 border-b border-gray-100 flex flex-row items-center justify-between p-4">
              <CardTitle className="text-lg">Meus Títulos</CardTitle>
              <div className="flex gap-4">
                <button 
                  onClick={() => setActiveTab('ativos')} 
                  className={`text-sm font-bold pb-2 border-b-2 transition-colors ${activeTab === 'ativos' ? 'text-brand-orange border-brand-orange' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                >
                  Ativos
                </button>
                <button 
                  onClick={() => setActiveTab('resgatados')} 
                  className={`text-sm font-bold pb-2 border-b-2 transition-colors ${activeTab === 'resgatados' ? 'text-brand-orange border-brand-orange' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                >
                  Resgatados
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-gray-100 h-[400px] overflow-y-auto min-h-[300px]">
              {loading ? (
                <div className="p-6 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
                  Carregando carteira...
                </div>
              ) : (
                (() => {
                  const filteredInvestments = investments.filter(inv => 
                    activeTab === 'ativos' ? !inv.redeemed_at : !!inv.redeemed_at
                  );

                  if (filteredInvestments.length === 0) {
                    return (
                      <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                        <Wallet className="w-12 h-12 text-brand-orange/30 mb-3" />
                        <p>Você não possui títulos {activeTab === 'ativos' ? 'ativos' : 'resgatados'}.</p>
                      </div>
                    );
                  }

                  return filteredInvestments.map((inv) => {
                    const isRedeemed = !!inv.redeemed_at;
                    const currentAmount = calculateCurrentAmount(inv, selicRate);
                    const profit = currentAmount - inv.amount;
                    
                    return (
                      <div key={inv.id} className={`p-5 transition-colors ${isRedeemed ? 'bg-gray-50/50' : 'hover:bg-orange-50/30'}`}>
                        <div className="flex justify-between mb-1">
                          <span className={`font-bold ${isRedeemed ? 'text-gray-500' : 'text-black'}`}>{inv.type}</span>
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            inv.rate_type === 'CDI' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {inv.rate_type === 'CDI' ? `${inv.rate_value}% CDI` : `${inv.rate_value}% a.a`}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-end mt-4">
                          <div>
                            <p className="text-xs text-gray-500">Investido: {inv.amount} UR</p>
                            <div className="flex items-baseline gap-2">
                              <span className={`text-2xl font-black tracking-tight ${isRedeemed ? 'text-gray-400' : 'text-brand-orange'}`}>
                                {currentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                              </span>
                              <span className="text-xs uppercase text-gray-400 font-bold">UR</span>
                            </div>
                            {profit > 0 && !isRedeemed && (
                              <p className="text-xs text-green-600 font-medium">+{profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} UR de lucro</p>
                            )}
                            {profit > 0 && isRedeemed && (
                              <p className="text-xs text-gray-500 font-medium">+{profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} UR de lucro realizado</p>
                            )}
                          </div>
                          
                          {!isRedeemed ? (
                            <button 
                              onClick={() => handleRedeem(inv)}
                              className="text-sm font-bold text-brand-orange hover:text-orange-700 bg-orange-100 px-3 py-2 rounded-lg transition-colors"
                            >
                              Resgatar
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-gray-400 bg-gray-200 px-2 py-1 rounded flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Resgatado
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  });
                })()
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
