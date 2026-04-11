
'use client';

import * as React from 'react';
import { AppLayout } from "@/components/layout/app-layout";
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuthProtection } from '@/hooks/useAuthProtection';

/**
 * Shared layout wrapper for pages that sit outside role-specific folders
 * (e.g. /classrooms, /notifications, /settings).
 * Reads the logged-in user from the live Supabase session and wraps children
 * in AppLayout with the correct role sidebar.
 */
export function SharedAppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // No role restriction — any authenticated user may access shared pages
  const { currentUser, authIsLoading, layoutError, handleLogout } = useAuthProtection();

  if (authIsLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (layoutError || !currentUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-center p-4">
        <div>
          <h2 className="text-xl font-semibold text-destructive mb-2">Not Logged In</h2>
          <p className="text-muted-foreground">Please log in to continue.</p>
          <Button onClick={() => router.push('/login')} className="mt-4">Go to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <AppLayout
      role={currentUser.role}
      user={currentUser}
      onLogout={handleLogout}
    >
      {children}
    </AppLayout>
  );
}
