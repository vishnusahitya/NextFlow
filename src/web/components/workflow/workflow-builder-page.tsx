"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlow,
  ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  WandSparkles,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { workflowNodeTypes } from "@/components/workflow/node-types";
import { useWorkflowBuilderStore } from "@/store/workflow-builder-store";

type PersistedWorkflow = {
  id: string;
  name: string;
  description: string | null;
  nodes: unknown[];
  edges: unknown[];
};

type ExecutionMode = "full" | "single";
type ExecutionStatus = "success" | "failed" | "partial" | "running";

type ExecutionNodeLog = {
  nodeId: string;
  nodeType: string;
  inputs: unknown;
  outputs?: unknown;
  error?: string | null;
  durationMs: number;
};

type ExecutionRecord = {
  id: string;
  workflowId: string;
  scope: "full" | "partial" | "single";
  status: ExecutionStatus;
  durationMs: number;
  createdAt: string;
  nodeLogs: ExecutionNodeLog[];
};

type NodeLibraryItem = {
  type: string;
  label: string;
  description: string;
};

const NODE_LIBRARY: NodeLibraryItem[] = [
  {
    type: "text",
    label: "Text Node",
    description: "Prompt or plain text source",
  },
  {
    type: "uploadImage",
    label: "Upload Image Node",
    description: "Transloadit image upload with preview",
  },
  {
    type: "uploadVideo",
    label: "Upload Video Node",
    description: "Transloadit video upload with player",
  },
  {
    type: "runLLM",
    label: "Run Any LLM Node",
    description: "System prompt, user message, and images",
  },
  {
    type: "cropImage",
    label: "Crop Image Node",
    description: "x/y/width/height percent crop",
  },
  {
    type: "extractFrame",
    label: "Extract Frame from Video Node",
    description: "Timestamp to frame extraction",
  },
];

function defaultDataForType(type: string): Record<string, unknown> {
  switch (type) {
    case "text":
      return { text: "" };
    case "uploadImage":
      return { imageUrl: "" };
    case "uploadVideo":
      return { videoUrl: "" };
    case "runLLM":
      return {
        model: "gemini-2.0-flash",
        systemPrompt: "",
        userMessage: "",
        result: "",
        errorMessage: "",
      };
    case "cropImage":
      return { cropX: 0, cropY: 0, cropW: 100, cropH: 100 };
    case "extractFrame":
      return { timestamp: "0" };
    default:
      return {};
  }
}

function generateNodeId() {
  return `node-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs} ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(2)} s`;
  return `${Math.floor(durationMs / 60_000)}m ${(durationMs % 60_000 / 1000).toFixed(1)}s`;
}

function formatTimestamp(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleString();
}

function prettyValue(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseOutputString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function outputRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

function outputFieldAsString(
  output: Record<string, unknown> | null,
  field: string,
): string {
  if (!output) return "";
  const value = output[field];
  return typeof value === "string" ? value : "";
}

function isWorkflowCycle(nodes: Node[], edges: Edge[]): boolean {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    indegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) continue;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    adjacency.get(edge.source)?.push(edge.target);
  }

  const queue = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);

  let visitedCount = 0;
  while (queue.length > 0) {
    const current = queue.shift() as string;
    visitedCount += 1;
    for (const next of adjacency.get(current) ?? []) {
      const nextDegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) queue.push(next);
    }
  }

  return visitedCount !== nodes.length;
}

function collectRequiredNodeIds(targetIds: string[], edges: Edge[]): Set<string> {
  const required = new Set(targetIds);
  let changed = true;

  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (required.has(edge.target) && !required.has(edge.source)) {
        required.add(edge.source);
        changed = true;
      }
    }
  }

  return required;
}

function statusClasses(status: ExecutionStatus): string {
  if (status === "success") return "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
  if (status === "failed") return "text-red-300 bg-red-500/10 border-red-500/30";
  if (status === "partial") return "text-amber-300 bg-amber-500/10 border-amber-500/30";
  return "text-blue-300 bg-blue-500/10 border-blue-500/30";
}

function statusIcon(status: ExecutionStatus) {
  if (status === "success") return <CheckCircle2 size={13} className="text-emerald-300" />;
  if (status === "failed") return <XCircle size={13} className="text-red-300" />;
  if (status === "partial") return <AlertTriangle size={13} className="text-amber-300" />;
  return <Loader2 size={13} className="text-blue-300 animate-spin" />;
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function WorkflowBuilderPage({ workflow }: { workflow: PersistedWorkflow }) {
  const {
    workflowId,
    workflowName,
    nodes,
    edges,
    isExecuting,
    nodeStatuses,
    lastConnectionError,
    executionError,
    setWorkflow,
    addNode,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setExecuting,
    setNodeStatus,
    clearStatuses,
    updateNodeData,
    setExecutionError,
    clearLastConnectionError,
  } = useWorkflowBuilderStore();

  const [executionHistory, setExecutionHistory] = useState<ExecutionRecord[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runningMode, setRunningMode] = useState<ExecutionMode | null>(null);

  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const hydratedWorkflowIdRef = useRef<string | null>(null);

  const selectedNodeIds = useMemo(
    () => nodes.filter((node) => node.selected).map((node) => node.id),
    [nodes],
  );

  useEffect(() => {
    if (hydratedWorkflowIdRef.current === workflow.id) {
      return;
    }

    const incomingNodes = (workflow.nodes as Node[]).map((node) => ({
      ...node,
      data: node.data ?? {},
    }));
    const incomingEdges = (workflow.edges as Edge[]).map((edge) => ({
      ...edge,
      animated: true,
      style: { stroke: "#9aa3b2", strokeWidth: 1.7 },
    }));

    setWorkflow({
      workflowId: workflow.id,
      workflowName: workflow.name,
      nodes: incomingNodes,
      edges: incomingEdges,
    });
    hydratedWorkflowIdRef.current = workflow.id;
  }, [setWorkflow, workflow.edges, workflow.id, workflow.name, workflow.nodes]);

  const refreshHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("workflowId", workflow.id);
      const response = await fetch(`/api/executions?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) return;
      const payload = await safeJson<unknown>(response);
      if (!Array.isArray(payload)) return;
      setExecutionHistory(payload as ExecutionRecord[]);
    } catch {
      // Keep current history when refresh fails.
    }
  }, [workflow.id]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const addNodeOfType = useCallback(
    (type: string) => {
      const wrapperBounds = canvasRef.current?.getBoundingClientRect();
      const centerPoint = wrapperBounds
        ? {
            x: wrapperBounds.left + wrapperBounds.width / 2,
            y: wrapperBounds.top + wrapperBounds.height / 2,
          }
        : { x: 400, y: 300 };

      const pointer = lastPointerRef.current;
      const pointerInsideCanvas =
        pointer &&
        wrapperBounds &&
        pointer.x >= wrapperBounds.left &&
        pointer.x <= wrapperBounds.right &&
        pointer.y >= wrapperBounds.top &&
        pointer.y <= wrapperBounds.bottom;

      const point = pointerInsideCanvas ? pointer : centerPoint;

      const flowPosition = reactFlowInstanceRef.current
        ? reactFlowInstanceRef.current.screenToFlowPosition(point)
        : { x: 260, y: 180 };

      addNode({
        id: generateNodeId(),
        type,
        position: {
          x: flowPosition.x - 140,
          y: flowPosition.y - 90,
        },
        data: defaultDataForType(type),
      } as Node);
    },
    [addNode],
  );

  const validateBeforeRun = useCallback(
    (mode: ExecutionMode, targetIds: string[]): string | null => {
      if (nodes.length === 0) {
        return "Canvas is empty. Add at least one node.";
      }

      if (mode === "single" && targetIds.length !== 1) {
        return "Select exactly one node for Run Single Node.";
      }

      const nodeIds = new Set(nodes.map((node) => node.id));
      for (const edge of edges) {
        if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
          return "Found a connection with a missing source or target node.";
        }
      }

      if (isWorkflowCycle(nodes, edges)) {
        return "Workflow contains a cycle. Remove cyclic connections before running.";
      }

      const requiredForMode =
        mode === "full" ? null : collectRequiredNodeIds(targetIds, edges);
      const nodesToValidate =
        mode === "full"
          ? nodes
          : nodes.filter((node) => requiredForMode?.has(node.id));

      const hasIncomingOnHandle = (nodeId: string, handle: string) =>
        edges.some((edge) => edge.target === nodeId && edge.targetHandle === handle);

      const hasIncomingPrefix = (nodeId: string, prefix: string) =>
        edges.some(
          (edge) => edge.target === nodeId && (edge.targetHandle ?? "").startsWith(prefix),
        );

      for (const node of nodesToValidate) {
        const data = (node.data ?? {}) as Record<string, unknown>;

        if (node.type === "uploadImage" && !String(data.imageUrl ?? "").trim()) {
          return `Upload Image node ${node.id} needs an uploaded image.`;
        }

        if (node.type === "uploadVideo" && !String(data.videoUrl ?? "").trim()) {
          return `Upload Video node ${node.id} needs an uploaded video.`;
        }

        if (node.type === "runLLM") {
          const hasConnectedUserMessage = hasIncomingOnHandle(node.id, "user-message-in");
          if (!hasConnectedUserMessage && !String(data.userMessage ?? "").trim()) {
            return `Run Any LLM node ${node.id} requires a user message.`;
          }
        }

        if (node.type === "cropImage") {
          const hasInput =
            hasIncomingOnHandle(node.id, "image-in") ||
            hasIncomingPrefix(node.id, "image-in-") ||
            String(data.imageUrl ?? "").trim().length > 0;
          if (!hasInput) {
            return `Crop Image node ${node.id} requires an image input.`;
          }
        }

        if (node.type === "extractFrame") {
          const hasInput =
            hasIncomingOnHandle(node.id, "video-in") ||
            hasIncomingPrefix(node.id, "video-in-") ||
            String(data.videoUrl ?? "").trim().length > 0;
          if (!hasInput) {
            return `Extract Frame node ${node.id} requires a video input.`;
          }
        }
      }

      return null;
    },
    [edges, nodes],
  );

  const runWorkflow = useCallback(
    async (mode: ExecutionMode, explicitTargetIds?: string[]) => {
      if (isExecuting) return;

      const targetIds =
        explicitTargetIds ?? (mode === "single" ? selectedNodeIds : []);

      const validationError = validateBeforeRun(mode, targetIds);
      if (validationError) {
        setExecutionError(validationError);
        return;
      }

      setExecutionError(null);
      setExecuting(true);
      setRunningMode(mode);
      clearStatuses();

      const requiredNodeIds =
        mode === "full"
          ? new Set(nodes.map((node) => node.id))
          : collectRequiredNodeIds(targetIds, edges);

      for (const node of nodes) {
        setNodeStatus(node.id, requiredNodeIds.has(node.id) ? "running" : "idle");
      }

      try {
        const activeWorkflowId = workflowId ?? workflow.id;
        const response = await fetch(`/api/workflows/${activeWorkflowId}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            selectedNodeIds: mode === "single" ? targetIds : undefined,
            nodes,
            edges,
          }),
        });

        const responseClone = response.clone();
        let rawPayload: ExecutionRecord | { error?: string };
        try {
          rawPayload = (await response.json()) as ExecutionRecord | { error?: string };
        } catch {
          const rawText = await responseClone.text().catch(() => "");
          const snippet = rawText.trim().slice(0, 180) || "(empty response)";
          throw new Error(`Backend returned invalid JSON: ${snippet}`);
        }

        if (!response.ok || ("error" in rawPayload && rawPayload.error)) {
          const message =
            ("error" in rawPayload ? rawPayload.error : undefined) ||
            "Workflow execution failed.";
          throw new Error(message);
        }
        const payload = rawPayload as ExecutionRecord;

        const logs = payload.nodeLogs ?? [];
        for (const node of nodes) {
          setNodeStatus(node.id, "idle");
        }

        for (const log of logs) {
          const failed = Boolean(log.error);
          setNodeStatus(log.nodeId, failed ? "error" : "success");

          const output = outputRecord(log.outputs);
          const patch: Record<string, unknown> = {
            outputJson: output ?? {},
            output: parseOutputString(log.outputs),
          };

          if (log.nodeType === "text") {
            const textOut = outputFieldAsString(output, "text");
            if (textOut) patch.output = textOut;
          }

          if (log.nodeType === "uploadImage" && !failed) {
            const imageUrl = outputFieldAsString(output, "image_url");
            if (imageUrl) patch.imageUrl = imageUrl;
          }

          if (log.nodeType === "uploadVideo" && !failed) {
            const videoUrl = outputFieldAsString(output, "video_url");
            if (videoUrl) patch.videoUrl = videoUrl;
          }

          if (log.nodeType === "runLLM") {
            const llmOutput = outputFieldAsString(output, "output");
            patch.result = llmOutput || parseOutputString(log.outputs);
            patch.output = llmOutput || parseOutputString(log.outputs);
            patch.errorMessage = failed ? String(log.error ?? "Unknown error") : "";
            patch.status = failed ? "error" : "success";
          }

          if (log.nodeType === "cropImage" && !failed) {
            const croppedUrl = outputFieldAsString(output, "cropped_image_url");
            if (croppedUrl) {
              patch.croppedUrl = croppedUrl;
              patch.output = croppedUrl;
            }
          }

          if (log.nodeType === "extractFrame" && !failed) {
            const frameUrl = outputFieldAsString(output, "frame_image_url");
            if (frameUrl) {
              patch.frameUrl = frameUrl;
              patch.output = frameUrl;
            }
          }

          updateNodeData(log.nodeId, patch);
        }

        setExecutionHistory((prev) => {
          const next = [payload, ...prev.filter((run) => run.id !== payload.id)];
          return next.slice(0, 100);
        });
        setExpandedRunId(payload.id);
      } catch (error) {
        for (const node of nodes) {
          setNodeStatus(node.id, "idle");
        }
        setExecutionError(error instanceof Error ? error.message : "Execution failed.");
      } finally {
        setRunningMode(null);
        setExecuting(false);
      }
    },
    [
      clearStatuses,
      edges,
      isExecuting,
      nodes,
      selectedNodeIds,
      setExecuting,
      setExecutionError,
      setNodeStatus,
      updateNodeData,
      validateBeforeRun,
      workflow.id,
      workflowId,
    ],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeId?: string }>).detail;
      if (!detail?.nodeId) return;
      void runWorkflow("single", [detail.nodeId]);
    };

    window.addEventListener("nextflow:run-single-node", handler as EventListener);
    return () =>
      window.removeEventListener(
        "nextflow:run-single-node",
        handler as EventListener,
      );
  }, [runWorkflow]);

  const connectionAndExecutionErrors = [lastConnectionError, executionError].filter(
    (message): message is string => Boolean(message),
  );

  const activeCount = useMemo(
    () => Object.values(nodeStatuses).filter((status) => status === "running").length,
    [nodeStatuses],
  );

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
      }}
      className="bg-[#090b10] text-zinc-100"
    >
      <aside className="w-[280px] shrink-0 border-r border-[#252b33] bg-[#0f141b] flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-[#252b33]">
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">Node Buttons</p>
          <h2 className="mt-2 text-sm font-semibold">{workflowName || "Workflow Builder"}</h2>
          <p className="mt-1 text-xs text-zinc-500">Click to add nodes instantly on canvas.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {NODE_LIBRARY.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => addNodeOfType(item.type)}
              className="w-full rounded-lg border border-[#28303a] bg-[#131a23] hover:bg-[#1b2531] transition-colors text-left px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{item.label}</span>
                <Plus size={14} className="text-zinc-400" />
              </div>
              <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">{item.description}</p>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-[#252b33] space-y-2">
          <button
            type="button"
            onClick={() => void runWorkflow("full")}
            disabled={isExecuting}
            className="w-full h-10 rounded-lg border border-blue-400/40 bg-blue-500/15 text-blue-200 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 text-sm font-medium"
          >
            {isExecuting && runningMode === "full" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Run Full Workflow
          </button>

          <button
            type="button"
            onClick={() => void runWorkflow("single")}
            disabled={isExecuting || selectedNodeIds.length !== 1}
            className="w-full h-10 rounded-lg border border-[#2f3945] bg-[#18212c] text-zinc-200 hover:bg-[#202c39] disabled:opacity-45 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 text-sm font-medium"
          >
            {isExecuting && runningMode === "single" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <WandSparkles size={14} />
            )}
            Run Single Node
          </button>

          <p className="text-[11px] text-zinc-500">
            Selected nodes: <span className="text-zinc-300 font-medium">{selectedNodeIds.length}</span>
          </p>
        </div>
      </aside>

      <section className="flex-1 relative overflow-hidden">
        {connectionAndExecutionErrors.length > 0 ? (
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 max-w-[560px]">
            {connectionAndExecutionErrors.map((message) => (
              <div
                key={message}
                className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <span>{message}</span>
                  <button
                    type="button"
                    onClick={() => {
                      clearLastConnectionError();
                      setExecutionError(null);
                    }}
                    className="text-red-200/80 hover:text-red-100"
                  >
                    x
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {nodes.length === 0 ? (
          <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
            <div className="rounded-2xl border border-[#2b3440] bg-[#0e141d]/95 px-6 py-5 text-center">
              <h3 className="text-base font-semibold">Blank Workflow Workspace</h3>
              <p className="mt-2 text-sm text-zinc-400 max-w-[320px]">
                Start from a clean canvas. Click a node button on the left to place your first node.
              </p>
            </div>
          </div>
        ) : null}

        <div ref={canvasRef} className="absolute inset-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={workflowNodeTypes}
            onPaneMouseMove={(event) => {
              lastPointerRef.current = { x: event.clientX, y: event.clientY };
            }}
            onInit={(instance) => {
              reactFlowInstanceRef.current = instance;
            }}
            minZoom={0.2}
            maxZoom={2.8}
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: "#8d99ab", strokeWidth: 1.8 },
            }}
            fitView={false}
            className="dot-grid"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.1}
              color="rgba(198, 211, 226, 0.22)"
            />
            <Controls
              showInteractive={false}
              style={{
                background: "#101722",
                border: "1px solid #2d3643",
                borderRadius: 8,
              }}
            />
            <MiniMap
              style={{
                background: "#101722",
                border: "1px solid #2d3643",
                borderRadius: 8,
              }}
              maskColor="rgba(3, 7, 15, 0.65)"
              nodeColor="#88a0c0"
              pannable
              zoomable
            />
          </ReactFlow>
        </div>

        <div className="absolute bottom-3 left-3 z-20 rounded-md border border-[#2d3643] bg-[#111924]/90 px-3 py-2 text-xs text-zinc-300">
          Active nodes: {nodes.length} | Running: {activeCount}
        </div>
      </section>

      <aside className="w-[360px] shrink-0 border-l border-[#252b33] bg-[#0f141b] flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-[#252b33] flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">Workflow History</p>
            <h2 className="mt-1 text-sm font-semibold">Execution Runs</h2>
          </div>
          <button
            type="button"
            onClick={() => void refreshHistory()}
            className="h-8 w-8 rounded-md border border-[#2d3643] bg-[#15202d] hover:bg-[#1c2a39] flex items-center justify-center"
            title="Refresh history"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {executionHistory.length === 0 ? (
            <div className="rounded-lg border border-[#2b3440] bg-[#121a24] p-4 text-center">
              <p className="text-sm text-zinc-300">No runs yet</p>
              <p className="mt-1 text-xs text-zinc-500">Run the workflow to populate history.</p>
            </div>
          ) : (
            executionHistory.map((run) => {
              const isExpanded = expandedRunId === run.id;

              return (
                <div
                  key={run.id}
                  className="rounded-lg border border-[#2b3440] bg-[#111924] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedRunId((prev) => (prev === run.id ? null : run.id))
                    }
                    className="w-full text-left px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {statusIcon(run.status)}
                          <span className="text-sm font-medium truncate">{run.scope.toUpperCase()}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wide ${statusClasses(run.status)}`}
                          >
                            {run.status}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 size={10} />
                            {formatDuration(run.durationMs)}
                          </span>
                          <span>{formatTimestamp(run.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-[#2b3440] bg-[#0f1620] p-3 space-y-2">
                      {run.nodeLogs.length === 0 ? (
                        <p className="text-xs text-zinc-500">No node-level details recorded.</p>
                      ) : (
                        run.nodeLogs.map((log) => (
                          <div
                            key={`${run.id}-${log.nodeId}-${log.durationMs}`}
                            className="rounded-md border border-[#2b3440] bg-[#101722] p-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold truncate">{log.nodeType}</span>
                              <span className="text-[10px] text-zinc-500">
                                {formatDuration(log.durationMs)}
                              </span>
                            </div>

                            {prettyValue(log.inputs) ? (
                              <div className="mt-2">
                                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Inputs</p>
                                <pre className="mt-1 max-h-28 overflow-auto rounded border border-[#2b3440] bg-[#0b1119] p-2 text-[11px] text-zinc-200 whitespace-pre-wrap break-all">
                                  {prettyValue(log.inputs)}
                                </pre>
                              </div>
                            ) : null}

                            {prettyValue(log.outputs) ? (
                              <div className="mt-2">
                                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Outputs</p>
                                <pre className="mt-1 max-h-28 overflow-auto rounded border border-[#2b3440] bg-[#0b1119] p-2 text-[11px] text-zinc-200 whitespace-pre-wrap break-all">
                                  {prettyValue(log.outputs)}
                                </pre>
                              </div>
                            ) : null}

                            {log.error ? (
                              <div className="mt-2">
                                <p className="text-[10px] uppercase tracking-wide text-red-300">Errors</p>
                                <pre className="mt-1 max-h-24 overflow-auto rounded border border-red-500/40 bg-red-900/20 p-2 text-[11px] text-red-100 whitespace-pre-wrap break-all">
                                  {String(log.error)}
                                </pre>
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}

export default WorkflowBuilderPage;
