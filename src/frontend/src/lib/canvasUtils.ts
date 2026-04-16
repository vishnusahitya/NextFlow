/**
 * Canvas-based image crop and video frame extraction utilities.
 * All operations are purely frontend — no external services.
 */

/**
 * Crop an image by percentage coordinates.
 * @param sourceUrl - data URL, blob URL, or CORS-enabled HTTP URL
 * @param xPct - left offset as percentage (0–100)
 * @param yPct - top offset as percentage (0–100)
 * @param widthPct - crop width as percentage (0–100)
 * @param heightPct - crop height as percentage (0–100)
 * @returns data URL (image/png) of the cropped region
 */
export function cropImage(
  sourceUrl: string,
  xPct: number,
  yPct: number,
  widthPct: number,
  heightPct: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;

      const srcX = Math.round((xPct / 100) * w);
      const srcY = Math.round((yPct / 100) * h);
      const srcW = Math.max(1, Math.round((widthPct / 100) * w));
      const srcH = Math.max(1, Math.round((heightPct / 100) * h));

      const canvas = document.createElement("canvas");
      canvas.width = srcW;
      canvas.height = srcH;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = sourceUrl;
  });
}

/**
 * Extract a single frame from a video at a given timestamp.
 * @param videoUrl - blob URL or CORS-enabled video URL
 * @param timestamp - position in seconds, HH:MM:SS, MM:SS, or percentage ("50%")
 * @returns data URL (image/png) of the extracted frame
 */
export function extractFrame(
  videoUrl: string,
  timestamp: number | string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "metadata";

    const timeout = setTimeout(
      () => reject(new Error("Frame extraction timed out")),
      20_000,
    );

    const cleanup = () => {
      clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      video.src = "";
    };

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const raw =
        typeof timestamp === "number"
          ? timestamp
          : parseTimestampToSeconds(timestamp, duration);
      const clamped = Math.min(Math.max(0, raw), duration || raw);
      video.currentTime = clamped;
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");
      cleanup();
      resolve(dataUrl);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video for frame extraction"));
    };

    video.src = videoUrl;
    video.load();
  });
}

/**
 * Parse human-friendly timestamp strings to seconds.
 * Accepts: plain numbers, "SS", "MM:SS", "HH:MM:SS", "50%"
 */
export function parseTimestampToSeconds(
  ts: string,
  videoDurationSeconds?: number,
): number {
  const trimmed = ts.trim();
  if (!trimmed) return 0;

  if (trimmed.endsWith("%")) {
    const percent = Number.parseFloat(trimmed.slice(0, -1));
    if (Number.isNaN(percent)) return 0;
    const duration = videoDurationSeconds ?? 0;
    if (duration <= 0) return 0;
    return (Math.max(0, Math.min(100, percent)) / 100) * duration;
  }

  const parts = trimmed.split(":").map(Number);

  if (parts.some(Number.isNaN)) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] ?? 0;
}
