
'use client';

import { AdminSignupForm } from "@/components/auth/admin-signup-form";

export default function AdminSignupPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.08),transparent)]" />
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[100px] animate-pulse-subtle" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[100px] animate-pulse-subtle" style={{ animationDelay: '1s' }} />
      </div>
      <div className="relative w-full max-w-lg animate-fade-in">
        <AdminSignupForm />
      </div>
    </div>
  );
}
