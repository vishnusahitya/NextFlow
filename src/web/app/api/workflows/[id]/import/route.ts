import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workflowCreateSchema } from "@/lib/zod/workflow";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.workflow.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const payload = await req.json().catch(() => null);
  const parsed = workflowCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid import payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await prisma.workflow.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      nodes: parsed.data.nodes as Prisma.InputJsonValue,
      edges: parsed.data.edges as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(updated);
}
