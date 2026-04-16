export type NodeExecutionStatus = "idle" | "running" | "success" | "error";

export enum NodeType {
  Text = "text",
  UploadImage = "uploadImage",
  UploadVideo = "uploadVideo",
  RunLLM = "runLLM",
  CropImage = "cropImage",
  ExtractFrame = "extractFrame",
}

export type WorkflowNode = {
  id: string;
  type: NodeType | string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  selected?: boolean;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  animated?: boolean;
};

export type ExecutionMode = "full" | "partial" | "single";
export type ExecutionStatus = "success" | "failed" | "partial" | "running";

export type NodeExecutionLog = {
  nodeId: string;
  nodeType: string;
  inputs: Record<string, unknown>;
  outputs?: unknown;
  error?: string | null;
  durationMs: number;
};

export type WorkflowExecutionResult = {
  status: ExecutionStatus;
  durationMs: number;
  nodeLogs: NodeExecutionLog[];
};
