import { NextRequest, NextResponse } from "next/server";
import { addExecutionRecord } from "@/lib/execution-history-store";
import { getWorkflow } from "@/lib/mock-db";
import { ensureSampleWorkflow } from "@/lib/sample-workflow";
import { triggerTaskAndWait } from "@/lib/trigger-client";
import { NodeType } from "@/lib/workflow-types";
import type {
  ExecutionStatus,
  NodeExecutionLog,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeOutput,
} from "@/lib/workflow-types";
import {
  cropImageNodeLocal,
  extractFrameNodeLocal,
  runLLMNodeLocal,
} from "@/trigger/tasks/nodes";

type ExecuteMode = "full" | "partial" | "single";

type ExecutePayload = {
  mode?: ExecuteMode;
  selectedNodeIds?: string[];
  nodes?: unknown[];
  edges?: unknown[];
};

type NodeRunResult =
  | { ok: true; output: WorkflowNodeOutput; log: NodeExecutionLog }
  | { ok: false; log: NodeExecutionLog };

const SOURCE_HANDLE_TYPES: Record<string, "text" | "image" | "video"> = {
  "text-out": "text",
  "image-out": "image",
  "video-out": "video",
};

const TARGET_HANDLE_ACCEPTS: Record<string, Array<"text" | "image" | "video">> = {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTextOutput(output: WorkflowNodeOutput): output is { text: string } {
  return "text" in output;
}

function isLlmOutput(output: WorkflowNodeOutput): output is { output: string } {
  return "output" in output;
}

function isUploadImageOutput(
  output: WorkflowNodeOutput,
): output is { image_url: string } {
  return "image_url" in output;
}

function isCropOutput(
  output: WorkflowNodeOutput,
): output is { cropped_image_url: string } {
  return "cropped_image_url" in output;
}

function isFrameOutput(
  output: WorkflowNodeOutput,
): output is { frame_image_url: string } {
  return "frame_image_url" in output;
}

function isUploadVideoOutput(
  output: WorkflowNodeOutput,
): output is { video_url: string } {
  return "video_url" in output;
}

function normalizeNodes(input: unknown): WorkflowNode[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .filter((item) => typeof item.id === "string")
    .map((item) => {
      const position = isRecord(item.position) ? item.position : {};
      return {
        id: String(item.id),
        type: String(item.type ?? "text"),
        position: {
          x: Number(position.x ?? 0),
          y: Number(position.y ?? 0),
        },
        data: isRecord(item.data) ? item.data : {},
        selected: Boolean(item.selected),
      };
    });
}

function normalizeEdges(input: unknown): WorkflowEdge[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .filter((item) => typeof item.id === "string")
    .map((item) => ({
      id: String(item.id),
      source: String(item.source ?? ""),
      target: String(item.target ?? ""),
      sourceHandle:
        item.sourceHandle === null || item.sourceHandle === undefined
          ? undefined
          : String(item.sourceHandle),
      targetHandle:
        item.targetHandle === null || item.targetHandle === undefined
          ? undefined
          : String(item.targetHandle),
      animated: true,
    }))
    .filter((edge) => edge.source.length > 0 && edge.target.length > 0);
}

function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    if (!inDegree.has(edge.source) || !inDegree.has(edge.target)) continue;
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    adjacency.get(edge.source)?.push(edge.target);
  }

  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);

  const ordered: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    ordered.push(current);

    for (const neighbor of adjacency.get(current) ?? []) {
      const nextDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, nextDegree);
      if (nextDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  return ordered;
}

function ensureAcyclicAndSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const ordered = topologicalSort(nodes, edges);
  if (ordered.length !== nodes.length) {
    throw new Error("Workflow contains a cycle.");
  }
  return ordered;
}

function getParents(nodeId: string, edges: WorkflowEdge[]): string[] {
  return edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source);
}

function getAncestors(nodeId: string, edges: WorkflowEdge[], seen = new Set<string>()) {
  for (const parent of getParents(nodeId, edges)) {
    if (seen.has(parent)) continue;
    seen.add(parent);
    getAncestors(parent, edges, seen);
  }
  return seen;
}

function pickNodesForMode(
  mode: ExecuteMode,
  selectedNodeIds: string[],
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string[] {
  if (mode === "full") {
    return ensureAcyclicAndSort(nodes, edges);
  }

  const required = new Set<string>(selectedNodeIds);
  for (const nodeId of selectedNodeIds) {
    for (const ancestor of getAncestors(nodeId, edges)) {
      required.add(ancestor);
    }
  }

  const filteredNodes = nodes.filter((node) => required.has(node.id));
  const filteredEdges = edges.filter(
    (edge) => required.has(edge.source) && required.has(edge.target),
  );

  return ensureAcyclicAndSort(filteredNodes, filteredEdges);
}

function parseNumeric(value: unknown, fallback: number, clampToPercent = false): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value ?? fallback));

  if (Number.isNaN(parsed)) return fallback;
  if (!clampToPercent) return parsed;
  return Math.max(0, Math.min(100, parsed));
}

function extractTextValue(output: WorkflowNodeOutput): string | null {
  if (isTextOutput(output)) return output.text;
  if (isLlmOutput(output)) return output.output;
  return null;
}

function extractImageUrl(output: WorkflowNodeOutput): string | null {
  if (isUploadImageOutput(output)) return output.image_url;
  if (isCropOutput(output)) return output.cropped_image_url;
  if (isFrameOutput(output)) return output.frame_image_url;
  return null;
}

function extractVideoUrl(output: WorkflowNodeOutput): string | null {
  if (isUploadVideoOutput(output)) return output.video_url;
  return null;
}

function valueFromSourceHandle(
  sourceHandle: string | undefined | null,
  output: WorkflowNodeOutput,
): string | null {
  const normalized = sourceHandle ?? "";
  if (normalized.startsWith("text-out")) return extractTextValue(output);
  if (normalized.startsWith("image-out")) return extractImageUrl(output);
  if (normalized.startsWith("video-out")) return extractVideoUrl(output);
  return null;
}

function resolveInputsForNode(
  nodeId: string,
  edges: WorkflowEdge[],
  outputMap: Map<string, WorkflowNodeOutput>,
) {
  const incoming = edges.filter((edge) => edge.target === nodeId);
  const byHandle = new Map<string, string[]>();

  for (const edge of incoming) {
    const sourceOutput = outputMap.get(edge.source);
    if (!sourceOutput) continue;

    const value = valueFromSourceHandle(edge.sourceHandle, sourceOutput);
    if (value === null || value === undefined) continue;

    const targetHandle = edge.targetHandle ?? "";
    byHandle.set(targetHandle, [...(byHandle.get(targetHandle) ?? []), value]);
  }

  const first = (...handles: string[]) => {
    for (const handle of handles) {
      const value = byHandle.get(handle)?.[0];
      if (value !== undefined) return value;
    }
    return undefined;
  };

  const allWithPrefix = (prefix: string) =>
    [...byHandle.entries()]
      .filter(([handle]) => handle.startsWith(prefix))
      .flatMap(([, values]) => values);

  return { byHandle, first, allWithPrefix };
}

function detectSourceType(sourceHandle: string | undefined | null) {
  if (!sourceHandle) return null;

  for (const [handlePrefix, outputType] of Object.entries(SOURCE_HANDLE_TYPES)) {
    if (sourceHandle.startsWith(handlePrefix)) return outputType;
  }

  return null;
}

function detectTargetAccepted(targetHandle: string | undefined | null) {
  if (!targetHandle) return null;

  for (const [handlePrefix, accepts] of Object.entries(TARGET_HANDLE_ACCEPTS)) {
    if (targetHandle.startsWith(handlePrefix)) return accepts;
  }

  return null;
}

function validateConnectionsTypeSafe(edges: WorkflowEdge[]): string | null {
  for (const edge of edges) {
    const sourceType = detectSourceType(edge.sourceHandle ?? undefined);
    const accepted = detectTargetAccepted(edge.targetHandle ?? undefined);

    if (!sourceType || !accepted) continue;
    if (!accepted.includes(sourceType)) {
      return `Invalid connection ${edge.id}: ${edge.sourceHandle ?? "source"} cannot connect to ${edge.targetHandle ?? "target"}.`;
    }
  }

  return null;
}

async function executeNode(
  node: WorkflowNode,
  edges: WorkflowEdge[],
  outputMap: Map<string, WorkflowNodeOutput>,
): Promise<NodeRunResult> {
  const startedAt = Date.now();
  const { byHandle, first, allWithPrefix } = resolveInputsForNode(
    node.id,
    edges,
    outputMap,
  );

  let inputContract: Record<string, unknown> = {};

  try {
    if (node.type === NodeType.Text) {
      const text = String(node.data.text ?? "");
      inputContract = { text };
      const output = { text };
      return {
        ok: true,
        output,
        log: {
          nodeId: node.id,
          nodeType: node.type,
          inputs: inputContract,
          outputs: output,
          durationMs: Date.now() - startedAt,
        },
      };
    }

    if (node.type === NodeType.UploadImage) {
      const imageUrl = String(node.data.imageUrl ?? node.data.image_url ?? "").trim();
      inputContract = { image_url: imageUrl };
      if (!imageUrl) {
        throw new Error("Upload Image Node requires input.image_url");
      }

      const output = { image_url: imageUrl };
      return {
        ok: true,
        output,
        log: {
          nodeId: node.id,
          nodeType: node.type,
          inputs: inputContract,
          outputs: output,
          durationMs: Date.now() - startedAt,
        },
      };
    }

    if (node.type === NodeType.UploadVideo) {
      const videoUrl = String(node.data.videoUrl ?? node.data.video_url ?? "").trim();
      inputContract = { video_url: videoUrl };
      if (!videoUrl) {
        throw new Error("Upload Video Node requires input.video_url");
      }

      const output = { video_url: videoUrl };
      return {
        ok: true,
        output,
        log: {
          nodeId: node.id,
          nodeType: node.type,
          inputs: inputContract,
          outputs: output,
          durationMs: Date.now() - startedAt,
        },
      };
    }

    if (node.type === NodeType.CropImage) {
      const imageUrl =
        first("image-in") ??
        allWithPrefix("image-in-")[0] ??
        String(node.data.imageUrl ?? node.data.image_url ?? "").trim();

      const xPercent = parseNumeric(
        first("x-in") ?? node.data.cropX ?? node.data.x_percent ?? 0,
        0,
        true,
      );
      const yPercent = parseNumeric(
        first("y-in") ?? node.data.cropY ?? node.data.y_percent ?? 0,
        0,
        true,
      );
      const widthPercent = parseNumeric(
        first("width-in") ?? node.data.cropW ?? node.data.width_percent ?? 100,
        100,
        true,
      );
      const heightPercent = parseNumeric(
        first("height-in") ?? node.data.cropH ?? node.data.height_percent ?? 100,
        100,
        true,
      );

      inputContract = {
        image_url: imageUrl,
        x_percent: xPercent,
        y_percent: yPercent,
        width_percent: widthPercent,
        height_percent: heightPercent,
      };

      if (!imageUrl) {
        throw new Error("Crop Image Node requires input.image_url");
      }

      const result = await triggerTaskAndWait(
        "node-crop-image",
        {
          imageUrl,
          xPercent,
          yPercent,
          widthPercent,
          heightPercent,
        },
        cropImageNodeLocal,
      );

      const croppedImageUrl = String((result as { output?: string }).output ?? "").trim();
      if (!croppedImageUrl) {
        throw new Error("Crop Image Node returned an empty output URL");
      }

      const output = { cropped_image_url: croppedImageUrl };
      return {
        ok: true,
        output,
        log: {
          nodeId: node.id,
          nodeType: node.type,
          inputs: inputContract,
          outputs: output,
          durationMs: Date.now() - startedAt,
        },
      };
    }

    if (node.type === NodeType.ExtractFrame) {
      const videoUrl =
        first("video-in") ??
        allWithPrefix("video-in-")[0] ??
        String(node.data.videoUrl ?? node.data.video_url ?? "").trim();
      const timestamp = String(
        first("timestamp-in") ?? node.data.timestamp ?? "0",
      ).trim();

      inputContract = {
        video_url: videoUrl,
        timestamp: timestamp || "0",
      };

      if (!videoUrl) {
        throw new Error("Extract Frame Node requires input.video_url");
      }

      const result = await triggerTaskAndWait(
        "node-extract-frame",
        {
          videoUrl,
          timestamp: timestamp || "0",
        },
        extractFrameNodeLocal,
      );

      const frameImageUrl = String((result as { output?: string }).output ?? "").trim();
      if (!frameImageUrl) {
        throw new Error("Extract Frame Node returned an empty output URL");
      }

      const output = { frame_image_url: frameImageUrl };
      return {
        ok: true,
        output,
        log: {
          nodeId: node.id,
          nodeType: node.type,
          inputs: inputContract,
          outputs: output,
          durationMs: Date.now() - startedAt,
        },
      };
    }

    if (node.type === NodeType.RunLLM) {
      const systemPrompt = String(
        first("system-prompt-in") ?? node.data.systemPrompt ?? node.data.system_prompt ?? "",
      );
      const userMessage = String(
        first("user-message-in") ?? node.data.userMessage ?? node.data.user_message ?? "",
      ).trim();

      const images = [...new Set([
        ...(byHandle.get("images-in") ?? []),
        ...allWithPrefix("image-in-"),
      ])].filter((url) => url.trim().length > 0);

      inputContract = {
        system_prompt: systemPrompt,
        user_message: userMessage,
        images,
      };

      if (!userMessage) {
        throw new Error("Run Any LLM Node requires input.user_message");
      }

      const result = await triggerTaskAndWait(
        "node-run-llm",
        {
          model: String(node.data.model ?? "gemini-2.0-flash"),
          systemPrompt,
          userMessage,
          imageUrls: images,
        },
        runLLMNodeLocal,
      );

      const outputText = String((result as { output?: string }).output ?? "");
      if (!outputText.trim()) {
        throw new Error("Run Any LLM Node returned an empty response");
      }

      const output = { output: outputText };
      return {
        ok: true,
        output,
        log: {
          nodeId: node.id,
          nodeType: node.type,
          inputs: inputContract,
          outputs: output,
          durationMs: Date.now() - startedAt,
        },
      };
    }

    throw new Error(`Unsupported node type: ${node.type}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown node execution error";
    return {
      ok: false,
      log: {
        nodeId: node.id,
        nodeType: String(node.type),
        inputs: inputContract,
        outputs: {},
        error: message,
        durationMs: Date.now() - startedAt,
      },
    };
  }
}

function buildExecutionLevels(nodeIds: string[], edges: WorkflowEdge[]): string[][] {
  const nodeSet = new Set(nodeIds);
  const parentsMap = new Map<string, string[]>();

  for (const nodeId of nodeIds) {
    parentsMap.set(nodeId, []);
  }

  for (const edge of edges) {
    if (!nodeSet.has(edge.source) || !nodeSet.has(edge.target)) continue;
    parentsMap.set(edge.target, [...(parentsMap.get(edge.target) ?? []), edge.source]);
  }

  const levelCache = new Map<string, number>();
  const computeLevel = (nodeId: string): number => {
    const cached = levelCache.get(nodeId);
    if (cached !== undefined) return cached;

    const parents = parentsMap.get(nodeId) ?? [];
    if (parents.length === 0) {
      levelCache.set(nodeId, 0);
      return 0;
    }

    const level = Math.max(...parents.map((parentId) => computeLevel(parentId) + 1));
    levelCache.set(nodeId, level);
    return level;
  };

  const grouped = new Map<number, string[]>();
  for (const nodeId of nodeIds) {
    const level = computeLevel(nodeId);
    grouped.set(level, [...(grouped.get(level) ?? []), nodeId]);
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, ids]) => ids);
}

async function runExecution(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  orderedNodeIds: string[],
) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const outputs = new Map<string, WorkflowNodeOutput>();
  const logs: NodeExecutionLog[] = [];
  const levels = buildExecutionLevels(orderedNodeIds, edges);

  let hasFailure = false;
  const executed = new Set<string>();

  for (const levelIds of levels) {
    if (hasFailure) break;

    const levelResults = await Promise.all(
      levelIds.map(async (nodeId) => {
        const node = nodeMap.get(nodeId);
        if (!node) {
          return {
            nodeId,
            result: {
              ok: false,
              log: {
                nodeId,
                nodeType: "unknown",
                inputs: {},
                outputs: {},
                error: "Node not found during execution",
                durationMs: 0,
              } satisfies NodeExecutionLog,
            } as NodeRunResult,
          };
        }

        const result = await executeNode(node, edges, outputs);
        return { nodeId, result };
      }),
    );

    for (const { nodeId, result } of levelResults) {
      logs.push(result.log);
      executed.add(nodeId);
      if (result.ok) {
        outputs.set(nodeId, result.output);
      }
    }

    if (levelResults.some(({ result }) => !result.ok)) {
      hasFailure = true;
    }
  }

  if (hasFailure) {
    for (const nodeId of orderedNodeIds) {
      if (executed.has(nodeId)) continue;
      const node = nodeMap.get(nodeId);
      logs.push({
        nodeId,
        nodeType: String(node?.type ?? "unknown"),
        inputs: {},
        outputs: {},
        error: "Skipped because workflow execution stopped after a node failure.",
        durationMs: 0,
      });
    }
  }

  return logs;
}

function summarizeExecutionStatus(logs: NodeExecutionLog[]): ExecutionStatus {
  if (logs.length === 0) return "success";
  const successCount = logs.filter((log) => !log.error).length;
  const errorCount = logs.length - successCount;

  if (errorCount === 0) return "success";
  if (successCount === 0) return "failed";
  return "partial";
}

function parseMode(value: unknown): ExecuteMode {
  return value === "single" || value === "partial" ? value : "full";
}

function parseSelectedNodeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .filter((item) => item.length > 0);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const payload = (await req.json().catch(() => ({}))) as ExecutePayload;
    const mode = parseMode(payload.mode);
    const selectedNodeIds = parseSelectedNodeIds(payload.selectedNodeIds);

    const requestNodes = normalizeNodes(payload.nodes);
    const requestEdges = normalizeEdges(payload.edges);

    let nodes: WorkflowNode[] = requestNodes;
    let edges: WorkflowEdge[] = requestEdges;

    if (nodes.length === 0 && edges.length === 0) {
      if (id === "sample") {
        const workflow = await ensureSampleWorkflow();
        nodes = normalizeNodes(workflow.nodes);
        edges = normalizeEdges(workflow.edges);
      } else if (id !== "blank") {
        const workflow = await getWorkflow(id);
        if (!workflow) {
          return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
        }
        nodes = normalizeNodes(workflow.nodes);
        edges = normalizeEdges(workflow.edges);
      }
    }

    if (mode !== "full" && selectedNodeIds.length === 0) {
      return NextResponse.json(
        { error: "selectedNodeIds is required for partial/single mode." },
        { status: 400 },
      );
    }

    if (mode === "single" && selectedNodeIds.length !== 1) {
      return NextResponse.json(
        { error: "Run Single Node requires exactly one selected node." },
        { status: 400 },
      );
    }

    const nodeIds = new Set(nodes.map((node) => node.id));
    const missingSelected = selectedNodeIds.filter((nodeId) => !nodeIds.has(nodeId));
    if (missingSelected.length > 0) {
      return NextResponse.json(
        { error: `Selected node not found: ${missingSelected.join(", ")}` },
        { status: 400 },
      );
    }

    for (const edge of edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        return NextResponse.json(
          {
            error: `Edge ${edge.id} references a missing source or target node.`,
          },
          { status: 400 },
        );
      }
    }

    const typeError = validateConnectionsTypeSafe(edges);
    if (typeError) {
      return NextResponse.json({ error: typeError }, { status: 400 });
    }

    let idsToRun: string[];
    try {
      idsToRun = pickNodesForMode(mode, selectedNodeIds, nodes, edges);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Invalid workflow graph.",
        },
        { status: 400 },
      );
    }

    const startedAt = Date.now();
    const logs = await runExecution(nodes, edges, idsToRun);
    const durationMs = Date.now() - startedAt;
    const status = summarizeExecutionStatus(logs);

    const executionRecord = {
      id: `exec-${Date.now()}`,
      workflowId: id,
      scope: mode,
      status,
      durationMs,
      nodeLogs: logs,
      createdAt: new Date().toISOString(),
    };

    addExecutionRecord(executionRecord);
    return NextResponse.json(executionRecord);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Workflow execution failed due to an unexpected server error.",
      },
      { status: 500 },
    );
  }
}
