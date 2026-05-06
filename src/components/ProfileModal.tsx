import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Mail, GraduationCap, Save, Camera, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Input } from './Input';
import { Button } from './Button';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { profile, user, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [grade, setGrade] = useState(profile?.grade || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatarSeed, setAvatarSeed] = useState(profile?.id || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFullName(profile?.full_name || '');
      setGrade(profile?.grade || '');
      setEmail(user?.email || '');
      
      // Try to extract seed from avatar_url
      if (profile?.avatar_url?.includes('seed=')) {
        const seed = profile.avatar_url.split('seed=')[1].split('&')[0];
        setAvatarSeed(seed);
      } else {
        setAvatarSeed(profile?.id || '');
      }
    }
  }, [isOpen, profile, user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const newAvatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          grade: grade,
          avatar_url: newAvatarUrl,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update email if changed (Supabase handles this with confirmation usually)
      if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw emailError;
      }

      await refreshProfile();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Erro ao atualizar perfil. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const randomizeAvatar = () => {
    setAvatarSeed(Math.random().toString(36).substring(7));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] cursor-pointer"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md bg-white rounded-[40px] shadow-2xl z-[101] overflow-hidden"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-black tracking-tight uppercase italic">Editar Perfil</h2>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Personalize sua conta</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                <div className="flex flex-col items-center mb-8">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-[40px] bg-brand-orange/5 border-4 border-brand-orange/20 overflow-hidden shadow-xl mb-4">
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`}
                        alt="Preview Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={randomizeAvatar}
                      className="absolute -bottom-2 -right-2 w-10 h-10 bg-brand-orange text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand-orange/40 hover:scale-110 transition-transform"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avatar Aleatório</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome Completo</label>
                    <div className="relative">
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Seu nome..."
                        className="pl-12"
                        required
                      />
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">E-mail</label>
                    <div className="relative">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="pl-12"
                        required
                      />
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Série / Turma</label>
                    <div className="relative">
                      <Input
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        placeholder="Ex: 3º Ano A"
                        className="pl-12"
                        required
                      />
                      <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || success}
                  className={`w-full h-16 rounded-[24px] font-black uppercase tracking-widest transition-all ${
                    success ? 'bg-green-500 hover:bg-green-500' : 'bg-brand-orange hover:bg-brand-orange/90 shadow-xl shadow-brand-orange/20'
                  }`}
                >
                  {loading ? (
                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : success ? (
                    'Perfil Atualizado!'
                  ) : (
                    <div className="flex items-center gap-2">
                      <Save className="w-5 h-5" />
                      Salvar Alterações
                    </div>
                  )}
                </Button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
