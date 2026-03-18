'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useFluxStore } from '@/hooks/use-flux-store';
import { createNodeFromDefinition, getNodeDefinitionsByCategory, NODE_TYPE_COLORS, DATA_TYPE_COLORS } from '@/lib/nodes/definitions';
import { generateId } from '@/lib/utils';
import type { FluxNode, NodeCategory, NodeConnection } from '@/types';

export function NodeGraphEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentGraph = useFluxStore((s) => s.currentGraph);
  const setCurrentGraph = useFluxStore((s) => s.setCurrentGraph);
  const addNodeToGraph = useFluxStore((s) => s.addNodeToGraph);
  const removeNodeFromGraph = useFluxStore((s) => s.removeNodeFromGraph);
  const updateNodeInGraph = useFluxStore((s) => s.updateNodeInGraph);
  const addConnectionToGraph = useFluxStore((s) => s.addConnectionToGraph);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 200, y: 200 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  const categories = getNodeDefinitionsByCategory();

  function initGraph() {
    setCurrentGraph({
      id: generateId(), name: 'New Workflow', nodes: [], connections: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
  }

  function addNode(type: string, x: number, y: number) {
    const node = createNodeFromDefinition(type, { x: x - panOffset.x, y: y - panOffset.y });
    if (node) addNodeToGraph(node);
    setShowAddMenu(false);
  }

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentGraph) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.clientWidth * 2;
    canvas.height = canvas.clientHeight * 2;
    ctx.scale(2, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;

    ctx.fillStyle = '#0c0c0f';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    const gridSize = 30;
    for (let x = panOffset.x % gridSize; x < w; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = panOffset.y % gridSize; y < h; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // Connections
    for (const conn of currentGraph.connections) {
      const srcNode = currentGraph.nodes.find((n) => n.id === conn.sourceNodeId);
      const tgtNode = currentGraph.nodes.find((n) => n.id === conn.targetNodeId);
      if (!srcNode || !tgtNode) continue;
      const sx = srcNode.position.x + panOffset.x + 160;
      const sy = srcNode.position.y + panOffset.y + 30;
      const tx = tgtNode.position.x + panOffset.x;
      const ty = tgtNode.position.y + panOffset.y + 30;
      ctx.strokeStyle = 'rgba(100,100,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(sx + 60, sy, tx - 60, ty, tx, ty);
      ctx.stroke();
    }

    // Nodes
    for (const node of currentGraph.nodes) {
      const nx = node.position.x + panOffset.x;
      const ny = node.position.y + panOffset.y;
      const nw = 160, nh = 24 + Math.max(node.inputs.length, node.outputs.length) * 18 + 12;
      const color = NODE_TYPE_COLORS[node.category] || '#555';

      ctx.fillStyle = '#1a1a20';
      ctx.strokeStyle = selectedNodeId === node.id ? '#6366f1' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = selectedNodeId === node.id ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(nx, ny, nw, nh, 6);
      ctx.fill(); ctx.stroke();

      // Header
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(nx, ny, nw, 22, [6, 6, 0, 0]);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '10px Inter';
      ctx.fillText(node.label, nx + 8, ny + 15);

      // Ports
      node.inputs.forEach((port, i) => {
        const py = ny + 30 + i * 18;
        ctx.fillStyle = DATA_TYPE_COLORS[port.type] || '#888';
        ctx.beginPath(); ctx.arc(nx, py, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '9px Inter';
        ctx.fillText(port.name, nx + 10, py + 3);
      });
      node.outputs.forEach((port, i) => {
        const py = ny + 30 + i * 18;
        ctx.fillStyle = DATA_TYPE_COLORS[port.type] || '#888';
        ctx.beginPath(); ctx.arc(nx + nw, py, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '9px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(port.name, nx + nw - 10, py + 3);
        ctx.textAlign = 'left';
      });
    }

    if (currentGraph.nodes.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.font = '13px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Right-click to add nodes', w / 2, h / 2);
      ctx.textAlign = 'left';
    }
  }, [currentGraph, panOffset, selectedNodeId]);

  useEffect(() => { render(); }, [render]);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowAddMenu(true);
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (isPanning) {
      setPanOffset((p) => ({ x: p.x + e.clientX - lastMouse.x, y: p.y + e.clientY - lastMouse.y }));
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  }

  function handleMouseUp() { setIsPanning(false); }

  if (!currentGraph) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center"><p className="text-white/20 mb-3">No workflow loaded</p><button onClick={initGraph} className="fx-btn-primary">Create Workflow</button></div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onContextMenu={handleContextMenu}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={() => { setShowAddMenu(false); setSelectedNodeId(null); }}
      />

      {showAddMenu && (
        <div className="fixed z-50 bg-[#1a1a20] border border-white/10 rounded-lg shadow-xl py-1 max-h-96 overflow-y-auto w-52" style={{ left: menuPosition.x, top: menuPosition.y }}>
          {(Object.entries(categories) as [NodeCategory, any[]][]).map(([cat, defs]) => (
            defs.length > 0 && (
              <div key={cat}>
                <div className="px-3 py-1 text-[9px] text-white/30 uppercase tracking-wider">{cat}</div>
                {defs.map((def: any) => (
                  <button key={def.type} onClick={() => addNode(def.type, menuPosition.x, menuPosition.y)} className="w-full text-left px-3 py-1 text-xs text-white/60 hover:bg-white/5 hover:text-white transition">
                    {def.label}
                  </button>
                ))}
              </div>
            )
          ))}
        </div>
      )}

      <div className="absolute top-3 left-3 flex gap-1.5">
        <span className="px-2 py-1 rounded bg-white/5 text-[10px] text-white/30">{currentGraph.nodes.length} nodes</span>
        <span className="px-2 py-1 rounded bg-white/5 text-[10px] text-white/30">{currentGraph.connections.length} links</span>
      </div>
    </div>
  );
}
