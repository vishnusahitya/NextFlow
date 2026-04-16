import type {
  ExecutionScope,
  ExecutionStatus,
  ExecutionSummary,
  NodeExecutionLog,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  WorkflowSummary,
} from "../backend.d.ts";

// Re-export backend types for use across the app
export type {
  ExecutionScope,
  ExecutionStatus,
  ExecutionSummary,
  NodeExecutionLog,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  WorkflowSummary,
};

export enum NodeType {
  text = "text",
  uploadImage = "uploadImage",
  uploadVideo = "uploadVideo",
  runLLM = "runLLM",
  cropImage = "cropImage",
  extractFrame = "extractFrame",
}

export interface NodeTypeDefinition {
  type: NodeType;
  label: string;
  description: string;
  icon: string;
  category: "input" | "transform" | "ai";
  color: string;
}

export const NODE_TYPE_DEFINITIONS: NodeTypeDefinition[] = [
  {
    type: NodeType.text,
    label: "Text Node",
    description: "Text input with output handle",
    icon: "Type",
    category: "input",
    color: "oklch(0.65 0.15 240)",
  },
  {
    type: NodeType.uploadImage,
    label: "Upload Image",
    description: "Upload JPG, PNG, WebP, GIF with preview",
    icon: "Image",
    category: "input",
    color: "oklch(0.65 0.18 155)",
  },
  {
    type: NodeType.uploadVideo,
    label: "Upload Video",
    description: "Upload MP4, MOV, WebM with preview",
    icon: "Video",
    category: "input",
    color: "oklch(0.65 0.15 280)",
  },
  {
    type: NodeType.runLLM,
    label: "Run Any LLM",
    description: "Gemini model with system prompt and multimodal input",
    icon: "Sparkles",
    category: "ai",
    color: "oklch(0.65 0.21 200)",
  },
  {
    type: NodeType.cropImage,
    label: "Crop Image",
    description: "Crop with configurable x%, y%, width%, height%",
    icon: "Crop",
    category: "transform",
    color: "oklch(0.65 0.18 70)",
  },
  {
    type: NodeType.extractFrame,
    label: "Extract Frame from Video",
    description: "Extract a single frame by seconds or percentage",
    icon: "Film",
    category: "transform",
    color: "oklch(0.65 0.19 22)",
  },
];

export interface ExecutionRecord {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  scope: ExecutionScope;
  durationMs: bigint;
  createdAt: bigint;
  nodeLogs: NodeExecutionLog[];
}

export interface FlowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}
