import { GoogleGenerativeAI, Part } from "@google/generative-ai";

const QUOTA_HELP_URL = "https://ai.google.dev/gemini-api/docs/rate-limits";
const USAGE_DASHBOARD_URL = "https://ai.dev/rate-limit";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function extractStatusCode(message: string): number | null {
  const bracketMatch = message.match(/\[(\d{3})\s/);
  if (bracketMatch) return Number.parseInt(bracketMatch[1], 10);
  return null;
}

function isQuotaErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("exceeded your current quota") ||
    lower.includes("insufficient_quota") ||
    lower.includes("quota")
  );
}

function isRetryableStatus(statusCode: number | null): boolean {
  return statusCode === 429 || statusCode === 500 || statusCode === 503;
}

function normalizeError(modelName: string, error: unknown): Error {
  const rawMessage = toErrorMessage(error);
  const statusCode = extractStatusCode(rawMessage);

  if (statusCode === 429 && isQuotaErrorMessage(rawMessage)) {
    return new Error(
      `Gemini quota exceeded for model "${modelName}" (429). Update billing/quota, then retry. ` +
        `Docs: ${QUOTA_HELP_URL} | Usage: ${USAGE_DASHBOARD_URL}`,
    );
  }

  if (statusCode === 429) {
    return new Error(
      `Gemini rate limit hit for model "${modelName}" (429). Reduce request frequency and retry shortly.`,
    );
  }

  if (statusCode === 503) {
    return new Error(
      `Gemini service temporarily unavailable for model "${modelName}" (503). Please retry.`,
    );
  }

  return new Error(
    `Gemini request failed for model "${modelName}". ${rawMessage}`,
  );
}

function buildMockQuotaResponse(payload: RunGeminiPayload, modelName: string) {
  const userPreview = payload.userMessage.trim().slice(0, 220);
  const imageCount = payload.imageUrls?.length ?? 0;
  return [
    "[MOCK_RESPONSE]",
    `Model: ${modelName}`,
    "Reason: Gemini quota exceeded (429).",
    `User message preview: ${userPreview || "(empty)"}`,
    `Attached images: ${imageCount}`,
    "Set GEMINI_ALLOW_MOCK_ON_QUOTA=false to disable this fallback.",
  ].join("\n");
}

async function imageUrlToPart(imageUrl: string): Promise<Part> {
  if (imageUrl.startsWith("data:")) {
    const [header, data = ""] = imageUrl.split(",");
    const mimeType = header.match(/:(.*?);/)?.[1] ?? "image/png";
    return {
      inlineData: {
        mimeType,
        data,
      },
    };
  }

  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch image URL: ${res.status}`);
  }

  const mimeType = res.headers.get("content-type") ?? "image/png";
  const data = arrayBufferToBase64(await res.arrayBuffer());
  return {
    inlineData: {
      mimeType,
      data,
    },
  };
}

export type RunGeminiPayload = {
  model: string;
  userMessage: string;
  systemPrompt?: string;
  imageUrls?: string[];
};

type GenerateOptions = {
  apiKey: string;
  modelName: string;
  payload: RunGeminiPayload;
  parts: Part[];
};

async function generateOnce(options: GenerateOptions): Promise<string> {
  const { apiKey, modelName, payload, parts } = options;
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: modelName,
    ...(payload.systemPrompt?.trim()
      ? {
          systemInstruction: payload.systemPrompt,
        }
      : {}),
  });

  const response = await model.generateContent({
    contents: [{ role: "user", parts }],
  });

  const text = response.response.text();
  if (!text) {
    throw new Error("Gemini response was empty");
  }
  return text;
}

export async function runGeminiOnServer(payload: RunGeminiPayload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  if (!payload.userMessage?.trim()) {
    throw new Error("Gemini userMessage is required");
  }

  const parts: Part[] = [];
  for (const imageUrl of payload.imageUrls ?? []) {
    parts.push(await imageUrlToPart(imageUrl));
  }
  parts.push({ text: payload.userMessage });

  const requestedModel = payload.model || "gemini-2.0-flash";
  const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const modelCandidates = [requestedModel, ...fallbackModels].filter(
    (item, index, arr) => arr.indexOf(item) === index,
  );

  const maxRetries = Number.parseInt(process.env.GEMINI_MAX_RETRIES ?? "2", 10);
  const retryBaseMs = Number.parseInt(
    process.env.GEMINI_RETRY_BASE_MS ?? "800",
    10,
  );
  const allowMockOnQuota =
    (process.env.GEMINI_ALLOW_MOCK_ON_QUOTA ?? "false").toLowerCase() ===
    "true";

  let lastError: Error | null = null;

  for (const modelName of modelCandidates) {
    for (let attempt = 0; attempt <= Math.max(0, maxRetries); attempt += 1) {
      try {
        return await generateOnce({
          apiKey,
          modelName,
          payload,
          parts,
        });
      } catch (error) {
        const message = toErrorMessage(error);
        const statusCode = extractStatusCode(message);
        const quotaExceeded =
          statusCode === 429 && isQuotaErrorMessage(message);

        if (quotaExceeded && allowMockOnQuota) {
          return buildMockQuotaResponse(payload, modelName);
        }

        lastError = normalizeError(modelName, error);

        if (quotaExceeded) {
          break;
        }

        const retryable = isRetryableStatus(statusCode);
        const hasAttemptsLeft = attempt < Math.max(0, maxRetries);
        if (!retryable || !hasAttemptsLeft) {
          break;
        }

        const delayMs = retryBaseMs * 2 ** attempt;
        await sleep(delayMs);
      }
    }
  }

  throw (
    lastError ?? new Error("Gemini request failed with no detailed error.")
  );
}
