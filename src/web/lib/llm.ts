import { runGeminiOnServer } from "@/lib/gemini";

type RunLLMPayload = {
  model?: string;
  systemPrompt?: string;
  userMessage: string;
  images?: string[];
};

export async function runLLM(payload: RunLLMPayload) {
  return runGeminiOnServer({
    model: payload.model ?? "gemini-2.0-flash",
    systemPrompt: payload.systemPrompt,
    userMessage: payload.userMessage,
    imageUrls: payload.images ?? [],
  });
}
