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

type BuilderState = {
  workflowId: string | null;
  workflowName: string;
  nodes: Node[];
  edges: Edge[];
  isExecuting: boolean;
  nodeStatuses: Record<string, NodeExecutionStatus>;
  setWorkflow: (payload: {
    workflowId: string;
    workflowName: string;
    nodes: Node[];
    edges: Edge[];
  }) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
  removeNode: (nodeId: string) => void;
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

export const useWorkflowBuilderStore = create<BuilderState>((set, get) => ({
  workflowId: null,
  workflowName: "Untitled Workflow",
  nodes: [],
  edges: [],
  isExecuting: false,
  nodeStatuses: {},
  setWorkflow: (payload) =>
    set({
      workflowId: payload.workflowId,
      workflowName: payload.workflowName,
      nodes: payload.nodes,
      edges: payload.edges,
    }),
  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    })),
  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    })),
  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;
    if (!isConnectionTypeValid(connection.sourceHandle, connection.targetHandle)) {
      return;
    }
    const { nodes, edges } = get();
    if (wouldCreateCycle(connection.source, connection.target, nodes, edges)) {
      return;
    }
    set((state) => ({
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
      nodes: [...state.nodes, node],
    })),
  updateNodeData: (nodeId, patch) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    })),
  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId,
      ),
    })),
  setExecuting: (value) => set({ isExecuting: value }),
  setNodeStatus: (nodeId, status) =>
    set((state) => ({
      nodeStatuses: {
        ...state.nodeStatuses,
        [nodeId]: status,
      },
    })),
  clearStatuses: () => set({ nodeStatuses: {} }),
}));
