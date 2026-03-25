
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from 'next/link';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogIn, GraduationCap } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }).trim().toLowerCase(),
  password: z.string().min(1, { message: "Password is required" }),
});

export function LoginForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    try {
      // Call our dedicated login API route — avoids cookie timing issues with server actions
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email.trim().toLowerCase(),
          password: values.password,
        }),
        credentials: 'include', // ensure cookies are sent/received
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: result.error || "Invalid email or password.",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "Login Successful",
        description: "Welcome back! Navigating to your portal...",
      });

      // Hard navigate — ensures the browser picks up newly-set session cookies
      // on a fresh full HTTP request. Middleware will detect the role and route correctly.
      const role = result.role;
      if (role === 'super_admin') {
        window.location.href = '/admin/dashboard';
      } else if (role === 'teacher') {
        window.location.href = '/teacher/dashboard';
      } else if (role === 'student') {
        window.location.href = '/student/dashboard';
      } else if (role === 'employee') {
        window.location.href = '/employee/dashboard';
      } else {
        window.location.href = '/';
      }

    } catch (err: any) {
      console.error("Login error:", err);
      toast({
        variant: "destructive",
        title: "Login Error",
        description: "An unexpected error occurred. Please try again.",
      });
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-elevated border-0 bg-card/90 backdrop-blur-xl">
      <CardHeader className="text-center pb-2 pt-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-600 text-primary-foreground shadow-lg shadow-primary/25">
          <GraduationCap size={32} />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">SSN Student Hub</CardTitle>
        <CardDescription className="text-muted-foreground mt-1">Sign in to access your portal</CardDescription>
      </CardHeader>
      <CardContent className="px-7 pb-4">
        <Form {...form}>
          {/* autoComplete="off" prevents Chrome from showing password breach popups */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" autoComplete="off">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Enter your email address" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                  </div>
                  <FormControl>
                    <Input type="password" placeholder="Enter your password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 text-sm text-center">
        <p className="text-muted-foreground">
          New Student?&nbsp;
          <Link href="/signup" className="text-primary hover:underline font-medium">
            Create an account
          </Link>
        </p>
        <p className="text-muted-foreground">OR</p>
        <Link href="/admin-signup" className="text-primary hover:underline font-medium">
          Register as Admin
        </Link>
      </CardFooter>
    </Card>
  );
}
