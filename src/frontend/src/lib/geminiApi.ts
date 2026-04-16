const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const API_KEY =
  (import.meta as ImportMeta & { env: Record<string, string> }).env
    .VITE_GEMINI_API_KEY ?? "";

export interface GeminiTextPart {
  text: string;
}

export interface GeminiInlineDataPart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

export type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: {
    parts: GeminiTextPart[];
  };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: GeminiTextPart[];
      role: string;
    };
    finishReason: string;
  }>;
}

function dataUrlToInlineData(dataUrl: string): {
  mimeType: string;
  data: string;
} {
  const [header, data] = dataUrl.split(",");
  const mimeType = header.match(/:(.*?);/)?.[1] ?? "image/png";
  return { mimeType, data: data ?? "" };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 32_768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function buildImagePart(imageRef: string): Promise<GeminiInlineDataPart> {
  if (imageRef.startsWith("data:")) {
    const { mimeType, data } = dataUrlToInlineData(imageRef);
    return { inlineData: { mimeType, data } };
  }

  if (/^https?:\/\//i.test(imageRef)) {
    const resp = await fetch(imageRef);
    if (!resp.ok) {
      throw new Error(`Failed to fetch image URL (${resp.status})`);
    }
    const mimeType = resp.headers.get("content-type") ?? "image/png";
    const data = arrayBufferToBase64(await resp.arrayBuffer());
    return { inlineData: { mimeType, data } };
  }

  return { inlineData: { mimeType: "image/png", data: imageRef } };
}

export interface RunGeminiOptions {
  model: string;
  systemPrompt?: string;
  userMessage: string;
  imageUrls?: string[];
  temperature?: number;
  maxTokens?: number;
}

export async function runGemini(options: RunGeminiOptions): Promise<string> {
  if (!API_KEY) {
    throw new Error(
      "Gemini API key not configured. Set VITE_GEMINI_API_KEY in your environment.",
    );
  }

  const {
    model,
    systemPrompt,
    userMessage,
    imageUrls = [],
    temperature,
    maxTokens,
  } = options;

  const userParts: GeminiPart[] = [];
  for (const imageRef of imageUrls) {
    if (!imageRef) continue;
    userParts.push(await buildImagePart(imageRef));
  }
  userParts.push({ text: userMessage });

  const body: GeminiRequest = {
    contents: [{ role: "user", parts: userParts }],
  };

  if (systemPrompt?.trim()) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  if (temperature !== undefined || maxTokens !== undefined) {
    body.generationConfig = {};
    if (temperature !== undefined)
      body.generationConfig.temperature = temperature;
    if (maxTokens !== undefined)
      body.generationConfig.maxOutputTokens = maxTokens;
  }

  const url = `${GEMINI_BASE}/${model}:generateContent?key=${API_KEY}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`Gemini API error ${resp.status}: ${errText}`);
  }

  const json = (await resp.json()) as GeminiResponse;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}
