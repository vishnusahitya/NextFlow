import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workflowUpdateSchema } from "@/lib/zod/workflow";

async function getOwnedWorkflow(id: string, userId: string) {
  return prisma.workflow.findFirst({
    where: {
      id,
      userId,
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const workflow = await getOwnedWorkflow(id, userId);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  return NextResponse.json(workflow);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const existing = await getOwnedWorkflow(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const payload = await req.json().catch(() => null);
  const parsed = workflowUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const workflow = await prisma.workflow.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description ?? null }
        : {}),
      ...(parsed.data.nodes ? { nodes: parsed.data.nodes } : {}),
      ...(parsed.data.edges ? { edges: parsed.data.edges } : {}),
    },
  });

  return NextResponse.json(workflow);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const existing = await getOwnedWorkflow(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  await prisma.workflow.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
