import { NextRequest, NextResponse } from "next/server";
import { listExecutionRecords } from "@/lib/execution-history-store";

export async function GET(req: NextRequest) {
  const workflowId = req.nextUrl.searchParams.get("workflowId") ?? undefined;
  const runs = listExecutionRecords(workflowId);
  return NextResponse.json(runs);
}
