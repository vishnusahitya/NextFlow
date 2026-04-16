import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { ExecutionScope, ExecutionStatus } from "../../backend";
import { cn } from "../../lib/utils";
import type {
  ExecutionRecord,
  ExecutionSummary,
  NodeExecutionLog,
} from "../../types/workflow";
import { NodeExecutionDetail } from "./NodeExecutionDetail";

interface ExecutionHistoryItemProps {
  exec: ExecutionSummary | ExecutionRecord;
  index: number;
  nodeLogs?: NodeExecutionLog[];
  onExpand?: (id: string) => void;
}

function formatDuration(ms: bigint): string {
  const n = Number(ms);
  if (n < 1000) return `${n}ms`;
  if (n < 60_000) return `${(n / 1000).toFixed(1)}s`;
  return `${Math.floor(n / 60_000)}m ${Math.floor((n % 60_000) / 1000)}s`;
}

function toEpochMs(ts: bigint): number {
  // Backend timestamps may be ns, while local timestamps may be ms.
  if (ts > 10_000_000_000_000n) {
    return Number(ts / 1_000_000n);
  }
  return Number(ts);
}

function formatRelativeTime(ts: bigint): string {
  const now = Date.now();
  const then = toEpochMs(ts);
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function formatAbsoluteTime(ts: bigint): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(toEpochMs(ts)));
}

const STATUS_CONFIG = {
  [ExecutionStatus.success]: {
    Icon: CheckCircle,
    color: "text-emerald-400",
    badgeCls: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    label: "Success",
  },
  [ExecutionStatus.failed]: {
    Icon: XCircle,
    color: "text-red-400",
    badgeCls: "bg-red-400/10 text-red-400 border-red-400/20",
    label: "Failed",
  },
  [ExecutionStatus.partial]: {
    Icon: AlertTriangle,
    color: "text-amber-400",
    badgeCls: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    label: "Partial",
  },
};

const SCOPE_CONFIG = {
  [ExecutionScope.full]: {
    label: "Full",
    cls: "bg-accent/10 text-accent border-accent/20",
  },
  [ExecutionScope.single]: {
    label: "Single",
    cls: "bg-muted text-muted-foreground border-border",
  },
  [ExecutionScope.partial]: {
    label: "Partial",
    cls: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  },
};

export function ExecutionHistoryItem({
  exec,
  index,
  nodeLogs,
  onExpand,
}: ExecutionHistoryItemProps) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[exec.status];
  const scopeCfg = SCOPE_CONFIG[exec.scope];
  const { Icon, color, badgeCls } = statusCfg;

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && onExpand) onExpand(exec.id);
  };

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden transition-all duration-200",
        expanded
          ? "border-border bg-card"
          : "border-border/50 bg-card/50 hover:border-border hover:bg-card",
      )}
      data-ocid={`history.item.${index + 1}`}
    >
      {/* Row header — click to expand */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left"
        data-ocid={`history.item.${index + 1}.toggle`}
      >
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">
          <Icon size={13} className={color} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Top row: scope + relative time */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                  scopeCfg.cls,
                )}
              >
                {scopeCfg.label}
              </span>
              <span
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                  badgeCls,
                )}
              >
                {statusCfg.label}
              </span>
            </div>
            <div className="text-right shrink-0">
              <span className="block text-[10px] text-muted-foreground">
                {formatAbsoluteTime(exec.createdAt)}
              </span>
              <span className="block text-[9px] text-muted-foreground/60">
                {formatRelativeTime(exec.createdAt)}
              </span>
            </div>
          </div>

          {/* Bottom row: duration + node count */}
          <div className="flex items-center gap-2.5 mt-1">
            <div className="flex items-center gap-1">
              <Clock size={9} className="text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {formatDuration(exec.durationMs)}
              </span>
            </div>
            {nodeLogs && nodeLogs.length > 0 && (
              <div className="flex items-center gap-1">
                <Layers size={9} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  {nodeLogs.length} node{nodeLogs.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Expand chevron */}
        <div className="mt-0.5 shrink-0">
          {expanded ? (
            <ChevronDown size={11} className="text-muted-foreground" />
          ) : (
            <ChevronRight size={11} className="text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded node logs */}
      {expanded && (
        <div
          className="border-t border-border/50 bg-muted/20 px-3 py-2.5 space-y-1.5"
          data-ocid={`history.item.${index + 1}.detail`}
        >
          {nodeLogs && nodeLogs.length > 0 ? (
            nodeLogs.map((log, i) => (
              <NodeExecutionDetail key={log.nodeId ?? i} log={log} index={i} />
            ))
          ) : (
            <div className="flex items-center gap-2 py-2">
              <Layers size={12} className="text-muted-foreground opacity-50" />
              <p className="text-xs text-muted-foreground">
                No node-level logs available
              </p>
            </div>
          )}
          <p className="text-[10px] font-mono text-muted-foreground/50 pt-1 truncate">
            ID: {exec.id}
          </p>
        </div>
      )}
    </div>
  );
}
