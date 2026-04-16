import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node as FlowNode,
  MiniMap,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FlaskConical, Workflow } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  PRODUCT_MARKETING_KIT_EDGES,
  PRODUCT_MARKETING_KIT_NAME,
  PRODUCT_MARKETING_KIT_NODES,
} from "../../lib/sampleWorkflows";
import { useWorkflowStore } from "../../stores/workflowStore";
import { NodeType } from "../../types/workflow";
import { CropImageNode } from "../nodes/CropImageNode";
import { ExtractFrameNode } from "../nodes/ExtractFrameNode";
import { RunLLMNode } from "../nodes/RunLLMNode";
import { TextNode } from "../nodes/TextNode";
import { UploadImageNode } from "../nodes/UploadImageNode";
import { UploadVideoNode } from "../nodes/UploadVideoNode";
import { CustomConnectionLine } from "./ConnectionLine";

// ─── Type Compatibility ───────────────────────────────────────────────────────

const HANDLE_OUTPUT_TYPE: Record<string, string> = {
  "text-out": "text",
  "image-out": "image",
  "video-out": "video",
};

const HANDLE_INPUT_ACCEPTS: Record<string, string[]> = {
  "system-prompt-in": ["text"],
  "user-message-in": ["text"],
  "text-in": ["text"],
  "x-in": ["text"],
  "y-in": ["text"],
  "width-in": ["text"],
  "height-in": ["text"],
  "timestamp-in": ["text"],
  "image-in": ["image"],
  "images-in": ["image"],
  "video-in": ["video"],
};

function isConnectionValid(
  sourceHandle: string | null,
  targetHandle: string | null,
): boolean {
  if (!sourceHandle || !targetHandle) return true;
  // Support prefixed handles like "image-in-0"
  const normalizedTarget =
    Object.keys(HANDLE_INPUT_ACCEPTS).find((k) =>
      (targetHandle ?? "").startsWith(k.replace(/-\d+$/, "")),
    ) ?? targetHandle;
  const outputType = HANDLE_OUTPUT_TYPE[sourceHandle] ?? "any";
  const accepted = HANDLE_INPUT_ACCEPTS[normalizedTarget] ?? ["any"];
  return accepted.includes(outputType);
}

// ─── Node Types Registry ──────────────────────────────────────────────────────

const nodeTypes = {
  [NodeType.text]: TextNode,
  [NodeType.uploadImage]: UploadImageNode,
  [NodeType.uploadVideo]: UploadVideoNode,
  [NodeType.runLLM]: RunLLMNode,
  [NodeType.cropImage]: CropImageNode,
  [NodeType.extractFrame]: ExtractFrameNode,
};

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

function NodeContextMenu({
  menu,
  onDelete,
  onClose,
}: {
  menu: ContextMenuState;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement))
        onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", top: menu.y, left: menu.x, zIndex: 1000 }}
      className="bg-popover border border-border rounded-lg shadow-[0_8px_32px_oklch(0_0_0/0.5)] py-1 min-w-[140px] animate-scale-in"
      data-ocid="canvas.context_menu"
    >
      <button
        type="button"
        onClick={() => {
          onDelete(menu.nodeId);
          onClose();
        }}
        className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2 transition-colors"
        data-ocid="canvas.delete_button"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 15 15"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5.5 1h4a.5.5 0 0 1 .5.5V3H5V1.5a.5.5 0 0 1 .5-.5ZM4 3V1.5A1.5 1.5 0 0 1 5.5 0h4A1.5 1.5 0 0 1 11 1.5V3h2.5a.5.5 0 0 1 0 1H13v9.5A1.5 1.5 0 0 1 11.5 15h-8A1.5 1.5 0 0 1 2 13.5V4H1.5a.5.5 0 0 1 0-1H4Zm1 1H3v9.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V4H5ZM6 6.5a.5.5 0 0 0-1 0v5a.5.5 0 0 0 1 0v-5Zm2 0a.5.5 0 0 0-1 0v5a.5.5 0 0 0 1 0v-5Zm2 0a.5.5 0 0 0-1 0v5a.5.5 0 0 0 1 0v-5Z"
            fill="currentColor"
          />
        </svg>
        Delete Node
      </button>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function CanvasEmptyState({ onLoadSample }: { onLoadSample: () => void }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10"
      data-ocid="canvas.empty_state"
    >
      <div className="pointer-events-auto flex flex-col items-center gap-5 text-center max-w-xs">
        <div className="w-16 h-16 rounded-2xl bg-card/60 border border-border/60 flex items-center justify-center backdrop-blur-sm">
          <Workflow size={28} className="text-muted-foreground/60" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-foreground">
            Your canvas is empty
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Drag a node from the sidebar to get started, or load the sample
            workflow below.
          </p>
        </div>
        <button
          type="button"
          onClick={onLoadSample}
          data-ocid="canvas.load_sample_button"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 hover:border-accent/60 transition-all duration-200"
        >
          <FlaskConical size={15} />
          Load Sample Workflow
        </button>
      </div>
    </div>
  );
}

// ─── Main Canvas ──────────────────────────────────────────────────────────────

let nodeIdCounter = 1;
function generateNodeId(): string {
  return `node-${Date.now()}-${nodeIdCounter++}`;
}

export function WorkflowCanvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect: storeOnConnect,
    addNode,
    removeNode,
    setNodes,
    setEdges,
    setCurrentWorkflowName,
    undo,
    redo,
  } = useWorkflowStore();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const handleLoadSample = useCallback(() => {
    setNodes(PRODUCT_MARKETING_KIT_NODES);
    setEdges(PRODUCT_MARKETING_KIT_EDGES);
    setCurrentWorkflowName(PRODUCT_MARKETING_KIT_NAME);
  }, [setNodes, setEdges, setCurrentWorkflowName]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const active = document.activeElement;
      const isEditing =
        active?.tagName === "INPUT" ||
        active?.tagName === "TEXTAREA" ||
        (active as HTMLElement)?.isContentEditable;
      if (isEditing) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  // ── Connection validation ──
  const handleConnect = useCallback(
    (connection: Parameters<typeof storeOnConnect>[0]) => {
      const { source, target, sourceHandle, targetHandle } = connection;
      if (!source || !target) return;

      if (!isConnectionValid(sourceHandle ?? null, targetHandle ?? null)) {
        toast.error("Invalid connection: incompatible handle types", {
          description: `Cannot connect ${sourceHandle ?? "output"} to ${targetHandle ?? "input"}`,
        });
        return;
      }

      const edgesBefore = useWorkflowStore.getState().edges.length;
      storeOnConnect(connection);
      const edgesAfter = useWorkflowStore.getState().edges.length;
      if (edgesAfter === edgesBefore) {
        toast.error("Cannot create cycle", {
          description: "This connection would create a loop in the workflow.",
        });
      }
    },
    [storeOnConnect],
  );

  // ── Drag-and-drop from sidebar ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData(
        "application/nextflow-node",
      ) as NodeType;
      if (!nodeType) return;

      const wrapper = reactFlowWrapper.current;
      if (!wrapper) return;
      const bounds = wrapper.getBoundingClientRect();

      const x = e.clientX - bounds.left;
      const y = e.clientY - bounds.top;

      const vpEl = wrapper.querySelector(
        ".react-flow__viewport",
      ) as HTMLElement | null;
      let flowX = x;
      let flowY = y;
      if (vpEl) {
        const style = window.getComputedStyle(vpEl);
        const matrix = new DOMMatrix(style.transform);
        flowX = (x - matrix.m41) / matrix.m11;
        flowY = (y - matrix.m42) / matrix.m22;
      }

      const id = generateNodeId();
      addNode({
        id,
        type: nodeType,
        position: { x: flowX - 140, y: flowY - 40 },
        data: {},
      });
    },
    [addNode],
  );

  // ── Node context menu ──
  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: FlowNode) => {
      e.preventDefault();
      setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const isEmpty = nodes.length === 0;

  return (
    <div
      ref={reactFlowWrapper}
      className="w-full h-full relative"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-ocid="workflow.canvas"
    >
      {isEmpty && <CanvasEmptyState onLoadSample={handleLoadSample} />}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        connectionLineComponent={CustomConnectionLine}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={() => setContextMenu(null)}
        minZoom={0.3}
        maxZoom={2}
        fitView
        deleteKeyCode="Delete"
        style={{ background: "oklch(0.09 0 0)" }}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: "oklch(0.68 0.19 305)", strokeWidth: 2 },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={32}
          size={1.2}
          color="oklch(0.3 0.04 200 / 0.5)"
        />
        <Controls
          className="react-flow__controls--dark"
          showInteractive={false}
          style={{
            background: "oklch(0.15 0 0)",
            border: "1px solid oklch(0.22 0.06 200)",
            borderRadius: "8px",
          }}
        />
        <MiniMap
          style={{
            background: "oklch(0.12 0 0)",
            border: "1px solid oklch(0.22 0.06 200)",
            borderRadius: "8px",
          }}
          nodeColor={(n: FlowNode) => {
            const typeColors: Record<string, string> = {
              [NodeType.text]: "oklch(0.65 0.15 240)",
              [NodeType.uploadImage]: "oklch(0.65 0.18 155)",
              [NodeType.uploadVideo]: "oklch(0.65 0.15 280)",
              [NodeType.runLLM]: "oklch(0.65 0.21 200)",
              [NodeType.cropImage]: "oklch(0.65 0.18 70)",
              [NodeType.extractFrame]: "oklch(0.65 0.19 22)",
            };
            return typeColors[n.type ?? ""] ?? "oklch(0.55 0 0)";
          }}
          maskColor="oklch(0.09 0 0 / 0.6)"
        />
      </ReactFlow>

      {contextMenu && (
        <NodeContextMenu
          menu={contextMenu}
          onDelete={removeNode}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Undo/Redo hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 border border-border backdrop-blur-sm text-xs text-muted-foreground">
          <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">
            ⌘Z
          </kbd>
          <span>Undo</span>
          <span className="text-border">·</span>
          <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">
            ⌘⇧Z
          </kbd>
          <span>Redo</span>
          <span className="text-border">·</span>
          <span>Right-click node to delete</span>
        </div>
      </div>
    </div>
  );
}
