import { existsSync, promises as fs } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import ffmpegPath from "ffmpeg-static";

const require = createRequire(import.meta.url);

function stripWrappingQuotes(value: string) {
  return value.replace(/^"(.*)"$/, "$1");
}

function resolveFfmpegFromRequire() {
  try {
    const loaded = require("ffmpeg-static") as string | null | undefined;
    return loaded ?? null;
  } catch {
    return null;
  }
}

function ensureFfmpegPath() {
  const candidates = [
    process.env.FFMPEG_BIN ?? null,
    ffmpegPath,
    resolveFfmpegFromRequire(),
  ]
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => stripWrappingQuotes(candidate));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const details = candidates.length > 0 ? candidates.join(", ") : "(none)";
  throw new Error(
    `ffmpeg binary is unavailable. Checked paths: ${details}.`,
  );
}

function bufferToDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function writeTempFile(url: string, extension: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch media URL (${res.status})`);
  }
  const file = path.join(tmpdir(), `nextflow-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`);
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

async function readAndCleanup(files: string[]) {
  const [first, ...rest] = files;
  const output = await fs.readFile(first);
  await Promise.all(
    files.map(async (file) => {
      try {
        await fs.unlink(file);
      } catch {
        // no-op
      }
    }),
  );
  for (const file of rest) {
    void file;
  }
  return output;
}

async function getVideoDurationSeconds(inputPath: string) {
  const binary = ensureFfmpegPath();
  try {
    const { stderr } = await execa(binary, ["-i", inputPath], {
      reject: false,
    });
    const match = stderr.match(/Duration:\s+(\d{2}):(\d{2}):(\d{2}\.\d+)/);
    if (!match) return 0;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    return hours * 3600 + minutes * 60 + seconds;
  } catch {
    return 0;
  }
}

function parseTimestamp(raw: string, durationSeconds: number) {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (trimmed.endsWith("%")) {
    const pct = Number.parseFloat(trimmed.slice(0, -1));
    if (Number.isNaN(pct) || durationSeconds <= 0) return 0;
    return (Math.max(0, Math.min(100, pct)) / 100) * durationSeconds;
  }
  const parts = trimmed.split(":").map(Number);
  if (parts.some(Number.isNaN)) {
    return 0;
  }
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
}

export async function cropImageWithFfmpeg(payload: {
  imageUrl: string;
  xPercent?: number;
  yPercent?: number;
  widthPercent?: number;
  heightPercent?: number;
}) {
  const binary = ensureFfmpegPath();
  const inputPath = await writeTempFile(payload.imageUrl, "input");
  const outputPath = path.join(
    tmpdir(),
    `nextflow-crop-${Date.now()}-${Math.random().toString(16).slice(2)}.png`,
  );

  const x = payload.xPercent ?? 0;
  const y = payload.yPercent ?? 0;
  const width = payload.widthPercent ?? 100;
  const height = payload.heightPercent ?? 100;

  const filter = `crop=iw*${width}/100:ih*${height}/100:iw*${x}/100:ih*${y}/100`;
  await execa(binary, ["-y", "-i", inputPath, "-vf", filter, outputPath]);

  const outputBuffer = await readAndCleanup([outputPath, inputPath]);
  return bufferToDataUrl(outputBuffer, "image/png");
}

export async function extractFrameWithFfmpeg(payload: {
  videoUrl: string;
  timestamp?: string;
}) {
  const binary = ensureFfmpegPath();
  const inputPath = await writeTempFile(payload.videoUrl, "input");
  const outputPath = path.join(
    tmpdir(),
    `nextflow-frame-${Date.now()}-${Math.random().toString(16).slice(2)}.png`,
  );

  const duration = await getVideoDurationSeconds(inputPath);
  const ts = parseTimestamp(payload.timestamp ?? "0", duration);

  await execa(binary, [
    "-y",
    "-ss",
    String(ts),
    "-i",
    inputPath,
    "-frames:v",
    "1",
    outputPath,
  ]);

  const outputBuffer = await readAndCleanup([outputPath, inputPath]);
  return bufferToDataUrl(outputBuffer, "image/png");
}
