'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Bell, Palette, ArrowLeft } from "lucide-react";
import { sendPasswordResetLink, updateNotificationPreferences, getUserSettings } from '@/actions/user-actions';
import { useAuthProtection } from '@/hooks/useAuthProtection';
import { useRouter } from 'next/navigation';

export function SettingsPageContent() {
    const { toast } = useToast();
    const router = useRouter();
    const { currentUser } = useAuthProtection();
    const [isLoading, setIsLoading] = React.useState(true);
    const [isPasswordResetLoading, setIsPasswordResetLoading] = React.useState(false);
    const [isNotificationToggleLoading, setIsNotificationToggleLoading] = React.useState(false);
    const [notificationEnabled, setNotificationEnabled] = React.useState(true);
    const [currentTime, setCurrentTime] = React.useState<Date | null>(null);

    const uidRef = React.useRef(currentUser?.uid);
    React.useEffect(() => { uidRef.current = currentUser?.uid; });

    React.useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchSettings = React.useCallback(async () => {
        if (!uidRef.current) return;
        setIsLoading(true);
        try {
            const result = await getUserSettings(uidRef.current);
            if (result.success && result.data?.notifications) {
                setNotificationEnabled(result.data.notifications.enabled);
            }
        } catch (e: any) {
            console.error("Error fetching settings:", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load your settings.' });
        }
        setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
        if (currentUser?.uid) fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.uid]);

    const handleChangePassword = async () => {
        if (!currentUser?.email) {
            toast({ variant: 'destructive', title: 'Error', description: 'Your email is not available.' });
            return;
        }
        setIsPasswordResetLoading(true);
        const result = await sendPasswordResetLink(currentUser.email);
        if (result.success) {
            toast({ title: 'Password Reset Email Sent', description: result.message });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsPasswordResetLoading(false);
    };

    const handleNotificationToggle = async (enabled: boolean) => {
        if (!uidRef.current) return;
        setIsNotificationToggleLoading(true);
        setNotificationEnabled(enabled); // Optimistic update
        try {
            const result = await updateNotificationPreferences(uidRef.current, enabled);
            if (!result.success) {
                setNotificationEnabled(!enabled); // Revert on failure
                toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
            } else {
                toast({ title: 'Success', description: result.message });
            }
        } catch (e: any) {
            setNotificationEnabled(!enabled); // Revert on failure
            toast({ variant: 'destructive', title: 'Error', description: "An unexpected error occurred." });
        }
        setIsNotificationToggleLoading(false);
    };

    return (
        <div className="space-y-8 max-w-2xl mx-auto animate-fade-in pt-4">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 p-6 mb-6 text-white shadow-lg">
              <div className="relative z-10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" onClick={() => router.back()} aria-label="Go back" className="h-9 w-9 flex-shrink-0 rounded-xl border-white/30 text-white hover:bg-white/10 bg-white/10 backdrop-blur-sm">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                        <p className="text-white/70 text-sm mt-1 hidden sm:block">Manage your account preferences</p>
                    </div>
                </div>
                {currentTime && (
                    <div className="text-right flex-shrink-0" aria-live="polite">
                        <div className="font-semibold text-lg sm:text-xl text-white font-mono tabular-nums">{currentTime.toLocaleTimeString()}</div>
                        <div className="text-xs sm:text-sm text-white/60">{currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                )}
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>

            <Card className="card-elevated">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2.5 text-base">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-red-500/20">
                            <KeyRound className="h-4 w-4" />
                        </div>
                        Account Security
                    </CardTitle>
                    <CardDescription className="text-xs">Manage your password and account security settings.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between gap-4 p-4 border border-border/40 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors duration-200">
                        <div className="min-w-0">
                            <Label htmlFor="change-password" className="text-sm font-medium">Change Password</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">A secure link will be sent to your registered email to reset your password.</p>
                        </div>
                        <Button
                            id="change-password"
                            variant="outline"
                            onClick={handleChangePassword}
                            disabled={isPasswordResetLoading || !currentUser}
                            className="gap-2 flex-shrink-0"
                        >
                            {isPasswordResetLoading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            Send Reset Link
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="card-elevated">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2.5 text-base">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20">
                            <Bell className="h-4 w-4" />
                        </div>
                        Notifications
                    </CardTitle>
                    <CardDescription className="text-xs">Control how you receive notifications from the application.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between gap-4 p-4 border border-border/40 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors duration-200">
                        <div className="min-w-0">
                            <Label htmlFor="notifications-enabled" className="text-sm font-medium">Enable Push Notifications</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">Receive real-time alerts on your device. (Requires browser permission)</p>
                        </div>
                        {isLoading ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                        ) : (
                            <Switch
                                id="notifications-enabled"
                                checked={notificationEnabled}
                                onCheckedChange={handleNotificationToggle}
                                disabled={isNotificationToggleLoading || !currentUser}
                                aria-describedby="notifications-description"
                            />
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="card-elevated">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2.5 text-base">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-md shadow-purple-500/20">
                            <Palette className="h-4 w-4" />
                        </div>
                        Appearance
                    </CardTitle>
                    <CardDescription className="text-xs">Customize the look and feel of the application.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between gap-4 p-4 border border-border/40 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors duration-200">
                        <div className="min-w-0">
                            <Label className="text-sm font-medium">Theme</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">Choose between light, dark, or system default mode.</p>
                        </div>
                        <ThemeToggle />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
