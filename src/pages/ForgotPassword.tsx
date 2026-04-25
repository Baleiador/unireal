import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Link } from 'react-router';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Placeholder check
    if (import.meta.env.VITE_SUPABASE_URL === 'YOUR_SUPABASE_URL' || !import.meta.env.VITE_SUPABASE_URL) {
      setError('ATENÇÃO: Variáveis do Supabase não configuradas. Vá ao menu Secrets do AI Studio e adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
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
          <h2 className="text-2xl font-bold text-black mb-4">E-mail Enviado!</h2>
          <p className="text-gray-500 mb-8">
            Enviamos as instruções de recuperação de senha para <strong>{email}</strong>.
          </p>
          <Link to="/login">
            <Button className="w-full">Voltar para o Login</Button>
          </Link>
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
        
        <h2 className="text-2xl font-bold text-center text-black mb-2">Recuperar Senha</h2>
        <p className="text-center text-gray-500 mb-8">Digite seu e-mail para receber um link de redefinição.</p>

        <form onSubmit={handleResetPassword} className="space-y-5">
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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar Link'}
          </Button>
        </form>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Lembrou sua senha? <Link to="/login" className="text-brand-orange font-medium hover:underline">Faça login</Link></p>
        </div>
      </div>
    </div>
  );
}
