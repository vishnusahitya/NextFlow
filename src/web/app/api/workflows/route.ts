import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workflowCreateSchema } from "@/lib/zod/workflow";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workflows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      nodes: true,
      edges: true,
    },
  });

  return NextResponse.json(
    workflows.map((workflow) => ({
      ...workflow,
      nodeCount: Array.isArray(workflow.nodes) ? workflow.nodes.length : 0,
      edgeCount: Array.isArray(workflow.edges) ? workflow.edges.length : 0,
    })),
  );
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const parsed = workflowCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const workflow = await prisma.workflow.create({
    data: {
      userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      nodes: parsed.data.nodes,
      edges: parsed.data.edges,
    },
  });

  return NextResponse.json(workflow, { status: 201 });
}
