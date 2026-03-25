
'use client';

import * as React from 'react';
import { Bell, Circle, CheckCircle, AlertTriangle, Info, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getNotificationsForUser, markNotificationRead, markAllNotificationsRead } from '@/actions/notification-actions';

export interface NotificationMessage {
  id: string;
  title: string;
  message: string;
  timestamp: string; // ISO string
  read: boolean;
  type: 'alert' | 'task' | 'info' | 'event';
  link?: string;
}

const getNotificationIcon = (type: NotificationMessage['type']) => {
  switch (type) {
    case 'alert': return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case 'task': return <CheckCircle className="h-4 w-4 text-blue-500" />;
    case 'event': return <Info className="h-4 w-4 text-purple-500" />;
    case 'info':
    default: return <Info className="h-4 w-4 text-primary" />;
  }
};

export function NotificationBell() {
  const [notifications, setNotifications] = React.useState<NotificationMessage[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const { toast } = useToast();

  const fetchNotifications = React.useCallback(async () => {
    const storedUserString = localStorage.getItem('loggedInUser');
    if (!storedUserString) return;
    const user = JSON.parse(storedUserString);
    if (!user?.uid) return;
    try {
      const result = await getNotificationsForUser(user.uid, 20);
      if (result.success && result.data) {
        setNotifications(result.data as NotificationMessage[]);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
    // Poll every 5 minutes (300,000ms) to refresh notifications
    const interval = setInterval(fetchNotifications, 300000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMinutes / 60);
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-semibold animate-scale-in">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-lg" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {notifications.length > 0 && (
            <Button variant="link" size="sm" className="text-xs h-auto p-0 text-muted-foreground hover:text-foreground" onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[320px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                <BellRing className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground/70 mt-1">No new notifications at the moment.</p>
            </div>
          ) : (
            <div className="divide-y" role="list" aria-label="Notification list">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'px-4 py-3 transition-colors duration-150 hover:bg-accent/50',
                    !notification.read && 'bg-primary/5'
                  )}
                  role="listitem"
                >
                  <div className="flex items-start gap-2.5">
                    {!notification.read && (<Circle className="h-2 w-2 mt-1.5 fill-primary stroke-primary flex-shrink-0" />)}
                    <div className={cn('flex-shrink-0 mt-0.5', notification.read && 'ml-[18px]')}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-tight">{notification.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-1">{formatTimestamp(notification.timestamp)}</p>
                    </div>
                    {notification.link ? (
                      <Link href={notification.link} onClick={() => { if (!notification.read) handleMarkAsRead(notification.id); setIsOpen(false); }}>
                        <Button variant="ghost" size="sm" className="text-xs h-auto p-1 text-primary hover:text-primary">View</Button>
                      </Link>
                    ) : (
                      !notification.read && (
                        <Button variant="ghost" size="sm" className="text-xs h-auto p-1 text-muted-foreground" onClick={() => handleMarkAsRead(notification.id)}>
                          Mark read
                        </Button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t bg-muted/20 text-center">
          <Link href="/notifications" onClick={() => setIsOpen(false)}>
            <Button variant="ghost" size="sm" className="text-xs w-full text-muted-foreground hover:text-foreground">View all notifications</Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
