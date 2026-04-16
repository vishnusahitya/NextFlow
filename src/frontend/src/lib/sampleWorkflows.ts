import type { Edge, Node } from "@xyflow/react";
import { NodeType } from "../types/workflow";

const edgeStyle = { stroke: "oklch(0.68 0.19 305)", strokeWidth: 2 };

export const PRODUCT_MARKETING_KIT_NODES: Node[] = [
  // Branch A: image + prompts -> LLM #1
  {
    id: "node-upload-image",
    type: NodeType.uploadImage,
    position: { x: 80, y: 120 },
    data: {},
  },
  {
    id: "node-crop-image",
    type: NodeType.cropImage,
    position: { x: 380, y: 120 },
    data: { cropX: 10, cropY: 10, cropW: 80, cropH: 80 },
  },
  {
    id: "node-system-a",
    type: NodeType.text,
    position: { x: 720, y: 40 },
    data: {
      text: "You are a professional marketing copywriter. Generate a compelling one-paragraph product description.",
    },
  },
  {
    id: "node-user-a",
    type: NodeType.text,
    position: { x: 720, y: 260 },
    data: {
      text: "Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.",
    },
  },
  {
    id: "node-llm-a",
    type: NodeType.runLLM,
    position: { x: 1080, y: 140 },
    data: { model: "gemini-2.0-flash", showSystemPrompt: true },
  },

  // Branch B: video -> extract frame
  {
    id: "node-upload-video",
    type: NodeType.uploadVideo,
    position: { x: 80, y: 500 },
    data: {},
  },
  {
    id: "node-extract-frame",
    type: NodeType.extractFrame,
    position: { x: 380, y: 500 },
    data: { timestamp: "50%" },
  },

  // Convergence: final LLM waits on both branches
  {
    id: "node-system-b",
    type: NodeType.text,
    position: { x: 1080, y: 470 },
    data: {
      text: "You are a social media manager. Create a tweet-length marketing post based on the product image and video frame.",
    },
  },
  {
    id: "node-llm-final",
    type: NodeType.runLLM,
    position: { x: 1470, y: 300 },
    data: { model: "gemini-2.0-flash", showSystemPrompt: true },
  },
];

export const PRODUCT_MARKETING_KIT_EDGES: Edge[] = [
  // Branch A
  {
    id: "edge-a-image",
    source: "node-upload-image",
    sourceHandle: "image-out",
    target: "node-crop-image",
    targetHandle: "image-in",
    animated: true,
    style: edgeStyle,
  },
  {
    id: "edge-a-system",
    source: "node-system-a",
    sourceHandle: "text-out",
    target: "node-llm-a",
    targetHandle: "system-prompt-in",
    animated: true,
    style: edgeStyle,
  },
  {
    id: "edge-a-user",
    source: "node-user-a",
    sourceHandle: "text-out",
    target: "node-llm-a",
    targetHandle: "user-message-in",
    animated: true,
    style: edgeStyle,
  },
  {
    id: "edge-a-image-to-llm",
    source: "node-crop-image",
    sourceHandle: "image-out",
    target: "node-llm-a",
    targetHandle: "images-in",
    animated: true,
    style: edgeStyle,
  },

  // Branch B
  {
    id: "edge-b-video",
    source: "node-upload-video",
    sourceHandle: "video-out",
    target: "node-extract-frame",
    targetHandle: "video-in",
    animated: true,
    style: edgeStyle,
  },

  // Convergence to final LLM
  {
    id: "edge-final-system",
    source: "node-system-b",
    sourceHandle: "text-out",
    target: "node-llm-final",
    targetHandle: "system-prompt-in",
    animated: true,
    style: edgeStyle,
  },
  {
    id: "edge-final-user",
    source: "node-llm-a",
    sourceHandle: "text-out",
    target: "node-llm-final",
    targetHandle: "user-message-in",
    animated: true,
    style: edgeStyle,
  },
  {
    id: "edge-final-image-a",
    source: "node-crop-image",
    sourceHandle: "image-out",
    target: "node-llm-final",
    targetHandle: "images-in",
    animated: true,
    style: edgeStyle,
  },
  {
    id: "edge-final-image-b",
    source: "node-extract-frame",
    sourceHandle: "image-out",
    target: "node-llm-final",
    targetHandle: "images-in",
    animated: true,
    style: edgeStyle,
  },
];

export const PRODUCT_MARKETING_KIT_NAME = "Product Marketing Kit Generator";
