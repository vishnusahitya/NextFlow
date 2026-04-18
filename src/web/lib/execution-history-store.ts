import type { ExecutionStatus, NodeExecutionLog } from "@/lib/workflow-types";

export type StoredExecutionRecord = {
  id: string;
  workflowId: string;
  scope: "full" | "partial" | "single";
  status: ExecutionStatus;
  durationMs: number;
  createdAt: string;
  nodeLogs: NodeExecutionLog[];
};

const MAX_RUNS = 100;
const executionRuns: StoredExecutionRecord[] = [];

export function addExecutionRecord(run: StoredExecutionRecord) {
  executionRuns.unshift({ ...run, nodeLogs: [...run.nodeLogs] });
  if (executionRuns.length > MAX_RUNS) {
    executionRuns.splice(MAX_RUNS);
  }
}

export function listExecutionRecords(workflowId?: string): StoredExecutionRecord[] {
  if (!workflowId) {
    return executionRuns.map((run) => ({ ...run, nodeLogs: [...run.nodeLogs] }));
  }

  return executionRuns
    .filter((run) => run.workflowId === workflowId)
    .map((run) => ({ ...run, nodeLogs: [...run.nodeLogs] }));
}

export function getExecutionRecord(id: string): StoredExecutionRecord | null {
  const run = executionRuns.find((item) => item.id === id);
  if (!run) return null;
  return { ...run, nodeLogs: [...run.nodeLogs] };
}
