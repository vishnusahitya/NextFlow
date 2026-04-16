import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  Download,
  Loader2,
  Layers,
  Menu,
  Pencil,
  Play,
  Plus,
  Upload,
  User,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useCreateWorkflow } from "../../hooks/useBackend";
import { useExecutionEngine } from "../../hooks/useExecutionEngine";
import { cn } from "../../lib/utils";
import { useWorkflowStore } from "../../stores/workflowStore";

interface WorkflowJSON {
  name?: string;
  nodes?: unknown[];
  edges?: unknown[];
}

function isWorkflowJSON(value: unknown): value is WorkflowJSON {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (obj.nodes !== undefined && !Array.isArray(obj.nodes)) return false;
  if (obj.edges !== undefined && !Array.isArray(obj.edges)) return false;
  return true;
}

export function Header() {
  const {
    currentWorkflowName,
    setCurrentWorkflowName,
    isSidebarOpen,
    toggleSidebar,
    nodes,
    edges,
    currentWorkflow,
    setNodes,
    setEdges,
  } = useWorkflowStore();

  const { executeFullWorkflow, executePartial, isExecuting } =
    useExecutionEngine();

  const createWorkflow = useCreateWorkflow();
  const navigate = useNavigate();
  const { clear } = useInternetIdentity();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(currentWorkflowName);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const selectedNodeIds = nodes
    .filter((n) => n.selected)
    .map((n) => n.id);

  const handleNameClick = () => {
    setNameValue(currentWorkflowName);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 10);
  };

  const handleNameBlur = () => {
    if (nameValue.trim()) {
      setCurrentWorkflowName(nameValue.trim());
    }
    setEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === "Escape") {
      setNameValue(currentWorkflowName);
      setEditingName(false);
    }
  };

  const handleExportJSON = () => {
    const payload = {
      name: currentWorkflowName,
      nodes,
      edges,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentWorkflowName.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    importFileRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const raw: unknown = JSON.parse(evt.target?.result as string);
        if (!isWorkflowJSON(raw)) {
          toast.error("Invalid workflow file", {
            description: "The file does not contain a valid workflow JSON.",
          });
          return;
        }
        // biome-ignore lint/suspicious/noExplicitAny: imported JSON nodes/edges
        setNodes((raw.nodes ?? []) as any[]);
        // biome-ignore lint/suspicious/noExplicitAny: imported JSON nodes/edges
        setEdges((raw.edges ?? []) as any[]);
        if (raw.name) setCurrentWorkflowName(raw.name);
        toast.success("Workflow imported", {
          description: `Loaded "${raw.name ?? "Untitled Workflow"}"`,
        });
      } catch {
        toast.error("Failed to parse JSON", {
          description: "Make sure the file is a valid JSON workflow export.",
        });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleNewWorkflow = async () => {
    const wf = await createWorkflow.mutateAsync({
      name: "Untitled Workflow",
      nodes: [],
      edges: [],
    });
    await navigate({ to: "/workflow/$id", params: { id: wf.id } });
  };

  return (
    <header
      className="flex items-center justify-between px-4 h-14 bg-card border-b border-border shrink-0 z-20"
      data-ocid="app.header"
    >
      {/* Left: Logo + sidebar toggle + workflow name */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={toggleSidebar}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          data-ocid="app.sidebar_toggle"
        >
          {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* NextFlow logo */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center">
            <span className="text-accent font-display font-bold text-sm">
              N
            </span>
          </div>
          <span className="font-display font-semibold text-foreground text-sm tracking-tight">
            NextFlow
          </span>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Editable workflow name */}
        {editingName ? (
          <input
            ref={nameInputRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className="bg-muted border border-accent/50 rounded px-2 py-0.5 text-sm font-medium text-foreground outline-none w-52 focus:ring-1 focus:ring-accent/50"
            data-ocid="workflow.name_input"
          />
        ) : (
          <button
            type="button"
            onClick={handleNameClick}
            className="flex items-center gap-1.5 group"
            data-ocid="workflow.name_edit_button"
          >
            <span className="text-sm font-medium text-foreground max-w-xs truncate">
              {currentWorkflow?.name ?? currentWorkflowName}
            </span>
            <Pencil
              size={12}
              className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </button>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleNewWorkflow}
          disabled={createWorkflow.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-colors disabled:opacity-50"
          data-ocid="app.new_workflow_button"
        >
          <Plus size={14} />
          New
        </button>

        {/* Hidden file input for import */}
        <input
          ref={importFileRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportFile}
          className="hidden"
          aria-label="Import workflow JSON"
          data-ocid="app.import_file_input"
        />

        <button
          type="button"
          onClick={handleImportClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
          data-ocid="app.import_json_button"
        >
          <Upload size={14} />
          Import
        </button>

        <button
          type="button"
          onClick={handleExportJSON}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
          data-ocid="app.export_json_button"
        >
          <Download size={14} />
          Export
        </button>

        <button
          type="button"
          onClick={() => executePartial(selectedNodeIds)}
          disabled={isExecuting || selectedNodeIds.length === 0}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
            selectedNodeIds.length > 0
              ? "bg-[oklch(0.68_0.19_305/0.12)] border border-[oklch(0.68_0.19_305/0.45)] text-[oklch(0.82_0.1_305)] hover:bg-[oklch(0.68_0.19_305/0.2)]"
              : "bg-card border border-border text-muted-foreground",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
          data-ocid="app.execute_selected_button"
        >
          <Layers size={13} />
          Run Selected
          {selectedNodeIds.length > 0 && (
            <span className="font-mono text-[10px] opacity-80">
              ({selectedNodeIds.length})
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={executeFullWorkflow}
          disabled={isExecuting || nodes.length === 0}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-all",
            isExecuting
              ? "bg-accent/20 border border-accent/40 text-accent animate-pulse-glow"
              : "bg-accent/10 border border-accent/40 text-accent hover:bg-accent/20 hover:border-accent/60",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
          data-ocid="app.execute_button"
        >
          {isExecuting ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Play size={13} />
          )}
          {isExecuting ? "Running…" : "Execute"}
        </button>

        <div className="w-px h-5 bg-border" />

        {/* User menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            data-ocid="app.user_menu_button"
          >
            <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
              <User size={12} className="text-accent" />
            </div>
            <ChevronDown size={12} />
          </button>

          {showUserMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-node py-1 z-50 animate-scale-in"
              data-ocid="app.user_menu.dropdown_menu"
            >
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs text-muted-foreground">Signed in via</p>
                <p className="text-xs font-medium text-foreground truncate mt-0.5">
                  Internet Identity
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  clear();
                }}
                className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-muted transition-colors"
                data-ocid="app.sign_out_button"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
