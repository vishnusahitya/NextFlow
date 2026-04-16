/**
 * useExecutionEngine hook
 *
 * Exposes:
 *   executeFullWorkflow()    — runs all nodes
 *   executeSingleNode(id)    — runs only the specified node
 *   executePartial(ids)      — runs selected nodes + their deps
 *   isExecuting              — global execution flag
 *   nodeStatuses             — Map<nodeId, NodeExecutionStatus> for real-time UI
 */

import { useCallback } from "react";
import { toast } from "sonner";
import { ExecutionScope, ExecutionStatus } from "../backend";
import type { NodeExecutionLog } from "../backend.d.ts";
import type { ExecuteWorkflowOptions } from "../lib/executionEngine";
import { executeWorkflow } from "../lib/executionEngine";
import type { NodeExecutionStatus } from "../lib/executionEngine";
import { useHistoryStore } from "../stores/historyStore";
import { useWorkflowStore } from "../stores/workflowStore";
import type { ExecutionRecord } from "../types/workflow";
import { useAppendExecution } from "./useBackend";

export function useExecutionEngine() {
  const {
    nodes,
    edges,
    currentWorkflow,
    setIsExecuting,
    isExecuting,
    updateNodeData,
    setNodeExecutionStatus,
    clearNodeExecutionStatuses,
    nodeExecutionStatus,
  } = useWorkflowStore();

  const { addExecution } = useHistoryStore();
  const appendExecution = useAppendExecution();

  const handleStatusChange = useCallback(
    (nodeId: string, status: NodeExecutionStatus) => {
      setNodeExecutionStatus(nodeId, status);
    },
    [setNodeExecutionStatus],
  );

  const handleDataUpdate = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      updateNodeData(nodeId, data);
    },
    [updateNodeData],
  );

  const run = useCallback(
    async (mode: "full" | "single" | "partial", targetNodeIds?: string[]) => {
      if (isExecuting) return;
      if (nodes.length === 0) {
        toast.error("Add some nodes to the canvas first");
        return;
      }

      setIsExecuting(true);
      clearNodeExecutionStatuses();

      try {
        const result = await executeWorkflow({
          nodes,
          edges,
          mode,
          targetNodeIds,
          onStatusChange: handleStatusChange,
          onDataUpdate: handleDataUpdate,
        });

        // Show toast feedback
        if (result.status === ExecutionStatus.success) {
          toast.success("Workflow completed successfully");
        } else if (result.status === ExecutionStatus.partial) {
          toast.warning("Workflow completed with some errors");
        } else {
          toast.error("Workflow execution failed");
        }

        // Build local execution record
        const record: ExecutionRecord = {
          id: `exec-${Date.now()}`,
          workflowId: currentWorkflow?.id ?? "local",
          status: result.status,
          scope: result.scope,
          durationMs: result.durationMs,
          createdAt: BigInt(Date.now()),
          nodeLogs: result.nodeLogs,
        };
        addExecution(record);

        // Persist to backend if workflow is saved
        if (currentWorkflow?.id) {
          appendExecution
            .mutateAsync({
              workflowId: currentWorkflow.id,
              status: result.status,
              scope: result.scope,
              durationMs: result.durationMs,
              nodeLogs: result.nodeLogs.map(
                (l): NodeExecutionLog => ({
                  nodeId: l.nodeId,
                  nodeType: l.nodeType,
                  inputs: l.inputs,
                  outputs: l.outputs,
                  error: l.error,
                  durationMs: l.durationMs,
                }),
              ),
            })
            .catch((err: unknown) => {
              console.warn("Failed to persist execution to backend:", err);
            });
        }

        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        toast.error(`Execution error: ${msg}`);

        // Persist a failed record
        const failedRecord: ExecutionRecord = {
          id: `exec-${Date.now()}`,
          workflowId: currentWorkflow?.id ?? "local",
          status: ExecutionStatus.failed,
          scope:
            mode === "full"
              ? ExecutionScope.full
              : mode === "single"
                ? ExecutionScope.single
                : ExecutionScope.partial,
          durationMs: BigInt(0),
          createdAt: BigInt(Date.now()),
          nodeLogs: [],
        };
        addExecution(failedRecord);
      } finally {
        setIsExecuting(false);
      }
    },
    [
      isExecuting,
      nodes,
      edges,
      currentWorkflow,
      setIsExecuting,
      clearNodeExecutionStatuses,
      handleStatusChange,
      handleDataUpdate,
      addExecution,
      appendExecution,
    ],
  );

  const executeFullWorkflow = useCallback(() => run("full"), [run]);

  const executeSingleNode = useCallback(
    (nodeId: string) => run("single", [nodeId]),
    [run],
  );

  const executePartial = useCallback(
    (nodeIds: string[]) => run("partial", nodeIds),
    [run],
  );

  // Convert the store's record to a Map for convenience
  const nodeStatuses = new Map(
    Object.entries(nodeExecutionStatus) as [string, NodeExecutionStatus][],
  );

  return {
    executeFullWorkflow,
    executeSingleNode,
    executePartial,
    isExecuting,
    nodeStatuses,
  };
}
