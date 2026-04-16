export { BaseNode } from "./BaseNode";
export type { NodeHandle, HandleType } from "./BaseNode";
export { TextNode } from "./TextNode";
export { UploadImageNode } from "./UploadImageNode";
export { UploadVideoNode } from "./UploadVideoNode";
export { RunLLMNode } from "./RunLLMNode";
export { CropImageNode } from "./CropImageNode";
export { ExtractFrameNode } from "./ExtractFrameNode";

import { CropImageNode } from "./CropImageNode";
import { ExtractFrameNode } from "./ExtractFrameNode";
import { RunLLMNode } from "./RunLLMNode";
import { TextNode } from "./TextNode";
import { UploadImageNode } from "./UploadImageNode";
import { UploadVideoNode } from "./UploadVideoNode";

export const nodeTypes = {
  text: TextNode,
  uploadImage: UploadImageNode,
  uploadVideo: UploadVideoNode,
  runLLM: RunLLMNode,
  cropImage: CropImageNode,
  extractFrame: ExtractFrameNode,
} as const;
