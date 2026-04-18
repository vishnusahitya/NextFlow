export const sampleNodes = [
  {
    id: "upload-image-1",
    type: "uploadImage",
    position: { x: 120, y: 120 },
    data: {},
  },
  {
    id: "crop-image-1",
    type: "cropImage",
    position: { x: 420, y: 120 },
    data: { cropX: 10, cropY: 10, cropW: 80, cropH: 80 },
  },
  {
    id: "text-system-1",
    type: "text",
    position: { x: 120, y: 380 },
    data: {
      text: "You are a professional marketing copywriter. Generate a compelling one-paragraph product description.",
    },
  },
  {
    id: "text-product-1",
    type: "text",
    position: { x: 420, y: 380 },
    data: {
      text: "Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.",
    },
  },
  {
    id: "llm-branch-a",
    type: "runLLM",
    position: { x: 740, y: 250 },
    data: { model: "gemini-2.0-flash" },
  },
  {
    id: "upload-video-1",
    type: "uploadVideo",
    position: { x: 120, y: 640 },
    data: {},
  },
  {
    id: "extract-frame-1",
    type: "extractFrame",
    position: { x: 420, y: 640 },
    data: { timestamp: "50%" },
  },
  {
    id: "text-system-2",
    type: "text",
    position: { x: 740, y: 620 },
    data: {
      text: "You are a social media manager. Create a tweet-length marketing post based on the product image and video frame.",
    },
  },
  {
    id: "llm-final",
    type: "runLLM",
    position: { x: 1060, y: 440 },
    data: { model: "gemini-2.0-flash" },
  },
];

export const sampleEdges = [
  { id: "e1", source: "upload-image-1", target: "crop-image-1", sourceHandle: "image-out", targetHandle: "image-in", animated: true },
  { id: "e2", source: "text-system-1", target: "llm-branch-a", sourceHandle: "text-out", targetHandle: "system-prompt-in", animated: true },
  { id: "e3", source: "text-product-1", target: "llm-branch-a", sourceHandle: "text-out", targetHandle: "user-message-in", animated: true },
  { id: "e4", source: "crop-image-1", target: "llm-branch-a", sourceHandle: "image-out", targetHandle: "images-in", animated: true },
  { id: "e5", source: "upload-video-1", target: "extract-frame-1", sourceHandle: "video-out", targetHandle: "video-in", animated: true },
  { id: "e6", source: "text-system-2", target: "llm-final", sourceHandle: "text-out", targetHandle: "system-prompt-in", animated: true },
  { id: "e7", source: "llm-branch-a", target: "llm-final", sourceHandle: "text-out", targetHandle: "user-message-in", animated: true },
  { id: "e8", source: "crop-image-1", target: "llm-final", sourceHandle: "image-out", targetHandle: "images-in", animated: true },
  { id: "e9", source: "extract-frame-1", target: "llm-final", sourceHandle: "image-out", targetHandle: "images-in", animated: true },
];

export async function ensureSampleWorkflow(dummyUserId: string = 'demo') {
  return {
    id: 'sample',
    name: "Product Marketing Kit Generator",
    description: "Sample workflow covering all node types, parallel branches, and final convergence.",
    nodes: sampleNodes,
    edges: sampleEdges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
