import { ChevronRight, History, RefreshCw } from "lucide-react";
import React, { useState } from "react";
import { useGetExecution, useListExecutions } from "../../hooks/useBackend";
import { cn } from "../../lib/utils";
import { useHistoryStore } from "../../stores/historyStore";
import type {
  ExecutionSummary,
  NodeExecutionLog,
  ExecutionRecord,
} from "../../types/workflow";
import { ExecutionHistoryItem } from "../sidebar/ExecutionHistoryItem";

function useExecutionLogs(
  executionId: string | null,
): NodeExecutionLog[] | undefined {
  const { data } = useGetExecution(executionId);
  if (!data || data.__kind__ !== "ok") return undefined;
  return data.ok.nodeLogs;
}

function HistoryItemWithLogs({
  exec,
  index,
  initialLogs,
}: {
  exec: ExecutionSummary | ExecutionRecord;
  index: number;
  initialLogs?: NodeExecutionLog[];
}) {
  const [fetchId, setFetchId] = useState<string | null>(null);
  const logs = initialLogs ?? useExecutionLogs(fetchId);

  return (
    <ExecutionHistoryItem
      exec={exec}
      index={index}
      nodeLogs={logs}
      onExpand={initialLogs ? undefined : (id) => setFetchId(id)}
    />
  );
}

export function RightSidebar() {
  const { isHistoryOpen, toggleHistory } = useHistoryStore();
  const {
    data: executions,
    isLoading,
    refetch,
    isFetching,
  } = useListExecutions();
  const localExecutions = useHistoryStore((s) => s.executions);

  const mergedExecutions: Array<{
    exec: ExecutionSummary | ExecutionRecord;
    nodeLogs?: NodeExecutionLog[];
  }> = React.useMemo(() => {
    const remote = executions ?? [];
    const localOnly = localExecutions
      .filter((local) => !remote.some((r) => r.id === local.id))
      .map((local) => ({ exec: local, nodeLogs: local.nodeLogs }));
    const remoteItems = remote.map((exec) => ({ exec }));
    return [...localOnly, ...remoteItems];
  }, [executions, localExecutions]);

  return (
    <>
      {/* Collapsed toggle */}
      {!isHistoryOpen && (
        <button
          type="button"
          onClick={toggleHistory}
          aria-label="Open execution history"
          data-ocid="right_sidebar.open_button"
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 z-20",
            "flex items-center justify-center w-7 h-7 rounded-lg",
            "bg-card/80 border border-border/60 text-muted-foreground",
            "hover:text-foreground hover:border-accent/40 hover:bg-card",
            "transition-all duration-200 shadow-node backdrop-blur-sm",
          )}
        >
          <ChevronRight size={13} className="rotate-180" />
        </button>
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "relative flex flex-col h-full shrink-0 overflow-hidden",
          "bg-sidebar border-l border-sidebar-border",
          "transition-all duration-200 ease-in-out",
          isHistoryOpen ? "w-72" : "w-0",
        )}
        data-ocid="right_sidebar.panel"
      >
        <div className="flex flex-col h-full w-72">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border shrink-0">
            <div className="flex items-center gap-2">
              <History size={13} className="text-accent" />
              <span className="text-[11px] font-semibold text-foreground tracking-wide">
                Execution History
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => refetch()}
                aria-label="Refresh history"
                data-ocid="right_sidebar.refresh_button"
                className={cn(
                  "p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
                  isFetching && "animate-spin text-accent",
                )}
              >
                <RefreshCw size={12} />
              </button>
              <button
                type="button"
                onClick={toggleHistory}
                aria-label="Collapse history"
                data-ocid="right_sidebar.close_button"
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

          {/* History list */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scrollbar-thin">
            {isLoading ? (
              <div
                className="space-y-2"
                data-ocid="right_sidebar.loading_state"
              >
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-[60px] rounded-lg bg-muted/40 animate-pulse border border-border/30"
                  />
                ))}
              </div>
            ) : mergedExecutions.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-14 text-center"
                data-ocid="right_sidebar.empty_state"
              >
                <div className="w-10 h-10 rounded-xl bg-muted/50 border border-border/40 flex items-center justify-center mb-3">
                  <History
                    size={18}
                    className="text-muted-foreground opacity-50"
                  />
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  No executions yet
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1 max-w-[170px] leading-relaxed">
                  Run a workflow to see results appear here
                </p>
              </div>
            ) : (
              mergedExecutions.map(({ exec, nodeLogs }, idx) => (
                <HistoryItemWithLogs
                  key={exec.id}
                  exec={exec}
                  index={idx}
                  initialLogs={nodeLogs}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2.5 border-t border-sidebar-border shrink-0">
            <p className="text-[10px] text-muted-foreground text-center">
              {mergedExecutions.length > 0
                ? `${mergedExecutions.length} of 100 records`
                : "Up to 100 executions stored"}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
