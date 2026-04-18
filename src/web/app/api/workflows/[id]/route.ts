import { NextRequest, NextResponse } from "next/server";
import { deleteWorkflow, getWorkflow, updateWorkflow } from "@/lib/mock-db";
import { workflowUpdateSchema } from "@/lib/zod/workflow";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workflow = await getWorkflow(id);

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  return NextResponse.json(workflow);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await getWorkflow(id);
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

  const updated = await updateWorkflow(id, {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.description !== undefined
      ? { description: parsed.data.description }
      : {}),
    ...(parsed.data.nodes !== undefined ? { nodes: parsed.data.nodes } : {}),
    ...(parsed.data.edges !== undefined ? { edges: parsed.data.edges } : {}),
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await getWorkflow(id);
  if (!existing) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  await deleteWorkflow(id);
  return NextResponse.json({ ok: true });
}
