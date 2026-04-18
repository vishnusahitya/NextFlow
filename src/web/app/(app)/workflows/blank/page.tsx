import WorkflowBuilderPage from "@/components/workflow/workflow-builder-page";

export default function BlankWorkflowPage() {
  return (
    <WorkflowBuilderPage
      workflow={{
        id: "blank",
        name: "New Workflow",
        description: null,
        nodes: [],
        edges: [],
      }}
    />
  );
}

