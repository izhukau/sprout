"use client";

import type { Edge } from "@xyflow/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentActivityCard } from "@/components/agent-activity-card";
import { ForceGraphView } from "@/components/force-graph-view";
import GraphCanvas from "@/components/graph-canvas";
import type { GraphNode, NodeVariant } from "@/components/graph-node";
import { GraphSidebar, type GraphView } from "@/components/graph-sidebar";
import { NewBranchDialog } from "@/components/new-branch-dialog";
import { ConceptDiagnosticChat } from "@/components/concept-diagnostic-chat";
import { HandCursor } from "@/components/hand-cursor";
import { type StreamMutation, useAgentStream } from "@/hooks/use-agent-stream";
import { useHandTracking } from "@/hooks/use-hand-tracking";
import { DEFAULT_USER_ID } from "@/lib/constants";
import {
  type BackendBranch,
  type BackendEdge,
  type BackendNode,
  type BackendProgress,
  type BackendAssessment,
  type BackendQuestion,
  createBranch,
  createNode,
  deleteBranch,
  listBranches,
  listDependencyEdges,
  listNodes,
  listProgress,
  SSE_BASE_URL,
  uploadDocuments,
} from "@/lib/backend-api";
import {
  getConceptNodesForBranch,
  getSubconceptNodesForConcept,
} from "@/lib/graph-utils";
import { getConceptDiagnostic, patchAssessment } from "@/lib/backend-api";

function nodeVariantFromType(type: BackendNode["type"]): NodeVariant {
  return type;
}

function buildCompletedSet(progressRows: BackendProgress[]): Set<string> {
  return new Set(
    progressRows
      .filter((row) => !!row.completedAt || row.masteryScore >= 0.7)
      .map((row) => row.nodeId),
  );
}

function mapBackendNodesToGraphNodes(
  backendNodes: BackendNode[],
  completedSet: Set<string>,
): GraphNode[] {
  return backendNodes.map((node) => ({
    id: node.id,
    type: "graph",
    position: { x: 0, y: 0 },
    data: {
      label: node.title,
      variant: nodeVariantFromType(node.type),
      userId: node.userId,
      branchId: node.branchId,
      parentId: node.parentId,
      completed: node.type === "root" ? true : completedSet.has(node.id),
      summary: node.desc ?? undefined,
    },
  }));
}

function toReactFlowEdges(edges: BackendEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
  }));
}

function buildLinearFallbackEdges(nodes: GraphNode[]): Edge[] {
  const sorted = [...nodes];
  return sorted.slice(0, -1).map((node, index) => ({
    id: `fallback-${node.id}-${sorted[index + 1].id}`,
    source: node.id,
    target: sorted[index + 1].id,
  }));
}

function isStructuralEdge(edge: Edge): boolean {
  return Boolean(
    (edge.data as { isStructural?: boolean } | undefined)?.isStructural,
  );
}

function buildLockedNodeIds(nodes: GraphNode[], edges: Edge[]): Set<string> {
  const completedById = new Map(
    nodes.map((node) => [node.id, !!node.data.completed]),
  );
  const nodeIdSet = new Set(nodes.map((node) => node.id));
  const incomingByTarget = new Map<string, string[]>();

  for (const edge of edges) {
    if (isStructuralEdge(edge)) continue;
    if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) continue;
    const incoming = incomingByTarget.get(edge.target) ?? [];
    incoming.push(edge.source);
    incomingByTarget.set(edge.target, incoming);
  }

  const locked = new Set<string>();
  for (const node of nodes) {
    if (node.data.completed) continue;
    const parents = incomingByTarget.get(node.id) ?? [];
    if (!parents.length) continue;

    const allParentsCompleted = parents.every(
      (parentId) => completedById.get(parentId) === true,
    );
    if (!allParentsCompleted) {
      locked.add(node.id);
    }
  }

  return locked;
}

function applyLockedState(nodes: GraphNode[], edges: Edge[]): GraphNode[] {
  const lockedNodeIds = buildLockedNodeIds(nodes, edges);
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      locked: lockedNodeIds.has(node.id),
    },
  }));
}

export function GraphViewContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchIdFromQuery = searchParams.get("branchId");
  const conceptIdFromQuery = searchParams.get("conceptId");
  const activeUserId = DEFAULT_USER_ID;

  const [view, setView] = useState<GraphView>({ level: "global" });
  const [highlightedBranchId, setHighlightedBranchId] = useState<string | null>(
    null,
  );
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [pendingDiagnostic, setPendingDiagnostic] = useState<{
    conceptId: string;
    conceptTitle: string;
    assessment: BackendAssessment;
    questions: BackendQuestion[];
    requiredAnswers: number;
  } | null>(null);
  const [branches, setBranches] = useState<BackendBranch[]>([]);
  const [backendNodes, setBackendNodes] = useState<BackendNode[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [conceptEdgesByRootId, setConceptEdgesByRootId] = useState<
    Record<string, BackendEdge[]>
  >({});
  const [subconceptEdgesByConceptId, setSubconceptEdgesByConceptId] = useState<
    Record<string, BackendEdge[]>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNewBranchOpen, setIsNewBranchOpen] = useState(false);
  const isSmallAgents = process.env.NEXT_PUBLIC_SMALL_AGENTS === "true";
  const [handTrackingEnabled, setHandTrackingEnabled] = useState(false);
  const { handPos, hands, connected: handConnected } = useHandTracking(
    "ws://localhost:8765",
    handTrackingEnabled,
  );

  // Ref mirror for use inside SSE mutation handler (avoids stale closures)
  const backendNodesRef = useRef<BackendNode[]>([]);
  useEffect(() => {
    backendNodesRef.current = backendNodes;
  }, [backendNodes]);
  // Optional diagnostic fetch on concept entry
  useEffect(() => {
    let cancelled = false;
    const loadDiagnostic = async () => {
      if (view.level !== "concept") {
        setPendingDiagnostic(null);
        return;
      }
      try {
        const result = await getConceptDiagnostic({
          conceptId: view.conceptId,
          userId: activeUserId,
        });
        if (cancelled) return;
        if (result.isComplete) {
          setPendingDiagnostic(null);
          return;
        }
        const conceptTitle =
          backendNodesRef.current.find((n) => n.id === view.conceptId)?.title ??
          "Concept";
        setPendingDiagnostic({
          conceptId: view.conceptId,
          conceptTitle,
          assessment: result.assessment,
          questions: result.questions,
          requiredAnswers: result.requiredAnswers,
        });
      } catch {
        /* optional; ignore errors */
      }
    };
    void loadDiagnostic();
    return () => {
      cancelled = true;
    };
  }, [view, activeUserId]);

  const completedSetRef = useRef<Set<string>>(new Set());

  const branchRootByBranchId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const node of backendNodes) {
      if (node.type === "root" && node.branchId) {
        map[node.branchId] = node.id;
      }
    }
    return map;
  }, [backendNodes]);

  // --- SSE stream mutation handler ---
  const handleStreamMutation = useCallback((mutation: StreamMutation) => {
    switch (mutation.kind) {
      case "node_created": {
        const node = mutation.node;
        // Sync ref immediately so subsequent edge_created (flushed from
        // the SSE buffer in the same microtask) can find this node.
        if (!backendNodesRef.current.some((n) => n.id === node.id)) {
          backendNodesRef.current = [...backendNodesRef.current, node];
        }
        setBackendNodes((prev) => {
          if (prev.some((n) => n.id === node.id)) return prev;
          return [...prev, node];
        });
        setGraphNodes((prev) => {
          if (prev.some((n) => n.id === node.id)) return prev;
          const graphNode = mapBackendNodesToGraphNodes(
            [node],
            completedSetRef.current,
          )[0];
          return [...prev, graphNode];
        });
        break;
      }

      case "edge_created": {
        const { sourceNodeId, targetNodeId } = mutation.edge;
        const nodes = backendNodesRef.current;
        const sourceNode = nodes.find((n) => n.id === sourceNodeId);
        const targetNode = nodes.find((n) => n.id === targetNodeId);

        if (sourceNode && targetNode) {
          const edgeRow: BackendEdge = {
            id: `sse-${sourceNodeId}-${targetNodeId}`,
            sourceNodeId,
            targetNodeId,
            createdAt: new Date().toISOString(),
          };

          // Classify: concept-to-concept → conceptEdgesByRootId
          if (
            sourceNode.type === "concept" &&
            targetNode.type === "concept" &&
            sourceNode.parentId
          ) {
            const rootId = sourceNode.parentId;
            setConceptEdgesByRootId((prev) => {
              const existing = prev[rootId] ?? [];
              if (
                existing.some(
                  (e) =>
                    e.sourceNodeId === sourceNodeId &&
                    e.targetNodeId === targetNodeId,
                )
              )
                return prev;
              return { ...prev, [rootId]: [...existing, edgeRow] };
            });
          }
          // Classify: subconcept edges → subconceptEdgesByConceptId
          else if (
            targetNode.type === "subconcept" ||
            sourceNode.type === "subconcept"
          ) {
            const conceptId =
              sourceNode.type === "subconcept"
                ? sourceNode.parentId
                : sourceNode.id;
            if (conceptId) {
              setSubconceptEdgesByConceptId((prev) => {
                const existing = prev[conceptId] ?? [];
                if (
                  existing.some(
                    (e) =>
                      e.sourceNodeId === sourceNodeId &&
                      e.targetNodeId === targetNodeId,
                  )
                )
                  return prev;
                return { ...prev, [conceptId]: [...existing, edgeRow] };
              });
            }
          }
        }
        break;
      }

      case "node_removed": {
        // Sync ref immediately (mirrors node_created symmetry)
        backendNodesRef.current = backendNodesRef.current.filter(
          (n) => n.id !== mutation.nodeId,
        );
        // Mark as removing for animation, then remove after delay
        setGraphNodes((prev) =>
          prev.map((n) =>
            n.id === mutation.nodeId
              ? { ...n, data: { ...n.data, isRemoving: true } }
              : n,
          ),
        );
        setTimeout(() => {
          setBackendNodes((prev) =>
            prev.filter((n) => n.id !== mutation.nodeId),
          );
          setGraphNodes((prev) => prev.filter((n) => n.id !== mutation.nodeId));
        }, 400);
        break;
      }

      case "edge_removed": {
        const { sourceNodeId, targetNodeId } = mutation;
        const filterEdge = (e: BackendEdge) =>
          !(e.sourceNodeId === sourceNodeId && e.targetNodeId === targetNodeId);
        setConceptEdgesByRootId((prev) => {
          const updated: Record<string, BackendEdge[]> = {};
          for (const key of Object.keys(prev)) {
            updated[key] = prev[key].filter(filterEdge);
          }
          return updated;
        });
        setSubconceptEdgesByConceptId((prev) => {
          const updated: Record<string, BackendEdge[]> = {};
          for (const key of Object.keys(prev)) {
            updated[key] = prev[key].filter(filterEdge);
          }
          return updated;
        });
        break;
      }

      case "json_response": {
        const data = mutation.data as Record<string, unknown>;
        if (data.status === "not_ready") {
          setError(
            "Diagnostic questions are still being generated. Please wait a moment and try again.",
          );
        }
        break;
      }
    }
  }, []);

  const {
    startStream,
    cancelStream,
    seedKnownNodes,
    isStreaming,
    error: streamError,
    activityLog,
    clearActivityLog,
  } = useAgentStream({ onMutation: handleStreamMutation });

  const resumeConceptRun = useCallback(
    (conceptId: string) => {
      seedKnownNodes(backendNodesRef.current.map((n) => n.id));
      void startStream(`${SSE_BASE_URL}/api/agents/concepts/${conceptId}/run`, {
        userId: activeUserId,
        ...(isSmallAgents && { small: true }),
      });
    },
    [activeUserId, seedKnownNodes, startStream, isSmallAgents],
  );

  const refreshGraph = useCallback(async (userId: string) => {
    const [nodesRows, progressRows] = await Promise.all([
      listNodes({ userId }),
      listProgress(userId),
    ]);
    const completedSet = buildCompletedSet(progressRows);
    completedSetRef.current = completedSet;
    setBackendNodes(nodesRows);
    setGraphNodes(mapBackendNodesToGraphNodes(nodesRows, completedSet));
    return nodesRows;
  }, []);

  const loadConceptEdgesForBranch = useCallback(
    async (branchId: string, nodesSnapshot: BackendNode[]) => {
      const rootNode = nodesSnapshot.find(
        (node) => node.type === "root" && node.branchId === branchId,
      );
      if (!rootNode) return [];

      const edges = await listDependencyEdges(rootNode.id, "concept");
      setConceptEdgesByRootId((prev) => ({ ...prev, [rootNode.id]: edges }));
      return edges;
    },
    [],
  );

  const loadSubconceptEdgesForConcept = useCallback(
    async (conceptId: string) => {
      const edges = await listDependencyEdges(conceptId, "subconcept");
      setSubconceptEdgesByConceptId((prev) => ({
        ...prev,
        [conceptId]: edges,
      }));
      return edges;
    },
    [],
  );

  useEffect(() => {
    let isCancelled = false;

    const bootstrap = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const branchRows = await listBranches(activeUserId);
        if (isCancelled) return;

        setBranches(branchRows);

        let nodesRows = await refreshGraph(activeUserId);
        const hasRootByBranch = new Set(
          nodesRows
            .filter((node) => node.type === "root" && !!node.branchId)
            .map((node) => node.branchId as string),
        );

        const missingRoots = branchRows.filter(
          (branch) => !hasRootByBranch.has(branch.id),
        );
        if (missingRoots.length) {
          await Promise.all(
            missingRoots.map((branch) =>
              createNode({
                userId: activeUserId,
                type: "root",
                branchId: branch.id,
                parentId: null,
                title: branch.title,
              }),
            ),
          );
          nodesRows = await refreshGraph(activeUserId);
        }

        if (isCancelled) return;

        const roots = nodesRows.filter((node) => node.type === "root");
        await Promise.all(
          roots
            .filter((root) => root.branchId)
            .map((root) =>
              loadConceptEdgesForBranch(root.branchId as string, nodesRows),
            ),
        );

        if (branchIdFromQuery) {
          const hasBranch = branchRows.some(
            (branch) => branch.id === branchIdFromQuery,
          );
          if (hasBranch) {
            setHighlightedBranchId(branchIdFromQuery);

            if (conceptIdFromQuery) {
              const conceptNode = nodesRows.find(
                (node) =>
                  node.id === conceptIdFromQuery &&
                  node.type === "concept" &&
                  node.branchId === branchIdFromQuery,
              );

              if (conceptNode) {
                setView({
                  level: "concept",
                  branchId: branchIdFromQuery,
                  conceptId: conceptIdFromQuery,
                });
                await loadSubconceptEdgesForConcept(conceptIdFromQuery);
              } else {
                setView({ level: "branch", branchId: branchIdFromQuery });
              }
            } else {
              setView({ level: "branch", branchId: branchIdFromQuery });
            }
          }
        }
      } catch (e) {
        if (!isCancelled) {
          setError(e instanceof Error ? e.message : "Failed to load graph");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      isCancelled = true;
    };
  }, [
    activeUserId,
    branchIdFromQuery,
    conceptIdFromQuery,
    refreshGraph,
    loadConceptEdgesForBranch,
    loadSubconceptEdgesForConcept,
  ]);

  const handleSelectBranch = useCallback((branchId: string) => {
    setHighlightedBranchId((prev) => (prev === branchId ? null : branchId));
  }, []);

  const handleOpenBranch = useCallback(
    (branchId: string) => {
      setView({ level: "branch", branchId });
      setHighlightedBranchId(null);
      setFocusedNodeId(null);
      setExpandedNodeId(null);

      const rootId = branchRootByBranchId[branchId];
      if (!rootId) return;

      seedKnownNodes(backendNodesRef.current.map((n) => n.id));
      void startStream(`${SSE_BASE_URL}/api/agents/topics/${rootId}/run`, {
        userId: activeUserId,
        ...(process.env.NEXT_PUBLIC_SMALL_AGENTS === "true" && { small: true }),
      });
    },
    [activeUserId, branchRootByBranchId, seedKnownNodes, startStream],
  );

  const handleSelectConcept = useCallback((_conceptId: string) => {
    // Concept-level focus is handled by view navigation.
  }, []);

  const handleOpenConcept = useCallback(
    async (conceptId: string) => {
      if (view.level !== "branch") return;

      const branchNodes = getConceptNodesForBranch(graphNodes, view.branchId);
      const rootId = branchRootByBranchId[view.branchId];
      const dependencyEdges = rootId ? conceptEdgesByRootId[rootId] : undefined;
      const edges = dependencyEdges?.length
        ? toReactFlowEdges(dependencyEdges)
        : buildLinearFallbackEdges(branchNodes);
      const lockedNodeIds = buildLockedNodeIds(branchNodes, edges);
      if (lockedNodeIds.has(conceptId)) {
        setError("This node is locked. Complete all parent nodes first.");
        return;
      }

      setExpandedNodeId(null);
      setView({ level: "concept", branchId: view.branchId, conceptId });

      seedKnownNodes(backendNodesRef.current.map((n) => n.id));
      void startStream(`${SSE_BASE_URL}/api/agents/concepts/${conceptId}/run`, {
        userId: activeUserId,
        ...(process.env.NEXT_PUBLIC_SMALL_AGENTS === "true" && { small: true }),
      });
    },
    [
      view,
      graphNodes,
      branchRootByBranchId,
      conceptEdgesByRootId,
      activeUserId,
      seedKnownNodes,
      startStream,
    ],
  );

  const isNodeLockedInCurrentView = useCallback(
    (nodeId: string) => {
      if (view.level === "branch") {
        const branchNodes = getConceptNodesForBranch(graphNodes, view.branchId);
        const rootId = branchRootByBranchId[view.branchId];
        const dependencyEdges = rootId
          ? conceptEdgesByRootId[rootId]
          : undefined;
        const edges = dependencyEdges?.length
          ? toReactFlowEdges(dependencyEdges)
          : buildLinearFallbackEdges(branchNodes);
        return buildLockedNodeIds(branchNodes, edges).has(nodeId);
      }

      if (view.level === "concept") {
        const conceptNodes = getSubconceptNodesForConcept(
          graphNodes,
          view.conceptId,
        );
        const dependencyEdges =
          subconceptEdgesByConceptId[view.conceptId] ?? [];
        const explicitEdges = toReactFlowEdges(dependencyEdges);
        const incoming = new Set(explicitEdges.map((edge) => edge.target));
        const rootEdges = conceptNodes
          .filter((node) => node.data.variant === "subconcept")
          .filter((node) => !incoming.has(node.id))
          .map((node) => ({
            id: `entry-${view.conceptId}-${node.id}`,
            source: view.conceptId,
            target: node.id,
            data: { isStructural: true },
          }));
        return buildLockedNodeIds(conceptNodes, [
          ...explicitEdges,
          ...rootEdges,
        ]).has(nodeId);
      }

      return false;
    },
    [
      view,
      graphNodes,
      branchRootByBranchId,
      conceptEdgesByRootId,
      subconceptEdgesByConceptId,
    ],
  );

  const handleOpenNode = useCallback(
    (nodeId: string) => {
      if (isNodeLockedInCurrentView(nodeId)) {
        setError("This node is locked. Complete all parent nodes first.");
        return;
      }

      if (view.level === "branch") {
        void handleOpenConcept(nodeId);
      } else if (view.level === "concept") {
        setExpandedNodeId(null);
        const query = new URLSearchParams({ nodeId });
        query.set("branchId", view.branchId);
        query.set("conceptId", view.conceptId);
        router.push(`/learn?${query.toString()}`);
      }
    },
    [view, isNodeLockedInCurrentView, handleOpenConcept, router],
  );

  const handleBack = useCallback(() => {
    cancelStream();
    setExpandedNodeId(null);
    setFocusedNodeId(null);
    if (view.level === "concept") {
      setView({ level: "branch", branchId: view.branchId });
    } else if (view.level === "branch") {
      setView({ level: "global" });
    }
  }, [view, cancelStream]);

  const handleCreateBranch = useCallback(
    async (data: { title: string; description: string; files: File[] }) => {
      const newBranch = await createBranch({
        userId: activeUserId,
        title: data.title,
      });

      const rootNode = await createNode({
        userId: activeUserId,
        type: "root",
        branchId: newBranch.id,
        parentId: null,
        title: data.title,
        desc: data.description || null,
      });

      if (data.files.length > 0) {
        await uploadDocuments(rootNode.id, data.files);
      }

      setBranches((prev) => [...prev, newBranch]);
      // Add root node to state immediately
      setBackendNodes((prev) => [...prev, rootNode]);
      setGraphNodes((prev) => [
        ...prev,
        ...mapBackendNodesToGraphNodes([rootNode], completedSetRef.current),
      ]);

      // Auto-focus the new branch so the user sees it grow in isolation
      setHighlightedBranchId(newBranch.id);

      // Start SSE stream for topic agent (fire-and-forget; progress shown in activity card)
      seedKnownNodes([
        ...backendNodesRef.current.map((n) => n.id),
        rootNode.id,
      ]);
      void startStream(`${SSE_BASE_URL}/api/agents/topics/${rootNode.id}/run`, {
        userId: activeUserId,
        ...(process.env.NEXT_PUBLIC_SMALL_AGENTS === "true" && { small: true }),
      });
    },
    [activeUserId, seedKnownNodes, startStream],
  );

  const handleDeleteBranch = useCallback(
    async (branchId: string) => {
      const branch = branches.find((item) => item.id === branchId);
      const confirmed = window.confirm(
        `Delete topic "${branch?.title ?? "this topic"}" and its full graph?`,
      );
      if (!confirmed) return;

      setIsSyncing(true);
      setError(null);
      try {
        await deleteBranch(branchId);

        const [branchRows, nodesRows] = await Promise.all([
          listBranches(activeUserId),
          refreshGraph(activeUserId),
        ]);
        setBranches(branchRows);

        const rootNodeIds = new Set(
          nodesRows
            .filter((node) => node.type === "root")
            .map((node) => node.id),
        );
        setConceptEdgesByRootId((prev) => {
          const next: Record<string, BackendEdge[]> = {};
          for (const [rootId, edges] of Object.entries(prev)) {
            if (rootNodeIds.has(rootId)) {
              next[rootId] = edges;
            }
          }
          return next;
        });

        const conceptNodeIds = new Set(
          nodesRows
            .filter((node) => node.type === "concept")
            .map((node) => node.id),
        );
        setSubconceptEdgesByConceptId((prev) => {
          const next: Record<string, BackendEdge[]> = {};
          for (const [conceptId, edges] of Object.entries(prev)) {
            if (conceptNodeIds.has(conceptId)) {
              next[conceptId] = edges;
            }
          }
          return next;
        });

        if (highlightedBranchId === branchId) {
          setHighlightedBranchId(null);
        }
        if (view.level !== "global" && view.branchId === branchId) {
          setView({ level: "global" });
        }
        setFocusedNodeId(null);
        setExpandedNodeId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete topic");
      } finally {
        setIsSyncing(false);
      }
    },
    [activeUserId, branches, highlightedBranchId, refreshGraph, view],
  );

  const handleForceNodeClick = useCallback(
    (nodeId: string) => {
      const node = graphNodes.find((candidate) => candidate.id === nodeId);
      if (!node) return;

      if (nodeId === focusedNodeId) {
        if (node.data.variant === "root" && node.data.branchId) {
          void handleOpenBranch(node.data.branchId);
        } else if (node.data.variant === "concept" && node.data.branchId) {
          void handleOpenBranch(node.data.branchId);
          setExpandedNodeId(nodeId);
        } else if (
          node.data.variant === "subconcept" &&
          node.data.branchId &&
          node.data.parentId
        ) {
          setView({
            level: "concept",
            branchId: node.data.branchId,
            conceptId: node.data.parentId,
          });
          void loadSubconceptEdgesForConcept(node.data.parentId);
        }
        setFocusedNodeId(null);
        setHighlightedBranchId(null);
        return;
      }

      setFocusedNodeId(nodeId);
      if (node.data.branchId) {
        setHighlightedBranchId(node.data.branchId);
      }
    },
    [
      graphNodes,
      focusedNodeId,
      handleOpenBranch,
      loadSubconceptEdgesForConcept,
    ],
  );

  const handleReactFlowNodeClick = useCallback(
    (nodeId: string) => {
      if (isNodeLockedInCurrentView(nodeId)) {
        return;
      }

      if (view.level === "branch") {
        const node = graphNodes.find((candidate) => candidate.id === nodeId);
        if (node?.data.variant === "concept") {
          setExpandedNodeId((prev) => (prev === nodeId ? null : nodeId));
        }
      } else if (view.level === "concept") {
        const node = graphNodes.find((candidate) => candidate.id === nodeId);
        if (node?.data.variant === "subconcept") {
          setExpandedNodeId((prev) => (prev === nodeId ? null : nodeId));
        }
      }
    },
    [view, graphNodes, isNodeLockedInCurrentView],
  );

  const { filteredNodes, filteredEdges } = useMemo(() => {
    if (view.level === "branch") {
      const branchNodes = getConceptNodesForBranch(graphNodes, view.branchId);
      const rootId = branchRootByBranchId[view.branchId];
      const dependencyEdges = rootId ? conceptEdgesByRootId[rootId] : undefined;
      const edges = dependencyEdges?.length
        ? toReactFlowEdges(dependencyEdges)
        : buildLinearFallbackEdges(branchNodes);

      const nodesWithLocks = applyLockedState(branchNodes, edges);

      return {
        filteredNodes: nodesWithLocks,
        filteredEdges: edges,
      };
    }

    if (view.level === "concept") {
      const conceptNodes = getSubconceptNodesForConcept(
        graphNodes,
        view.conceptId,
      );
      const dependencyEdges = subconceptEdgesByConceptId[view.conceptId] ?? [];
      const explicitEdges = toReactFlowEdges(dependencyEdges);

      const incoming = new Set(explicitEdges.map((edge) => edge.target));
      const rootEdges = conceptNodes
        .filter((node) => node.data.variant === "subconcept")
        .filter((node) => !incoming.has(node.id))
        .map((node) => ({
          id: `entry-${view.conceptId}-${node.id}`,
          source: view.conceptId,
          target: node.id,
          data: { isStructural: true },
        }));

      const edges = [...explicitEdges, ...rootEdges];
      const nodesWithLocks = applyLockedState(conceptNodes, edges);

      return {
        filteredNodes: nodesWithLocks,
        filteredEdges: edges,
      };
    }

    return {
      filteredNodes: [],
      filteredEdges: [] as Edge[],
    };
  }, [
    view,
    graphNodes,
    branchRootByBranchId,
    conceptEdgesByRootId,
    subconceptEdgesByConceptId,
  ]);

  const allDependencyEdges = useMemo(() => {
    const conceptEdges = Object.values(conceptEdgesByRootId).flat();
    const subconceptEdges = Object.values(subconceptEdgesByConceptId).flat();
    return [...conceptEdges, ...subconceptEdges];
  }, [conceptEdgesByRootId, subconceptEdgesByConceptId]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0A1A0F] text-sm text-[#3DBF5A]/80">
        Loading learning graph...
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen bg-[#0A1A0F]">
      <GraphSidebar
        view={view}
        branches={branches}
        nodes={view.level === "global" ? graphNodes : filteredNodes}
        highlightedBranchId={highlightedBranchId}
        onSelectBranch={handleSelectBranch}
        onOpenBranch={(branchId) => void handleOpenBranch(branchId)}
        onSelectConcept={handleSelectConcept}
        onOpenConcept={(conceptId) => void handleOpenConcept(conceptId)}
        onSelectSubconcept={handleOpenNode}
        onDeleteBranch={(branchId) => void handleDeleteBranch(branchId)}
        onBack={handleBack}
        onNewBranch={() => setIsNewBranchOpen(true)}
      />

      <div
        className="absolute inset-0 left-72"
        onKeyDown={(e) => {
          if (e.key === "Escape" && highlightedBranchId) {
            setHighlightedBranchId(null);
          }
        }}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: need focus for key events
        tabIndex={0}
      >
        {(error || streamError) && (
          <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error || streamError}
          </div>
        )}
        {isSyncing && (
          <div className="pointer-events-none absolute right-4 top-4 z-20 rounded-lg border border-[rgba(46,232,74,0.25)] bg-[rgba(10,26,15,0.8)] px-3 py-2 text-xs text-[#2EE84A]">
            Syncing with backend...
          </div>
        )}

        {/* Hand tracking toggle */}
        <button
          type="button"
          onClick={() => setHandTrackingEnabled((prev) => !prev)}
          title={
            handTrackingEnabled
              ? "Disable hand tracking"
              : "Enable hand tracking"
          }
          className={[
            "absolute bottom-44 right-4 z-30 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors",
            handTrackingEnabled
              ? "border-green-500/60 bg-green-500/20 text-green-300"
              : "border-white/10 bg-[rgba(10,26,15,0.8)] text-white/40 hover:border-white/20 hover:text-white/70",
          ].join(" ")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
            <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
          </svg>
          {handTrackingEnabled
            ? handConnected
              ? "Hand tracking on"
              : "Connecting…"
            : "Hand tracking"}
        </button>

        <HandCursor handPos={handPos} connected={handConnected} />

        {view.level === "global" && (
          <>
            <ForceGraphView
              branches={branches}
              nodes={graphNodes}
              dependencyEdges={allDependencyEdges}
              highlightedBranchId={highlightedBranchId}
              focusedNodeId={focusedNodeId}
              onNodeClick={handleForceNodeClick}
              handPos={handPos}
              hands={hands}
            />
            {highlightedBranchId && (
              <button
                type="button"
                onClick={() => setHighlightedBranchId(null)}
                className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-lg border border-[rgba(46,232,74,0.25)] bg-[rgba(10,26,15,0.85)] px-3 py-2 text-xs text-[#2EE84A] backdrop-blur-sm transition-colors hover:bg-[rgba(46,232,74,0.15)]"
              >
                <span>&#x2190;</span>
                <span>All branches</span>
                <kbd className="ml-1 rounded border border-[rgba(46,232,74,0.2)] px-1 text-[10px] text-[#2EE84A]/60">
                  Esc
                </kbd>
              </button>
            )}
          </>
        )}
        {(view.level === "branch" || view.level === "concept") && (
          <GraphCanvas
            key={
              view.level === "branch"
                ? `branch-${view.branchId}`
                : `concept-${view.conceptId}`
            }
            nodes={filteredNodes}
            edges={filteredEdges}
            onNodeClick={handleReactFlowNodeClick}
            expandedNodeId={expandedNodeId}
            onOpenConcept={handleOpenNode}
            onPaneClick={() => setExpandedNodeId(null)}
          />
        )}
      </div>

      <NewBranchDialog
        open={isNewBranchOpen}
        onOpenChange={setIsNewBranchOpen}
        onSubmit={handleCreateBranch}
      />

      {(activityLog.length > 0 || isStreaming) && (
        <AgentActivityCard
          activityLog={activityLog}
          isStreaming={isStreaming}
          error={streamError}
          onDismiss={clearActivityLog}
        />
      )}

      {pendingDiagnostic && (
        <ConceptDiagnosticChat
          userId={activeUserId}
          conceptTitle={pendingDiagnostic.conceptTitle}
          assessment={pendingDiagnostic.assessment}
          questions={pendingDiagnostic.questions}
          requiredAnswers={pendingDiagnostic.requiredAnswers}
          onComplete={() => {
            setPendingDiagnostic(null);
            resumeConceptRun(pendingDiagnostic.conceptId);
          }}
          onClose={() => {
            const assessmentId = pendingDiagnostic.assessment.id;
            setPendingDiagnostic(null);
            void patchAssessment(assessmentId, {
              completedAt: new Date().toISOString(),
            });
          }}
        />
      )}
    </div>
  );
}
