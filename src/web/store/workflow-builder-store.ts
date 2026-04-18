"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import { NodeExecutionStatus } from "@/lib/workflow-types";

type GraphSnapshot = {
  nodes: Node[];
  edges: Edge[];
};

type BuilderState = {
  workflowId: string | null;
  workflowName: string;
  nodes: Node[];
  edges: Edge[];
  selectedNodeIds: string[];
  isExecuting: boolean;
  nodeStatuses: Record<string, NodeExecutionStatus>;
  lastConnectionError: string | null;
  executionError: string | null;
  undoStack: GraphSnapshot[];
  redoStack: GraphSnapshot[];
  setWorkflow: (payload: {
    workflowId: string;
    workflowName: string;
    nodes: Node[];
    edges: Edge[];
  }) => void;
  setWorkflowName: (name: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  setSelectedNodeIds: (nodeIds: string[]) => void;
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
  removeNode: (nodeId: string) => void;
  removeSelectedNodes: () => void;
  clearLastConnectionError: () => void;
  setExecutionError: (value: string | null) => void;
  updateNodeOutput: (nodeId: string, output: string) => void;
  hydrateNodeStatuses: (statusMap: Record<string, NodeExecutionStatus>) => void;
  undo: () => void;
  redo: () => void;
  setExecuting: (value: boolean) => void;
  setNodeStatus: (nodeId: string, status: NodeExecutionStatus) => void;
  clearStatuses: () => void;
};

const HANDLE_OUTPUT_TYPE: Record<string, "text" | "image" | "video"> = {
  "text-out": "text",
  "image-out": "image",
  "video-out": "video",
};

const HANDLE_ACCEPTS: Record<string, Array<"text" | "image" | "video">> = {
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

function isConnectionTypeValid(
  sourceHandle: string | null | undefined,
  targetHandle: string | null | undefined,
) {
  if (!sourceHandle || !targetHandle) return true;
  const sourceType = HANDLE_OUTPUT_TYPE[sourceHandle];
  const accepted =
    Object.entries(HANDLE_ACCEPTS).find(([key]) =>
      targetHandle.startsWith(key.replace(/-\d+$/, "")),
    )?.[1] ?? [];
  if (!sourceType) return false;
  return accepted.includes(sourceType);
}

function wouldCreateCycle(
  sourceId: string,
  targetId: string,
  nodes: Node[],
  edges: Edge[],
) {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) adjacency.get(edge.source)?.push(edge.target);
  adjacency.get(sourceId)?.push(targetId);

  const stack = [targetId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) stack.push(next);
  }

  return false;
}

function cloneNodes(nodes: Node[]) {
  return nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: { ...(node.data as Record<string, unknown>) },
  }));
}

function cloneEdges(edges: Edge[]) {
  return edges.map((edge) => ({
    ...edge,
    style: edge.style ? { ...edge.style } : undefined,
  }));
}

function snapshotFromState(state: BuilderState): GraphSnapshot {
  return {
    nodes: cloneNodes(state.nodes),
    edges: cloneEdges(state.edges),
  };
}

function pushUndo(state: BuilderState): Pick<BuilderState, "undoStack" | "redoStack"> {
  const nextUndo = [...state.undoStack, snapshotFromState(state)];
  const maxSnapshots = 50;
  return {
    undoStack: nextUndo.length > maxSnapshots ? nextUndo.slice(-maxSnapshots) : nextUndo,
    redoStack: [],
  };
}

export const useWorkflowBuilderStore = create<BuilderState>((set, get) => ({
  workflowId: null,
  workflowName: "Untitled Workflow",
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  isExecuting: false,
  nodeStatuses: {},
  lastConnectionError: null,
  executionError: null,
  undoStack: [],
  redoStack: [],
  setWorkflow: (payload) =>
    set({
      workflowId: payload.workflowId,
      workflowName: payload.workflowName,
      nodes: cloneNodes(payload.nodes),
      edges: cloneEdges(payload.edges),
      selectedNodeIds: payload.nodes.filter((node) => node.selected).map((node) => node.id),
      undoStack: [],
      redoStack: [],
      lastConnectionError: null,
      executionError: null,
      nodeStatuses: {},
    }),
  setWorkflowName: (name) => set({ workflowName: name }),
  onNodesChange: (changes) =>
    set((state) => {
      const nextNodes = applyNodeChanges(changes, state.nodes);
      return {
        ...pushUndo(state),
        nodes: nextNodes,
        selectedNodeIds: nextNodes
          .filter((node) => node.selected)
          .map((node) => node.id),
      };
    }),
  onEdgesChange: (changes) =>
    set((state) => ({
      ...pushUndo(state),
      edges: applyEdgeChanges(changes, state.edges),
    })),
  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;
    if (!isConnectionTypeValid(connection.sourceHandle, connection.targetHandle)) {
      set({
        lastConnectionError:
          "Invalid connection: output and input handle types do not match.",
      });
      return;
    }
    const { nodes, edges } = get();
    if (wouldCreateCycle(connection.source, connection.target, nodes, edges)) {
      set({
        lastConnectionError:
          "Connection blocked: this edge would create a cycle.",
      });
      return;
    }
    set((state) => ({
      ...pushUndo(state),
      lastConnectionError: null,
      edges: addEdge(
        {
          ...connection,
          animated: true,
          style: { stroke: "#b58cff", strokeWidth: 2 },
        },
        state.edges,
      ),
    }));
  },
  addNode: (node) =>
    set((state) => ({
      ...pushUndo(state),
      nodes: [...state.nodes, node],
      lastConnectionError: null,
    })),
  setSelectedNodeIds: (nodeIds) => set({ selectedNodeIds: nodeIds }),
  updateNodeData: (nodeId, patch) =>
    set((state) => ({
      ...pushUndo(state),
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    })),
  removeNode: (nodeId) =>
    set((state) => ({
      ...pushUndo(state),
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId,
      ),
      selectedNodeIds: state.selectedNodeIds.filter((id) => id !== nodeId),
    })),
  removeSelectedNodes: () =>
    set((state) => {
      if (state.selectedNodeIds.length === 0) return {};
      return {
        ...pushUndo(state),
        nodes: state.nodes.filter((node) => !state.selectedNodeIds.includes(node.id)),
        edges: state.edges.filter(
          (edge) =>
            !state.selectedNodeIds.includes(edge.source) &&
            !state.selectedNodeIds.includes(edge.target),
        ),
        selectedNodeIds: [],
      };
    }),
  clearLastConnectionError: () => set({ lastConnectionError: null }),
  setExecutionError: (value) => set({ executionError: value }),
  updateNodeOutput: (nodeId, output) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                output,
              },
            }
          : node,
      ),
    })),
  hydrateNodeStatuses: (statusMap) => set({ nodeStatuses: statusMap }),
  undo: () =>
    set((state) => {
      if (state.undoStack.length === 0) return {};
      const previous = state.undoStack[state.undoStack.length - 1];
      const current = snapshotFromState(state);
      return {
        nodes: previous.nodes,
        edges: previous.edges,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, current],
        selectedNodeIds: previous.nodes
          .filter((node) => node.selected)
          .map((node) => node.id),
      };
    }),
  redo: () =>
    set((state) => {
      if (state.redoStack.length === 0) return {};
      const next = state.redoStack[state.redoStack.length - 1];
      const current = snapshotFromState(state);
      return {
        nodes: next.nodes,
        edges: next.edges,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, current],
        selectedNodeIds: next.nodes.filter((node) => node.selected).map((node) => node.id),
      };
    }),
  setExecuting: (value) => set({ isExecuting: value }),
  setNodeStatus: (nodeId, status) =>
    set((state) => ({
      nodeStatuses: {
        ...state.nodeStatuses,
        [nodeId]: status,
      },
    })),
  clearStatuses: () => set({ nodeStatuses: {}, executionError: null }),
}));
