import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { WorkflowCanvas } from "../components/canvas/WorkflowCanvas";
import { AppLayout } from "../components/layout/AppLayout";
import { useGetWorkflow } from "../hooks/useBackend";
import { useWorkflowStore } from "../stores/workflowStore";

export default function WorkflowPage() {
  const { id } = useParams({ from: "/workflow/$id" });
  const navigate = useNavigate();
  const { loginStatus, isAuthenticated } = useInternetIdentity();
  const { setCurrentWorkflow, currentWorkflow } = useWorkflowStore();

  useEffect(() => {
    if (loginStatus === "idle") {
      navigate({ to: "/" });
    }
  }, [loginStatus, navigate]);

  const { data: workflow, isLoading } = useGetWorkflow(
    id !== "new" ? id : null,
  );

  useEffect(() => {
    if (workflow && workflow.id !== currentWorkflow?.id) {
      setCurrentWorkflow(workflow);
    }
  }, [workflow, currentWorkflow?.id, setCurrentWorkflow]);

  if (loginStatus === "initializing" || loginStatus === "logging-in") {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Authenticating…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Redirecting…</span>
        </div>
      </div>
    );
  }

  if (isLoading && id !== "new") {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div
          className="flex items-center gap-2.5 text-muted-foreground"
          data-ocid="workflow.loading_state"
        >
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading workflow…</span>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div
        className="w-full h-full relative"
        data-ocid="workflow.canvas_wrapper"
      >
        <WorkflowCanvas />
      </div>
    </AppLayout>
  );
}
