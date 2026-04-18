"use client";

import { useWorkflowBuilderStore } from "@/store/workflow-builder-store";
import { sampleNodes, sampleEdges } from "@/lib/sample-workflow";

// Simple wrapper
export default function WorkflowBuilderPage({ initialNodes = sampleNodes, initialEdges = sampleEdges, initialName = "Sample" }: { initialNodes: any[], initialEdges: any[], initialName?: string }) {
  const setWorkflow = useWorkflowBuilderStore(state => state.setWorkflow);
  
  // Load sample
  setWorkflow({
    workflowId: 'sample',
    workflowName: initialName,
    nodes: initialNodes,
    edges: initialEdges,
  });

  // Embed React Flow canvas here (stub for now)
  return <div>Workflow Builder Loaded - Sample ready (canvas would render here). Check console for store state.</div>;
}
