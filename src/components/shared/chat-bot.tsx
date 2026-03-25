"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ── Types ──

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
}

interface ChatBotProps {
  role: "student" | "teacher" | "admin" | "super_admin" | "employee";
  userName: string;
}

// ── Role config ──

const ROLE_CONFIG = {
  student: {
    label: "Student Assistant",
    apiUrl: "/api/student/chat",
    gradient: "from-blue-500 to-blue-600",
    accent: "bg-blue-500",
    lightBg: "bg-blue-50 dark:bg-blue-950/30",
    ring: "ring-blue-500/30",
    text: "text-blue-600 dark:text-blue-400",
  },
  teacher: {
    label: "Teacher Assistant",
    apiUrl: "/api/teacher/chat",
    gradient: "from-emerald-500 to-emerald-600",
    accent: "bg-emerald-500",
    lightBg: "bg-emerald-50 dark:bg-emerald-950/30",
    ring: "ring-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  admin: {
    label: "Admin Assistant",
    apiUrl: "/api/admin/chat",
    gradient: "from-violet-500 to-violet-600",
    accent: "bg-violet-500",
    lightBg: "bg-violet-50 dark:bg-violet-950/30",
    ring: "ring-violet-500/30",
    text: "text-violet-600 dark:text-violet-400",
  },
  employee: {
    label: "Staff Assistant",
    apiUrl: "/api/employee/chat",
    gradient: "from-orange-500 to-orange-600",
    accent: "bg-orange-500",
    lightBg: "bg-orange-50 dark:bg-orange-950/30",
    ring: "ring-orange-500/30",
    text: "text-orange-600 dark:text-orange-400",
  },
  super_admin: {
    label: "Super Admin Assistant",
    apiUrl: "/api/admin/chat",
    gradient: "from-violet-500 to-violet-600",
    accent: "bg-violet-500",
    lightBg: "bg-violet-50 dark:bg-violet-950/30",
    ring: "ring-violet-500/30",
    text: "text-violet-600 dark:text-violet-400",
  },
} as const;

// ── Helpers ──

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

// Simple markdown-like rendering: **bold**, bullets, line breaks
function renderBotText(text: string): React.ReactNode {
  const lines = text.split("\n");

  return lines.map((line, lineIndex) => {
    // Process bold markers
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, partIndex) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={partIndex} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      // Italic with underscore
      if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
        return (
          <em key={partIndex} className="italic text-muted-foreground text-xs">
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });

    return (
      <React.Fragment key={lineIndex}>
        {rendered}
        {lineIndex < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

// ── Quick action chips ──

const QUICK_ACTIONS: Record<string, string[]> = {
  student: ["My Attendance", "Today's Classes", "My Marks", "Fee Status", "Upcoming Exams"],
  teacher: ["My Schedule", "Low Attendance", "Class Performance", "My Students", "Upcoming Exams"],
  admin: ["Total Students", "Fee Collection", "Overall Attendance", "Performance Analytics", "Hostel Occupancy"],
  super_admin: ["Total Students", "Fee Collection", "Overall Attendance", "Performance Analytics", "Hostel Occupancy"],
  employee: ["Module Overview", "Action Pending", "My Activity"],
};

// ── Component ──

export default function ChatBot({ role, userName }: ChatBotProps) {
  const config = ROLE_CONFIG[role];
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Welcome message on first open (local, no API call)
  useEffect(() => {
    if (isOpen && !hasGreeted) {
      setHasGreeted(true);
      const hour = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
      ).getHours();
      const greeting =
        hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
      const welcomeMsg: ChatMessage = {
        id: generateId(),
        sender: "bot",
        text: `${greeting}, ${userName}! 👋 I'm your ${config.label}. How can I help you today?`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, welcomeMsg]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, hasGreeted]);

  // ── Send message ──

  const sendMessage = useCallback(
    async (text: string, isAutoGreet = false) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      // Add user message (skip for auto-greet)
      if (!isAutoGreet) {
        const userMsg: ChatMessage = {
          id: generateId(),
          sender: "user",
          text: trimmed,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
      }

      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch(config.apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
          credentials: "include",
        });

        const data = await res.json();

        const botMsg: ChatMessage = {
          id: generateId(),
          sender: "bot",
          text: data.success
            ? data.message
            : data.message || "Something went wrong. Please try again.",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, botMsg]);
      } catch {
        const errorMsg: ChatMessage = {
          id: generateId(),
          sender: "bot",
          text: "Network error. Please check your connection and try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [config.apiUrl, isLoading]
  );

  // ── Handlers ──

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickAction = (action: string) => {
    sendMessage(action);
  };

  const handleReset = () => {
    setMessages([]);
    setHasGreeted(false);
    setTimeout(() => {
      setHasGreeted(true);
      sendMessage("hello", true);
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ── Render ──

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 print:hidden",
          `bg-gradient-to-br ${config.gradient} text-white`,
          isOpen && "rotate-0"
        )}
        aria-label={isOpen ? "Close chatbot" : "Open chatbot"}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl border border-border/60 bg-background shadow-2xl transition-all duration-300 print:hidden",
          "w-[360px] sm:w-[400px]",
          isOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        )}
        style={{ maxHeight: "calc(100vh - 7rem)", height: "min(560px, calc(100vh - 7rem))" }}
        role="dialog"
        aria-label={`${config.label} chat`}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between rounded-t-2xl px-4 py-3",
            `bg-gradient-to-r ${config.gradient} text-white`
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{config.label}</h3>
              <p className="text-[11px] opacity-80">
                {isLoading ? "Typing..." : "Online"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              className="rounded-full p-1.5 hover:bg-white/20 transition-colors"
              title="Reset conversation"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 hover:bg-white/20 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <ScrollArea className="flex-1 min-h-0 px-4 py-3">
          <div className="space-y-3" ref={scrollRef}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2",
                  msg.sender === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.sender === "bot" && (
                  <div
                    className={cn(
                      "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full mt-0.5",
                      config.lightBg
                    )}
                  >
                    <Bot className={cn("h-4 w-4", config.text)} />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    msg.sender === "user"
                      ? `bg-gradient-to-br ${config.gradient} text-white rounded-br-md`
                      : "bg-muted/60 text-foreground rounded-bl-md border border-border/30"
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {msg.sender === "bot"
                      ? renderBotText(msg.text)
                      : msg.text}
                  </div>
                  <p
                    className={cn(
                      "mt-1.5 text-[10px]",
                      msg.sender === "user"
                        ? "text-white/60 text-right"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatTimestamp(msg.timestamp)}
                  </p>
                </div>
                {msg.sender === "user" && (
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div
                  className={cn(
                    "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full mt-0.5",
                    config.lightBg
                  )}
                >
                  <Bot className={cn("h-4 w-4", config.text)} />
                </div>
                <div className="rounded-2xl rounded-bl-md bg-muted/60 border border-border/30 px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Quick actions — show when no user messages yet */}
        {messages.length <= 1 && !isLoading && (
          <div className="px-4 pb-2">
            <p className="text-[11px] text-muted-foreground mb-1.5">Quick actions:</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIONS[role].map((action) => (
                <button
                  key={action}
                  onClick={() => handleQuickAction(action)}
                  className={cn(
                    "rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium transition-colors hover:bg-muted",
                    config.text
                  )}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        <form onSubmit={handleSubmit} className="border-t border-border/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              maxLength={300}
              disabled={isLoading}
              className="flex-1 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 transition-shadow"
              style={{ boxShadow: "none" }}
              autoComplete="off"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className={cn(
                "h-9 w-9 rounded-xl transition-all",
                `bg-gradient-to-br ${config.gradient} text-white hover:opacity-90`,
                "disabled:opacity-40"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
