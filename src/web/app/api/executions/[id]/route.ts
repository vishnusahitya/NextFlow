import { NextRequest, NextResponse } from "next/server";
import { getExecutionRecord } from "@/lib/execution-history-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = getExecutionRecord(id);

  if (!run) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  return NextResponse.json(run);
}
