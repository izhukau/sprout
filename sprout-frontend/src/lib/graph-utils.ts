import type { Edge } from "@xyflow/react";
import type { GraphNode } from "@/components/graph-node";
import type { BackendEdge } from "@/lib/backend-api";

type BranchLike = {
  id: string;
};

export type BranchColors = { concept: string; subconcept: string };

/** Build a stable color map for branches using golden-angle hue spacing */
export function buildBranchColorMap(
  branches: BranchLike[],
): Map<string, BranchColors> {
  const map = new Map<string, BranchColors>();
  branches.forEach((branch, i) => {
    const hue = (i * 137.5) % 360;
    map.set(branch.id, {
      concept: `hsl(${hue}, 80%, 65%)`,
      subconcept: `hsl(${hue}, 50%, 35%)`,
    });
  });
  return map;
}

export function buildEdgesFromNodes(nodes: GraphNode[]): Edge[] {
  return nodes
    .filter(
      (n): n is GraphNode & { data: { parentId: string } } =>
        n.data.parentId !== null,
    )
    .map((n) => ({
      id: `e-${n.data.parentId}-${n.id}`,
      source: n.data.parentId,
      target: n.id,
    }));
}

/** Get concept nodes for a branch + include the first concept's parent link to root */
export function getConceptNodesForBranch(
  allNodes: GraphNode[],
  branchId: string,
): GraphNode[] {
  return allNodes.filter(
    (n) => n.data.branchId === branchId && n.data.variant === "concept",
  );
}

/** Get a concept node and its subconcepts */
export function getSubconceptNodesForConcept(
  allNodes: GraphNode[],
  conceptId: string,
): GraphNode[] {
  const concept = allNodes.find((n) => n.id === conceptId);
  const subconcepts = allNodes.filter(
    (n) => n.data.variant === "subconcept" && n.data.parentId === conceptId,
  );
  if (!concept) return subconcepts;
  // Null out parentId so no dangling edge to nodes outside this view
  const conceptAsRoot = {
    ...concept,
    data: { ...concept.data, parentId: null },
  };
  return [conceptAsRoot, ...subconcepts];
}

export type ForceNode = {
  [others: string]: unknown;
  id: string;
  label: string;
  variant: "root" | "concept" | "subconcept";
  completed: boolean;
  branchId: string | null;
  val: number;
};

type ForceLinkEndpoint =
  | string
  | {
      id?: string;
      [others: string]: unknown;
    };

export type ForceLink = {
  source: ForceLinkEndpoint;
  target: ForceLinkEndpoint;
};

type ForceGraphData = {
  nodes: ForceNode[];
  links: ForceLink[];
};

function getForceLinkEndpointId(endpoint: ForceLinkEndpoint): string | null {
  if (typeof endpoint === "string") return endpoint;
  if (typeof endpoint.id === "string") return endpoint.id;
  return null;
}

/** Convert GraphNode[] to the format expected by react-force-graph */
export function toForceGraphData(
  nodes: GraphNode[],
  previousData?: ForceGraphData,
  dependencyEdges?: BackendEdge[],
): ForceGraphData {
  const sizeMap = { root: 20, concept: 10, subconcept: 4 };
  const previousNodesById = new Map(
    (previousData?.nodes ?? []).map((node) => [node.id, node]),
  );

  const forceNodes: ForceNode[] = nodes.map((n) => {
    const existingNode = previousNodesById.get(n.id);
    if (!existingNode) {
      // Seed position near parent node to avoid spawning at origin
      const parentNode = n.data.parentId
        ? previousNodesById.get(n.data.parentId)
        : null;
      const parentPos = parentNode as
        | (ForceNode & { x?: number; y?: number; z?: number })
        | undefined;
      const seededPos =
        parentPos?.x != null
          ? {
              x: parentPos.x + (Math.random() - 0.5) * 30,
              y: (parentPos.y ?? 0) + (Math.random() - 0.5) * 30,
              z: ((parentPos as { z?: number }).z ?? 0) + (Math.random() - 0.5) * 30,
            }
          : {};

      return {
        id: n.id,
        label: n.data.label,
        variant: n.data.variant,
        completed: !!n.data.completed,
        branchId: n.data.branchId,
        val: sizeMap[n.data.variant],
        ...seededPos,
      };
    }

    existingNode.label = n.data.label;
    existingNode.variant = n.data.variant;
    existingNode.completed = !!n.data.completed;
    existingNode.branchId = n.data.branchId;
    existingNode.val = sizeMap[n.data.variant];
    return existingNode;
  });

  const previousLinksByKey = new Map<string, ForceLink>();
  for (const link of previousData?.links ?? []) {
    const sourceId = getForceLinkEndpointId(link.source);
    const targetId = getForceLinkEndpointId(link.target);
    if (!sourceId || !targetId) continue;
    previousLinksByKey.set(`${sourceId}->${targetId}`, link);
  }

  let forceLinks: ForceLink[];

  if (dependencyEdges && dependencyEdges.length > 0) {
    const nodeIdSet = new Set(nodes.map((n) => n.id));

    // Build links from dependency edges
    const depLinks: ForceLink[] = dependencyEdges
      .filter(
        (e) => nodeIdSet.has(e.sourceNodeId) && nodeIdSet.has(e.targetNodeId),
      )
      .map((e) => ({ source: e.sourceNodeId, target: e.targetNodeId }));

    // Nodes with an incoming dependency edge
    const hasIncomingDep = new Set(
      depLinks.map((l) => getForceLinkEndpointId(l.target)).filter(Boolean),
    );

    // Entry-point nodes (no incoming dep edge) get a structural parentId link
    const entryPointLinks: ForceLink[] = nodes
      .filter((n) => n.data.parentId !== null)
      .filter((n) => !hasIncomingDep.has(n.id))
      .filter((n) => nodeIdSet.has(n.data.parentId as string))
      .map((n) => ({ source: n.data.parentId as string, target: n.id }));

    forceLinks = [...depLinks, ...entryPointLinks];
  } else {
    // Fallback: parentId-based links (original behavior)
    forceLinks = nodes
      .filter((n) => n.data.parentId !== null)
      .map((n) => ({ source: n.data.parentId as string, target: n.id }));
  }

  // Reuse previous link objects for force simulation stability
  forceLinks = forceLinks.map((link) => {
    const sourceId = getForceLinkEndpointId(link.source);
    const targetId = getForceLinkEndpointId(link.target);
    if (!sourceId || !targetId) return link;
    const key = `${sourceId}->${targetId}`;
    return previousLinksByKey.get(key) ?? link;
  });

  return { nodes: forceNodes, links: forceLinks };
}
