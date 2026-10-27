import { supabase } from './supabase';
import { PARENT_GRADE } from '../constants';

export const PARENT_FIXED_PASSWORD = 'PaisUnireais2026!';

export function cleanSlug(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function generateParentEmail(parentName: string, childIdentifier: string): string {
  const pSlug = cleanSlug(parentName).slice(0, 30) || 'responsavel';
  const cSlug = cleanSlug(childIdentifier).slice(0, 30) || 'aluno';
  return `pais.${pSlug}.${cSlug}@apresentacao.unireais.edu`;
}

export interface ParentCredentials {
  fullName: string;
  studentId?: string | null;
  studentName: string;
  unit: string;
}

export interface RecentParentEntry {
  fullName: string;
  studentName: string;
  studentId?: string | null;
  unit: string;
  lastUsed: number;
}

const RECENT_PARENTS_KEY = 'unireal_recent_parents';

export function getRecentParents(): RecentParentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_PARENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentParent(entry: ParentCredentials): void {
  try {
    const existing = getRecentParents();
    const filtered = existing.filter(
      p => cleanSlug(p.fullName) !== cleanSlug(entry.fullName)
    );
    const updated: RecentParentEntry[] = [
      {
        fullName: entry.fullName.trim(),
        studentName: entry.studentName.trim(),
        studentId: entry.studentId || null,
        unit: entry.unit || 'Palmares',
        lastUsed: Date.now(),
      },
      ...filtered,
    ].slice(0, 5); // Keep up to 5 for quick presentation access
    localStorage.setItem(RECENT_PARENTS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not save recent parent to localStorage:', err);
  }
}

/**
 * Single fluid entry point for parents:
 * Does NOT require email or password.
 * Checks if account exists: if yes, signs in; if no, registers and signs in.
 */
export async function authenticateParent(params: ParentCredentials): Promise<{
  success: boolean;
  error?: string;
  isNewUser?: boolean;
}> {
  const { fullName, studentId, studentName, unit } = params;

  if (!fullName || !fullName.trim()) {
    return { success: false, error: 'Por favor, informe seu nome completo.' };
  }

  if (!studentName || !studentName.trim()) {
    return { success: false, error: 'Por favor, informe ou selecione o nome do seu filho(a).' };
  }

  const generatedEmail = generateParentEmail(fullName, studentName);
  const password = PARENT_FIXED_PASSWORD;

  try {
    // 1. Try to sign in first in case parent already registered
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: generatedEmail,
      password: password,
    });

    if (signInData?.user) {
      // Successfully logged in!
      // Update any updated metadata or profile if needed
      saveRecentParent(params);
      return { success: true, isNewUser: false };
    }

    // 2. If sign in failed, attempt automatic registration
    const userMetadata = {
      full_name: fullName.trim(),
      grade: PARENT_GRADE,
      unit: unit || 'Palmares',
      role: 'parent',
      linked_student_id: studentId || null,
      linked_student_name: studentName.trim(),
      parent_bonus_claimed: false,
      is_presentation_quick_login: true,
    };

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: generatedEmail,
      password: password,
      options: {
        data: userMetadata,
      },
    });

    if (signUpError) {
      // If user already registered with different password or unconfirmed, try one more sign in
      if (signUpError.message.includes('already registered') || signUpError.message.includes('User already exists')) {
        const retry = await supabase.auth.signInWithPassword({
          email: generatedEmail,
          password: password,
        });
        if (retry.data?.user) {
          saveRecentParent(params);
          return { success: true, isNewUser: false };
        }
      }
      return { success: false, error: signUpError.message };
    }

    // 3. Ensure profile row exists in database
    if (signUpData?.user) {
      try {
        await supabase.from('profiles').upsert({
          id: signUpData.user.id,
          full_name: fullName.trim(),
          grade: PARENT_GRADE,
          unit: unit || 'Palmares',
          balance: 0,
          is_admin: false,
        });
      } catch (err) {
        console.warn('Notice updating profile table:', err);
      }

      // If session not created immediately by signUp (in case auto-confirm is off), force sign-in
      if (!signUpData.session) {
        await supabase.auth.signInWithPassword({
          email: generatedEmail,
          password: password,
        });
      }
    }

    saveRecentParent(params);
    return { success: true, isNewUser: true };
  } catch (err: any) {
    console.error('Error during fluid parent authentication:', err);
    return {
      success: false,
      error: err.message || 'Erro inesperado ao acessar o sistema. Tente novamente.',
    };
  }
}
