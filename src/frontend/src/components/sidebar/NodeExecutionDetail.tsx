import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { ExecutionStatus } from "../../backend";
import { cn } from "../../lib/utils";
import type { NodeExecutionLog } from "../../types/workflow";

interface NodeExecutionDetailProps {
  log: NodeExecutionLog;
  index: number;
}

const NODE_STATUS_ICONS = {
  success: CheckCircle,
  failed: XCircle,
  partial: AlertTriangle,
  running: Clock,
};

const NODE_STATUS_COLORS = {
  success: "text-emerald-400",
  failed: "text-destructive",
  partial: "text-amber-400",
  running: "text-accent",
};

function deriveStatus(log: NodeExecutionLog): keyof typeof NODE_STATUS_ICONS {
  if (log.error) return "failed";
  if (log.outputs && log.outputs !== "{}") return "success";
  return "success";
}

function JsonViewer({ label, value }: { label: string; value: string }) {
  const [open, setOpen] = useState(false);

  let parsed: unknown;
  let display: string;
  try {
    parsed = JSON.parse(value);
    display = JSON.stringify(parsed, null, 2);
  } catch {
    display = value;
  }

  if (!value || value === "{}" || value === "null" || value === "") return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDown size={10} className="shrink-0" />
        ) : (
          <ChevronRight size={10} className="shrink-0" />
        )}
        <span className="font-medium">{label}</span>
      </button>
      {open && (
        <pre
          className={cn(
            "mt-1 p-2 rounded text-xs font-mono text-foreground/80 bg-muted/60 border border-border/50",
            "max-h-32 overflow-auto whitespace-pre-wrap break-all leading-relaxed",
          )}
        >
          {display}
        </pre>
      )}
    </div>
  );
}

export function NodeExecutionDetail({ log, index }: NodeExecutionDetailProps) {
  const status = deriveStatus(log);
  const Icon = NODE_STATUS_ICONS[status];
  const color = NODE_STATUS_COLORS[status];

  const durationMs = Number(log.durationMs);
  const durationLabel =
    durationMs < 1000
      ? `${durationMs}ms`
      : `${(durationMs / 1000).toFixed(1)}s`;

  return (
    <div
      className="border border-border/50 rounded-md overflow-hidden bg-muted/20"
      data-ocid={`history.node_detail.${index + 1}`}
    >
      {/* Node header row */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        <Icon size={12} className={cn(color, "shrink-0")} />
        <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
          {log.nodeType}
        </span>
        {log.nodeId && (
          <span className="text-xs font-mono text-muted-foreground shrink-0">
            #{log.nodeId.slice(0, 4)}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <Clock size={9} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{durationLabel}</span>
        </div>
      </div>

      {/* Expandable JSON sections */}
      {(log.inputs || log.outputs || log.error) && (
        <div className="px-2.5 pb-2 space-y-0.5">
          <JsonViewer label="Inputs" value={log.inputs} />
          <JsonViewer label="Outputs" value={log.outputs} />
          {log.error && (
            <div className="mt-1">
              <p className="text-xs font-medium text-destructive mb-0.5">
                Error
              </p>
              <pre
                className={cn(
                  "p-2 rounded text-xs font-mono text-destructive/80 bg-destructive/5 border border-destructive/20",
                  "max-h-24 overflow-auto whitespace-pre-wrap break-all leading-relaxed",
                )}
              >
                {log.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
