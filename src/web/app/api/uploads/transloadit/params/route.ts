import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signTransloaditParams } from "@/lib/transloadit";

const templateSchema = z.object({
  kind: z.enum(["image", "video"]).optional(),
  maxSize: z.number().int().positive().optional(),
  accept: z.array(z.string()).optional(),
  signatureAlgorithm: z.enum(["sha1", "sha384"]).optional(),
});

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const parsed = templateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const maxSize = parsed.data.maxSize ?? 100 * 1024 * 1024;
    const accepted = (parsed.data.accept ?? []).map((item) => item.toLowerCase());
    const isVideo = parsed.data.kind === "video";

    const signed = signTransloaditParams({
      steps: {
        ":original": {
          robot: "/upload/handle",
          accepts: accepted.length > 0 ? accepted : undefined,
          ...(isVideo ? { result: true } : {}),
        },
      },
      fields: {
        max_file_size: String(maxSize),
      },
    }, parsed.data.signatureAlgorithm);

    return NextResponse.json(signed);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create upload params",
      },
      { status: 500 },
    );
  }
}
