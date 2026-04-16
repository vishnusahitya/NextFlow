import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signTransloaditParams } from "@/lib/transloadit";

const templateSchema = z.object({
  maxSize: z.number().int().positive().optional(),
  accept: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const parsed = templateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const signed = signTransloaditParams({
      steps: {
        upload: {
          robot: "/upload/handle",
        },
      },
    });
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
