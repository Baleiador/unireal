import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useNavigate, Link } from 'react-router';
import { GraduationCap, Users, Sparkles, ArrowRight, UserCheck } from 'lucide-react';
import { PARENT_GRADE, PARENT_BONUS_AMOUNT } from '../constants';
import { authenticateParent, getRecentParents, RecentParentEntry } from '../lib/parentAuth';

type StudentOption = {
  id: string;
  full_name: string;
  grade: string | null;
  unit: string | null;
};

export function Login() {
  const [loginMode, setLoginMode] = useState<'student' | 'parent'>('student');
  
  // Student standard fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Parent fluid fields (no email required)
  const [parentName, setParentName] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [manualStudentName, setManualStudentName] = useState('');
  const [parentUnit, setParentUnit] = useState('Palmares');
  const [studentsList, setStudentsList] = useState<StudentOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [recentParents, setRecentParents] = useState<RecentParentEntry[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (loginMode === 'parent') {
      fetchStudents();
      setRecentParents(getRecentParents());
    }
  }, [loginMode]);

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, grade, unit, is_admin')
        .eq('is_admin', false)
        .order('full_name', { ascending: true });

      if (!error && data) {
        const validStudents = data.filter(p => p.grade !== PARENT_GRADE);
        setStudentsList(validStudents);
      }
    } catch (err) {
      console.error('Error fetching students for parent quick login:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleStudentSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedStudentId(val);
    if (val && val !== 'manual') {
      const found = studentsList.find(s => s.id === val);
      if (found && found.unit) {
        setParentUnit(found.unit);
      }
    }
  };

  // Quick 1-click login for recent parents on this device
  const handleQuickLoginRecent = async (entry: RecentParentEntry) => {
    setParentName(entry.fullName);
    setParentUnit(entry.unit);
    if (entry.studentId && studentsList.some(s => s.id === entry.studentId)) {
      setSelectedStudentId(entry.studentId);
    } else {
      setSelectedStudentId('manual');
      setManualStudentName(entry.studentName);
    }

    setLoading(true);
    setError(null);
    const result = await authenticateParent({
      fullName: entry.fullName,
      studentId: entry.studentId,
      studentName: entry.studentName,
      unit: entry.unit,
    });
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Erro ao entrar. Tente novamente.');
    }
  };

  // Parent Fluid Login/Register Submit
  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let chosenStudentName = '';
    if (selectedStudentId === 'manual') {
      if (!manualStudentName.trim()) {
        setError('Por favor, digite o nome completo do seu filho(a).');
        return;
      }
      chosenStudentName = manualStudentName.trim();
    } else if (selectedStudentId) {
      const found = studentsList.find(s => s.id === selectedStudentId);
      chosenStudentName = found ? found.full_name : '';
    } else {
      setError('Por favor, selecione seu filho(a) na lista ou digite o nome.');
      return;
    }

    if (!parentName.trim()) {
      setError('Por favor, informe seu nome completo.');
      return;
    }

    setLoading(true);

    const result = await authenticateParent({
      fullName: parentName.trim(),
      studentId: selectedStudentId !== 'manual' ? selectedStudentId : null,
      studentName: chosenStudentName,
      unit: parentUnit,
    });

    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Não foi possível entrar. Tente novamente.');
    }
  };

  // Student / Teacher standard login
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (import.meta.env.VITE_SUPABASE_URL === 'YOUR_SUPABASE_URL' || !import.meta.env.VITE_SUPABASE_URL) {
      setError('ATENÇÃO: Variáveis do Supabase não configuradas.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      navigate('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-brand-gray flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        <div className="flex justify-center mb-6">
          <Logo className="scale-125" />
        </div>
        
        <h2 className="text-2xl font-black text-center text-black mb-1">Entrar na Plataforma</h2>
        <p className="text-center text-gray-500 text-sm mb-6">Acesse seu saldo e recompensas escolares:</p>

        {/* Profile Mode Toggle */}
        <div className="grid grid-cols-2 gap-2.5 mb-6 p-1 bg-gray-100 rounded-2xl">
          <button
            type="button"
            onClick={() => setLoginMode('student')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
              loginMode === 'student'
                ? 'bg-white text-black shadow-md shadow-black/5 scale-[1.02]'
                : 'text-gray-500 hover:text-black'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-brand-orange" />
            Aluno / Professor
          </button>
          
          <button
            type="button"
            onClick={() => setLoginMode('parent')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all relative ${
              loginMode === 'parent'
                ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/30 scale-[1.02]'
                : 'text-gray-500 hover:text-black'
            }`}
          >
            <Users className="w-4 h-4" />
            Pais (Sem E-mail)
            <span className="absolute -top-2 -right-1 bg-yellow-400 text-yellow-950 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
              +2.000 UR
            </span>
          </button>
        </div>

        {/* PARENT MODE: Frictionless, no email, no password */}
        {loginMode === 'parent' ? (
          <div>
            <div className="mb-5 p-3.5 bg-orange-50/80 border border-orange-200/80 rounded-2xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-orange text-white flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-black text-orange-950 uppercase tracking-wider">Acesso Direto dos Pais</p>
                <p className="text-xs text-orange-900/90 font-medium mt-0.5">
                  Não é necessário e-mail. Basta informar seu nome e seu filho(a) para entrar com <strong>2.000 UR$ de bônus</strong>!
                </p>
              </div>
            </div>

            {/* Quick 1-click recent parents list */}
            {recentParents.length > 0 && (
              <div className="mb-5 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-[11px] font-black uppercase text-gray-400 tracking-wider mb-2 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-brand-orange" />
                  Entrar com 1 toque neste aparelho:
                </p>
                <div className="flex flex-col gap-1.5">
                  {recentParents.map((rp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={loading}
                      onClick={() => handleQuickLoginRecent(rp)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 hover:border-brand-orange hover:text-brand-orange transition-all shadow-sm active:scale-[0.99] text-left"
                    >
                      <span>👨‍👩‍👧 {rp.fullName}</span>
                      <span className="text-[11px] text-brand-orange font-semibold flex items-center gap-1">
                        Filho(a): {rp.studentName} →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleParentLogin} className="space-y-4">
              {error && (
                <div className="p-3.5 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-medium text-center">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-black uppercase text-gray-600 mb-1 tracking-wider">
                  Nome do Pai / Mãe / Responsável *
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Maria Carvalho"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  required
                />
              </div>

              <div className="p-3.5 bg-orange-50/40 rounded-2xl border border-orange-100 space-y-2.5">
                <label className="block text-xs font-black uppercase text-brand-orange tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Filho(a) Estudante no Projeto *
                  </span>
                  {selectedStudentId !== 'manual' && (
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId('manual')}
                      className="text-[11px] text-brand-orange hover:underline font-bold"
                    >
                      Digitar nome
                    </button>
                  )}
                </label>

                {loadingStudents ? (
                  <div className="py-2 text-xs text-gray-400 font-bold flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-brand-orange border-t-transparent animate-spin" />
                    Buscando alunos...
                  </div>
                ) : (
                  <select
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 outline-none transition-all bg-white font-medium text-gray-800 text-sm shadow-sm"
                    value={selectedStudentId}
                    onChange={handleStudentSelect}
                    required
                  >
                    <option value="" disabled>-- Selecione seu filho(a) --</option>
                    {studentsList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.grade || 'Aluno'} - Unidade {s.unit || 'Palmares'})
                      </option>
                    ))}
                    <option value="manual">➕ Não está na lista? (Digitar nome)</option>
                  </select>
                )}

                {selectedStudentId === 'manual' && (
                  <div className="pt-1 space-y-2 animate-in fade-in duration-200">
                    <Input
                      type="text"
                      placeholder="Nome completo do seu filho(a)"
                      value={manualStudentName}
                      onChange={(e) => setManualStudentName(e.target.value)}
                      required
                    />
                    {studentsList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedStudentId('')}
                        className="text-[11px] text-brand-orange hover:underline font-bold block"
                      >
                        Voltar para lista de alunos
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-600 mb-1 tracking-wider">Unidade Escolar</label>
                <select
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 outline-none transition-all bg-white font-medium text-gray-800 text-sm shadow-sm"
                  value={parentUnit}
                  onChange={(e) => setParentUnit(e.target.value)}
                  required
                >
                  <option value="Palmares">Unidade Palmares</option>
                  <option value="Ribeirão">Unidade Ribeirão</option>
                </select>
              </div>

              <Button
                type="submit"
                className="w-full py-4 text-base font-black shadow-lg shadow-brand-orange/25 hover:shadow-brand-orange/40 hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Acessando...</span>
                  </div>
                ) : (
                  <>
                    <span>Entrar</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>
          </div>
        ) : (
          /* STUDENT / TEACHER LOGIN FORM */
          <form onSubmit={handleStudentLogin} className="space-y-4">
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-medium text-center">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-xs font-black uppercase text-gray-600 mb-1 tracking-wider">E-mail Escolar *</label>
              <Input
                type="email"
                placeholder="aluno@colegioreal.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-black uppercase text-gray-600 tracking-wider">Senha *</label>
                <Link to="/forgot-password" className="text-xs text-brand-orange hover:underline font-bold">
                  Esqueceu?
                </Link>
              </div>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full py-3.5 font-black text-sm" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar como Aluno / Professor'}
            </Button>
          </form>
        )}
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Novo por aqui?{' '}
            <Link to="/register" className="text-brand-orange font-black hover:underline">
              {loginMode === 'parent' ? 'Acessar pela Página de Cadastro' : 'Cadastre-se'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
