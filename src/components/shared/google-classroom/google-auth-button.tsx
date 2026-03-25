'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, LinkIcon, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * GoogleAuthButton
 *
 * Opens the OAuth consent screen in a popup window. The backend
 * callback page sends a postMessage to the opener, which this
 * component listens for to update the linked state.
 */
interface GoogleAuthButtonProps {
    backendUrl: string;
    token: string;
    onLinked?: () => void;
}

export function GoogleAuthButton({ backendUrl, token, onLinked }: GoogleAuthButtonProps) {
    const { toast } = useToast();
    const [isLinked, setIsLinked] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true); // Start as loading to check status
    const [isLinking, setIsLinking] = React.useState(false);

    // Check if Google account is already linked on mount
    React.useEffect(() => {
        if (!token) {
            setIsLoading(false);
            return;
        }
        const checkStatus = async () => {
            try {
                const res = await fetch(`${backendUrl}/api/google/status`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.linked) {
                        setIsLinked(true);
                        onLinked?.();
                    }
                }
            } catch {
                // Silently fail – user can still link manually
            } finally {
                setIsLoading(false);
            }
        };
        checkStatus();
    }, [backendUrl, token, onLinked]);

    // Listen for the postMessage from the OAuth callback popup
    React.useEffect(() => {
        const handler = (event: MessageEvent) => {
            // Validate origin to prevent XSS
            if (event.origin !== backendUrl) return;
            if (event.data === 'google-auth-success') {
                setIsLinked(true);
                setIsLinking(false);
                toast({ title: 'Google Account Linked', description: 'You can now use Google Classroom features.' });
                onLinked?.();
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [toast, onLinked]);

    const handleLink = () => {
        if (!token) {
            toast({
                variant: 'destructive',
                title: 'Not Authenticated',
                description: 'Please wait for backend authentication to complete.',
            });
            return;
        }

        setIsLinking(true);
        // Open OAuth URL in a popup window – pass token via query param
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
            `${backendUrl}/api/google/auth?token=${encodeURIComponent(token)}`,
            'google-auth',
            `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );

        // If popup was blocked, reset loading
        if (!popup) {
            setIsLinking(false);
            toast({
                variant: 'destructive',
                title: 'Popup Blocked',
                description: 'Please allow popups for this site to link your Google account.',
            });
        }

        // Poll for popup close (user might close without completing)
        const timer = setInterval(() => {
            if (popup && popup.closed) {
                clearInterval(timer);
                setIsLinking(false);
            }
        }, 500);
    };

    if (isLoading) {
        return (
            <Button variant="outline" className="gap-2" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking...
            </Button>
        );
    }

    if (isLinked) {
        return (
            <Button variant="outline" className="gap-2" disabled>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Google Account Linked
            </Button>
        );
    }

    return (
        <Button onClick={handleLink} disabled={isLinking} variant="outline" className="gap-2">
            {isLinking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <LinkIcon className="h-4 w-4" />
            )}
            {isLinking ? 'Linking...' : 'Link Google Account'}
        </Button>
    );
}
