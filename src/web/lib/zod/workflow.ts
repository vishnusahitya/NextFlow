import { z } from "zod";

export const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.record(z.string(), z.unknown()),
  selected: z.boolean().optional(),
});

export const edgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional().nullable(),
  targetHandle: z.string().optional().nullable(),
  animated: z.boolean().optional(),
});

export const workflowCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
});

export const workflowUpdateSchema = workflowCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field must be provided" },
);

export const executionNodeLogSchema = z.object({
  nodeId: z.string(),
  nodeType: z.string(),
  inputs: z.unknown(),
  outputs: z.unknown().optional(),
  error: z.string().optional().nullable(),
  durationMs: z.number().int().nonnegative(),
});

export const executionPersistSchema = z.object({
  workflowId: z.string().min(1),
  scope: z.enum(["full", "partial", "single"]),
  status: z.enum(["success", "failed", "partial", "running"]),
  durationMs: z.number().int().nonnegative(),
  nodeLogs: z.array(executionNodeLogSchema),
});

export const executionRequestSchema = z.object({
  workflowId: z.string().min(1),
  mode: z.enum(["full", "partial", "single"]),
  selectedNodeIds: z.array(z.string()).optional(),
}).superRefine((value, ctx) => {
  if ((value.mode === "partial" || value.mode === "single") && (!value.selectedNodeIds || value.selectedNodeIds.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selectedNodeIds"],
      message: "selectedNodeIds is required for partial/single mode",
    });
  }
  if (value.mode === "single" && (value.selectedNodeIds?.length ?? 0) !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selectedNodeIds"],
      message: "single mode requires exactly one selected node",
    });
  }
});

export type WorkflowCreateInput = z.infer<typeof workflowCreateSchema>;
export type WorkflowUpdateInput = z.infer<typeof workflowUpdateSchema>;
export type ExecutionPersistInput = z.infer<typeof executionPersistSchema>;
export type ExecutionRequestInput = z.infer<typeof executionRequestSchema>;
