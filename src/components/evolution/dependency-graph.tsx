"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { GraphNode, GraphEdge } from "@/lib/evolution/types";

interface DepGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface Position { x: number; y: number }

export function DependencyGraph({ nodes, edges }: DepGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<Map<string, Position>>(new Map());
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 800, h: 500 });
  const [selected, setSelected] = useState<string | null>(null);

  // Layout: simple force-directed approximation
  useEffect(() => {
    if (nodes.length === 0) return;
    const layoutPositions = new Map<string, Position>();
    const cx = 400, cy = 250;
    const root = nodes.find((n) => n.id === "root");
    if (root) layoutPositions.set("root", { x: cx, y: cy });

    const children = nodes.filter((n) => n.id !== "root");
    const angleStep = (2 * Math.PI) / Math.max(children.length, 1);
    const radius = Math.min(180, 60 + children.length * 15);

    children.forEach((n, i) => {
      const angle = angleStep * i - Math.PI / 2;
      layoutPositions.set(n.id, {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    });
    // Use a timeout to avoid setState-in-render lint error
    const timer = setTimeout(() => setPositions(layoutPositions), 0);
    return () => clearTimeout(timer);
  }, [nodes]);

  const handleMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const pos = positions.get(nodeId);
    if (!pos || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * viewBox.w + viewBox.x;
    const svgY = ((e.clientY - rect.top) / rect.height) * viewBox.h + viewBox.y;
    setDragOffset({ x: svgX - pos.x, y: svgY - pos.y });
    setDragging(nodeId);
    setSelected(nodeId);
  }, [positions, viewBox]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * viewBox.w + viewBox.x;
    const svgY = ((e.clientY - rect.top) / rect.height) * viewBox.h + viewBox.y;
    setPositions((prev) => {
      const next = new Map(prev);
      next.set(dragging, { x: svgX - dragOffset.x, y: svgY - dragOffset.y });
      return next;
    });
  }, [dragging, dragOffset, viewBox]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox((prev) => {
      const newW = Math.max(200, Math.min(2000, prev.w * zoomFactor));
      const newH = Math.max(150, Math.min(1500, prev.h * zoomFactor));
      const mx = prev.x + prev.w / 2;
      const my = prev.y + prev.h / 2;
      return { x: mx - newW / 2, y: my - newH / 2, w: newW, h: newH };
    });
  }, []);

  const selectedNode = nodes.find((n) => n.id === selected);

  return (
    <div className="evol-graph-container">
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="evol-graph-svg"
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
          </marker>
        </defs>
        {/* Edges */}
        {edges.map((edge) => {
          const src = positions.get(edge.source);
          const tgt = positions.get(edge.target);
          if (!src || !tgt) return null;
          return (
            <line
              key={edge.id}
              x1={src.x} y1={src.y}
              x2={tgt.x} y2={tgt.y}
              stroke={edge.source === "root" ? "#0f8ca3" : "#d1d5db"}
              strokeWidth={Math.max(1, Math.min(4, edge.weight / 5))}
              markerEnd="url(#arrowhead)"
              className="evol-graph-edge"
            />
          );
        })}
        {/* Nodes */}
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const r = node.id === "root" ? 28 : 20;
          const color = node.type === "folder" ? "#0f8ca3" : "#10b981";
          const isSelected = selected === node.id;
          return (
            <g
              key={node.id}
              className="evol-graph-node"
              style={{ cursor: dragging === node.id ? "grabbing" : "grab" }}
              onMouseDown={(e) => handleMouseDown(node.id, e)}
            >
              <circle
                cx={pos.x} cy={pos.y} r={r}
                fill={isSelected ? color : "#fff"}
                stroke={color}
                strokeWidth={isSelected ? 3 : 2}
              />
              <text
                x={pos.x} y={pos.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                className="evol-graph-label"
                fill={isSelected ? "#fff" : "#1f2937"}
                fontSize={node.id === "root" ? 10 : 8}
              >
                {node.label.length > 16 ? node.label.slice(0, 14) + "..." : node.label}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Selected node info */}
      {selectedNode && (
        <div className="evol-graph-info">
          <strong>{selectedNode.label}</strong>
          <span>Type: {selectedNode.type}</span>
          <span>Commits: {selectedNode.commits}</span>
          <span>Contributors: {selectedNode.contributors}</span>
          <span>Activity: {selectedNode.activity}%</span>
        </div>
      )}
    </div>
  );
}