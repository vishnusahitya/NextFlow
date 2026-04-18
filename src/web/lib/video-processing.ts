import { extractFrameWithFfmpeg } from "@/lib/media";

export async function extractFrame(videoUrl: string, timestamp = "0") {
  return extractFrameWithFfmpeg({
    videoUrl,
    timestamp,
  });
}
