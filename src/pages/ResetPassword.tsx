import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ShieldCheck, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have an access token in the URL (Supabase reset flow)
    const handleAuthStateChange = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // If no session is found, it might be an expired link or manual access
        // We let the user try, but Supabase will fail if not authorized
      }
    };
    handleAuthStateChange();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ 
        password: password,
        data: { raw_password: password } // Store in metadata for trigger
      });

      if (error) throw error;

      // Manually update the profile as well to be sure
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ raw_password: password })
          .eq('id', user.id);
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-orange rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 relative z-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-brand-orange rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-orange/20">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900 leading-none mb-2">
            Nova Senha
          </h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
            Crie sua nova credencial de acesso
          </p>
        </div>

        {success ? (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-green-50 p-6 rounded-2xl flex flex-col items-center text-center gap-4 border border-green-100">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="text-green-800 font-bold">Senha atualizada com sucesso!</p>
              <p className="text-sm text-green-600">Você será redirecionado para o login em instantes...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-6">
            {error && (
              <div className="bg-red-50 p-4 rounded-xl flex items-center gap-3 text-red-600 text-sm font-bold border border-red-100 animate-shake">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    className="pl-12 h-14 bg-gray-50 border-gray-100 focus:bg-white rounded-2xl transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Confirmar Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    className="pl-12 h-14 bg-gray-50 border-gray-100 focus:bg-white rounded-2xl transition-all"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-16 bg-brand-orange hover:bg-orange-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-brand-orange/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? 'Atualizando...' : 'Atualizar Senha'}
            </Button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors"
            >
              Voltar ao Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
