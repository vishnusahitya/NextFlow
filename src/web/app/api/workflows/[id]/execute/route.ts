import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { triggerTaskAndWait } from "@/lib/trigger-client";
import { executionRequestSchema } from "@/lib/zod/workflow";
import {
  ExecutionStatus,
  NodeExecutionLog,
  NodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/workflow-types";
import {
  cropImageNodeLocal,
  extractFrameNodeLocal,
  runLLMNodeLocal,
} from "@/trigger/tasks/nodes";

function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  for (const edge of edges) {
    if (!inDegree.has(edge.source) || !inDegree.has(edge.target)) continue;
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    adj.get(edge.source)?.push(edge.target);
  }

  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);
  const ordered: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);
    for (const neighbor of adj.get(current) ?? []) {
      const next = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, next);
      if (next === 0) queue.push(neighbor);
    }
  }

  return ordered;
}

function getParents(nodeId: string, edges: WorkflowEdge[]) {
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
  mode: "full" | "partial" | "single",
  selectedNodeIds: string[],
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
) {
  if (mode === "full") {
    return topologicalSort(nodes, edges);
  }

  const targets = selectedNodeIds.length > 0 ? selectedNodeIds : [];
  const required = new Set<string>(targets);
  for (const target of targets) {
    for (const ancestor of getAncestors(target, edges)) {
      required.add(ancestor);
    }
  }

  const filteredNodes = nodes.filter((node) => required.has(node.id));
  const filteredEdges = edges.filter(
    (edge) => required.has(edge.source) && required.has(edge.target),
  );

  return topologicalSort(filteredNodes, filteredEdges);
}

function resolveInputsForNode(
  nodeId: string,
  edges: WorkflowEdge[],
  outputMap: Map<string, string>,
) {
  const incoming = edges.filter((edge) => edge.target === nodeId);
  const byHandle = new Map<string, string[]>();
  for (const edge of incoming) {
    const value = outputMap.get(edge.source);
    if (value === undefined) continue;
    const key = edge.targetHandle ?? "";
    byHandle.set(key, [...(byHandle.get(key) ?? []), value]);
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
      .filter(([key]) => key.startsWith(prefix))
      .flatMap(([, values]) => values);

  return { byHandle, first, allWithPrefix };
}

function parseNumeric(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (Number.isNaN(n)) return fallback;
  return n;
}

async function executeNode(
  node: WorkflowNode,
  edges: WorkflowEdge[],
  outputMap: Map<string, string>,
): Promise<{ output: string; log: NodeExecutionLog }> {
  const start = Date.now();
  const { byHandle, first, allWithPrefix } = resolveInputsForNode(
    node.id,
    edges,
    outputMap,
  );

  try {
    let output = "";
    if (node.type === NodeType.Text) {
      output = String(node.data.text ?? "");
    } else if (node.type === NodeType.UploadImage) {
      output = String(node.data.imageUrl ?? node.data.uploadedUrl ?? "");
      if (!output) throw new Error("Upload Image node has no image URL");
    } else if (node.type === NodeType.UploadVideo) {
      output = String(node.data.videoUrl ?? node.data.uploadedUrl ?? "");
      if (!output) throw new Error("Upload Video node has no video URL");
    } else if (node.type === NodeType.RunLLM) {
      const result = await triggerTaskAndWait(
        "node-run-llm",
        {
          model: String(node.data.model ?? "gemini-2.0-flash"),
          systemPrompt: first("system-prompt-in") ?? String(node.data.systemPrompt ?? ""),
          userMessage: first("user-message-in") ?? String(node.data.userMessage ?? ""),
          imageUrls: [
            ...(byHandle.get("images-in") ?? []),
            ...allWithPrefix("image-in-"),
          ],
        },
        runLLMNodeLocal,
      );
      output = String((result as { output: string }).output);
    } else if (node.type === NodeType.CropImage) {
      const imageUrl =
        first("image-in") ??
        allWithPrefix("image-in-")[0] ??
        String(node.data.imageUrl ?? "");
      if (!imageUrl) throw new Error("Crop Image node has no input image");

      const result = await triggerTaskAndWait(
        "node-crop-image",
        {
          imageUrl,
          xPercent: parseNumeric(first("x-in") ?? node.data.cropX ?? 0, 0),
          yPercent: parseNumeric(first("y-in") ?? node.data.cropY ?? 0, 0),
          widthPercent: parseNumeric(first("width-in") ?? node.data.cropW ?? 100, 100),
          heightPercent: parseNumeric(first("height-in") ?? node.data.cropH ?? 100, 100),
        },
        cropImageNodeLocal,
      );
      output = String((result as { output: string }).output);
    } else if (node.type === NodeType.ExtractFrame) {
      const videoUrl =
        first("video-in") ??
        allWithPrefix("video-in-")[0] ??
        String(node.data.videoUrl ?? "");
      if (!videoUrl) throw new Error("Extract Frame node has no input video");

      const result = await triggerTaskAndWait(
        "node-extract-frame",
        {
          videoUrl,
          timestamp: String(first("timestamp-in") ?? node.data.timestamp ?? "0"),
        },
        extractFrameNodeLocal,
      );
      output = String((result as { output: string }).output);
    } else {
      throw new Error(`Unsupported node type: ${node.type}`);
    }

    return {
      output,
      log: {
        nodeId: node.id,
        nodeType: node.type,
        inputs: {
          handles: Object.fromEntries(byHandle.entries()),
        },
        outputs: output,
        durationMs: Date.now() - start,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown node execution error";
    return {
      output: "",
      log: {
        nodeId: node.id,
        nodeType: node.type,
        inputs: {
          handles: Object.fromEntries(byHandle.entries()),
        },
        error: message,
        durationMs: Date.now() - start,
      },
    };
  }
}

async function runExecution(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  orderedNodeIds: string[],
) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const outputs = new Map<string, string>();
  const logs: NodeExecutionLog[] = [];
  const failures = new Set<string>();
  const completions = new Map<string, Promise<void>>();

  for (const nodeId of orderedNodeIds) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;
    const parents = getParents(nodeId, edges).filter((id) => orderedNodeIds.includes(id));

    const run = async () => {
      if (parents.length > 0) {
        await Promise.allSettled(
          parents
            .map((parentId) => completions.get(parentId))
            .filter((p): p is Promise<void> => Boolean(p)),
        );

        const failedParent = parents.find((parentId) => failures.has(parentId));
        if (failedParent) {
          failures.add(nodeId);
          logs.push({
            nodeId,
            nodeType: node.type,
            inputs: {},
            error: `Skipped due to failed parent node: ${failedParent}`,
            durationMs: 0,
          });
          return;
        }
      }

      const result = await executeNode(node, edges, outputs);
      logs.push(result.log);
      if (result.log.error) {
        failures.add(nodeId);
        return;
      }
      outputs.set(nodeId, result.output);
    };

    completions.set(nodeId, run());
  }

  await Promise.allSettled([...completions.values()]);
  return logs;
}

function summarizeExecutionStatus(logs: NodeExecutionLog[]): ExecutionStatus {
  const errors = logs.filter((log) => log.error);
  if (errors.length === 0) return "success";
  if (errors.length === logs.length) return "failed";
  return "partial";
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const workflow = await prisma.workflow.findFirst({
    where: { id, userId },
  });
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const payload = await req.json().catch(() => null);
  const parsed = executionRequestSchema.safeParse({
    ...payload,
    workflowId: id,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const nodes = workflow.nodes as WorkflowNode[];
  const edges = workflow.edges as WorkflowEdge[];
  const selectedNodeIds = parsed.data.selectedNodeIds ?? [];
  const idsToRun = pickNodesForMode(parsed.data.mode, selectedNodeIds, nodes, edges);

  const startedAt = Date.now();
  const logs = await runExecution(nodes, edges, idsToRun);
  const durationMs = Date.now() - startedAt;
  const status = summarizeExecutionStatus(logs);

  const persisted = await prisma.executionRun.create({
    data: {
      userId,
      workflowId: workflow.id,
      scope: parsed.data.mode,
      status,
      durationMs,
      nodeLogs: logs,
    },
  });

  return NextResponse.json({
    id: persisted.id,
    workflowId: workflow.id,
    scope: persisted.scope,
    status: persisted.status,
    durationMs,
    createdAt: persisted.createdAt,
    nodeLogs: logs,
  });
}