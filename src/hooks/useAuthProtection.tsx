'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getSession, signOutAction } from '@/actions/auth-actions';

export interface AppUser {
  name: string;
  initials: string;
  avatarUrl?: string;
  id: string; // Consistent, internal document ID (studentDocId or staffDocId)
  uid: string;
  email: string | null;
  role: 'student' | 'super_admin' | 'employee' | 'teacher';
  program?: string;
  branch?: string;
  year?: number;
  semester?: number;
  staffDocId?: string | null;
  studentDocId?: string | null;
  collegeId?: string | null;
  staffId?: string | null;
  type?: string | null;
}

export function useAuthProtection(expectedRoles?: string | string[]) {
  const [currentUser, setCurrentUser] = React.useState<AppUser | null>(null);
  const [authIsLoading, setAuthIsLoading] = React.useState(true);
  const [layoutError, setLayoutError] = React.useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = React.useCallback(async () => {
    try {
      await signOutAction();
    } catch (error) {
      console.error('Error signing out: ', error);
      toast({ variant: 'destructive', title: 'Logout Failed', description: 'Could not log out.' });
    }
  }, [toast]);

  React.useEffect(() => {
    let mounted = true;
    
    async function checkAuth() {
      try {
        const { data, error } = await getSession();
        
        if (error || !data?.session || !data?.profile) {
            if (mounted) {
              setAuthIsLoading(false);
              setLayoutError(`Session load failed: ${error || 'Missing profile or session data'}`)
              // Temporarily removing router.push so we can read the exact error message!
              // router.push('/login');
            }
            return;
        }

        const profile = data.profile;
        const role = profile.role;

        // Verify role — super_admin always bypasses role checks (unrestricted access)
        if (expectedRoles && role !== 'super_admin') {
          const rolesArray = Array.isArray(expectedRoles) ? expectedRoles : [expectedRoles];
          if (!rolesArray.includes(role)) {
            if (mounted) {
               setLayoutError(`Access Denied: You are logged in as a ${role}, but this module requires: ${rolesArray.join(', ')}.`);
               setAuthIsLoading(false);
            }
            return;
          }
        }

        const appUser: AppUser = {
          uid: profile.id,
          email: profile.email || null,
          name: profile.full_name || 'User',
          initials: profile.full_name ? profile.full_name.substring(0, 2).toUpperCase() : 'U',
          role: role as any,
          avatarUrl: profile.avatar_url || undefined,
          id: profile.id,
        };

        if (mounted) {
          setCurrentUser(appUser);
          setAuthIsLoading(false);
        }
        
      } catch (err: any) {
        if (mounted) {
           setLayoutError(err.message || 'An authentication error occurred. Please try logging in again.');
           setAuthIsLoading(false);
           router.push('/login');
        }
      }
    }
    
    checkAuth();
    
    return () => { mounted = false; };
  }, [expectedRoles, router]);

  return {
    currentUser,
    authIsLoading,
    layoutError,
    showEmailVerificationPrompt: false,
    userEmail: currentUser?.email ?? null,
    handleLogout,
    handleSendVerificationEmail: async () => {},
  };
}
