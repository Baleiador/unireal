import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { supabase } from '../lib/supabase';
import { PlusCircle, Search, X, Coins, Settings, TrendingUpDown, Save, CheckCircle, Users } from 'lucide-react';
import { Navigate } from 'react-router';

type Profile = {
  id: string;
  full_name: string;
  balance: number;
  grade: string | null;
};

export function Admin() {
  const { profile, refreshProfile } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);
  const [amount, setAmount] = useState('');
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Settings state
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [exchangeRate, setExchangeRate] = useState<string>('0.01');
  const [savingSettings, setSavingSettings] = useState(false);
  const [successSettings, setSuccessSettings] = useState(false);
  const [dbError, setDbError] = useState<boolean>(false);

  // Protect route
  if (profile && !profile.is_admin) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    fetchStudents();
    fetchSettings();
  }, [profile?.id]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'exchange_rate')
        .single();
      
      if (error) {
        if (error.code === '42P01' || error.message.includes('row-level security')) {
          setDbError(true);
        }
        return;
      }
      
      if (data) {
        setExchangeRate(data.value.toString());
        setDbError(false);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const saveExchangeRate = async () => {
    setSavingSettings(true);
    setSuccessSettings(false);
    try {
      const rate = parseFloat(exchangeRate);
      if (isNaN(rate) || rate <= 0) throw new Error("Cotação inválida");

      const { error: settingsError } = await supabase
        .from('settings')
        .upsert({ 
          key: 'exchange_rate', 
          value: rate,
          updated_at: new Date().toISOString()
        });

      if (settingsError) {
        setDbError(true);
        throw settingsError;
      }
      
      setDbError(false);
      setSuccessSettings(true);
      setTimeout(() => setSuccessSettings(false), 3000);
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, balance, grade')
        .eq('is_admin', false) // Only show students
        .order('full_name');

      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student => 
    student.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Por favor, insira um valor válido.');
      return;
    }

    setMinting(true);
    setError(null);

    try {
      const newBalance = selectedStudent.balance + Number(amount);

      // 1. Add to receiver (Minting coins - no deduction from admin)
      const { error: receiverUpdateError } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', selectedStudent.id);

      if (receiverUpdateError) throw receiverUpdateError;

      // 2. Create transaction record
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          sender_id: profile?.id,
          receiver_id: selectedStudent.id,
          amount: Number(amount),
        });

      if (txError) throw txError;

      // 3. Update local state to reflect changes immediately
      setStudents(students.map(s => 
        s.id === selectedStudent.id ? { ...s, balance: newBalance } : s
      ));

      setSuccess(true);
      await refreshProfile();
      
      setTimeout(() => {
        setSuccess(false);
        setSelectedStudent(null);
        setAmount('');
      }, 2000);

    } catch (err: any) {
      console.error('Mint error:', err);
      setError('Erro ao gerar moedas. Verifique as permissões do banco de dados.');
    } finally {
      setMinting(false);
    }
  };

  const openModal = (student: Profile) => {
    setSelectedStudent(student);
    setAmount('');
    setError(null);
    setSuccess(false);
  };

  const closeModal = () => {
    if (!minting) {
      setSelectedStudent(null);
      setAmount('');
      setError(null);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-black mb-2 flex items-center gap-3">
            {activeTab === 'users' ? <PlusCircle className="w-8 h-8 text-brand-orange" /> : <Settings className="w-8 h-8 text-brand-orange" />}
            {activeTab === 'users' ? 'Gerar Unireais' : 'Configurações'}
          </h1>
          <p className="text-gray-500">
            {activeTab === 'users' ? 'Área exclusiva do professor para recompensar alunos.' : 'Gerencie os parâmetros globais da economia.'}
          </p>
        </div>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-white text-brand-orange shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Users className="w-4 h-4" />
            Alunos
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'settings' ? 'bg-white text-brand-orange shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Settings className="w-4 h-4" />
            Cotação
          </button>
        </div>
      </header>

      {activeTab === 'users' ? (
        <Card>
          <CardContent className="p-0">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Buscar aluno pelo nome..."
                  className="pl-12 bg-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-500">Carregando lista de alunos...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-12 text-center text-gray-500">Nenhum aluno encontrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-gray-100 text-sm text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">Aluno</th>
                      <th className="px-6 py-4 font-medium">Turma</th>
                      <th className="px-6 py-4 font-medium">Saldo Atual</th>
                      <th className="px-6 py-4 font-medium text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand-orange/10 text-brand-orange flex items-center justify-center font-bold">
                              {student.full_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-black">{student.full_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-600">{student.grade || '-'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-black">{student.balance} UR</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            size="sm" 
                            onClick={() => openModal(student)}
                            className="shadow-sm"
                          >
                            <PlusCircle className="w-4 h-4 mr-2" />
                            Recompensar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Card>
            <CardHeader className="p-6 border-b border-gray-100">
              <CardTitle className="text-xl flex items-center gap-2">
                <TrendingUpDown className="w-6 h-6 text-brand-orange" />
                Cotação Sugerida: Unireal ⇄ Real (BRL)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="flex flex-col md:flex-row items-center gap-10">
                <div className="flex-1 w-full">
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Valor de 1 Unireal em Real</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-xl">R$</span>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0.01"
                      className="pl-16 text-3xl font-black h-24 bg-gray-50 border-gray-200 focus:bg-white"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                    />
                  </div>
                  <p className="mt-4 text-sm text-gray-500 leading-relaxed">
                    Este valor define a conversão exibida no dashboard dos alunos. 
                    <br /><strong>Ex: 0.10</strong> significa que cada 10 UR valem R$ 1,00.
                  </p>
                </div>

                <div className="w-full md:w-80 p-8 bg-brand-orange/5 rounded-3xl border border-brand-orange/10 flex flex-col items-center justify-center text-center">
                  <span className="text-brand-orange text-xs font-black uppercase tracking-widest mb-4">Impacto nos Preços</span>
                  <div className="space-y-4 w-full">
                    <div className="flex flex-col items-center mb-2">
                       <span className="text-3xl font-black text-black">R$ {parseFloat(exchangeRate || '0').toFixed(2)}</span>
                       <span className="text-[10px] font-bold text-gray-400 uppercase">por Unireal</span>
                    </div>
                    
                    <div className="h-px w-full bg-brand-orange/10" />
                    
                    <div className="space-y-2 text-left">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Doce (20 UR)</span>
                        <span className="font-bold text-black">R$ {(20 * parseFloat(exchangeRate || '0')).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Lanche (150 UR)</span>
                        <span className="font-bold text-black">R$ {(150 * parseFloat(exchangeRate || '0')).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Prêmio Top (500 UR)</span>
                        <span className="font-bold text-black">R$ {(500 * parseFloat(exchangeRate || '0')).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-gray-100 pt-8">
                <Button 
                  size="lg"
                  onClick={saveExchangeRate} 
                  disabled={savingSettings}
                  className="px-10 h-16 rounded-2xl text-lg font-black shadow-lg shadow-brand-orange/20 flex items-center gap-3 transition-all hover:scale-105 active:scale-95"
                >
                  {savingSettings ? 'Processando...' : (
                    <>
                      {successSettings ? <CheckCircle className="w-6 h-6" /> : <Save className="w-6 h-6" />}
                      {successSettings ? 'Salvo com sucesso!' : 'Salvar Alterações'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex gap-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-blue-900 mb-1 uppercase text-xs tracking-wider">Gestão Econômica</h4>
                <p className="text-sm text-blue-800/70 leading-relaxed">
                  Ajuste a taxa de acordo com a inflação interna da escola. Se os alunos tiverem muitas moedas, aumente o valor (UR) dos itens ou reduza a cotação.
                </p>
              </div>
            </div>
            <div className="p-6 bg-green-50 rounded-3xl border border-green-100 flex gap-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-green-600 shadow-sm shrink-0">
                <TrendingUpDown className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-green-900 mb-1 uppercase text-xs tracking-wider">Transparência</h4>
                <p className="text-sm text-green-800/70 leading-relaxed">
                  A nova cotação será aplicada instantaneamente no Dashboard de todos os alunos, ajudando-os a planejar suas compras para a feira.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && dbError && (
        <div className="mt-8 p-8 bg-red-50 border-2 border-red-200 rounded-3xl animate-in zoom-in-95 duration-300">
          <div className="flex items-center gap-4 text-red-600 mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Acesso Bloqueado (RLS)</h3>
              <p className="opacity-80">O banco de dados recusou a gravação. Você precisa rodar o comando abaixo no SQL Editor do Supabase para liberar o acesso do Admin.</p>
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-2xl p-6 overflow-x-auto mb-6 border-4 border-red-100 shadow-xl">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">SQL Editor Script (V3)</span>
              <span className="text-red-400 text-[10px] font-bold px-2 py-0.5 rounded border border-red-400/30 uppercase">Executor Obrigatório</span>
            </div>
            <pre className="text-blue-400 text-sm font-mono leading-relaxed">
{`-- 1. Criar função de verificação de admin (Bypassa RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Garantir que a tabela existe
CREATE TABLE IF NOT EXISTS public.settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. Habilitar RLS e Tempo Real
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings REPLICA IDENTITY FULL;

-- 4. Limpar políticas antigas
DROP POLICY IF EXISTS "Leitura pública" ON public.settings;
DROP POLICY IF EXISTS "Admin full access" ON public.settings;

-- 5. Criar novas políticas usando a função segura
CREATE POLICY "Leitura pública" ON public.settings 
FOR SELECT USING (true);

CREATE POLICY "Admin full access" ON public.settings 
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 6. Garantir que você é um Admin (SUBSTITUA SEU-ID ABAIXO)
-- UPDATE public.profiles SET is_admin = true WHERE id = auth.uid();`}
            </pre>
          </div>
          
          <div className="flex items-center gap-3 text-red-700 bg-red-100/50 p-4 rounded-xl border border-red-200">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium italic">Copie todo o código acima, cole no Painel SQL do Supabase e clique em "RUN". Depois volte aqui e tente salvar.</p>
          </div>
        </div>
      )}

      {/* Minting Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            {success ? (
              <div className="p-10 text-center">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <PlusCircle className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-black mb-2">Moedas Geradas!</h2>
                <p className="text-gray-500">Você enviou {amount} UR para {selectedStudent.full_name}.</p>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <h3 className="font-bold text-lg text-black">Recompensar Aluno</h3>
                  <button 
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleMint} className="p-6 space-y-6">
                  {error && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-xl border border-brand-orange/20">
                    <div className="w-12 h-12 rounded-full bg-white text-brand-orange flex items-center justify-center font-bold text-lg shadow-sm">
                      {selectedStudent.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-brand-orange/80 font-medium">Enviando para</p>
                      <p className="font-bold text-brand-orange">{selectedStudent.full_name}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Valor da Recompensa (Unireais)</label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="1"
                        placeholder="0"
                        className="text-3xl font-bold h-20 pl-6"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        autoFocus
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl uppercase">
                        UR
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1" disabled={minting}>
                      {minting ? 'Gerando...' : `Enviar ${amount || 0} UR`}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
