import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { User, GraduationCap, Save, CheckCircle2, AlertCircle, Loader2, RefreshCw, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const AVATAR_STYLES = [
  { id: 'avataaars', name: 'Humano' },
  { id: 'bottts', name: 'Robô' },
  { id: 'pixel-art', name: 'Pixel' },
  { id: 'lorelei', name: 'Desenho' },
  { id: 'adventurer', name: 'Aventura' },
  { id: 'miniavs', name: 'Minimalista' },
];

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [avatarStyle, setAvatarStyle] = useState('avataaars');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setGrade(profile.grade || '');
      
      // Extract seed and style from avatar_url if exists
      // Format expected: https://api.dicebear.com/7.x/{style}/svg?seed={seed}
      if (profile.avatar_url) {
        try {
          const url = new URL(profile.avatar_url);
          const style = url.pathname.split('/')[2];
          const seed = url.searchParams.get('seed');
          if (style) setAvatarStyle(style);
          if (seed) setAvatarSeed(seed);
        } catch (e) {
          setAvatarSeed(profile.id);
        }
      } else {
        setAvatarSeed(profile.id);
      }
    }
  }, [profile]);

  const generateRandomSeed = () => {
    setAvatarSeed(Math.random().toString(36).substring(7));
  };

  const avatarUrl = `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${avatarSeed || profile?.id}`;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const updateData: any = {
        full_name: fullName,
        grade: grade,
        avatar_url: avatarUrl,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      const errorMessage = error.message || 'Erro desconhecido';
      setMessage({ 
        type: 'error', 
        text: `Falha ao atualizar perfil: ${errorMessage}` 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
            <User className="w-6 h-6" />
          </div>
          <h1 className="text-4xl font-black text-black tracking-tight">Meu Perfil</h1>
        </div>
        <p className="text-gray-500 font-medium text-lg">Gerencie suas informações pessoais na plataforma.</p>
      </header>

      <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl shadow-gray-200/20 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-brand-orange to-orange-400 relative">
           <div className="absolute -bottom-12 left-10 flex items-end gap-4">
              <motion.div 
                key={avatarUrl}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 rounded-[32px] bg-white border-4 border-white shadow-xl flex items-center justify-center overflow-hidden"
              >
                <img 
                  src={avatarUrl} 
                  alt="avatar"
                  className="w-full h-full object-cover p-1 bg-gray-50"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
              <button 
                type="button"
                onClick={generateRandomSeed}
                className="mb-2 p-2 rounded-xl bg-white border border-gray-100 shadow-sm text-gray-400 hover:text-brand-orange transition-colors"
                title="Novo avatar aleatório"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
           </div>
        </div>

        <div className="pt-16 pb-10 px-10">
          <form onSubmit={handleUpdateProfile} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4 md:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Palette className="w-3 h-3" />
                  Estilo do Avatar
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {AVATAR_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setAvatarStyle(style.id)}
                      className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border ${
                        avatarStyle === style.id
                        ? 'bg-black text-white border-black shadow-lg scale-105'
                        : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Semente Personalizada</label>
                <Input
                  value={avatarSeed}
                  onChange={(e) => setAvatarSeed(e.target.value)}
                  placeholder="Nome ou código aleatório"
                  className="h-14 bg-gray-50 border-transparent focus:bg-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome"
                    className="pl-12 h-14 bg-gray-50 border-transparent focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Série / Turma</label>
                <div className="relative">
                  <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="Ex: 3º Ano A"
                    className="pl-12 h-14 bg-gray-50 border-transparent focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">E-mail (Não editável)</label>
                <Input
                  value={profile?.email || ''}
                  disabled
                  className="h-14 bg-gray-100 border-transparent text-gray-500 opacity-60 italic"
                />
              </div>
            </div>

            <AnimatePresence>
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${
                    message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                  }`}
                >
                  {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  {message.text}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-black hover:bg-neutral-800 h-16 rounded-2xl text-lg font-black uppercase tracking-widest shadow-xl shadow-black/10 transition-all hover:-translate-y-1 active:scale-95"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
              ) : (
                <Save className="w-6 h-6 mr-2" />
              )}
              {isLoading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-[32px] p-8 flex items-start gap-6">
        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-blue-500 shrink-0">
          <GraduationCap className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-black text-blue-900 uppercase tracking-tight mb-2">Dica de Segurança</h3>
          <p className="text-blue-700/80 font-medium leading-relaxed">
            Mantenha seu nome e turma sempre atualizados para que seus colegas consigam te encontrar facilmente na hora de realizar transferências e enviar Unireais.
          </p>
        </div>
      </div>
    </div>
  );
}
