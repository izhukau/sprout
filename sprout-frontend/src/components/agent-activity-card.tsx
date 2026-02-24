"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AgentActivityEntry } from "@/hooks/use-agent-stream";
import { cn } from "@/lib/utils";

type AgentActivityCardProps = {
  activityLog: AgentActivityEntry[];
  isStreaming: boolean;
  error: string | null;
  onDismiss: () => void;
};

function formatActivity(entry: AgentActivityEntry) {
  switch (entry.type) {
    case "agent_start":
      return {
        icon: (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#2EE84A]" />
        ),
        text: `${entry.agent ?? "agent"} started`,
      };
    case "tool_call": {
      const title = entry.input?.title as string | undefined;
      const toolName = entry.tool ?? "tool";
      return {
        icon: (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#3DBF5A]" />
        ),
        text: title ? `${toolName}: "${title}"` : toolName,
      };
    }
    case "tool_result":
      return {
        icon: (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#2EE84A]/60" />
        ),
        text: `${entry.tool ?? "tool"} done`,
      };
    case "agent_done":
      return {
        icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#2EE84A]" />,
        text: `${entry.agent ?? "agent"} completed`,
      };
    case "agent_error":
      return {
        icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />,
        text: entry.message ?? `${entry.agent ?? "agent"} error`,
      };
  }
}

export function AgentActivityCard({
  activityLog,
  isStreaming,
  error,
  onDismiss,
}: AgentActivityCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll to bottom on new entries
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional trigger on activityLog.length
  useEffect(() => {
    if (!collapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activityLog.length, collapsed]);

  // Auto-collapse 5s after stream ends, auto-hide 10s after that
  useEffect(() => {
    if (autoCollapseTimer.current) clearTimeout(autoCollapseTimer.current);
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);

    if (!isStreaming && activityLog.length > 0) {
      const hasErrors = activityLog.some((e) => e.type === "agent_error");

      autoCollapseTimer.current = setTimeout(() => {
        setCollapsed(true);
      }, 5_000);

      if (!hasErrors) {
        autoHideTimer.current = setTimeout(() => {
          setHidden(true);
        }, 15_000);
      }
    }

    return () => {
      if (autoCollapseTimer.current) clearTimeout(autoCollapseTimer.current);
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    };
  }, [isStreaming, activityLog]);

  // Reset hidden/collapsed when a new stream starts
  useEffect(() => {
    if (isStreaming) {
      setCollapsed(false);
      setHidden(false);
    }
  }, [isStreaming]);

  const handleDismiss = useCallback(() => {
    setHidden(true);
    onDismiss();
  }, [onDismiss]);

  if (hidden) return null;

  const inFlightCount = activityLog.filter(
    (e) => e.type === "agent_start" || e.type === "tool_call",
  ).length;
  const doneCount = activityLog.filter(
    (e) => e.type === "agent_done" || e.type === "tool_result",
  ).length;

  // Collapsed pill
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={cn(
          "fixed top-6 right-6 z-50",
          "flex items-center gap-2 rounded-full px-4 py-2",
          "border border-[rgba(46,232,74,0.15)] bg-[rgba(17,34,20,0.85)]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-[16px]",
          "text-xs text-[#3DBF5A]",
          "transition-all duration-300 hover:border-[rgba(46,232,74,0.3)]",
        )}
      >
        {isStreaming && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2EE84A] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2EE84A]" />
          </span>
        )}
        <Zap className="h-3.5 w-3.5" />
        {isStreaming
          ? `${inFlightCount - doneCount} operations running...`
          : "Agent activity"}
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
    );
  }

  // Expanded card
  return (
    <div
      className={cn(
        "fixed top-6 right-6 z-50 w-80",
        "rounded-xl border border-[rgba(46,232,74,0.15)] bg-[rgba(17,34,20,0.85)]",
        "shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-[16px]",
        "text-white",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[rgba(46,232,74,0.1)] px-4 py-3">
        {isStreaming && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2EE84A] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2EE84A]" />
          </span>
        )}
        <Zap className="h-4 w-4 text-[#2EE84A]" />
        <span className="flex-1 text-sm font-medium text-[#3DBF5A]">
          Agent Activity
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded p-0.5 text-white/40 transition-colors hover:text-white/70"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded p-0.5 text-white/40 transition-colors hover:text-white/70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Activity list */}
      <div ref={scrollRef} className="max-h-64 overflow-y-auto">
        <div className="space-y-1 px-4 py-3">
          {activityLog.length === 0 && (
            <p className="text-xs text-white/40">Waiting for events...</p>
          )}
          {activityLog.map((entry) => {
            const { icon, text } = formatActivity(entry);
            return (
              <div
                key={entry.id}
                className="flex items-start gap-2 text-xs leading-relaxed text-white/70"
              >
                <span className="mt-0.5 shrink-0">{icon}</span>
                <span className="min-w-0 break-words">{text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
