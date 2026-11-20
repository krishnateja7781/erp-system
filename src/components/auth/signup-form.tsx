
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from 'next/navigation';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, GraduationCap } from "lucide-react";
import { studentSelfRegister } from '@/actions/auth-actions';
import { PROGRAMS, BRANCHES, previewStudentId } from '@/lib/academic-codes';

const JOINING_YEARS = Array.from({ length: 8 }, (_, i) => String(new Date().getFullYear() - i));

const studentGenders = ["Male", "Female", "Other"];

const formSchema = z.object({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters." }).trim(),
  lastName: z.string().min(1, { message: "Last name is required." }).trim(),
  program: z.string({ required_error: "Please select your program." }).min(1, "Please select your program."),
  branch: z.string({ required_error: "Please select your branch." }).min(1, "Please select your branch."),
  joiningYear: z.string().regex(/^\d{4}$/, "Select the year you joined."),
  gender: z.enum(["Male", "Female", "Other"], { required_error: "Please select your gender." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type SignupFormValues = z.infer<typeof formSchema>;


export function SignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      program: "",
      branch: "",
      joiningYear: String(new Date().getFullYear()),
      gender: undefined,
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const watchedProgram = form.watch("program");
  const watchedBranch = form.watch("branch");
  const watchedYear = form.watch("joiningYear");

  async function onSubmit(values: SignupFormValues) {
    setIsLoading(true);
    try {
      const result = await studentSelfRegister(values);

      if (result.success) {
        toast({
          title: "Registration Successful!",
          description: `Your account has been created. Your college ID is ${result.studentId}. Please log in to continue.`,
          duration: 8000,
        });
        router.push('/login');
      } else {
        toast({
          variant: "destructive",
          title: "Registration Failed",
          description: result.error || "An unknown error occurred.",
        });
      }
    } catch (error: any) {
      console.error("Client-side signup error:", error);
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-lg shadow-elevated border-0 bg-card/90 backdrop-blur-xl">
      <CardHeader className="text-center pb-2 pt-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-600 text-primary-foreground shadow-lg shadow-primary/25">
          <GraduationCap size={32} />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">Student Registration</CardTitle>
        <CardDescription className="text-muted-foreground mt-1">Create your SSN Student Hub account</CardDescription>
      </CardHeader>
      <CardContent className="px-7 pb-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your first name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your last name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="program"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Program</FormLabel>
                      <Select onValueChange={(v) => { field.onChange(v); form.setValue('branch', ''); }} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger></FormControl>
                        <SelectContent>{PROGRAMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="branch"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!watchedProgram}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger></FormControl>
                        <SelectContent>{(BRANCHES[watchedProgram] || []).map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            {watchedProgram && watchedBranch && (
              <p className="text-xs text-muted-foreground -mt-1">
                Your college ID will look like <span className="font-mono font-semibold">{previewStudentId(watchedProgram, watchedBranch, watchedYear)}</span> — the last 5 digits are assigned in sequence.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="joiningYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year of Joining</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger></FormControl>
                        <SelectContent>{JOINING_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select your gender" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>{studentGenders.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                        </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Institutional Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Enter your email" {...field} />
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Create a password (min. 6 characters)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Confirm your password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Sign Up
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center text-sm">
        <p className="text-muted-foreground">
          Already have an account?&nbsp;
          <Link href="/login" className="text-primary hover:underline font-medium">
            Log In
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
