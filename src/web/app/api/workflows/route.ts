import { NextRequest, NextResponse } from "next/server";
import { getWorkflows, createWorkflow } from "@/lib/mock-db";
import { workflowCreateSchema } from "@/lib/zod/workflow";

export async function GET() {
  const workflows = await getWorkflows();
  return NextResponse.json(
    workflows.map((workflow) => ({
      ...workflow,
      nodeCount: Array.isArray(workflow.nodes) ? workflow.nodes.length : 0,
      edgeCount: Array.isArray(workflow.edges) ? workflow.edges.length : 0,
    })),
  );
}

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  const parsed = workflowCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const workflow = await createWorkflow({
    name: parsed.data.name,
    description: parsed.data.description,
    nodes: parsed.data.nodes,
    edges: parsed.data.edges,
  });

  return NextResponse.json(workflow, { status: 201 });
}
