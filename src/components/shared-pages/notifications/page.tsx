
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BellRing, Circle, CheckCircle, AlertTriangle, Info, ArrowLeft, Loader2 } from "lucide-react";
import { type NotificationMessage } from '@/components/layout/notification-bell';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getNotificationsForUser, markNotificationRead, markAllNotificationsRead } from '@/actions/notification-actions';

const getNotificationIcon = (type: NotificationMessage['type']) => {
  switch (type) {
    case 'alert': return <AlertTriangle className="h-5 w-5 text-destructive" />;
    case 'task': return <CheckCircle className="h-5 w-5 text-blue-500" />;
    case 'event': return <Info className="h-5 w-5 text-purple-500" />;
    case 'info':
    default: return <Info className="h-5 w-5 text-primary" />;
  }
};

export function AllNotificationsPage() {
  const [notifications, setNotifications] = React.useState<NotificationMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();
  const { toast } = useToast();

  React.useEffect(() => {
    const storedUserString = localStorage.getItem('loggedInUser');
    if (!storedUserString) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'Please log in to see notifications.' });
      setIsLoading(false);
      return;
    }
    const user = JSON.parse(storedUserString);
    if (!user?.uid) { setIsLoading(false); return; }

    getNotificationsForUser(user.uid)
      .then((result) => {
        if (result.success && result.data) setNotifications(result.data as NotificationMessage[]);
      })
      .catch((error) => {
        console.error('Error fetching notifications:', error);
        toast({ variant: 'destructive', title: 'Notification Error', description: 'Could not fetch notifications.' });
      })
      .finally(() => setIsLoading(false));
  }, [toast]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      toast({ title: 'Notification Marked Read' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not mark notification as read.' });
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    try {
      await markAllNotificationsRead(unreadIds);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast({ title: 'All Read', description: 'All notifications marked as read.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not mark all notifications as read.' });
    }
  };

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  };

  if (isLoading) {
    return <div className="p-6 text-center flex flex-col items-center justify-center h-64 gap-3"><div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" /><span className="text-muted-foreground font-medium">Loading notifications...</span></div>;
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-4xl space-y-8 animate-fade-in">
      <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-xl" aria-label="Back">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-6 mb-6 text-white shadow-lg">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-white/70 text-sm mt-1">Keep track of important updates and tasks</p>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      </div>
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20">
              <BellRing className="h-5 w-5" />
            </div>
            All Notifications
          </CardTitle>
          <CardDescription>Here are all your notifications. Keep track of important updates and tasks.</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length > 0 && (
            <div className="text-right mb-4">
              <Button onClick={handleMarkAllAsRead} size="sm" variant="outline" disabled={notifications.every((n) => n.read)}>
                Mark All as Read
              </Button>
            </div>
          )}
          {notifications.length === 0 ? (
            <div className="empty-state py-10">
              <div className="empty-state-icon"><BellRing className="h-8 w-8 text-muted-foreground/50" /></div>
              <p className="empty-state-title">No Notifications</p>
              <p className="empty-state-text">You have no notifications.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={cn(
                    'p-4 border rounded-xl flex items-start gap-4 transition-all duration-200',
                    notification.read ? 'bg-card hover:bg-muted/30' : 'bg-primary/5 hover:bg-primary/10 border-primary/30'
                  )}
                >
                  {!notification.read && (<Circle className="h-2.5 w-2.5 mt-1.5 fill-primary stroke-primary flex-shrink-0" />)}
                  <div className={cn('flex-shrink-0 mt-0.5', notification.read && 'ml-[calc(0.625rem+0.5rem)]')}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{notification.title}</h4>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">{formatTimestamp(notification.timestamp)}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
                    {notification.link && (
                      <Button variant="link" size="sm" className="text-xs h-auto p-1" asChild>
                        <Link href={notification.link} onClick={() => !notification.read && handleMarkAsRead(notification.id)}>View Details</Link>
                      </Button>
                    )}
                    {!notification.read && (
                      <Button variant="outline" size="sm" className="text-xs h-auto p-1" onClick={() => handleMarkAsRead(notification.id)}>
                        Mark as Read
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
