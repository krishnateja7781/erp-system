
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
import { Loader2, Mail, KeyRound } from "lucide-react";
import { sendPasswordResetLink } from '@/actions/user-actions';


const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

export function ForgotPasswordForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const result = await sendPasswordResetLink(values.email);
       toast({
          title: "Check your email",
          description: result.message,
      });
    } catch (error: any) {
       toast({
          title: "Error",
          description: "An unexpected error occurred while sending the reset link.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-elevated border-0 bg-card/90 backdrop-blur-xl">
      <CardHeader className="text-center pb-2 pt-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-600 text-primary-foreground shadow-lg shadow-primary/25">
          <KeyRound size={32} />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">Reset Password</CardTitle>
        <CardDescription className="text-muted-foreground mt-1">Enter your email to receive reset instructions</CardDescription>
      </CardHeader>
      <CardContent className="px-7 pb-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Enter your email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Reset Link
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="text-center text-sm px-6 pb-8">
        <Link href="/login" className="text-primary hover:text-primary/80 hover:underline transition-colors font-medium">
          Back to Sign In
        </Link>
      </CardFooter>
    </Card>
  );
}
