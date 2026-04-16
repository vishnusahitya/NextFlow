import { GoogleGenerativeAI, Part } from "@google/generative-ai";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
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

export async function runGeminiOnServer(payload: RunGeminiPayload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: payload.model || "gemini-2.0-flash",
    ...(payload.systemPrompt?.trim()
      ? {
          systemInstruction: payload.systemPrompt,
        }
      : {}),
  });

  const parts: Part[] = [];
  for (const imageUrl of payload.imageUrls ?? []) {
    parts.push(await imageUrlToPart(imageUrl));
  }
  parts.push({ text: payload.userMessage });

  const response = await model.generateContent({
    contents: [{ role: "user", parts }],
  });

  const text = response.response.text();
  if (!text) {
    throw new Error("Gemini response was empty");
  }
  return text;
}
