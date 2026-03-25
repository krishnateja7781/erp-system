'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Megaphone, Send, Trash2, MessageSquare, Check, CheckCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase-client';
import {
  createPost,
  listPosts,
  deletePost,
  type ClassroomPost,
} from '@/actions/classroom-post-actions';

interface StreamTabProps {
  classroomId: string;
  userId: string;
  userName: string;
  userRole: 'teacher' | 'student' | 'admin';
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function StreamTab({ classroomId, userId, userName, userRole }: StreamTabProps) {
  const { toast } = useToast();
  const [posts, setPosts] = React.useState<ClassroomPost[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [newText, setNewText] = React.useState('');
  const [isPosting, setIsPosting] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Ref to track latest posts for polling comparison
  const postsRef = React.useRef<ClassroomPost[]>([]);
  postsRef.current = posts;

  const loadPosts = React.useCallback(async () => {
    try {
      const data = await listPosts(classroomId);
      setPosts(data);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load posts.' });
    }
  }, [classroomId, toast]);

  // Initial load
  React.useEffect(() => {
    setIsLoading(true);
    loadPosts().finally(() => setIsLoading(false));
  }, [loadPosts]);

  // Supabase Realtime — subscribe to new posts and deletes
  React.useEffect(() => {
    const channel = supabase
      .channel(`classroom_posts_${classroomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'classroom_posts',
          filter: `classroomId=eq.${classroomId}`,
        },
        (payload) => {
          const newPost = payload.new as ClassroomPost;
          setPosts((prev) => {
            // Remove any optimistic version with temp ID, then add real post
            const withoutOptimistic = prev.filter(
              (p) => !(p.id.startsWith('opt_') && p.authorId === newPost.authorId && p.content === newPost.content)
            );
            // Avoid duplicates
            if (withoutOptimistic.some((p) => p.id === newPost.id)) return withoutOptimistic;
            return [newPost, ...withoutOptimistic];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'classroom_posts',
          filter: `classroomId=eq.${classroomId}`,
        },
        (payload) => {
          const deletedId = (payload.old as any).id;
          if (deletedId) {
            setPosts((prev) => prev.filter((p) => p.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classroomId]);

  // Polling fallback — uses direct Supabase client reads (not server actions)
  // to avoid overwhelming the Next.js server.
  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data: freshPosts } = await supabase
          .from('classroom_posts')
          .select('*')
          .eq('classroomId', classroomId)
          .order('createdAt', { ascending: false });
        if (!freshPosts) return;
        setPosts((prev) => {
          const optimistic = prev.filter((p) => p.id.startsWith('opt_'));
          const prevRealIds = new Set(prev.filter((p) => !p.id.startsWith('opt_')).map((p) => p.id));
          const freshIds = new Set(freshPosts.map((p: any) => p.id));
          const sameSet =
            prevRealIds.size === freshIds.size &&
            [...prevRealIds].every((id) => freshIds.has(id));
          if (sameSet) return prev;
          const remainingOptimistic = optimistic.filter(
            (op) => !freshPosts.some((fp: any) => fp.authorId === op.authorId && fp.content === op.content)
          );
          return [...remainingOptimistic, ...(freshPosts as ClassroomPost[])];
        });
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [classroomId]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [posts]);

  const handlePost = async () => {
    if (!newText.trim()) return;
    const messageText = newText.trim();
    setNewText('');
    setIsPosting(true);

    // Optimistic insert — show message instantly
    const optimisticId = `opt_${Date.now()}`;
    const optimisticPost: ClassroomPost = {
      id: optimisticId,
      classroomId,
      authorId: userId,
      authorName: userName,
      authorRole: userRole,
      content: messageText,
      createdAt: new Date().toISOString(),
    };
    setPosts((prev) => [optimisticPost, ...prev]);

    try {
      const result = await createPost(classroomId, userId, userName, userRole, messageText);
      if (result.success && result.data) {
        // Replace optimistic post with real post from server
        setPosts((prev) =>
          prev.map((p) => (p.id === optimisticId ? (result.data as ClassroomPost) : p))
        );
      } else if (result.success) {
        // Server didn't return data — remove optimistic, next poll/realtime will add it
        setPosts((prev) => prev.filter((p) => p.id !== optimisticId));
      } else {
        setPosts((prev) => prev.filter((p) => p.id !== optimisticId));
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } catch {
      setPosts((prev) => prev.filter((p) => p.id !== optimisticId));
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to post message.' });
    } finally {
      setIsPosting(false);
    }
  };

  const handleDelete = async (postId: string) => {
    // Optimistic delete
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    const result = await deletePost(postId, userId);
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
      loadPosts();
    }
  };

  // Enter to send, Shift+Enter for new line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePost();
    }
  };

  // Group posts by date for date separators (posts are newest-first, reverse for chat order)
  const sortedPosts = [...posts].reverse();
  const groupedByDate: { date: string; posts: ClassroomPost[] }[] = [];
  sortedPosts.forEach(post => {
    const dateKey = new Date(post.createdAt).toDateString();
    const last = groupedByDate[groupedByDate.length - 1];
    if (last && last.date === dateKey) {
      last.posts.push(post);
    } else {
      groupedByDate.push({ date: dateKey, posts: [post] });
    }
  });

  return (
    <div className="flex flex-col h-full">
      {/* Chat area */}
      <div className="flex-1 rounded-2xl border border-border/40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/[0.03] via-background to-background dark:from-violet-500/[0.06] dark:via-background overflow-hidden">
        {/* Chat messages */}
        <div className="p-3 sm:p-4 space-y-1 max-h-[60vh] overflow-y-auto scrollbar-thin" role="feed" aria-label="Classroom posts">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3" role="status">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading messages...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Start the conversation!</p>
            </div>
          ) : (
            <>
              {groupedByDate.map(group => (
                <React.Fragment key={group.date}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center py-3">
                    <div className="px-3 py-1 rounded-lg bg-muted/80 dark:bg-muted/40 text-[11px] font-medium text-muted-foreground shadow-sm">
                      {formatDateSeparator(group.posts[0].createdAt)}
                    </div>
                  </div>
                  {/* Messages for that date */}
                  {group.posts.map((post, idx) => {
                    const isMine = post.authorId === userId;
                    const isTeacherPost = post.authorRole === 'teacher';
                    // Show avatar & name if different author from previous
                    const prev = idx > 0 ? group.posts[idx - 1] : null;
                    const showHeader = !prev || prev.authorId !== post.authorId;

                    return (
                      <div
                        key={post.id}
                        className={cn(
                          "flex gap-2 group",
                          isMine ? "justify-end" : "justify-start",
                          showHeader ? "mt-3" : "mt-0.5"
                        )}
                        role="article"
                      >
                        {/* Avatar for other people's messages */}
                        {!isMine && (
                          <div className="w-8 shrink-0">
                            {showHeader ? (
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className={cn(
                                  "text-[10px] font-bold text-white",
                                  isTeacherPost
                                    ? "bg-gradient-to-br from-violet-500 to-purple-600"
                                    : "bg-gradient-to-br from-blue-500 to-cyan-500"
                                )}>
                                  {getInitials(post.authorName)}
                                </AvatarFallback>
                              </Avatar>
                            ) : null}
                          </div>
                        )}

                        {/* Bubble */}
                        <div className={cn("max-w-[75%] sm:max-w-[65%] relative")}>
                          {/* Chat bubble */}
                          <div className={cn(
                            "rounded-2xl px-3 py-2 shadow-sm relative",
                            isMine
                              ? "bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-tr-sm"
                              : isTeacherPost
                                ? "bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-foreground rounded-tl-sm"
                                : "bg-muted/80 dark:bg-muted/50 border border-border/40 text-foreground rounded-tl-sm"
                          )}>
                            {/* Sender name */}
                            {showHeader && !isMine && (
                              <p className={cn(
                                "text-[11px] font-semibold mb-0.5",
                                isTeacherPost ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"
                              )}>
                                {post.authorName}
                                {isTeacherPost && <span className="text-[9px] ml-1.5 opacity-70">Teacher</span>}
                              </p>
                            )}

                            {/* Message text */}
                            <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>

                            {/* Time + ticks */}
                            <div className={cn(
                              "flex items-center gap-1 justify-end mt-0.5",
                              isMine ? "text-white/60" : "text-muted-foreground/60"
                            )}>
                              <span className="text-[10px]">{formatTime(post.createdAt)}</span>
                              {isMine && <CheckCheck className="h-3 w-3" />}
                            </div>
                          </div>

                          {/* Delete action (on hover) */}
                          {post.authorId === userId && (
                            <button
                              onClick={() => handleDelete(post.id)}
                              className={cn(
                                "absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity",
                                "h-6 w-6 rounded-full bg-destructive/90 hover:bg-destructive text-white flex items-center justify-center shadow-md",
                                isMine ? "-left-8" : "-right-8"
                              )}
                              aria-label={`Delete message`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* Spacer for own messages (no avatar) */}
                        {isMine && <div className="w-0 shrink-0" />}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* WhatsApp-style input bar */}
        <div className="border-t border-border/40 bg-background/80 backdrop-blur-sm p-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <Textarea
                placeholder={userRole === 'teacher' ? 'Type an announcement...' : 'Type a message...'}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                className="resize-none min-h-[40px] max-h-[120px] pr-3 rounded-2xl bg-muted/50 dark:bg-muted/30 border-border/40 text-sm"
                aria-label={userRole === 'teacher' ? 'Announcement text' : 'Message text'}
              />
            </div>
            <Button
              onClick={handlePost}
              disabled={isPosting || !newText.trim()}
              size="icon"
              className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/20 shrink-0"
            >
              {isPosting ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <Send className="h-4 w-4 text-white" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
