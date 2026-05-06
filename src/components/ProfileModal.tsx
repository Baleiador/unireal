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
  const [avatarOptions, setAvatarOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Generate some random initial seeds if none exist
    const options = Array.from({ length: 12 }, (_, i) => 
      profile?.id ? `${profile.id}_${i}` : Math.random().toString(36).substring(7)
    );
    setAvatarOptions(options);

    if (isOpen) {
      setFullName(profile?.full_name || '');
      setGrade(profile?.grade || '');
      setEmail(user?.email || '');
      
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
    const newOptions = Array.from({ length: 12 }, () => 
      Math.random().toString(36).substring(7)
    );
    setAvatarOptions(newOptions);
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
            className="fixed inset-x-4 top-[5%] bottom-[5%] md:top-[8%] md:bottom-auto md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md bg-white rounded-[40px] shadow-2xl z-[101] overflow-hidden flex flex-col"
          >
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex items-center justify-between mb-8 sticky top-0 bg-white/95 backdrop-blur-sm z-20 pb-2">
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
                {/* Large Preview */}
                <div className="flex flex-col items-center mb-6">
                  <div className="w-28 h-28 rounded-[36px] bg-white border-4 border-brand-orange/20 overflow-hidden shadow-2xl p-1">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`}
                      alt="Current Selection"
                      className="w-full h-full object-cover rounded-[30px]"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Escolha seu Avatar</label>
                    <button
                      type="button"
                      onClick={randomizeAvatar}
                      className="text-[10px] font-black text-brand-orange uppercase tracking-widest flex items-center gap-1 hover:opacity-70 transition-opacity"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Novas Opções
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-3 p-2 rounded-[24px] bg-gray-50 border border-gray-100">
                    {avatarOptions.map((seed) => (
                      <button
                        key={seed}
                        type="button"
                        onClick={() => setAvatarSeed(seed)}
                        className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
                          avatarSeed === seed 
                            ? 'border-brand-orange ring-4 ring-brand-orange/20 scale-95 shadow-inner bg-white' 
                            : 'border-transparent hover:border-gray-200 bg-white'
                        }`}
                      >
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
                          alt="Avatar Option"
                          className="w-full h-full object-cover"
                        />
                        {avatarSeed === seed && (
                          <div className="absolute inset-0 bg-brand-orange/10 flex items-center justify-center">
                            <div className="w-2 h-2 bg-brand-orange rounded-full shadow-[0_0_10px_rgba(242,125,38,0.5)]" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
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

                <div className="sticky bottom-0 bg-white pt-4 pb-2">
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
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
