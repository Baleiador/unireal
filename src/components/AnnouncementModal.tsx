import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { Megaphone, X, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function AnnouncementModal() {
  const { profile } = useAuth();
  const [announcement, setAnnouncement] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (profile && !profile.is_admin) {
      fetchLatestAnnouncement();
    }
  }, [profile]);

  const fetchLatestAnnouncement = async () => {
    try {
      // Find announcements where target_grades contains 'TODOS' or the user's grade
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Find the first announcement that targets this user and hasn't been dismissed
        const relevantAnn = data.find(ann => {
          const isTarget = ann.target_grades.includes('TODOS') || (profile?.grade && ann.target_grades.includes(profile.grade));
          const isDismissed = localStorage.getItem(`ann_dismissed_${ann.id}`);
          return isTarget && !isDismissed;
        });

        if (relevantAnn) {
          setAnnouncement(relevantAnn);
          setIsVisible(true);
        }
      }
    } catch (err) {
      console.error("Announcement check error:", err);
    }
  };

  const handleDismiss = () => {
    if (announcement) {
      localStorage.setItem(`ann_dismissed_${announcement.id}`, 'true');
      setIsVisible(false);
    }
  };

  if (!isVisible || !announcement) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-4 border-brand-orange/20"
          >
            <div className="bg-gradient-to-br from-brand-orange to-orange-600 p-10 text-white relative">
              <button 
                onClick={handleDismiss}
                className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/40 rounded-full transition-all text-white"
              >
                <X className="w-5 h-5" />
              </button>
              
              <motion.div 
                initial={{ rotate: -20, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mb-8 backdrop-blur-sm"
              >
                <Megaphone className="w-10 h-10 text-white" />
              </motion.div>
              
              <h2 className="text-4xl font-black uppercase tracking-tight leading-none mb-2">
                Atenção<br />Aluno!
              </h2>
              <p className="text-orange-100 font-bold opacity-80 uppercase tracking-widest text-[10px]">Comunicado Oficial da Direção</p>
            </div>
            
            <div className="p-10 space-y-8">
              <div className="space-y-4">
                <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                  <Bell className="w-6 h-6 text-brand-orange" />
                  {announcement.title}
                </h3>
                <div className="bg-gray-50 p-6 rounded-2xl border-l-4 border-brand-orange">
                  <p className="text-gray-700 leading-relaxed text-xl font-medium italic whitespace-pre-wrap">
                    "{announcement.content}"
                  </p>
                </div>
              </div>
              
              <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Publicação</span>
                  <span className="text-sm font-bold text-gray-600">
                    {new Date(announcement.created_at).toLocaleDateString('pt-BR')} às {new Date(announcement.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <Button 
                  onClick={handleDismiss}
                  className="w-full sm:w-auto bg-gray-900 text-white hover:bg-black px-12 py-5 rounded-2xl font-black uppercase text-sm tracking-widest shadow-2xl shadow-black/20 transition-all hover:scale-105 active:scale-95"
                >
                  Entendido
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
