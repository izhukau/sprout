"use client";

import { forceX, forceY } from "d3-force";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { HandSample } from "@/hooks/use-hand-tracking";
import type { GraphNode } from "@/components/graph-node";
import type { BackendBranch, BackendEdge } from "@/lib/backend-api";
import type { ForceLink, ForceNode } from "@/lib/graph-utils";
import { buildBranchColorMap, toForceGraphData } from "@/lib/graph-utils";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

const ROOT_COLOR = "#ffffff";

type ForceGraphViewProps = {
  branches: BackendBranch[];
  nodes: GraphNode[];
  dependencyEdges: BackendEdge[];
  highlightedBranchId: string | null;
  focusedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  handPos?: { x: number; y: number; z: number; pinch: number } | null;
  hands?: HandSample[];
};

export function ForceGraphView({
  branches,
  nodes,
  dependencyEdges,
  highlightedBranchId,
  focusedNodeId,
  onNodeClick,
  handPos,
  hands,
}: ForceGraphViewProps) {
  // biome-ignore lint/suspicious/noExplicitAny: react-force-graph ref type is untyped
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const focusNodeRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const initialFitDone = useRef(false);
  const smoothHandRef = useRef<{ x: number; y: number } | null>(null);
  const targetHandRef = useRef<{ x: number; y: number; pinch: number } | null>(null);
  const smoothRRef = useRef<number>(350);   // current lerped camera radius
  const rafRef = useRef<number | null>(null);
  const highlightedBranchIdRef = useRef(highlightedBranchId);
  const orbitCenterRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const graphDataRef = useRef<{ nodes: ForceNode[]; links: ForceLink[] }>({
    nodes: [],
    links: [],
  });
  const pinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinnedNodeIds = useRef(new Set<string>());
  const handsRef = useRef<HandSample[] | null>(null);
  const grabStateRef = useRef<{
    active: boolean;
    handedness: string | null;
    branchId: string | null;
    nodeIds: string[];
    initialPalm: { x: number; y: number; z: number };
    initialPositions: Map<string, { x: number; y: number; z: number }>;
  }>({
    active: false,
    handedness: null,
    branchId: null,
    nodeIds: [],
    initialPalm: { x: 0.5, y: 0.5, z: 0 },
    initialPositions: new Map(),
  });
  // Smoothed drag offset so node movement isn't jittery
  const smoothGrabOffsetRef = useRef({ x: 0, y: 0, z: 0 });
  const DRAG_SMOOTH_ALPHA = 0.06;
  const MAX_CAPTURE_RADIUS_PX = 140;
  const graphData = useMemo(() => {
    graphDataRef.current = toForceGraphData(nodes, graphDataRef.current, dependencyEdges);
    return graphDataRef.current;
  }, [nodes, dependencyEdges]);

  useEffect(() => {
    handsRef.current = hands ?? null;
  }, [hands]);
  // Pin nodes after settling — preserve existing pins so only new nodes float
  useEffect(() => {
    if (pinTimerRef.current) clearTimeout(pinTimerRef.current);

    // Immediately re-pin already-settled nodes so they don't jump
    for (const n of graphData.nodes) {
      const node = n as ForceNode & { x?: number; y?: number; z?: number; fx?: number; fy?: number; fz?: number };
      if (pinnedNodeIds.current.has(node.id)) {
        if (node.x != null) node.fx = node.x;
        if (node.y != null) node.fy = node.y;
        if (node.z != null) node.fz = node.z;
      }
    }

    // After settling, pin everything including new nodes
    pinTimerRef.current = setTimeout(() => {
      for (const n of graphData.nodes) {
        const node = n as ForceNode & { x?: number; y?: number; z?: number; fx?: number; fy?: number; fz?: number };
        if (node.x != null) node.fx = node.x;
        if (node.y != null) node.fy = node.y;
        if (node.z != null) node.fz = node.z;
        pinnedNodeIds.current.add(node.id);
      }
    }, 500);
    return () => {
      if (pinTimerRef.current) clearTimeout(pinTimerRef.current);
    };
  }, [graphData.nodes]);
  const branchColors = useMemo(() => buildBranchColorMap(branches), [branches]);
  const branchCenters = useMemo(() => {
    const centers = new Map<string, { x: number; y: number }>();
    if (!branches.length) return centers;

    branches.forEach((branch, i) => {
      const angle = (2 * Math.PI * i) / branches.length - Math.PI / 2;
      const radius = 200;
      centers.set(branch.id, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    });
    return centers;
  }, [branches]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      setDimensions({ width: el.clientWidth, height: el.clientHeight });
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Configure branch clustering forces (only when branch layout changes).
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;

    fg.d3Force(
      "x",
      forceX((d: unknown) => {
        const node = d as ForceNode;
        if (!node.branchId) return 0;
        return branchCenters.get(node.branchId)?.x ?? 0;
      }).strength(0.3),
    );

    fg.d3Force(
      "y",
      forceY((d: unknown) => {
        const node = d as ForceNode;
        if (!node.branchId) return 0;
        return branchCenters.get(node.branchId)?.y ?? 0;
      }).strength(0.3),
    );

    fg.d3Force("charge")?.strength(-80);
    fg.d3Force("link")?.distance(40);

    fg.d3ReheatSimulation();
  }, [branchCenters]);

  // Zoom to highlighted branch, centering on the clicked node
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg || !highlightedBranchId) return;

    const focus = focusNodeRef.current;
    if (focus) {
      fg.cameraPosition(
        { x: focus.x, y: focus.y, z: focus.z + 400 },
        { x: focus.x, y: focus.y, z: focus.z },
        600,
      );
      focusNodeRef.current = null;
      return;
    }

    // Fallback: center on branch centroid (e.g. sidebar click)
    const branchNodes = graphData.nodes.filter(
      (n) => n.branchId === highlightedBranchId,
    ) as (ForceNode & { x?: number; y?: number; z?: number })[];

    if (branchNodes.length === 0) return;

    const cx =
      branchNodes.reduce((sum, n) => sum + (n.x ?? 0), 0) / branchNodes.length;
    const cy =
      branchNodes.reduce((sum, n) => sum + (n.y ?? 0), 0) / branchNodes.length;
    const cz =
      branchNodes.reduce((sum, n) => sum + (n.z ?? 0), 0) / branchNodes.length;

    fg.cameraPosition(
      { x: cx, y: cy, z: cz + 400 },
      { x: cx, y: cy, z: cz },
      600,
    );
  }, [highlightedBranchId, graphData.nodes]);

  // Reset zoom when no branch is highlighted
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg || highlightedBranchId) return;

    fg.zoomToFit(600, 0);
  }, [highlightedBranchId]);

  // Keep refs current so the rAF loop always reads fresh values without restarts
  useEffect(() => {
    highlightedBranchIdRef.current = highlightedBranchId;
  }, [highlightedBranchId]);

  // Orbit center for hand tracking: origin when no branch, branch centroid when selected
  useEffect(() => {
    if (!highlightedBranchId) {
      orbitCenterRef.current = { x: 0, y: 0, z: 0 };
      return;
    }
    const branchNodes = graphData.nodes.filter(
      (n) => n.branchId === highlightedBranchId,
    ) as (ForceNode & { x?: number; y?: number; z?: number })[];
    if (branchNodes.length === 0) {
      orbitCenterRef.current = { x: 0, y: 0, z: 0 };
      return;
    }
    const cx =
      branchNodes.reduce((sum, n) => sum + (n.x ?? 0), 0) / branchNodes.length;
    const cy =
      branchNodes.reduce((sum, n) => sum + (n.y ?? 0), 0) / branchNodes.length;
    const cz =
      branchNodes.reduce((sum, n) => sum + (n.z ?? 0), 0) / branchNodes.length;
    orbitCenterRef.current = { x: cx, y: cy, z: cz };
  }, [highlightedBranchId, graphData.nodes]);

  useEffect(() => {
    targetHandRef.current = handPos
      ? { x: handPos.x, y: handPos.y, pinch: handPos.pinch }
      : null;
    if (!handPos) smoothHandRef.current = null; // reset on hand loss
  }, [handPos]);

  // rAF loop — lerps camera at 60fps toward target (works for both global and branch-selected views)
  useEffect(() => {
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);

      const fg = graphRef.current;
      if (!fg) return;

      const center = orbitCenterRef.current;
      const handsSnapshot = handsRef.current ?? [];
      const grabState = grabStateRef.current;

      // Only one grab active at a time. When a grab is already active, only
      // the hand that started it is acknowledged; a second open palm is ignored.
      const allGrabbingHands = handsSnapshot.filter((h) => h.is_grabbing);
      const grabHand = grabState.active
        ? (allGrabbingHands.find((h) => h.handedness === grabState.handedness) ?? null)
        : (allGrabbingHands[0] ?? null);

      const nodesWithCoords = graphDataRef.current
        .nodes as (ForceNode & {
        x?: number;
        y?: number;
        z?: number;
        fx?: number;
        fy?: number;
        fz?: number;
      })[];

      // BFS over links to collect only subconcept node IDs reachable from this concept.
      // Only subconcepts are moved with the main node; other concepts/roots are never included.
      const collectSubconceptIds = (conceptNodeId: string): string[] => {
        const found = new Set<string>();
        const queue = [conceptNodeId];
        const nodesById = new Map(
          graphDataRef.current.nodes.map((n) => [n.id, n as ForceNode]),
        );
        while (queue.length > 0) {
          const cur = queue.shift()!;
          for (const link of graphDataRef.current.links) {
            const src =
              typeof link.source === "object" && link.source !== null
                ? ((link.source as Record<string, unknown>).id as string | undefined) ?? ""
                : (link.source as string);
            const tgt =
              typeof link.target === "object" && link.target !== null
                ? ((link.target as Record<string, unknown>).id as string | undefined) ?? ""
                : (link.target as string);
            if (src !== cur || !tgt || found.has(tgt)) continue;
            const node = nodesById.get(tgt);
            if (node?.variant !== "subconcept") continue;
            found.add(tgt);
            queue.push(tgt);
          }
        }
        return Array.from(found);
      };

      // Start a new grab when a hand first enters grabbing state
      if (grabHand && !grabState.active) {
        const palm = {
          x: grabHand.palm_x,
          y: grabHand.palm_y,
          z: grabHand.palm_z,
        };

        // Grabbable nodes: root (white topic) and concept (large coloured) nodes only
        const mainNodes = nodesWithCoords.filter(
          (n) => n.variant === "root" || n.variant === "concept",
        );

        if (mainNodes.length > 0) {
          // Convert palm's normalised position to screen pixels, then project
          // each candidate node to screen space and pick the nearest one.
          // This is camera-aware (zoom, rotation, pan) — far more accurate than
          // any world-space approximation.
          const containerEl = containerRef.current;
          const screenW = containerEl?.clientWidth ?? 1280;
          const screenH = containerEl?.clientHeight ?? 800;
          const palmScreenX = palm.x * screenW;
          const palmScreenY = palm.y * screenH;

          let bestNode = mainNodes[0];
          let bestDist = Number.POSITIVE_INFINITY;
          for (const node of mainNodes) {
            const sp = fg.graph2ScreenCoords(
              node.x ?? 0,
              node.y ?? 0,
              node.z ?? 0,
            );
            const dx = sp.x - palmScreenX;
            const dy = sp.y - palmScreenY;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestDist) {
              bestDist = d2;
              bestNode = node;
            }
          }

          // Only capture if palm is actually over a main node (single closest one)
          const maxCaptureD2 = MAX_CAPTURE_RADIUS_PX * MAX_CAPTURE_RADIUS_PX;
          if (bestDist > maxCaptureD2) {
            // Palm not near any main node — don't start grab
          } else {
            // Root/topic: only that node. Concept: that node + only its subconcepts (never other concepts/roots).
            const idsToMove: string[] =
              bestNode.variant === "root"
                ? [bestNode.id]
                : [bestNode.id, ...collectSubconceptIds(bestNode.id)];

            const initialPositions = new Map<
              string,
              { x: number; y: number; z: number }
            >();
            for (const node of nodesWithCoords) {
              if (!idsToMove.includes(node.id)) continue;
              initialPositions.set(node.id, {
                x: node.x ?? 0,
                y: node.y ?? 0,
                z: node.z ?? 0,
              });
            }

            grabStateRef.current = {
              active: true,
              handedness: grabHand.handedness,
              branchId: bestNode.branchId ?? null,
              nodeIds: idsToMove,
              initialPalm: palm,
              initialPositions,
            };

            // Wake the force engine so it starts applying the new fixed positions
            if (typeof fg.d3ReheatSimulation === "function") {
              fg.d3ReheatSimulation();
            }
            smoothGrabOffsetRef.current = { x: 0, y: 0, z: 0 };
          }
        }
      } else if (!grabHand && grabState.active) {
        // Grabbing hand released — freeze nodes in place and clear grab state
        grabStateRef.current = {
          active: false,
          handedness: null,
          branchId: null,
          nodeIds: [],
          initialPalm: grabState.initialPalm,
          initialPositions: new Map(),
        };
      } else if (grabHand && grabState.active) {
        // Continue dragging: palm delta → world offset, then smooth and apply
        const palm = {
          x: grabHand.palm_x,
          y: grabHand.palm_y,
          z: grabHand.palm_z,
        };

        const dxNorm = palm.x - grabState.initialPalm.x;
        const dyNorm = palm.y - grabState.initialPalm.y;
        const dzNorm = palm.z - grabState.initialPalm.z;

        const scaleXY = 800;
        const scaleZ = -1200;

        const dxWorld = dxNorm * scaleXY;
        const dyWorld = -dyNorm * scaleXY;
        const dzWorld = dzNorm * scaleZ;

        const smooth = smoothGrabOffsetRef.current;
        smoothGrabOffsetRef.current = {
          x: smooth.x + (dxWorld - smooth.x) * DRAG_SMOOTH_ALPHA,
          y: smooth.y + (dyWorld - smooth.y) * DRAG_SMOOTH_ALPHA,
          z: smooth.z + (dzWorld - smooth.z) * DRAG_SMOOTH_ALPHA,
        };
        const dx = smoothGrabOffsetRef.current.x;
        const dy = smoothGrabOffsetRef.current.y;
        const dz = smoothGrabOffsetRef.current.z;

        for (const node of nodesWithCoords) {
          if (!grabState.nodeIds.includes(node.id)) continue;
          const base = grabState.initialPositions.get(node.id);
          if (!base) continue;

          node.fx = base.x + dx;
          node.fy = base.y + dy;
          node.fz = base.z + dz;

          (node as { x: number; y: number; z: number }).x = node.fx;
          (node as { x: number; y: number; z: number }).y = node.fy;
          (node as { x: number; y: number; z: number }).z = node.fz;
        }

        if (typeof fg.d3ReheatSimulation === "function") {
          fg.d3ReheatSimulation();
        }
      }

      // Camera orbit — only when a non-grabbing hand is providing a target.
      // If all hands are grabbing (or no hand is present), camera stays frozen
      // so the drag motion isn't fought by simultaneous orbit movement.
      const target = targetHandRef.current;
      if (!target) return;

      // Lerp smoothed x/y toward target each frame
      if (!smoothHandRef.current) {
        smoothHandRef.current = { x: target.x, y: target.y };
      } else {
        smoothHandRef.current.x += (target.x - smoothHandRef.current.x) * 0.06;
        smoothHandRef.current.y += (target.y - smoothHandRef.current.y) * 0.06;
      }

      // Map pinch distance [0.02, 0.35] → camera radius [80, 550]
      const clampedPinch = Math.max(0.02, Math.min(0.35, target.pinch));
      const targetR = 80 + ((clampedPinch - 0.02) / (0.35 - 0.02)) * 470;
      smoothRRef.current += (targetR - smoothRRef.current) * 0.05;
      const r = smoothRRef.current;

      const theta = (smoothHandRef.current.x - 0.5) * 2 * Math.PI;
      const phi = (0.5 - smoothHandRef.current.y) * (Math.PI / 3);

      // duration=0: we own the interpolation, no queued transitions
      // Orbit around center (origin when no branch, branch centroid when selected)
      fg.cameraPosition(
        {
          x: center.x + r * Math.cos(phi) * Math.sin(theta),
          y: center.y + r * Math.sin(phi),
          z: center.z + r * Math.cos(phi) * Math.cos(theta),
        },
        { x: center.x, y: center.y, z: center.z },
        0,
      );
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []); // runs once, reads all live state via refs

  const focusAndSelect = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: force-graph node type
    (node: any) => {
      const fg = graphRef.current;
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const z = node.z ?? 0;

      if (fg) {
        fg.cameraPosition({ x, y, z: z + 150 }, { x, y, z }, 600);
      }

      focusNodeRef.current = { x, y, z };
      onNodeClick(node.id);
    },
    [onNodeClick],
  );

  // Track drag start position to detect micro-drags (accidental)
  const dragStartRef = useRef<{ x: number; y: number; z: number } | null>(null);

  const handleNodeDrag = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: force-graph node type
    (node: any) => {
      if (!dragStartRef.current) {
        dragStartRef.current = {
          x: node.x ?? 0,
          y: node.y ?? 0,
          z: node.z ?? 0,
        };
      }
    },
    [],
  );

  const handleNodeDragEnd = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: force-graph node type
    (node: any) => {
      const start = dragStartRef.current;
      dragStartRef.current = null;
      if (!start) return;

      const dx = (node.x ?? 0) - start.x;
      const dy = (node.y ?? 0) - start.y;
      const dz = (node.z ?? 0) - start.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // If barely moved, treat as a click
      if (dist < 5) {
        focusAndSelect(node);
      }
    },
    [focusAndSelect],
  );

  const nodeThreeObject = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: force-graph node type
    (node: any) => {
      const { variant, completed, branchId } = node as ForceNode;
      const isHighlighted =
        !highlightedBranchId || branchId === highlightedBranchId;

      // Fully hide nodes from other branches
      if (!isHighlighted) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0, 0, 0),
          new THREE.MeshBasicMaterial(),
        );
        mesh.visible = false;
        return mesh;
      }

      const radius = variant === "root" ? 3 : variant === "concept" ? 2 : 1;
      const nodeBranchColors = branchId ? branchColors.get(branchId) : null;
      const color =
        variant === "root"
          ? ROOT_COLOR
          : (nodeBranchColors?.[variant] ?? ROOT_COLOR);
      const opacity = completed ? 1 : 0.6;

      const isFocused = node.id === focusedNodeId;
      const geometry = new THREE.SphereGeometry(radius, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity,
        emissive: isFocused
          ? new THREE.Color(color)
          : new THREE.Color(0x000000),
        emissiveIntensity: isFocused ? 0.6 : 0,
      });
      const mesh = new THREE.Mesh(geometry, material);

      // Label sprite — always for root/concept, subconcepts only when branch is focused
      const showLabel =
        variant !== "subconcept" ||
        (highlightedBranchId && branchId === highlightedBranchId);
      if (showLabel) {
        const { label } = node as ForceNode;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.height = 64;
          ctx.font = "24px monospace";
          const textWidth = ctx.measureText(label).width;
          canvas.width = textWidth + 32;
          // Re-apply after canvas resize (resize resets context state)
          ctx.font = "24px monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.8})`;
          ctx.fillText(label, canvas.width / 2, 40);

          const texture = new THREE.CanvasTexture(canvas);
          const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
          });
          const sprite = new THREE.Sprite(spriteMaterial);
          sprite.scale.set(canvas.width / 16, 4, 1);
          sprite.position.set(0, -(radius + 3), 0);
          mesh.add(sprite);
        }
      }

      return mesh;
    },
    [highlightedBranchId, focusedNodeId, branchColors],
  );

  const linkColor = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: force-graph link type
    (link: any) => {
      if (!highlightedBranchId) return "rgba(255, 255, 255, 0.06)";

      const sourceNode = typeof link.source === "object" ? link.source : null;
      const targetNode = typeof link.target === "object" ? link.target : null;

      if (!sourceNode || !targetNode) return "rgba(255, 255, 255, 0.02)";

      const sourceInBranch = sourceNode.branchId === highlightedBranchId;
      const targetInBranch = targetNode.branchId === highlightedBranchId;

      if (sourceInBranch && targetInBranch) return "rgba(255, 255, 255, 0.15)";
      return "rgba(0, 0, 0, 0)";
    },
    [highlightedBranchId],
  );

  if (dimensions.width === 0)
    return <div ref={containerRef} className="h-full w-full" />;

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#0A1A0F"
        nodeThreeObject={nodeThreeObject}
        onNodeClick={focusAndSelect}
        onNodeDrag={handleNodeDrag}
        onNodeDragEnd={handleNodeDragEnd}
        onEngineStop={() => {
          if (!initialFitDone.current) {
            initialFitDone.current = true;
            graphRef.current?.zoomToFit(600, 50);
          }
        }}
        linkColor={linkColor}
        linkWidth={1}
        linkOpacity={0.6}
        cooldownTicks={100}
        d3AlphaDecay={0.08}
        enableNodeDrag={true}
      />
      {/* Palm-grab progress indicators — one ring per hand in open-palm or grabbing state */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {(hands ?? [])
          .filter((h) => h.is_open_palm || h.is_grabbing)
          .map((h) => {
            const cx = h.palm_x * 100;
            const cy = h.palm_y * 100;
            const progress = Math.min(h.palm_hold_duration / 3.0, 1);
            const r = 22;
            const circ = 2 * Math.PI * r;
            const dashOffset = circ * (1 - progress);
            const color = h.is_grabbing ? "#4ade80" : "#facc15";
            return (
              <svg
                key={h.hand}
                className="absolute overflow-visible"
                style={{
                  left: `${cx}%`,
                  top: `${cy}%`,
                  transform: "translate(-50%, -50%)",
                }}
                width={60}
                height={60}
                viewBox="-30 -30 60 60"
              >
                {/* Faint track ring */}
                <circle
                  cx={0}
                  cy={0}
                  r={r}
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={3}
                />
                {/* Progress arc — fills clockwise from 12 o'clock */}
                <circle
                  cx={0}
                  cy={0}
                  r={r}
                  fill="none"
                  stroke={color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90)"
                />
                {/* Centre dot */}
                <circle cx={0} cy={0} r={5} fill={color} />
              </svg>
            );
          })}
      </div>
    </div>
  );
}
