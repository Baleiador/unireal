import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useNavigate, Link } from 'react-router';
import { GRADES } from '../constants';
import { CheckCircle2 } from 'lucide-react';

export function Register() {
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState('');
  const [unit, setUnit] = useState<string>('Palmares');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
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
            Cadastro Realizado!
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
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        <div className="flex justify-center mb-8">
          <Logo className="scale-125" />
        </div>
        
        <h2 className="text-2xl font-bold text-center text-black mb-2">Criar Nova Conta</h2>
        <p className="text-center text-gray-500 mb-8">Cadastre-se para começar a usar a moeda escolar.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm text-center">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
            <Input
              type="text"
              placeholder="Ex: João da Silva"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidade Escolar</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Turma / Série</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail Escolar</label>
            <Input
              type="email"
              placeholder="aluno@colegioreal.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <Button type="submit" className="w-full py-3.5 mt-2" disabled={loading}>
            {loading ? 'Cadastrando...' : 'Criar Conta'}
          </Button>
        </form>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Já tem uma conta? <Link to="/login" className="text-brand-orange font-semibold hover:underline">Faça login</Link></p>
        </div>
      </div>
    </div>
  );
}
