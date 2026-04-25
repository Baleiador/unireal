import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useNavigate, Link } from 'react-router';

export function Register() {
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Placeholder check
    if (import.meta.env.VITE_SUPABASE_URL === 'YOUR_SUPABASE_URL' || !import.meta.env.VITE_SUPABASE_URL) {
      setError('ATENÇÃO: Variáveis do Supabase não configuradas. Vá ao menu Secrets do AI Studio e adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          grade: grade,
        }
      }
    });

    if (error) {
      if (error.message === 'Failed to fetch') {
        setError('Erro de conexão: Verifique se suas chaves do Supabase (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY) estão configuradas corretamente e se a URL começa com https://');
      } else {
        setError(error.message);
      }
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-brand-gray flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100 text-center">
          <div className="flex justify-center mb-8">
            <Logo className="scale-125" />
          </div>
          <h2 className="text-2xl font-bold text-black mb-4">Cadastro Realizado!</h2>
          <p className="text-gray-500 mb-8">
            Verifique seu e-mail para confirmar o cadastro antes de fazer login.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full">
            Ir para o Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-gray flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        <div className="flex justify-center mb-8">
          <Logo className="scale-125" />
        </div>
        
        <h2 className="text-2xl font-bold text-center text-black mb-2">Criar Conta</h2>
        <p className="text-center text-gray-500 mb-8">Cadastre-se para participar das recompensas.</p>

        <form onSubmit={handleRegister} className="space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm text-center">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome Completo</label>
            <Input
              type="text"
              placeholder="João da Silva"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Turma / Cargo</label>
            <select
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 outline-none transition-all bg-white"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              required
            >
              <option value="" disabled>Selecione sua turma ou cargo</option>
              <option value="Coordenação / Professor">Coordenação / Professor</option>
              <option value="6º Ano">6º Ano</option>
              <option value="7º Ano">7º Ano</option>
              <option value="8º Ano">8º Ano</option>
              <option value="9º Ano">9º Ano</option>
              <option value="1º Ano (Ensino Médio)">1º Ano (Ensino Médio)</option>
              <option value="2º Ano (Ensino Médio)">2º Ano (Ensino Médio)</option>
              <option value="3º Ano (Ensino Médio)">3º Ano (Ensino Médio)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail Escolar</label>
            <Input
              type="email"
              placeholder="aluno@colegioreal.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar Senha</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Cadastrando...' : 'Cadastrar'}
          </Button>
        </form>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Já tem uma conta? <Link to="/login" className="text-brand-orange font-medium hover:underline">Faça login</Link></p>
        </div>
      </div>
    </div>
  );
}
