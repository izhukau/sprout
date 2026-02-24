import { useCallback, useEffect, useRef, useState } from "react";
import type { BackendNode } from "@/lib/backend-api";
import { openSSEStream } from "@/lib/sse-client";

export type AgentActivityEntry = {
  id: string;
  timestamp: number;
  type:
    | "agent_start"
    | "tool_call"
    | "tool_result"
    | "agent_done"
    | "agent_error";
  agent?: string;
  tool?: string;
  input?: Record<string, unknown>;
  summary?: string;
  message?: string;
};

export type StreamMutation =
  | { kind: "node_created"; node: BackendNode }
  | {
      kind: "edge_created";
      edge: { sourceNodeId: string; targetNodeId: string };
    }
  | { kind: "node_removed"; nodeId: string }
  | { kind: "edge_removed"; sourceNodeId: string; targetNodeId: string }
  | { kind: "json_response"; data: unknown };

export type UseAgentStreamOptions = {
  onMutation: (mutation: StreamMutation) => void;
};

export type UseAgentStreamReturn = {
  startStream: (url: string, body: object) => Promise<void>;
  cancelStream: () => void;
  seedKnownNodes: (ids: string[]) => void;
  isStreaming: boolean;
  error: string | null;
  activityLog: AgentActivityEntry[];
  clearActivityLog: () => void;
};

type PendingEdge = { sourceNodeId: string; targetNodeId: string };

export function useAgentStream(
  options: UseAgentStreamOptions,
): UseAgentStreamReturn {
  const onMutationRef = useRef(options.onMutation);
  onMutationRef.current = options.onMutation;

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<AgentActivityEntry[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const knownNodeIds = useRef(new Set<string>());
  const pendingEdges = useRef(new Map<string, PendingEdge[]>());

  const seedKnownNodes = useCallback((ids: string[]) => {
    knownNodeIds.current = new Set(ids);
    pendingEdges.current.clear();
  }, []);

  const clearActivityLog = useCallback(() => {
    setActivityLog([]);
  }, []);

  const makeEntryId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }, []);

  const handleEvent = useCallback(
    (event: { event: string; data: unknown }) => {
      const emit = onMutationRef.current;

      switch (event.event) {
        case "node_created": {
          const { node } = event.data as { node: BackendNode };
          knownNodeIds.current.add(node.id);
          emit({ kind: "node_created", node });

          // Flush buffered edges targeting this node
          const buffered = pendingEdges.current.get(node.id);
          if (buffered) {
            for (const edge of buffered) {
              emit({ kind: "edge_created", edge });
            }
            pendingEdges.current.delete(node.id);
          }
          break;
        }

        case "edge_created": {
          const { edge } = event.data as { edge: PendingEdge };
          if (
            !knownNodeIds.current.has(edge.sourceNodeId) ||
            !knownNodeIds.current.has(edge.targetNodeId)
          ) {
            // Buffer: at least one endpoint missing
            const key = !knownNodeIds.current.has(edge.targetNodeId)
              ? edge.targetNodeId
              : edge.sourceNodeId;
            const existing = pendingEdges.current.get(key) ?? [];
            existing.push(edge);
            pendingEdges.current.set(key, existing);
          } else {
            emit({ kind: "edge_created", edge });
          }
          break;
        }

        case "node_removed": {
          const { nodeId } = event.data as { nodeId: string };
          knownNodeIds.current.delete(nodeId);
          pendingEdges.current.delete(nodeId);
          emit({ kind: "node_removed", nodeId });
          break;
        }

        case "edge_removed": {
          const { sourceNodeId, targetNodeId } = event.data as {
            sourceNodeId: string;
            targetNodeId: string;
          };
          emit({ kind: "edge_removed", sourceNodeId, targetNodeId });
          break;
        }

        case "__json_response__": {
          emit({ kind: "json_response", data: event.data });
          break;
        }

        case "agent_start":
        case "tool_call":
        case "tool_result":
        case "agent_done":
        case "agent_error": {
          const payload = event.data as Record<string, unknown>;
          const entry: AgentActivityEntry = {
            id: makeEntryId(),
            timestamp: Date.now(),
            type: event.event as AgentActivityEntry["type"],
            agent: payload.agent as string | undefined,
            tool: payload.tool as string | undefined,
            input: payload.input as Record<string, unknown> | undefined,
            summary: payload.summary as string | undefined,
            message: payload.message as string | undefined,
          };
          setActivityLog((prev) => [...prev, entry]);
          break;
        }
      }
    },
    [makeEntryId],
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const startStream = useCallback(
    async (url: string, body: object) => {
      cancelStream();

      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setError(null);
      setActivityLog([]);

      try {
        await openSSEStream(
          url,
          body,
          {
            onEvent: handleEvent,
            onError: (err) => setError(err.message),
            onClose: () => setIsStreaming(false),
          },
          controller.signal,
        );
      } catch (err) {
        if ((err as DOMException)?.name !== "AbortError") {
          setError(
            err instanceof Error ? err.message : "Stream connection failed",
          );
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [cancelStream, handleEvent],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    startStream,
    cancelStream,
    seedKnownNodes,
    isStreaming,
    error,
    activityLog,
    clearActivityLog,
  };
}
