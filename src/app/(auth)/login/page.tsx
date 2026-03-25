'use client';

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4 overflow-hidden">
      {/* Premium background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.08),transparent)]" />
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[100px] animate-pulse-subtle" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[100px] animate-pulse-subtle" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/4 left-1/3 h-64 w-64 rounded-full bg-violet-500/3 blur-[80px]" />
      </div>
      <div className="relative w-full max-w-md animate-fade-in">
        <LoginForm />
      </div>
    </div>
  );
}
