import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runs = await prisma.executionRun.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      workflowId: true,
      scope: true,
      status: true,
      durationMs: true,
      createdAt: true,
    },
  });

  return NextResponse.json(runs);
}
