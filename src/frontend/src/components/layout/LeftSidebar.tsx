import { ChevronLeft, ChevronRight, FlaskConical, Search } from "lucide-react";
import { useMemo } from "react";
import {
  PRODUCT_MARKETING_KIT_EDGES,
  PRODUCT_MARKETING_KIT_NAME,
  PRODUCT_MARKETING_KIT_NODES,
} from "../../lib/sampleWorkflows";
import { cn } from "../../lib/utils";
import { useWorkflowStore } from "../../stores/workflowStore";
import { NODE_TYPE_DEFINITIONS } from "../../types/workflow";
import { NodeTypeCard } from "../sidebar/NodeTypeCard";

export function LeftSidebar() {
  const {
    isSidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    nodeSearchQuery,
    setNodeSearchQuery,
    setNodes,
    setEdges,
    setCurrentWorkflowName,
  } = useWorkflowStore();

  const filtered = useMemo(() => {
    if (!nodeSearchQuery.trim()) return NODE_TYPE_DEFINITIONS;
    const q = nodeSearchQuery.toLowerCase();
    return NODE_TYPE_DEFINITIONS.filter(
      (d) =>
        d.label.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q),
    );
  }, [nodeSearchQuery]);

  const handleLoadSample = () => {
    setNodes(PRODUCT_MARKETING_KIT_NODES);
    setEdges(PRODUCT_MARKETING_KIT_EDGES);
    setCurrentWorkflowName(PRODUCT_MARKETING_KIT_NAME);
  };

  return (
    <>
      {/* Collapsed toggle button */}
      {!isSidebarOpen && (
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Open node library"
          data-ocid="left_sidebar.open_button"
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 z-20",
            "flex items-center justify-center w-7 h-7 rounded-lg",
            "bg-card/80 border border-border/60 text-muted-foreground",
            "hover:text-foreground hover:border-accent/40 hover:bg-card",
            "transition-all duration-200 shadow-node backdrop-blur-sm",
          )}
        >
          <ChevronRight size={13} />
        </button>
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "relative flex flex-col h-full shrink-0 overflow-hidden",
          "bg-sidebar border-r border-sidebar-border",
          "transition-all duration-200 ease-in-out",
          isSidebarOpen ? "w-60" : "w-0",
        )}
        data-ocid="left_sidebar.panel"
      >
        {/* Inner container — fixed width so content doesn't squish during animation */}
        <div className="flex flex-col h-full w-60">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border shrink-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Node Library
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Collapse sidebar"
              data-ocid="left_sidebar.close_button"
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2.5 border-b border-sidebar-border shrink-0">
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search nodes…"
                value={nodeSearchQuery}
                onChange={(e) => setNodeSearchQuery(e.target.value)}
                data-ocid="left_sidebar.search_input"
                className={cn(
                  "w-full pl-7.5 pr-3 py-1.5 rounded-md text-xs",
                  "bg-muted/50 border border-border/50 text-foreground placeholder:text-muted-foreground",
                  "outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40",
                  "transition-colors duration-150",
                )}
              />
            </div>
          </div>

          {/* Node list */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 scrollbar-thin">
            {/* Section label */}
            <div className="flex items-center gap-2 px-0.5 mb-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Quick Access
              </span>
              <div className="flex-1 h-px bg-border/40" />
            </div>

            {filtered.length === 0 ? (
              <div
                className="flex flex-col items-center py-8 text-center"
                data-ocid="left_sidebar.empty_state"
              >
                <Search
                  size={20}
                  className="text-muted-foreground mb-2 opacity-40"
                />
                <p className="text-xs text-muted-foreground">
                  No nodes match your search
                </p>
              </div>
            ) : (
              filtered.map((def, idx) => (
                <NodeTypeCard key={def.type} def={def} index={idx} />
              ))
            )}
          </div>

          {/* Load Sample button */}
          <div className="px-3 pt-2 pb-1 border-t border-sidebar-border shrink-0">
            <button
              type="button"
              onClick={handleLoadSample}
              data-ocid="left_sidebar.load_sample_button"
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                "bg-accent/10 border border-accent/30 text-accent",
                "hover:bg-accent/20 hover:border-accent/50",
                "transition-all duration-200",
              )}
            >
              <FlaskConical size={13} />
              Load Sample Workflow
            </button>
          </div>

          {/* Footer hint */}
          <div className="px-3 py-2.5 shrink-0">
            <p className="text-[10px] text-muted-foreground text-center">
              Drag nodes onto the canvas
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
