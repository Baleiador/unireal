import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type Profile = {
  id: string;
  full_name: string;
  balance: number;
  avatar_url: string | null;
  is_admin: boolean;
  grade: string | null;
  unit: string | null;
  role?: 'student' | 'teacher' | 'parent';
  linked_student_id?: string | null;
  linked_student_name?: string | null;
  parent_bonus_claimed?: boolean;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching profile:', error.message || error);
      } else if (data) {
        const { data: { user: currentUser } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
        const meta = currentUser?.user_metadata || {};
        const isParentRole = data.role === 'parent' || meta.role === 'parent' || data.grade === 'Responsável / Familiar' || meta.grade === 'Responsável / Familiar';
        
        setProfile({
          ...data,
          full_name: data.full_name || meta.full_name || currentUser?.email?.split('@')[0] || 'Usuário',
          grade: data.grade || meta.grade || null,
          unit: data.unit || meta.unit || 'Palmares',
          avatar_url: data.avatar_url || meta.avatar_url || null,
          role: isParentRole ? 'parent' : (data.is_admin ? 'teacher' : 'student'),
          linked_student_id: data.linked_student_id || meta.linked_student_id || null,
          linked_student_name: data.linked_student_name || meta.linked_student_name || null,
          parent_bonus_claimed: (data.parent_bonus_claimed ?? meta.parent_bonus_claimed) === true,
        });
      } else {
        // Profile row doesn't exist yet, try to create one from user metadata
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const meta = user.user_metadata || {};
          const isParentRole = meta.role === 'parent' || meta.grade === 'Responsável / Familiar';
          
          const newProfile = {
            id: user.id,
            full_name: meta.full_name || user.email?.split('@')[0] || 'Usuário',
            balance: 0,
            avatar_url: null,
            is_admin: false,
            grade: meta.grade || null,
            unit: meta.unit || 'Ribeirão',
          };

          const { data: createdData, error: insertError } = await supabase
            .from('profiles')
            .upsert(newProfile)
            .select('*')
            .maybeSingle();

          const baseProfile = (!insertError && createdData) ? createdData : (newProfile as Profile);
          setProfile({
            ...baseProfile,
            role: isParentRole ? 'parent' : 'student',
            linked_student_id: meta.linked_student_id || null,
            linked_student_name: meta.linked_student_name || null,
            parent_bonus_claimed: meta.parent_bonus_claimed === true,
          });
        }
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
