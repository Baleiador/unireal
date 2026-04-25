import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useNavigate, Link } from 'react-router';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Placeholder check
    if (import.meta.env.VITE_SUPABASE_URL === 'YOUR_SUPABASE_URL' || !import.meta.env.VITE_SUPABASE_URL) {
      setError('ATENÇÃO: Variáveis do Supabase não configuradas. Vá ao menu Secrets do AI Studio e adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message === 'Failed to fetch') {
        setError('Erro de conexão: Verifique se suas chaves do Supabase (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY) estão configuradas corretamente e se a URL começa com https://');
      } else {
        setError(error.message);
      }
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-brand-gray flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        <div className="flex justify-center mb-8">
          <Logo className="scale-125" />
        </div>
        
        <h2 className="text-2xl font-bold text-center text-black mb-2">Bem-vindo de volta!</h2>
        <p className="text-center text-gray-500 mb-8">Faça login para acessar suas recompensas.</p>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm text-center">
              {error}
            </div>
          )}
          
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Senha</label>
              <Link to="/forgot-password" className="text-sm text-brand-orange hover:underline">
                Esqueceu a senha?
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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Ainda não tem uma conta? <Link to="/register" className="text-brand-orange font-medium hover:underline">Cadastre-se</Link></p>
        </div>
      </div>
    </div>
  );
}
