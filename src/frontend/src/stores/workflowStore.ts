import type { Edge, Node } from "@xyflow/react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  addEdge as rfAddEdge,
} from "@xyflow/react";
import type { Connection, EdgeChange, NodeChange } from "@xyflow/react";
import { create } from "zustand";
import type {
  FlowEdge,
  FlowNode,
  Workflow,
  WorkflowSummary,
} from "../types/workflow";

// History snapshot
interface HistorySnapshot {
  nodes: Node[];
  edges: Edge[];
}

export type NodeExecutionStatus = "idle" | "running" | "success" | "error";

interface WorkflowState {
  workflows: WorkflowSummary[];
  currentWorkflow: Workflow | null;
  currentWorkflowName: string;
  nodes: Node[];
  edges: Edge[];
  isExecuting: boolean;
  isSidebarOpen: boolean;
  nodeSearchQuery: string;

  /** Real-time execution status per node, updated by the execution engine */
  nodeExecutionStatus: Record<string, NodeExecutionStatus>;

  // History for undo/redo
  historyStack: HistorySnapshot[];
  historyIndex: number;

  // Actions
  setWorkflows: (workflows: WorkflowSummary[]) => void;
  setCurrentWorkflow: (workflow: Workflow | null) => void;
  setCurrentWorkflowName: (name: string) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: FlowNode) => void;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  addEdge: (edge: FlowEdge) => void;
  removeEdge: (id: string) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  setNodeExecutionStatus: (nodeId: string, status: NodeExecutionStatus) => void;
  clearNodeExecutionStatuses: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setNodeSearchQuery: (query: string) => void;
  resetCanvas: () => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

/** Detect cycles in a directed graph using DFS. Returns true if adding
 *  the edge source→target would create a cycle. */
function wouldCreateCycle(
  nodes: Node[],
  edges: Edge[],
  sourceId: string,
  targetId: string,
): boolean {
  // Build adjacency list
  const adj: Map<string, string[]> = new Map();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    const list = adj.get(e.source);
    if (list) list.push(e.target);
  }
  // Add the new edge temporarily
  const srcList = adj.get(sourceId);
  if (srcList) srcList.push(targetId);
  // DFS from targetId — if we reach sourceId, there's a cycle
  const visited = new Set<string>();
  const stack = [targetId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const neighbors = adj.get(current) ?? [];
    for (const n of neighbors) stack.push(n);
  }
  return false;
}

function snapshot(nodes: Node[], edges: Edge[]): HistorySnapshot {
  return { nodes: [...nodes], edges: [...edges] };
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  currentWorkflow: null,
  currentWorkflowName: "Untitled Workflow",
  nodes: [],
  edges: [],
  isExecuting: false,
  isSidebarOpen: true,
  nodeSearchQuery: "",
  nodeExecutionStatus: {},
  historyStack: [],
  historyIndex: -1,

  setWorkflows: (workflows) => set({ workflows }),

  setCurrentWorkflow: (currentWorkflow) => {
    const nodes: Node[] = currentWorkflow
      ? currentWorkflow.nodes.map((n) => ({
          id: n.id,
          type: n.nodeType,
          position: n.position,
          data: JSON.parse(n.data.config || "{}") as Record<string, unknown>,
        }))
      : [];
    const edges: Edge[] = currentWorkflow
      ? currentWorkflow.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? undefined,
          targetHandle: e.targetHandle ?? undefined,
          animated: true,
          style: { stroke: "oklch(0.68 0.19 305)", strokeWidth: 2 },
        }))
      : [];
    set({
      currentWorkflow,
      currentWorkflowName: currentWorkflow?.name ?? "Untitled Workflow",
      nodes,
      edges,
      historyStack: [snapshot(nodes, edges)],
      historyIndex: 0,
    });
  },

  setCurrentWorkflowName: (currentWorkflowName) => set({ currentWorkflowName }),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },

  onConnect: (connection) => {
    const state = get();
    if (!connection.source || !connection.target) return;
    if (
      wouldCreateCycle(
        state.nodes,
        state.edges,
        connection.source,
        connection.target,
      )
    ) {
      // Caller handles toast
      return;
    }
    const newEdge: Edge = {
      ...connection,
      id: `edge-${connection.source}-${connection.sourceHandle ?? "out"}-${connection.target}-${connection.targetHandle ?? "in"}`,
      animated: true,
      style: { stroke: "oklch(0.68 0.19 305)", strokeWidth: 2 },
    };
    set((state) => ({
      edges: rfAddEdge(newEdge, state.edges),
    }));
    get().pushHistory();
  },

  addNode: (node) => {
    set((state) => ({
      nodes: [
        ...state.nodes,
        {
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
        } as Node,
      ],
    }));
    get().pushHistory();
  },

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
    }));
    get().pushHistory();
  },

  updateNodeData: (id, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
      ),
    }));
  },

  addEdge: (edge) => {
    set((state) => ({
      edges: [
        ...state.edges,
        {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? undefined,
          targetHandle: edge.targetHandle ?? undefined,
          animated: true,
          style: { stroke: "oklch(0.68 0.19 305)", strokeWidth: 2 },
        } as Edge,
      ],
    }));
    get().pushHistory();
  },

  removeEdge: (id) => {
    set((state) => ({ edges: state.edges.filter((e) => e.id !== id) }));
    get().pushHistory();
  },

  setIsExecuting: (isExecuting) => set({ isExecuting }),
  setNodeExecutionStatus: (nodeId, status) =>
    set((state) => ({
      nodeExecutionStatus: { ...state.nodeExecutionStatus, [nodeId]: status },
    })),
  clearNodeExecutionStatuses: () => set({ nodeExecutionStatus: {} }),
  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setNodeSearchQuery: (nodeSearchQuery) => set({ nodeSearchQuery }),

  resetCanvas: () =>
    set({
      nodes: [],
      edges: [],
      currentWorkflow: null,
      currentWorkflowName: "Untitled Workflow",
      nodeExecutionStatus: {},
      historyStack: [],
      historyIndex: -1,
    }),

  pushHistory: () => {
    set((state) => {
      const snap = snapshot(state.nodes, state.edges);
      // Truncate any "future" history after current index
      const newStack = state.historyStack.slice(0, state.historyIndex + 1);
      newStack.push(snap);
      // Keep max 50 snapshots
      if (newStack.length > 50) newStack.shift();
      return {
        historyStack: newStack,
        historyIndex: newStack.length - 1,
      };
    });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex <= 0) return;
    const newIndex = state.historyIndex - 1;
    const snap = state.historyStack[newIndex];
    set({ nodes: snap.nodes, edges: snap.edges, historyIndex: newIndex });
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.historyStack.length - 1) return;
    const newIndex = state.historyIndex + 1;
    const snap = state.historyStack[newIndex];
    set({ nodes: snap.nodes, edges: snap.edges, historyIndex: newIndex });
  },
}));
