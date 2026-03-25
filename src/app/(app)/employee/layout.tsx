'use client';

import * as React from 'react';
import { AppLayout } from "@/components/layout/app-layout";
import { Loader2 } from "lucide-react"; 
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuthProtection } from '@/hooks/useAuthProtection';
import { getSession } from '@/actions/auth-actions';
import { createClient } from '@/lib/supabase-client';

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [employeeType, setEmployeeType] = React.useState<string | null>(null);
  
  const {
    currentUser,
    authIsLoading,
    layoutError,
    showEmailVerificationPrompt,
    userEmail,
    handleLogout,
    handleSendVerificationEmail
  } = useAuthProtection('employee');

  React.useEffect(() => {
    async function fetchEmployeeType() {
      if (currentUser && currentUser.uid) {
        // Fast client-side fetch since middleware already proved they are valid
        const supabase = createClient();
        
        const { data } = await supabase.from('employees').select('employee_type').eq('profile_id', currentUser.uid).single();
        if (data) setEmployeeType(data.employee_type);
      }
    }
    fetchEmployeeType();
  }, [currentUser]);

  if (authIsLoading || (currentUser && !employeeType)) {
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

  const enrichedUser = { ...currentUser, type: employeeType };

  return (
    <AppLayout
        role="employee"
        user={enrichedUser}
        onLogout={handleLogout}
      >
        {children}
      </AppLayout>
  );
}
