import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { supabase } from '../lib/supabase';
import { PlusCircle, Search, X, Coins, Settings, TrendingUpDown, TrendingUp, ShoppingCart, BarChart3, Save, CheckCircle, Users, Bell, Trash2, Megaphone, Eye, List, BarChart, History, ArrowUpRight, ArrowDownLeft, Briefcase, AlertTriangle, RotateCcw } from 'lucide-react';
import { Navigate } from 'react-router';
import { calculateCurrentAmount, Investment } from '../lib/investment-utils';

type Profile = {
  id: string;
  full_name: string;
  balance: number;
  grade: string | null;
  total_invested?: number;
  raw_password?: string;
};

type LogEntry = {
  id: string;
  type: 'transfer' | 'investment' | 'redemption' | 'mint';
  amount: number;
  description: string;
  date: string;
  change: 'positive' | 'negative' | 'neutral';
  metadata?: {
    profit?: number;
    profitPercent?: number;
    targetName?: string;
    productType?: string;
  };
};

export function Admin() {
  const { profile, refreshProfile } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [systemStats, setSystemStats] = useState({ totalBalance: 0, totalInvested: 0 });
  
  // Modal state
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);
  const [amount, setAmount] = useState('');
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [, setTick] = useState(0);

  // Student Details Modal
  const [detailsStudent, setDetailsStudent] = useState<Profile | null>(null);
  const [studentInvestments, setStudentInvestments] = useState<Investment[]>([]);
  const [allActiveInvestments, setAllActiveInvestments] = useState<Investment[]>([]);
  const [studentLogs, setStudentLogs] = useState<LogEntry[]>([]);
  const [globalLogs, setGlobalLogs] = useState<LogEntry[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingGlobalLogs, setLoadingGlobalLogs] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'portfolio' | 'logs'>('portfolio');
  
  // Log Filters
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logDateStart, setLogDateStart] = useState<string>(() => {
    const d = new Date();
    d.setMonth(0); // Start of current year
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [logDateEnd, setLogDateEnd] = useState<string>(new Date().toISOString().split('T')[0]);
  const [logTypeFilter, setLogTypeFilter] = useState<'all' | 'mint' | 'transfer' | 'investment' | 'redemption'>('all');
  
  // Settings state
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'announcements' | 'logs'>('users');
  const [exchangeRate, setExchangeRate] = useState<string>('0.01');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('O sistema está em manutenção para melhorias. Voltamos em breve!');
  const [savingSettings, setSavingSettings] = useState(false);
  const [successSettings, setSuccessSettings] = useState(false);
  const [dbError, setDbError] = useState<boolean>(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  
  // Announcements state
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annTargetGrades, setAnnTargetGrades] = useState<string[]>([]);
  const [creatingAnn, setCreatingAnn] = useState(false);

  // Protect route
  if (profile && !profile.is_admin) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    fetchStudents();
    fetchSettings();
    if (activeTab === 'announcements') {
      fetchAnnouncements();
    }
    if (activeTab === 'logs') {
      fetchGlobalLogs();
    }
  }, [profile?.id, activeTab]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) setAnnouncements(data || []);
      else if (error.code === '42P01') setDbError(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!annTitle || !annContent || annTargetGrades.length === 0) {
      alert("Preencha todos os campos e selecione ao menos uma turma.");
      return;
    }

    setCreatingAnn(true);
    try {
      const { error } = await supabase
        .from('announcements')
        .insert({
          title: annTitle,
          content: annContent,
          target_grades: annTargetGrades,
          admin_id: profile?.id
        });

      if (error) throw error;
      
      setAnnTitle('');
      setAnnContent('');
      setAnnTargetGrades([]);
      fetchAnnouncements();
      alert("Aviso publicado com sucesso!");
    } catch (err: any) {
      alert("Erro: " + err.message);
      setDbError(true);
    } finally {
      setCreatingAnn(false);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este aviso?")) return;
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      setAnnouncements(announcements.filter(a => a.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const uniqueGrades = Array.from(new Set(students.map(s => s.grade).filter(Boolean))) as string[];

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value');
      
      if (error) {
        if (error.code === '42P01' || error.message.includes('row-level security')) {
          setDbError(true);
        }
        return;
      }
      
      if (data) {
        const rate = data.find(s => s.key === 'exchange_rate');
        const maint = data.find(s => s.key === 'maintenance_mode');
        const msg = data.find(s => s.key === 'maintenance_message');
        
        if (rate) setExchangeRate(rate.value.toString());
        if (maint) setMaintenanceMode(maint.value === true);
        if (msg) setMaintenanceMessage(msg.value.toString());
        
        setDbError(false);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    setSuccessSettings(false);
    try {
      const rate = parseFloat(exchangeRate);
      if (isNaN(rate) || rate <= 0) throw new Error("Cotação inválida");

      const updates = [
        { key: 'exchange_rate', value: rate, updated_at: new Date().toISOString() },
        { key: 'maintenance_mode', value: maintenanceMode, updated_at: new Date().toISOString() },
        { key: 'maintenance_message', value: maintenanceMessage, updated_at: new Date().toISOString() }
      ];

      const { error } = await supabase
        .from('settings')
        .upsert(updates);

      if (error) {
        setDbError(true);
        throw error;
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

  const handleCleanupDiscontinued = async () => {
    const approvedNames = [
      'Tesouro Selic 2029',
      'CDB Prime 110% CDI',
      'Poupança Digital',
      'LCI Imobiliário',
      'LCA Agronegócio',
      'Debênture Infra',
      'ETF Global IVVB11',
      'Fundo Imobiliário'
    ];

    if (!confirm(`Isso removerá permanentemente TODOS os investimentos que não sejam os 8 títulos atuais aprovados. 
    
Apenas estes serão mantidos:
${approvedNames.map(n => `- ${n}`).join('\n')}

Deseja continuar?`)) return;
    
    setResetting(true);
    try {
      // Deleta tudo que NÃO estiver na lista de nomes aprovados
      const { error } = await supabase
        .from('investments')
        .delete()
        .not('type', 'in', approvedNames);

      if (error) throw error;

      alert("Investimentos desatualizados ou descontinuados removidos com sucesso!");
      fetchStudents();
    } catch (err: any) {
      alert("Erro ao limpar investimentos: " + err.message);
    } finally {
      setResetting(false);
    }
  };

  const fetchGlobalLogs = async () => {
    setLoadingGlobalLogs(true);
    try {
      const start = new Date(logDateStart);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(logDateEnd);
      end.setHours(23, 59, 59, 999);

      // Start fetching transactions
      let txQuery = supabase
        .from('transactions')
        .select(`
          *,
          sender:profiles!transactions_sender_id_fkey(full_name),
          receiver:profiles!transactions_receiver_id_fkey(full_name)
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // Start fetching investments
      let invQuery = supabase
        .from('investments')
        .select(`
          *,
          user:profiles!investments_user_id_fkey(full_name)
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const [{ data: txs, error: txError }, { data: invs, error: invError }] = await Promise.all([
        txQuery,
        invQuery
      ]);

      if (txError) throw txError;
      if (invError) throw invError;

      const logs: LogEntry[] = [];

      txs?.forEach(tx => {
        const isMint = (tx.sender && tx.sender.full_name === 'Sistema') || !tx.sender_id;
        const type = isMint ? 'mint' : 'transfer';
        
        if (logTypeFilter === 'all' || logTypeFilter === type) {
          logs.push({
            id: tx.id,
            type: type,
            amount: tx.amount,
            date: tx.created_at,
            change: isMint ? 'positive' : 'neutral',
            description: isMint 
              ? `Sistema premiou ${tx.receiver?.full_name}`
              : `${tx.sender?.full_name} → ${tx.receiver?.full_name}`,
            metadata: { targetName: tx.receiver?.full_name }
          });
        }
      });

      invs?.forEach(inv => {
        // Purchase entry
        if (logTypeFilter === 'all' || logTypeFilter === 'investment') {
          logs.push({
            id: `buy-${inv.id}`,
            type: 'investment',
            amount: inv.amount,
            date: inv.created_at,
            change: 'negative',
            description: `${inv.user?.full_name} investiu em ${inv.type}`,
            metadata: { productType: inv.type }
          });
        }

        // Redemption entry
        if (inv.redeemed_at && inv.redeemed_amount) {
          // Check if redemption is within range
          const redDate = new Date(inv.redeemed_at);
          if (redDate >= start && redDate <= end) {
            if (logTypeFilter === 'all' || logTypeFilter === 'redemption') {
              logs.push({
                id: `sell-${inv.id}`,
                type: 'redemption',
                amount: inv.redeemed_amount,
                date: inv.redeemed_at,
                change: 'positive',
                description: `${inv.user?.full_name} resgatou ${inv.type}`,
                metadata: { 
                  productType: inv.type,
                  profit: inv.redeemed_amount - inv.amount,
                  profitPercent: ((inv.redeemed_amount - inv.amount) / inv.amount) * 100
                }
              });
            }
          }
        }
      });

      logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setGlobalLogs(logs);
    } catch (err) {
      console.error("Error fetching global logs:", err);
      alert("Erro ao buscar logs: " + (err as any).message);
    } finally {
      setLoadingGlobalLogs(false);
    }
  };

  const handleResetSystem = async () => {
    if (resetConfirmText !== 'ZERAR') {
      alert("Por favor, digite ZERAR para confirmar.");
      return;
    }

    setResetting(true);
    try {
      // 1. Delete all transactions
      const { error: txError } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (txError) throw txError;

      // 2. Delete all investments
      const { error: invError } = await supabase.from('investments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (invError) throw invError;

      // 3. Reset all student balances to 0
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ balance: 0 })
        .eq('is_admin', false);
      
      if (profileError) throw profileError;

      alert("Sistema zerado com sucesso! Todos os alunos agora possuem saldo 0 e histórico limpo.");
      setResetModalOpen(false);
      setResetConfirmText('');
      fetchStudents();
      await refreshProfile();
    } catch (err: any) {
      alert("Erro ao zerar sistema: " + err.message);
    } finally {
      setResetting(false);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      // 1. Fetch Students
      const { data: studentData, error: studentError } = await supabase
        .from('profiles')
        .select('id, full_name, balance, grade, raw_password')
        .eq('is_admin', false)
        .order('full_name');

      if (studentError) throw studentError;

      // 2. Fetch Active Investments to calculate totals
      const { data: invData, error: invError } = await supabase
        .from('investments')
        .select('*')
        .is('redeemed_at', null);

      if (invError) {
        console.error('Investments error:', invError);
        // Don't throw here to at least show students
      }
      
      const activeInvs = invData || [];
      setAllActiveInvestments(activeInvs);

      const studentsWithTotals = (studentData || []).map(student => {
        const studentInvs = activeInvs.filter(inv => inv.user_id === student.id);
        const totalInvested = studentInvs.reduce((acc, inv) => acc + calculateCurrentAmount(inv), 0);
        return {
          ...student,
          total_invested: totalInvested
        };
      });

      // Calculate total stats
      const totalBal = (studentData || []).reduce((acc, s) => acc + (s.balance || 0), 0);
      const totalInv = activeInvs.reduce((acc, inv) => acc + calculateCurrentAmount(inv), 0);
      setSystemStats({ totalBalance: totalBal, totalInvested: totalInv });

      setStudents(studentsWithTotals);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentDetails = async (student: Profile) => {
    setDetailsStudent(student);
    setLoadingDetails(true);
    setDetailsTab('portfolio');
    
    try {
      // 1. Fetch all investments (active and redeemed)
      const { data: invs, error: invError } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', student.id)
        .order('created_at', { ascending: false });

      if (invError) throw invError;
      setStudentInvestments(invs || []);

      // 2. Fetch transaction history
      const { data: txs, error: txError } = await supabase
        .from('transactions')
        .select(`
          *,
          sender:profiles!transactions_sender_id_fkey(full_name),
          receiver:profiles!transactions_receiver_id_fkey(full_name)
        `)
        .or(`sender_id.eq.${student.id},receiver_id.eq.${student.id}`)
        .order('created_at', { ascending: false });

      if (txError) throw txError;

      // Map transactions and investments into logs
      const logs: LogEntry[] = [];

      // Add transfers
      txs?.forEach(tx => {
        const isSender = tx.sender_id === student.id;
        const isMint = (tx.sender && tx.sender.full_name === 'Sistema') || !tx.sender_id;
        
        logs.push({
          id: tx.id,
          type: isMint ? 'mint' : 'transfer',
          amount: tx.amount,
          date: tx.created_at,
          change: isMint ? 'positive' : (isSender ? 'negative' : 'positive'),
          description: isMint 
            ? `Recebeu premiação do sistema` 
            : isSender 
              ? `Transferência para ${tx.receiver?.full_name || 'Outro Aluno'}`
              : `Transferência de ${tx.sender?.full_name || 'Outro Aluno'}`,
          metadata: {
            targetName: isSender ? tx.receiver?.full_name : tx.sender?.full_name
          }
        });
      });

      // Add investment events
      invs?.forEach(allInv => {
        // Purchase entry
        logs.push({
          id: `inv-${allInv.id}`,
          type: 'investment',
          amount: allInv.amount,
          date: allInv.created_at,
          change: 'negative',
          description: `Compra de Ativo: ${allInv.type}`,
          metadata: {
            productType: allInv.type
          }
        });

        // Redemption entry (if it happened)
        if (allInv.redeemed_at && allInv.redeemed_amount) {
          const profit = allInv.redeemed_amount - allInv.amount;
          const profitPercent = (profit / allInv.amount) * 100;
          
          logs.push({
            id: `red-${allInv.id}`,
            type: 'redemption',
            amount: allInv.redeemed_amount,
            date: allInv.redeemed_at,
            change: 'positive',
            description: `Venda de Ativo: ${allInv.type}`,
            metadata: {
              profit,
              profitPercent,
              productType: allInv.type
            }
          });
        }
      });

      // Sort logs by date
      logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setStudentLogs(logs);

    } catch (err) {
      console.error("Error fetching student details:", err);
    } finally {
      setLoadingDetails(false);
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
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
              {activeTab === 'users' ? <Users className="w-6 h-6" /> : 
               activeTab === 'announcements' ? <Megaphone className="w-6 h-6" /> : 
               activeTab === 'logs' ? <History className="w-6 h-6" /> :
               <Settings className="w-6 h-6" />}
            </div>
            <h1 className="text-4xl font-black text-black tracking-tight">
              {activeTab === 'users' ? 'Gestão de Alunos' : 
               activeTab === 'announcements' ? 'Central de Avisos' : 
               activeTab === 'logs' ? 'Auditoria Global' :
               'Configurações'}
            </h1>
          </div>
          <p className="text-gray-500 font-medium">
            {activeTab === 'users' ? 'Monitore e recompense o progresso dos estudantes.' : 
             activeTab === 'announcements' ? 'Envie comunicados instantâneos para as turmas.' : 
             activeTab === 'logs' ? 'Rastreamento completo do ecossistema econômico.' :
             'Ajuste os parâmetros fundamentais do sistema.'}
          </p>
        </div>
        
        <div className="flex bg-white/50 backdrop-blur-md p-2 rounded-[32px] border border-gray-100 w-fit shadow-sm">
          {[
            { id: 'users', label: 'Alunos', icon: Users },
            { id: 'announcements', label: 'Avisos', icon: Megaphone },
            { id: 'logs', label: 'Auditoria', icon: List },
            { id: 'settings', label: 'Sistema', icon: Settings },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-8 py-4 rounded-[26px] text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id 
                ? 'bg-black text-white shadow-xl translate-y-[-2px]' 
                : 'text-gray-400 hover:text-black'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'users' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-brand-orange/5 border-brand-orange/10">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-brand-orange shadow-sm">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Saldo Total (Alunos)</p>
                  <p className="text-2xl font-black text-black">{Math.round(systemStats.totalBalance).toLocaleString()} UR</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-50/30 border-green-100">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-green-600 shadow-sm">
                  <BarChart className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total em Carteira (Investido)</p>
                  <p className="text-2xl font-black text-green-600">
                    {Math.round(allActiveInvestments.reduce((acc, inv) => acc + calculateCurrentAmount(inv), 0)).toLocaleString()} UR
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Buscar aluno pelo nome..."
                    className="pl-12 bg-white h-12 rounded-xl"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={fetchStudents} className="shrink-0 h-12 px-6 rounded-xl font-bold bg-white">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Sincronizar
                </Button>
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
                        <th className="px-6 py-4 font-medium">Saldo em Conta</th>
                        <th className="px-6 py-4 font-medium">Total Investido</th>
                        <th className="px-6 py-4 font-medium">Patrimônio Total</th>
                        <th className="px-6 py-4 font-medium text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStudents.map((student) => {
                        const studentInvs = allActiveInvestments.filter(inv => inv.user_id === student.id);
                        const studentTotalInvested = studentInvs.reduce((acc, inv) => acc + calculateCurrentAmount(inv), 0);
                        const totalWealth = (student.balance || 0) + studentTotalInvested;

                        return (
                          <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-brand-orange/10 text-brand-orange flex items-center justify-center font-bold">
                                  {student.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-black">{student.full_name}</span>
                                  {student.raw_password && (
                                    <span className="text-[10px] font-mono text-gray-400">Senha: {student.raw_password}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-gray-600">{student.grade || '-'}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-bold text-black">{(student.balance || 0).toLocaleString()} UR</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-brand-orange">
                                  {Math.round(studentTotalInvested).toLocaleString()} UR
                                </span>
                                {studentInvs.length > 0 && (
                                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                    {studentInvs.length} {studentInvs.length === 1 ? 'Ativo' : 'Ativos'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-orange/10 rounded-full">
                                <span className="font-black text-brand-orange text-sm">
                                  {Math.round(totalWealth).toLocaleString()} UR
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                              <button
                                onClick={() => fetchStudentDetails(student)}
                                className="p-2 text-gray-400 hover:text-brand-orange hover:bg-orange-50 rounded-lg transition-all"
                                title="Ver Perfil"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
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
                        );
                      })}
                    </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      ) : activeTab === 'logs' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Card>
            <CardHeader className="p-6 border-b border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-xl flex items-center gap-2">
                  <History className="w-6 h-6 text-brand-orange" />
                  Auditoria Completa do Sistema
                </CardTitle>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Buscar por nome do aluno..."
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-brand-orange outline-none w-64"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date"
                      value={logDateStart}
                      onChange={(e) => setLogDateStart(e.target.value)}
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-brand-orange outline-none"
                    />
                    <span className="text-gray-400 font-black">→</span>
                    <input 
                      type="date"
                      value={logDateEnd}
                      onChange={(e) => setLogDateEnd(e.target.value)}
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-brand-orange outline-none"
                    />
                  </div>
                  <select 
                    value={logTypeFilter}
                    onChange={(e) => setLogTypeFilter(e.target.value as any)}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-brand-orange outline-none"
                  >
                    <option value="all">Filtro: Todos</option>
                    <option value="mint">Tipo: Recompensa</option>
                    <option value="transfer">Tipo: Transferência</option>
                    <option value="investment">Tipo: Investimento</option>
                    <option value="redemption">Tipo: Resgate</option>
                  </select>
                  <Button size="sm" onClick={fetchGlobalLogs} disabled={loadingGlobalLogs}>
                    <PlusCircle className={`w-4 h-4 mr-2 ${loadingGlobalLogs ? 'animate-spin' : ''}`} />
                    Consultar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Summary Stats */}
              {!loadingGlobalLogs && globalLogs.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 border-b border-gray-100">
                  <div className="p-4 border-r border-gray-100 text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Movimentado</p>
                    <p className="text-xl font-black text-black">
                      {globalLogs.reduce((acc, log) => acc + log.amount, 0).toLocaleString()} UR
                    </p>
                  </div>
                  <div className="p-4 border-r border-gray-100 text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Operações</p>
                    <p className="text-xl font-black text-brand-orange">{globalLogs.length}</p>
                  </div>
                  <div className="p-4 border-r border-gray-100 text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Maior Valor</p>
                    <p className="text-xl font-black text-purple-600">
                      {Math.max(...globalLogs.map(l => l.amount), 0).toLocaleString()} UR
                    </p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Média p/ Operação</p>
                    <p className="text-xl font-black text-blue-600">
                      {Math.round(globalLogs.reduce((acc, log) => acc + log.amount, 0) / (globalLogs.length || 1)).toLocaleString()} UR
                    </p>
                  </div>
                </div>
              )}

              {loadingGlobalLogs ? (
                <div className="p-20 text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Auditoria em andamento...</p>
                </div>
              ) : globalLogs.length === 0 ? (
                <div className="p-20 text-center">
                  <History className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold">Nenhum registro encontrado para este período.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <th className="px-8 py-4">Data/Hora</th>
                        <th className="px-8 py-4">Tipo</th>
                        <th className="px-8 py-4">Descrição</th>
                        <th className="px-8 py-4 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {globalLogs
                        .filter(log => log.description.toLowerCase().includes(logSearchQuery.toLowerCase()))
                        .map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-8 py-5">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-900">
                                {new Date(log.date).toLocaleDateString('pt-BR')}
                              </span>
                              <span className="text-[10px] font-medium text-gray-400">
                                {new Date(log.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-[8px] font-mono text-gray-300 mt-1 uppercase">ID: {log.id.split('-')[0]}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                              log.type === 'mint' ? 'bg-purple-100 text-purple-600' :
                              log.type === 'transfer' ? 'bg-blue-100 text-blue-600' :
                              log.type === 'investment' ? 'bg-amber-100 text-amber-600' :
                              'bg-green-100 text-green-600'
                            }`}>
                              {log.type === 'mint' ? 'Recompensa' :
                               log.type === 'transfer' ? 'Transferência' :
                               log.type === 'investment' ? 'Investimento' : 'Resgate'}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <p className="text-sm text-gray-700 font-medium">{log.description}</p>
                            {log.metadata?.profitPercent !== undefined && (
                              <span className={`text-[10px] font-black uppercase ${log.metadata.profitPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                Lucro: {log.metadata.profitPercent.toFixed(2)}%
                              </span>
                            )}
                          </td>
                          <td className="px-8 py-5 text-right">
                            <span className={`font-black tracking-tight text-base ${
                              log.change === 'positive' ? 'text-green-600' : 
                              log.change === 'negative' ? 'text-red-500' : 'text-gray-900'
                            }`}>
                              {log.change === 'positive' ? '+' : log.change === 'negative' ? '-' : ''}
                              {log.amount.toLocaleString()} <span className="text-[10px]">UR</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : activeTab === 'announcements' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Card>
            <CardHeader className="p-6 border-b border-gray-100 bg-gray-50/50">
              <CardTitle className="text-xl flex items-center gap-2 text-brand-orange">
                <Megaphone className="w-6 h-6" />
                Novo Comunicado
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Título do Aviso</label>
                  <Input 
                    placeholder="Ex: Reunião da Feira Unireal"
                    value={annTitle}
                    onChange={e => setAnnTitle(e.target.value)}
                    className="font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Conteúdo da Mensagem</label>
                  <textarea 
                    className="w-full min-h-[100px] p-4 rounded-xl border border-gray-200 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none resize-none text-sm transition-all"
                    placeholder="Descreva o que os alunos precisam saber..."
                    value={annContent}
                    onChange={e => setAnnContent(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Público-Alvo (Turmas)</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setAnnTargetGrades(annTargetGrades.includes('TODOS') ? [] : ['TODOS'])}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${
                        annTargetGrades.includes('TODOS') 
                        ? 'bg-gray-900 text-white shadow-lg' 
                        : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-900'
                      }`}
                    >
                      Todos os Alunos
                    </button>
                    {uniqueGrades.map(grade => (
                      <button
                        key={grade}
                        onClick={() => {
                          if (annTargetGrades.includes('TODOS')) {
                            setAnnTargetGrades([grade]);
                          } else if (annTargetGrades.includes(grade)) {
                            setAnnTargetGrades(annTargetGrades.filter(g => g !== grade));
                          } else {
                            setAnnTargetGrades([...annTargetGrades, grade]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${
                          annTargetGrades.includes(grade) && !annTargetGrades.includes('TODOS')
                          ? 'bg-brand-orange text-white shadow-lg' 
                          : 'bg-white text-gray-500 border border-gray-200 hover:border-brand-orange'
                        }`}
                      >
                        {grade}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-4 flex justify-end">
                  <Button 
                    onClick={handleCreateAnnouncement}
                    disabled={creatingAnn}
                    className="h-14 px-10 rounded-2xl font-black text-lg shadow-lg shadow-brand-orange/10"
                  >
                    {creatingAnn ? 'Publicando...' : 'Publicar Agora'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-6 border-b border-gray-100">
              <CardTitle className="text-xl">Histórico de Avisos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {announcements.length === 0 ? (
                <div className="p-12 text-center text-gray-400">Nenhum aviso publicado.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {announcements.map(ann => (
                    <div key={ann.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-gray-900">{ann.title}</h4>
                          <p className="text-sm text-gray-600 line-clamp-2">{ann.content}</p>
                          <div className="flex flex-wrap gap-1 mt-3">
                            {ann.target_grades.map((g: string) => (
                              <span key={g} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[9px] font-black uppercase rounded">
                                {g}
                              </span>
                            ))}
                            <span className="ml-2 text-[9px] text-gray-400 font-bold uppercase tracking-widest self-center">
                              {new Date(ann.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteAnnouncement(ann.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
                  onClick={saveSettings} 
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

          <Card className="border-red-100 bg-red-50/30">
            <CardHeader className="p-6 border-b border-red-100">
              <CardTitle className="text-xl flex items-center gap-2 text-red-600">
                <Bell className="w-6 h-6" />
                Modo de Manutenção (Lock Mode)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center justify-between p-6 bg-white rounded-2xl border border-red-100 shadow-sm">
                <div>
                  <h4 className="font-bold text-gray-900">Pausar Plataforma</h4>
                  <p className="text-sm text-gray-500">Alunos serão impedidos de realizar qualquer ação.</p>
                </div>
                <button 
                  onClick={() => setMaintenanceMode(!maintenanceMode)}
                  className={`w-14 h-8 rounded-full transition-all relative ${maintenanceMode ? 'bg-red-600' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${maintenanceMode ? 'left-7' : 'left-1 shadow-sm'}`} />
                </button>
              </div>

              {maintenanceMode && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-black text-red-600 uppercase tracking-widest">Mensagem de Aviso para Alunos</label>
                  <textarea 
                    className="w-full min-h-[100px] p-4 rounded-xl border border-red-200 focus:border-red-600 outline-none resize-none text-sm bg-white"
                    placeholder="Ex: Estamos atualizando o sistema para a próxima fase da economia..."
                    value={maintenanceMessage}
                    onChange={e => setMaintenanceMessage(e.target.value)}
                  />
                  <p className="text-[10px] text-red-500 font-bold italic tracking-tight">Os alunos verão esta mensagem em tela cheia ao tentar acessar qualquer página.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-600/20 bg-red-950 text-white overflow-hidden">
            <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 bg-red-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-red-600/40 shrink-0">
                  <AlertTriangle className="w-8 h-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                    Zona de Perigo
                  </h3>
                  <p className="text-red-200/60 text-sm leading-relaxed max-w-md">
                    Ao zerar o sistema, todos os saldos de alunos voltarão para 0 UR. O histórico de investimentos e transações será permanentemente apagado. <strong>Esta ação não pode ser desfeita.</strong>
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => setResetModalOpen(true)}
                  className="bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all shadow-xl shadow-red-900/50 flex items-center justify-center gap-3 active:scale-95"
                >
                  <RotateCcw className="w-5 h-5" />
                  Zerar Sistema
                </button>
                <button 
                  onClick={handleCleanupDiscontinued}
                  className="bg-orange-600 hover:bg-orange-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all shadow-xl shadow-orange-900/50 flex items-center justify-center gap-3 active:scale-95"
                >
                  <Trash2 className="w-5 h-5" />
                  Limpar Descontinuados
                </button>
              </div>
            </div>
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

      {activeTab === 'announcements' && dbError && (
        <div className="mt-8 p-8 bg-red-50 border-2 border-red-200 rounded-3xl animate-in zoom-in-95 duration-300">
          <div className="flex items-center gap-4 text-red-600 mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Tabela não encontrada</h3>
              <p className="opacity-80">Rode o script SQL abaixo para habilitar o sistema de avisos.</p>
            </div>
          </div>
          <div className="bg-gray-900 rounded-2xl p-6 overflow-x-auto mb-6 border-4 border-red-100 shadow-xl">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">SQL Announcements Script</span>
              <span className="text-red-400 text-[10px] font-bold px-2 py-0.5 rounded border border-red-400/30 uppercase">Executor Obrigatório</span>
            </div>
            <pre className="text-blue-400 text-sm font-mono leading-relaxed">
{`CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text NOT NULL,
    target_grades text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    admin_id uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public select" ON public.announcements 
FOR SELECT USING (true);

CREATE POLICY "Admin full access" ON public.announcements 
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());`}
            </pre>
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

      {/* Student Details Modal */}
      {detailsStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 my-8">
            <div className="bg-black p-8 text-white relative">
              <button 
                onClick={() => setDetailsStudent(null)}
                className="absolute top-8 right-8 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-3xl bg-brand-orange flex items-center justify-center text-3xl font-black shadow-2xl shadow-brand-orange/20">
                  {detailsStudent.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight">{detailsStudent.full_name}</h2>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest">{detailsStudent.grade || 'S/ Turma'}</span>
                    <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">{detailsStudent.id.slice(0, 8)}...</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
                <div className="bg-white/10 p-4 rounded-2xl">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Saldo em Carteira</p>
                  <p className="text-xl font-black text-brand-orange">{detailsStudent.balance} UR</p>
                </div>
                <div className="bg-white/10 p-4 rounded-2xl">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Total Investido (Atual)</p>
                  <p className="text-xl font-black text-green-400">
                    {Math.round(studentInvestments
                      .filter(i => !i.redeemed_at)
                      .reduce((acc, inv) => acc + calculateCurrentAmount(inv), 0)
                    )} UR
                  </p>
                </div>
                <div className="bg-white/10 p-4 rounded-2xl">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Patrimônio Total</p>
                  <p className="text-xl font-black text-white">
                    {Math.round(detailsStudent.balance + studentInvestments
                      .filter(i => !i.redeemed_at)
                      .reduce((acc, inv) => acc + calculateCurrentAmount(inv), 0)
                    )} UR
                  </p>
                </div>
                <div className="bg-white/10 p-4 rounded-2xl">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Ativos Pendentes</p>
                  <p className="text-xl font-black text-blue-400">{studentInvestments.filter(i => !i.redeemed_at).length}</p>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button 
                  onClick={() => setDetailsTab('portfolio')}
                  className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${detailsTab === 'portfolio' ? 'bg-brand-orange text-white' : 'text-white/60 hover:text-white'}`}
                >
                  <Briefcase className="w-4 h-4" />
                  Portfólio
                </button>
                <button 
                  onClick={() => setDetailsTab('logs')}
                  className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${detailsTab === 'logs' ? 'bg-brand-orange text-white' : 'text-white/60 hover:text-white'}`}
                >
                  <History className="w-4 h-4" />
                  Log de Atividade
                </button>
              </div>
            </div>

            <div className="p-8">
              {loadingDetails ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Sincronizando dados...</p>
                </div>
              ) : detailsTab === 'portfolio' ? (
                <div className="space-y-6">
                  {studentInvestments.length === 0 ? (
                    <div className="py-12 bg-gray-50 rounded-3xl text-center">
                      <p className="text-gray-400 font-bold">Nenhum investimento encontrado.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {studentInvestments.map(inv => {
                        const currentVal = calculateCurrentAmount(inv);
                        const pnl = inv.redeemed_at 
                          ? ((inv.redeemed_amount! - inv.amount) / inv.amount) * 100
                          : ((currentVal - inv.amount) / inv.amount) * 100;

                        return (
                          <div key={inv.id} className={`p-6 rounded-3xl border ${inv.redeemed_at ? 'bg-gray-50 border-gray-100 opacity-75' : 'bg-white border-gray-100 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="font-black text-gray-900 uppercase tracking-tight text-sm">{inv.type}</h4>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  {inv.redeemed_at ? `Resgatado em ${new Date(inv.redeemed_at).toLocaleDateString('pt-BR')}` : `Início: ${new Date(inv.created_at).toLocaleDateString('pt-BR')}`}
                                </p>
                              </div>
                              <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 ${pnl >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {pnl >= 0 ? <TrendingUpDown className="w-3 h-3" /> : <History className="w-3 h-3 opacity-30" />}
                                {pnl.toFixed(1)}%
                              </div>
                            </div>
                            <div className="flex justify-between items-end">
                              <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Investido</p>
                                <p className="font-bold text-gray-900">{inv.amount} UR</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor {inv.redeemed_at ? 'Final' : 'Atual'}</p>
                                <p className={`text-xl font-black ${pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {Math.round(inv.redeemed_at ? inv.redeemed_amount! : currentVal)} <span className="text-[10px]">UR</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-[2rem] overflow-hidden border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-white border-b border-gray-200 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          <th className="px-8 py-4">Data</th>
                          <th className="px-8 py-4">Evento</th>
                          <th className="px-8 py-4 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {studentLogs.map(log => (
                          <tr key={log.id} className="bg-white/50 border-b border-gray-100 last:border-0 hover:bg-white transition-colors">
                            <td className="px-8 py-5">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                  {new Date(log.date).toLocaleDateString('pt-BR')}
                                </span>
                                <span className="text-[10px] font-bold text-gray-500">
                                  {new Date(log.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                  log.type === 'mint' ? 'bg-blue-50 text-blue-600' :
                                  log.type === 'investment' ? 'bg-orange-50 text-orange-600' :
                                  log.type === 'redemption' ? 'bg-green-50 text-green-600' : 
                                  log.change === 'positive' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                }`}>
                                  {log.type === 'mint' ? <TrendingUp className="w-5 h-5" /> :
                                   log.type === 'investment' ? <ShoppingCart className="w-5 h-5" /> :
                                   log.type === 'redemption' ? <BarChart3 className="w-5 h-5" /> :
                                   log.change === 'positive' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                </div>
                                <div>
                                  <span className="text-sm font-black text-gray-900 block leading-tight">{log.description}</span>
                                  {log.type === 'redemption' && log.metadata?.profit !== undefined && (
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${log.metadata.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                      {log.metadata.profit >= 0 ? 'Lucro' : 'Prejuízo'}: {Math.round(log.metadata.profit)} UR ({log.metadata.profitPercent?.toFixed(1)}%)
                                    </span>
                                  )}
                                  {log.type === 'transfer' && log.metadata?.targetName && (
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                      ID: {log.id.split('-')[0]}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-5 text-right">
                              <span className={`text-sm font-black px-3 py-1.5 rounded-lg inline-block ${
                                log.change === 'positive' ? 'bg-green-100/50 text-green-600' : 
                                log.change === 'negative' ? 'bg-red-100/50 text-red-600' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {log.change === 'positive' ? '+' : '-'}{Math.round(log.amount)} UR
                              </span>
                            </td>
                          </tr>
                        ))}
                        {studentLogs.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-8 py-12 text-center text-gray-400 font-bold">Nenhuma atividade registrada.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Reset System Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-red-600 p-8 text-white relative">
              <button 
                onClick={() => {
                  setResetModalOpen(false);
                  setResetConfirmText('');
                }}
                className="absolute top-8 right-8 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mb-6">
                <AlertTriangle className="w-10 h-10 text-white" />
              </div>
              
              <h2 className="text-3xl font-black uppercase tracking-tight leading-tight">
                Zerar Sistema Financeiro?
              </h2>
              <p className="text-red-100 font-bold opacity-80 uppercase tracking-widest text-[10px] mt-2">Ação Irreversível</p>
            </div>

            <div className="p-8 space-y-6">
              <div className="p-6 bg-red-50 border-l-4 border-red-600 rounded-2xl text-red-900">
                <p className="text-sm font-bold leading-relaxed italic">
                  "Eu compreendo que ao confirmar, todos os alunos começarão do zero (0 UR) e todo o histórico atual será deletado."
                </p>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Digite <span className="text-red-600 font-black">ZERAR</span> para confirmar</label>
                <Input 
                  className="h-16 text-2xl font-black text-center uppercase tracking-widest border-2 focus:border-red-600 transition-all rounded-2xl"
                  placeholder="DIGITE AQUI"
                  value={resetConfirmText}
                  onChange={e => setResetConfirmText(e.target.value.toUpperCase())}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1 h-14 rounded-2xl border-2 font-bold" 
                  onClick={() => {
                    setResetModalOpen(false);
                    setResetConfirmText('');
                  }}
                >
                  Abortar Missão
                </Button>
                <Button 
                  className="flex-1 h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-200 font-black uppercase tracking-widest text-xs" 
                  onClick={handleResetSystem}
                  disabled={resetting || resetConfirmText !== 'ZERAR'}
                >
                  {resetting ? 'Limpando...' : 'Confirmar Limpeza'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
