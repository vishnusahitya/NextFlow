import { task } from "@trigger.dev/sdk/v3";
import { runGeminiOnServer } from "@/lib/gemini";
import { cropImageWithFfmpeg, extractFrameWithFfmpeg } from "@/lib/media";

export type RunLLMNodePayload = {
  model: string;
  systemPrompt?: string;
  userMessage: string;
  imageUrls?: string[];
};

export type CropImageNodePayload = {
  imageUrl: string;
  xPercent?: number;
  yPercent?: number;
  widthPercent?: number;
  heightPercent?: number;
};

export type ExtractFrameNodePayload = {
  videoUrl: string;
  timestamp?: string;
};

export async function runLLMNodeLocal(payload: RunLLMNodePayload) {
  const output = await runGeminiOnServer(payload);
  return { output };
}

export async function cropImageNodeLocal(payload: CropImageNodePayload) {
  const output = await cropImageWithFfmpeg(payload);
  return { output };
}

export async function extractFrameNodeLocal(payload: ExtractFrameNodePayload) {
  const output = await extractFrameWithFfmpeg(payload);
  return { output };
}

export const runLLMNodeTask = task({
  id: "node-run-llm",
  run: async (payload: RunLLMNodePayload) => {
    return runLLMNodeLocal(payload);
  },
});

export const cropImageNodeTask = task({
  id: "node-crop-image",
  run: async (payload: CropImageNodePayload) => {
    return cropImageNodeLocal(payload);
  },
});

export const extractFrameNodeTask = task({
  id: "node-extract-frame",
  run: async (payload: ExtractFrameNodePayload) => {
    return extractFrameNodeLocal(payload);
  },
});
