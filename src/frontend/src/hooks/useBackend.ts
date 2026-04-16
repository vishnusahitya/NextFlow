import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createActor } from "../backend";
import type {
  AppendExecutionRequest,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
} from "../backend.d.ts";

// A typed hook that returns the backend actor
export function useBackendActor() {
  return useActor(createActor);
}

export function useListWorkflows() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listWorkflows();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetWorkflow(id: string | null) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["workflow", id],
    queryFn: async () => {
      if (!actor || !id) return null;
      return actor.getWorkflow(id);
    },
    enabled: !!actor && !isFetching && !!id,
  });
}

export function useCreateWorkflow() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: CreateWorkflowRequest) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createWorkflow(req);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}

export function useUpdateWorkflow() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: UpdateWorkflowRequest) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateWorkflow(req);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      qc.invalidateQueries({ queryKey: ["workflow", variables.id] });
    },
  });
}

export function useDeleteWorkflow() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deleteWorkflow(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}

export function useListExecutions() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["executions"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listExecutions();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetExecution(executionId: string | null) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["execution", executionId],
    queryFn: async () => {
      if (!actor || !executionId) return null;
      return actor.getExecution(executionId);
    },
    enabled: !!actor && !isFetching && !!executionId,
  });
}

export function useAppendExecution() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: AppendExecutionRequest) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.appendExecution(req);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["executions"] });
    },
  });
}
