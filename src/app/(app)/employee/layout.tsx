'use client';

import * as React from 'react';
import { AppLayout } from "@/components/layout/app-layout";
import { Loader2 } from "lucide-react"; 
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuthProtection } from '@/hooks/useAuthProtection';

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  
  const {
    currentUser,
    authIsLoading,
    layoutError,
    handleLogout,
  } = useAuthProtection('employee');

  if (authIsLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading Employee Portal...</span>
      </div>
    );
  }

  if (layoutError) { 
    return (
      <div className="flex h-screen w-full items-center justify-center text-center p-4">
        <div>
          <h2 className="text-xl font-semibold text-destructive mb-2">Access Error</h2>
          <p className="text-destructive">{layoutError}</p>
          <Button onClick={() => router.push('/login')} className="mt-4">Go to Login</Button>
        </div>
      </div>
    );
  }
  
  if (!currentUser) return null;

  return (
    <AppLayout
        role="employee"
        user={currentUser}
        onLogout={handleLogout}
      >
        {children}
      </AppLayout>
  );
}
