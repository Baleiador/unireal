import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useNavigate, Link } from 'react-router';
import { GRADES, PARENT_GRADE, PARENT_BONUS_AMOUNT } from '../constants';
import { GraduationCap, Users, Sparkles, HeartHandshake, CheckCircle2, ArrowRight, UserCheck } from 'lucide-react';
import { authenticateParent, getRecentParents, RecentParentEntry } from '../lib/parentAuth';

type StudentOption = {
  id: string;
  full_name: string;
  grade: string | null;
  unit: string | null;
};

export function Register() {
  const [userCategory, setUserCategory] = useState<'student' | 'parent'>('student');
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState('');
  const [unit, setUnit] = useState<string>('Palmares');
  
  // Student-only fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Parent specific states
  const [studentsList, setStudentsList] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [manualStudentName, setManualStudentName] = useState<string>('');
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [recentParents, setRecentParents] = useState<RecentParentEntry[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [registeredChildName, setRegisteredChildName] = useState<string>('');
  const navigate = useNavigate();

  // Load students & recent parents when parent tab is selected
  useEffect(() => {
    if (userCategory === 'parent') {
      fetchStudents();
      setRecentParents(getRecentParents());
    }
  }, [userCategory]);

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, grade, unit, is_admin')
        .eq('is_admin', false)
        .order('full_name', { ascending: true });

      if (!error && data) {
        // Exclude profiles that are already parents
        const validStudents = data.filter(p => p.grade !== PARENT_GRADE);
        setStudentsList(validStudents);
      }
    } catch (err) {
      console.error('Error fetching students for parent selection:', err);
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
        setUnit(found.unit);
      }
    }
  };

  const handleSelectRecentParent = async (entry: RecentParentEntry) => {
    setFullName(entry.fullName);
    setUnit(entry.unit);
    if (entry.studentId && studentsList.some(s => s.id === entry.studentId)) {
      setSelectedStudentId(entry.studentId);
    } else {
      setSelectedStudentId('manual');
      setManualStudentName(entry.studentName);
    }

    // Auto-authenticate for maximum fluidity during presentation
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

  // Submit Handler for Parents (No Email / No Password required)
  const handleParentSubmit = async (e: React.FormEvent) => {
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
      setError('Por favor, selecione seu filho(a) na lista ou clique em "Não encontrou? Digitar nome".');
      return;
    }

    if (!fullName.trim()) {
      setError('Por favor, informe seu nome completo.');
      return;
    }

    setLoading(true);

    const result = await authenticateParent({
      fullName: fullName.trim(),
      studentId: selectedStudentId !== 'manual' ? selectedStudentId : null,
      studentName: chosenStudentName,
      unit: unit,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Não foi possível entrar. Tente novamente.');
      return;
    }

    setRegisteredChildName(chosenStudentName);
    // Directly navigate into the dashboard for instantaneous presentation experience
    navigate('/dashboard');
  };

  // Submit Handler for Students (Email + Password standard)
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (import.meta.env.VITE_SUPABASE_URL === 'YOUR_SUPABASE_URL' || !import.meta.env.VITE_SUPABASE_URL) {
      setError('ATENÇÃO: Variáveis do Supabase não configuradas no ambiente.');
      return;
    }

    if (!grade) {
      setError('Por favor, selecione sua turma.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError(null);

    const userMetadata = {
      full_name: fullName,
      grade: grade,
      unit: unit,
      role: 'student',
      raw_password: password,
    };

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userMetadata
      }
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (authData?.user) {
      try {
        await supabase
          .from('profiles')
          .update({
            unit: unit,
            full_name: fullName,
            grade: grade,
          })
          .eq('id', authData.user.id);
      } catch (err) {
        console.warn('Profile direct update fallback error:', err);
      }
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-brand-gray flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100 text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="flex justify-center mb-6">
            <Logo className="scale-125" />
          </div>

          <div className="w-16 h-16 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-green-100 shadow-sm">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <h2 className="text-2xl font-black text-black mb-2">
            Cadastro de Estudante Realizado!
          </h2>

          <p className="text-gray-500 mb-8 mt-2 text-sm leading-relaxed">
            Conta criada com sucesso! Faça login com seu e-mail e senha cadastrados para começar.
          </p>

          <Button onClick={() => navigate('/login')} className="w-full py-4 text-base font-black">
            Ir para o Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-gray flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        <div className="flex justify-center mb-6">
          <Logo className="scale-125" />
        </div>
        
        <h2 className="text-2xl font-black text-center text-black mb-1">Acesso à Plataforma</h2>
        <p className="text-center text-gray-500 text-sm mb-6">Escolha o seu perfil para entrar no projeto:</p>

        {/* Category Selector Tabs */}
        <div className="grid grid-cols-2 gap-3 mb-6 p-1 bg-gray-100 rounded-2xl">
          <button
            type="button"
            onClick={() => setUserCategory('student')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
              userCategory === 'student'
                ? 'bg-white text-black shadow-md shadow-black/5 scale-[1.02]'
                : 'text-gray-500 hover:text-black'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-brand-orange" />
            Aluno / Estudante
          </button>
          
          <button
            type="button"
            onClick={() => setUserCategory('parent')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all relative ${
              userCategory === 'parent'
                ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/30 scale-[1.02]'
                : 'text-gray-500 hover:text-black'
            }`}
          >
            <Users className="w-4 h-4" />
            Pai / Responsável
            <span className="absolute -top-2 -right-1 bg-yellow-400 text-yellow-950 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
              +2.000 UR
            </span>
          </button>
        </div>

        {/* PARENT MODE: Fluid, email-less registration & direct access */}
        {userCategory === 'parent' ? (
          <div>
            {/* Presentation Highlight Banner */}
            <div className="mb-6 p-4 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200/80 rounded-2xl flex items-start gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-brand-orange text-white flex items-center justify-center shrink-0 shadow-md shadow-brand-orange/20 mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-orange-950 uppercase tracking-wider">Acesso Fluido para Pais</span>
                  <span className="bg-orange-200/60 text-orange-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">Sem E-mail</span>
                </div>
                <p className="text-xs text-orange-900/90 leading-relaxed font-medium">
                  Basta informar seu <strong>nome</strong> e selecionar seu <strong>filho(a)</strong>. Você entrará instantaneamente com o bônus de <strong>2.000 UR$</strong> liberado para testar!
                </p>
              </div>
            </div>

            {/* Recent Parents Quick Chips (if saved on device) */}
            {recentParents.length > 0 && (
              <div className="mb-6 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-[11px] font-black uppercase text-gray-400 tracking-wider mb-2 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-brand-orange" />
                  Acessar com 1 clique (Neste dispositivo):
                </p>
                <div className="flex flex-wrap gap-2">
                  {recentParents.map((rp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={loading}
                      onClick={() => handleSelectRecentParent(rp)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 hover:border-brand-orange hover:text-brand-orange transition-all shadow-sm active:scale-95"
                    >
                      <span>👨‍👩‍👧 {rp.fullName}</span>
                      <span className="text-[10px] text-gray-400 font-normal">({rp.studentName})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleParentSubmit} className="space-y-4">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm text-center font-medium animate-in fade-in duration-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-black uppercase text-gray-600 mb-1 tracking-wider">
                  Seu Nome Completo (Pai / Mãe / Responsável) *
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Carlos Eduardo de Oliveira"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {/* Child selector */}
              <div className="p-4 bg-orange-50/40 rounded-2xl border border-orange-100 space-y-3">
                <label className="block text-xs font-black uppercase text-brand-orange tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Filho(a) Estudante no Projeto *
                  </span>
                  {selectedStudentId !== 'manual' && (
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId('manual')}
                      className="text-[11px] text-brand-orange hover:underline font-bold capitalize"
                    >
                      Digitar nome
                    </button>
                  )}
                </label>

                {loadingStudents ? (
                  <div className="py-2.5 text-xs text-gray-400 font-bold flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-brand-orange border-t-transparent animate-spin" />
                    Carregando alunos do colégio...
                  </div>
                ) : (
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 outline-none transition-all bg-white font-medium text-gray-800 text-sm shadow-sm"
                    value={selectedStudentId}
                    onChange={handleStudentSelect}
                    required
                  >
                    <option value="" disabled>-- Selecione seu filho(a) na lista --</option>
                    {studentsList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.grade || 'Aluno'} - Unidade {s.unit || 'Palmares'})
                      </option>
                    ))}
                    <option value="manual">➕ Não está na lista? (Digitar nome do aluno)</option>
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
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-gray-400">
                        O vínculo será ativado com os 2.000 UR$ bônus.
                      </p>
                      {studentsList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedStudentId('')}
                          className="text-[11px] text-brand-orange hover:underline font-bold"
                        >
                          Voltar para lista
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-600 mb-1 tracking-wider">Unidade Escolar</label>
                <select
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 outline-none transition-all bg-white font-medium text-gray-800 text-sm shadow-sm"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  required
                >
                  <option value="Palmares">Unidade Palmares</option>
                  <option value="Ribeirão">Unidade Ribeirão</option>
                </select>
              </div>

              {/* Bonus Announcement Card */}
              <div className="p-3 bg-white rounded-xl border border-orange-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🎁</span>
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Bônus Especial de Apresentação</span>
                    <span className="text-sm font-black text-brand-orange">+{PARENT_BONUS_AMOUNT.toLocaleString()} Unireais (UR$)</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">Pronto para Resgatar</span>
              </div>

              <Button
                type="submit"
                className="w-full py-4 text-base font-black shadow-lg shadow-brand-orange/25 hover:shadow-brand-orange/40 hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Entrando no Sistema...</span>
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
          /* STUDENT MODE: Standard student registration */
          <form onSubmit={handleStudentSubmit} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm text-center">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-xs font-black uppercase text-gray-500 mb-1 tracking-wider">
                Nome Completo do Aluno *
              </label>
              <Input
                type="text"
                placeholder="Ex: João da Silva"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-gray-500 mb-1 tracking-wider">Unidade Escolar *</label>
              <select
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 outline-none transition-all bg-white font-medium text-gray-800 text-sm"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
              >
                <option value="Palmares">Unidade Palmares</option>
                <option value="Ribeirão">Unidade Ribeirão</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-gray-500 mb-1 tracking-wider">Turma / Série *</label>
              <select
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 outline-none transition-all bg-white font-medium text-gray-800 text-sm"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                required
              >
                <option value="" disabled>Selecione sua turma</option>
                {GRADES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-gray-500 mb-1 tracking-wider">
                E-mail Escolar *
              </label>
              <Input
                type="email"
                placeholder="aluno@colegioreal.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase text-gray-500 mb-1 tracking-wider">Senha *</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-500 mb-1 tracking-wider">Confirmar Senha *</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button type="submit" className="w-full py-4 text-base font-black mt-2" disabled={loading}>
              {loading ? 'Cadastrando Aluno...' : 'Cadastrar Aluno'}
            </Button>
          </form>
        )}
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Já tem uma conta de aluno ou professor? <Link to="/login" className="text-brand-orange font-bold hover:underline">Faça login</Link></p>
        </div>
      </div>
    </div>
  );
}
