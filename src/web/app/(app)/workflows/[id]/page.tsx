import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WorkflowBuilderPage } from "@/components/workflow/workflow-builder-page";

type WorkflowPageProps = {
  params: Promise<{ id: string }>;
};

export default async function WorkflowPage({ params }: WorkflowPageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { id } = await params;
  if (id === "new") {
    // Ensure user exists in DB
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    const workflow = await prisma.workflow.create({
      data: {
        userId,
        name: "Untitled Workflow",
        nodes: [],
        edges: [],
      },
    });
    redirect(`/workflows/${workflow.id}`);
  }

  const workflow = await prisma.workflow.findFirst({
    where: {
      id,
      userId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      nodes: true,
      edges: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!workflow) {
    notFound();
  }

  return (
    <WorkflowBuilderPage
      workflow={{
        ...workflow,
        nodes: workflow.nodes as unknown[],
        edges: workflow.edges as unknown[],
      }}
    />
  );
}
