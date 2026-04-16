import type { Edge, Node } from "@xyflow/react";
import { ExecutionScope, ExecutionStatus } from "../backend";
import type { NodeExecutionLog } from "../backend.d.ts";
import { NodeType } from "../types/workflow";
import { cropImage, extractFrame } from "./canvasUtils";
import { runGemini } from "./geminiApi";

export type NodeExecutionStatus = "idle" | "running" | "success" | "error";
export type ExecutionStatusMap = Map<string, NodeExecutionStatus>;

export interface ExecutionResult {
  status: ExecutionStatus;
  scope: ExecutionScope;
  durationMs: bigint;
  nodeLogs: NodeExecutionLog[];
}

interface ExecutionContext {
  nodes: Node[];
  edges: Edge[];
  outputs: Map<string, string>;
  onStatusChange: (nodeId: string, status: NodeExecutionStatus) => void;
  onDataUpdate: (nodeId: string, data: Record<string, unknown>) => void;
}

interface ResolvedInputs {
  byHandle: Map<string, string[]>;
  textInputs: string[];
  imageInputs: string[];
  videoInputs: string[];
}

function topologicalSort(nodes: Node[], edges: Edge[]): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }

  for (const e of edges) {
    if (!inDegree.has(e.source) || !inDegree.has(e.target)) continue;
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    adj.get(e.source)?.push(e.target);
  }

  const queue = [...inDegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([id]) => id);

  const result: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const neighbor of adj.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return result;
}

function getAncestors(
  nodeId: string,
  edges: Edge[],
  cache: Map<string, Set<string>>,
): Set<string> {
  if (cache.has(nodeId)) return cache.get(nodeId)!;

  const parents = edges.filter((e) => e.target === nodeId).map((e) => e.source);
  const ancestors = new Set<string>(parents);

  for (const p of parents) {
    for (const a of getAncestors(p, edges, cache)) {
      ancestors.add(a);
    }
  }

  cache.set(nodeId, ancestors);
  return ancestors;
}

function getParents(nodeId: string, edges: Edge[]): string[] {
  return edges.filter((e) => e.target === nodeId).map((e) => e.source);
}

function getRequiredNodes(
  targetIds: string[],
  nodes: Node[],
  edges: Edge[],
): string[] {
  const required = new Set<string>(targetIds);
  const ancestorCache = new Map<string, Set<string>>();

  for (const id of targetIds) {
    for (const a of getAncestors(id, edges, ancestorCache)) {
      required.add(a);
    }
  }

  return nodes.filter((n) => required.has(n.id)).map((n) => n.id);
}

function resolveInputs(
  nodeId: string,
  edges: Edge[],
  outputs: Map<string, string>,
): ResolvedInputs {
  const byHandle = new Map<string, string[]>();
  const textInputs: string[] = [];
  const imageInputs: string[] = [];
  const videoInputs: string[] = [];

  for (const edge of edges.filter((e) => e.target === nodeId)) {
    const value = outputs.get(edge.source);
    if (value === undefined) continue;

    const handle = edge.targetHandle ?? "";
    const existingForHandle = byHandle.get(handle) ?? [];
    existingForHandle.push(value);
    byHandle.set(handle, existingForHandle);

    if ((edge.sourceHandle ?? "").startsWith("image-out")) {
      imageInputs.push(value);
    } else if ((edge.sourceHandle ?? "").startsWith("video-out")) {
      videoInputs.push(value);
    } else {
      textInputs.push(value);
    }
  }

  return { byHandle, textInputs, imageInputs, videoInputs };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function parsePercentValue(raw: unknown, fallback: number): number {
  const n =
    typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? fallback));
  if (Number.isNaN(n)) return clampPercent(fallback);
  return clampPercent(n);
}

function normalizeLogInputValue(value: string): string {
  if (value.startsWith("data:")) return "[base64 payload]";
  return value;
}

async function executeNode(
  node: Node,
  ctx: ExecutionContext,
): Promise<{ output: string; log: NodeExecutionLog }> {
  const start = Date.now();
  const nodeType = node.type as NodeType;
  const data = node.data as Record<string, unknown>;

  ctx.onStatusChange(node.id, "running");

  const { byHandle, textInputs, imageInputs, videoInputs } = resolveInputs(
    node.id,
    ctx.edges,
    ctx.outputs,
  );

  const firstFromHandles = (...handleIds: string[]): string | undefined => {
    for (const handleId of handleIds) {
      const value = byHandle.get(handleId)?.[0];
      if (value !== undefined) return value;
    }
    return undefined;
  };

  const allFromHandle = (handleId: string): string[] => byHandle.get(handleId) ?? [];

  const allFromPrefix = (prefix: string): string[] =>
    [...byHandle.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .flatMap(([, values]) => values);

  try {
    let output = "";

    switch (nodeType) {
      case NodeType.text: {
        output = (data.text as string) ?? "";
        break;
      }

      case NodeType.uploadImage: {
        output =
          (data.uploadedUrl as string) ?? (data.imageUrl as string) ?? "";
        if (!output) throw new Error("No image uploaded");
        break;
      }

      case NodeType.uploadVideo: {
        output =
          (data.uploadedUrl as string) ?? (data.videoUrl as string) ?? "";
        if (!output) throw new Error("No video uploaded");
        break;
      }

      case NodeType.cropImage: {
        const imageSource =
          firstFromHandles("image-in") ??
          allFromPrefix("image-in-")[0] ??
          imageInputs[0] ??
          (data.imageUrl as string) ??
          "";
        if (!imageSource) throw new Error("No image input connected");

        const x = parsePercentValue(
          firstFromHandles("x-in") ?? data.cropX,
          (data.cropX as number) ?? 0,
        );
        const y = parsePercentValue(
          firstFromHandles("y-in") ?? data.cropY,
          (data.cropY as number) ?? 0,
        );
        const w = parsePercentValue(
          firstFromHandles("width-in") ?? data.cropW,
          (data.cropW as number) ?? 100,
        );
        const h = parsePercentValue(
          firstFromHandles("height-in") ?? data.cropH,
          (data.cropH as number) ?? 100,
        );

        output = await cropImage(imageSource, x, y, w, h);
        ctx.onDataUpdate(node.id, {
          croppedUrl: output,
          imageUrl: imageSource,
          cropX: x,
          cropY: y,
          cropW: w,
          cropH: h,
        });
        break;
      }

      case NodeType.extractFrame: {
        const videoSource =
          firstFromHandles("video-in") ??
          allFromPrefix("video-in-")[0] ??
          videoInputs[0] ??
          (data.videoUrl as string) ??
          "";
        if (!videoSource) throw new Error("No video input connected");

        const timestampRaw =
          firstFromHandles("timestamp-in") ?? (data.timestamp as string) ?? "0";
        output = await extractFrame(videoSource, timestampRaw);

        ctx.onDataUpdate(node.id, {
          frameUrl: output,
          videoUrl: videoSource,
          timestamp: timestampRaw,
        });
        break;
      }

      case NodeType.runLLM: {
        const model = (data.model as string) ?? "gemini-2.0-flash";
        const systemPrompt =
          firstFromHandles("system-prompt-in") ??
          (data.systemPrompt as string) ??
          "";

        let userMessage =
          firstFromHandles("user-message-in") ?? (data.userMessage as string) ?? "";

        for (const [id, val] of ctx.outputs.entries()) {
          userMessage = userMessage.replaceAll(`{{${id}}}`, val);
        }

        const legacyTextInputs = allFromHandle("text-in");
        if (!userMessage.trim() && legacyTextInputs.length > 0) {
          userMessage = legacyTextInputs.join("\n\n");
        }

        if (!userMessage.trim()) throw new Error("User message is empty");

        const imageUrls = [...new Set([
          ...allFromHandle("images-in"),
          ...allFromPrefix("image-in-"),
          ...imageInputs,
        ])];

        ctx.onDataUpdate(node.id, { status: "running" });
        const result = await runGemini({
          model,
          systemPrompt,
          userMessage,
          imageUrls,
        });
        output = result;
        ctx.onDataUpdate(node.id, { status: "success", result });
        break;
      }

      default: {
        throw new Error(`Unknown node type: ${nodeType}`);
      }
    }

    const durationMs = BigInt(Date.now() - start);
    ctx.onStatusChange(node.id, "success");

    const log: NodeExecutionLog = {
      nodeId: node.id,
      nodeType: nodeType,
      inputs: JSON.stringify({
        byHandle: Object.fromEntries(byHandle.entries()),
        textInputs: textInputs.map(normalizeLogInputValue),
        imageInputs: imageInputs.map(normalizeLogInputValue),
        videoInputs: videoInputs.map(normalizeLogInputValue),
      }),
      outputs: output.startsWith("data:")
        ? "[base64 output]"
        : output.slice(0, 2000),
      durationMs,
    };

    return { output, log };
  } catch (err) {
    const durationMs = BigInt(Date.now() - start);
    const errorMsg = err instanceof Error ? err.message : String(err);

    ctx.onStatusChange(node.id, "error");

    if (nodeType === NodeType.runLLM) {
      ctx.onDataUpdate(node.id, {
        status: "error",
        errorMessage: errorMsg,
      });
    } else if (nodeType === NodeType.extractFrame) {
      ctx.onDataUpdate(node.id, { error: errorMsg, isExtracting: false });
    }

    const log: NodeExecutionLog = {
      nodeId: node.id,
      nodeType: nodeType,
      inputs: JSON.stringify({
        byHandle: Object.fromEntries(byHandle.entries()),
        textInputs: textInputs.map(normalizeLogInputValue),
        imageInputs: imageInputs.map(normalizeLogInputValue),
        videoInputs: videoInputs.map(normalizeLogInputValue),
      }),
      outputs: "",
      error: errorMsg,
      durationMs,
    };

    throw Object.assign(err instanceof Error ? err : new Error(errorMsg), {
      log,
    });
  }
}

async function orchestrate(
  orderedIds: string[],
  ctx: ExecutionContext,
): Promise<NodeExecutionLog[]> {
  const nodeMap = new Map(ctx.nodes.map((n) => [n.id, n]));
  const logs: NodeExecutionLog[] = [];
  const failures = new Map<string, Error>();
  const completions = new Map<string, Promise<void>>();

  for (const nodeId of orderedIds) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const parents = getParents(nodeId, ctx.edges).filter((p) =>
      orderedIds.includes(p),
    );

    const run = async () => {
      if (parents.length > 0) {
        await Promise.allSettled(
          parents
            .map((p) => completions.get(p))
            .filter((p): p is Promise<void> => p !== undefined),
        );

        const failedParent = parents.find((p) => failures.has(p));
        if (failedParent) {
          const err = new Error(
            `Skipped: upstream node ${failedParent} failed`,
          );
          failures.set(nodeId, err);
          ctx.onStatusChange(nodeId, "error");
          logs.push({
            nodeId,
            nodeType: node.type ?? "",
            inputs: "",
            outputs: "",
            error: err.message,
            durationMs: BigInt(0),
          });
          return;
        }
      }

      try {
        const { output, log } = await executeNode(node, ctx);
        ctx.outputs.set(nodeId, output);
        logs.push(log);
      } catch (err) {
        const e = err as Error & { log?: NodeExecutionLog };
        failures.set(nodeId, e);
        if (e.log) logs.push(e.log);
      }
    };

    completions.set(nodeId, run());
  }

  await Promise.allSettled([...completions.values()]);
  return logs;
}

export interface ExecuteWorkflowOptions {
  nodes: Node[];
  edges: Edge[];
  mode: "full" | "single" | "partial";
  targetNodeIds?: string[];
  onStatusChange: (nodeId: string, status: NodeExecutionStatus) => void;
  onDataUpdate: (nodeId: string, data: Record<string, unknown>) => void;
}

export async function executeWorkflow(
  options: ExecuteWorkflowOptions,
): Promise<ExecutionResult> {
  const { nodes, edges, mode, targetNodeIds, onStatusChange, onDataUpdate } =
    options;

  const wallStart = Date.now();
  let idsToRun: string[];

  if (mode === "full") {
    idsToRun = topologicalSort(nodes, edges);
  } else if (mode === "single" && targetNodeIds?.length === 1) {
    idsToRun = [targetNodeIds[0]];
  } else if (mode === "partial" && targetNodeIds?.length) {
    const required = getRequiredNodes(targetNodeIds, nodes, edges);
    idsToRun = topologicalSort(
      nodes.filter((n) => required.includes(n.id)),
      edges.filter(
        (e) => required.includes(e.source) && required.includes(e.target),
      ),
    );
  } else {
    idsToRun = topologicalSort(nodes, edges);
  }

  if (idsToRun.length === 0) {
    return {
      status: ExecutionStatus.success,
      scope:
        mode === "full"
          ? ExecutionScope.full
          : mode === "single"
            ? ExecutionScope.single
            : ExecutionScope.partial,
      durationMs: BigInt(0),
      nodeLogs: [],
    };
  }

  for (const id of idsToRun) {
    onStatusChange(id, "idle");
  }

  const idsSet = new Set(idsToRun);
  const nodesToRun = nodes.filter((n) => idsSet.has(n.id));
  const edgesToRun = edges.filter(
    (e) => idsSet.has(e.source) && idsSet.has(e.target),
  );

  const ctx: ExecutionContext = {
    nodes: nodesToRun,
    edges: edgesToRun,
    outputs: new Map(),
    onStatusChange,
    onDataUpdate,
  };

  const logs = await orchestrate(idsToRun, ctx);
  const durationMs = BigInt(Date.now() - wallStart);

  const errorLogs = logs.filter((l) => l.error);
  const successLogs = logs.filter((l) => !l.error);

  let status: ExecutionStatus;
  if (errorLogs.length === 0) {
    status = ExecutionStatus.success;
  } else if (successLogs.length === 0) {
    status = ExecutionStatus.failed;
  } else {
    status = ExecutionStatus.partial;
  }

  const scope =
    mode === "full"
      ? ExecutionScope.full
      : mode === "single"
        ? ExecutionScope.single
        : ExecutionScope.partial;

  return { status, scope, durationMs, nodeLogs: logs };
}
