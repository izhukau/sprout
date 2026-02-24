"use client";

import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import "@xyflow/react/dist/style.css";
import { type GraphNode, graphNodeTypes } from "@/components/graph-node";
import { buildEdgesFromNodes } from "@/lib/graph-utils";
import { getLayoutedElements } from "@/lib/layout";

const FIT_VIEW_OPTIONS = { padding: 0.15 };

const edgeStyle = {
  stroke: "#2A6B30",
  strokeWidth: 1.5,
  strokeDasharray: "6,4",
};

function isStructuralEdge(edge: Edge): boolean {
  return Boolean(
    (edge.data as { isStructural?: boolean } | undefined)?.isStructural,
  );
}

function minimapNodeColor(node: GraphNode): string {
  if (node.data?.completed) return "#2EE84A";
  if (node.data?.locked) return "rgba(61,191,90,0.35)";
  switch (node.data?.variant) {
    case "root":
      return "#2EE84A";
    case "concept":
      return "#1A4D20";
    case "subconcept":
      return "#00FF41";
    default:
      return "#1A4D20";
  }
}

type GraphCanvasProps = {
  nodes: GraphNode[];
  edges?: Edge[];
  onNodeClick?: (nodeId: string) => void;
  expandedNodeId?: string | null;
  onOpenConcept?: (conceptId: string) => void;
  onPaneClick?: () => void;
};

export default function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function GraphCanvasInner({
  nodes: inputNodes,
  edges: inputEdges,
  onNodeClick,
  expandedNodeId,
  onOpenConcept,
  onPaneClick,
}: GraphCanvasProps) {
  const { fitView } = useReactFlow();
  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    const initialEdges = inputEdges ?? buildEdgesFromNodes(inputNodes);
    const nodeById = new Map(inputNodes.map((node) => [node.id, node]));

    const nodesWithNext = inputNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        next: !node.data.completed && !node.data.locked,
      },
    }));

    const styledEdges = initialEdges.map((edge) => {
      const sourceNode = nodeById.get(edge.source);
      const targetNode = nodeById.get(edge.target);
      const isFrontier =
        !isStructuralEdge(edge) &&
        !!sourceNode?.data.completed &&
        !!targetNode &&
        !targetNode.data.completed &&
        !targetNode.data.locked;
      return { ...edge, style: edgeStyle, animated: isFrontier };
    });

    const result = getLayoutedElements(nodesWithNext, styledEdges);
    return { layoutedNodes: result.nodes, layoutedEdges: result.edges };
  }, [inputNodes, inputEdges]);

  const nodesWithExpansion = useMemo(() => {
    const EXPANSION_HEIGHT = 160;
    const expandedNode = expandedNodeId
      ? layoutedNodes.find((n) => n.id === expandedNodeId)
      : null;
    const expandedY = expandedNode?.position.y ?? 0;

    return layoutedNodes.map((node) => {
      const isExpanded = node.id === expandedNodeId;
      const needsShift =
        expandedNode && !isExpanded && node.position.y > expandedY;
      return {
        ...node,
        zIndex: isExpanded ? 1000 : undefined,
        position: needsShift
          ? { ...node.position, y: node.position.y + EXPANSION_HEIGHT }
          : node.position,
        data: {
          ...node.data,
          expanded: isExpanded,
          onOpenConcept,
        },
      };
    });
  }, [layoutedNodes, expandedNodeId, onOpenConcept]);

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithExpansion);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  const prevPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(animFrameRef.current);

    const startPositions = prevPositionsRef.current;

    // First render — no animation needed
    if (startPositions.size === 0) {
      setNodes(nodesWithExpansion);
      prevPositionsRef.current = new Map(
        nodesWithExpansion.map((n) => [n.id, { ...n.position }]),
      );
      return;
    }

    const startTime = performance.now();
    const duration = 300;

    function animate(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - (1 - t) ** 3; // ease-out cubic

      setNodes(
        nodesWithExpansion.map((node) => {
          const from = startPositions.get(node.id) ?? node.position;
          return {
            ...node,
            position: {
              x: from.x + (node.position.x - from.x) * eased,
              y: from.y + (node.position.y - from.y) * eased,
            },
          };
        }),
      );

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        prevPositionsRef.current = new Map(
          nodesWithExpansion.map((n) => [n.id, { ...n.position }]),
        );
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [nodesWithExpansion, setNodes]);

  useEffect(() => {
    setEdges(layoutedEdges);
  }, [layoutedEdges, setEdges]);

  const initialFitDone = useRef(false);

  const handleInit = useCallback(() => {
    if (!initialFitDone.current) {
      initialFitDone.current = true;
      fitView(FIT_VIEW_OPTIONS);
    }
  }, [fitView]);

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    if ((node.data as { locked?: boolean } | undefined)?.locked) return;
    onNodeClick?.(node.id);
  };

  return (
    <div className="h-full w-full bg-[#0A1A0F]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={graphNodeTypes}
        colorMode="dark"
        onInit={handleInit}
      >
        <Background color="rgba(46, 232, 74, 0.08)" gap={24} size={1.5} />
        <Controls
          style={{
            borderRadius: "8px",
            overflow: "hidden",
            border: "1px solid #1E3D24",
          }}
        />
        <MiniMap
          nodeColor={minimapNodeColor}
          maskColor="rgba(10, 26, 15, 0.7)"
          style={{
            backgroundColor: "#0D2010",
            border: "1px solid #1E3D24",
            borderRadius: "8px",
          }}
        />
      </ReactFlow>
    </div>
  );
}
