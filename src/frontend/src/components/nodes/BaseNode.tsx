import { useExecutionEngine } from "@/hooks/useExecutionEngine";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/stores/workflowStore";
import { Handle, Position } from "@xyflow/react";
import { CheckCircle2, Play, X, XCircle } from "lucide-react";
import { type ReactNode, useState } from "react";

export type HandleType = "text" | "image" | "video";

export interface NodeHandle {
  id: string;
  type: HandleType;
  position: "input" | "output";
  label?: string;
}

const HANDLE_COLORS: Record<HandleType, string> = {
  text: "oklch(0.65 0.21 200)",
  image: "oklch(0.65 0.18 280)",
  video: "oklch(0.7 0.19 55)",
};

const HANDLE_GLOW: Record<HandleType, string> = {
  text: "0 0 6px oklch(0.65 0.21 200 / 0.8)",
  image: "0 0 6px oklch(0.65 0.18 280 / 0.8)",
  video: "0 0 6px oklch(0.7 0.19 55 / 0.8)",
};

interface BaseNodeProps {
  id: string;
  title: string;
  icon: ReactNode;
  accentColor?: string;
  handles: NodeHandle[];
  isExecuting?: boolean;
  isSelected?: boolean;
  hasError?: boolean;
  children: ReactNode;
  minWidth?: number;
  className?: string;
}

export function BaseNode({
  id,
  title,
  icon,
  accentColor,
  handles,
  isExecuting = false,
  isSelected = false,
  hasError = false,
  children,
  minWidth = 280,
  className,
}: BaseNodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const execStatus = useWorkflowStore(
    (s) => s.nodeExecutionStatus[id] ?? "idle",
  );
  const { executeSingleNode, isExecuting: isGlobalExecuting } =
    useExecutionEngine();

  const isRunning = isExecuting || execStatus === "running";
  const isSuccess = execStatus === "success";
  const isError = hasError || execStatus === "error";

  const boxShadow = isRunning
    ? undefined
    : isSelected
      ? "0 0 0 1px oklch(0.65 0.21 200 / 0.6), 0 4px 16px oklch(0 0 0 / 0.4)"
      : "0 4px 12px oklch(0 0 0 / 0.3), inset 0 0 1px oklch(1 0 0 / 0.04)";

  const borderColor = isError
    ? "oklch(0.65 0.19 22)"
    : isRunning
      ? "oklch(0.65 0.21 200)"
      : isSuccess
        ? "oklch(0.72 0.18 155)"
        : isSelected
          ? "oklch(0.65 0.21 200 / 0.9)"
          : "oklch(0.22 0.06 200)";

  const inputHandles = handles.filter((h) => h.position === "input");
  const outputHandles = handles.filter((h) => h.position === "output");

  return (
    <div
      data-ocid="node.card"
      className={cn(
        "relative rounded-xl overflow-visible select-none",
        "bg-[oklch(0.13_0_0)] border transition-all duration-200",
        isRunning && "animate-pulse-glow",
        className,
      )}
      style={{
        minWidth,
        borderColor,
        boxShadow,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-[oklch(0.22_0.06_200)]"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.16 0 0), oklch(0.14 0.04 200 / 0.5))",
        }}
      >
        <div
          className="flex items-center justify-center w-6 h-6 rounded-md shrink-0"
          style={{
            background: "oklch(0.65 0.21 200 / 0.12)",
            color: accentColor ?? "oklch(0.65 0.21 200)",
          }}
        >
          {icon}
        </div>
        <span className="text-xs font-semibold text-foreground/90 font-body tracking-wide flex-1 min-w-0 truncate">
          {title}
        </span>

        {isSuccess && !isRunning && (
          <CheckCircle2
            size={13}
            className="text-[oklch(0.72_0.18_155)] shrink-0"
            aria-label="Success"
          />
        )}
        {isError && !isRunning && (
          <XCircle
            size={13}
            className="text-destructive shrink-0"
            aria-label="Error"
          />
        )}

        <button
          type="button"
          data-ocid="node.run_single_button"
          onClick={(e) => {
            e.stopPropagation();
            executeSingleNode(id);
          }}
          disabled={isGlobalExecuting}
          className={cn(
            "flex items-center justify-center w-5 h-5 rounded-md transition-all duration-150",
            "text-muted-foreground/60 hover:text-accent hover:bg-accent/15",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            isHovered ? "opacity-100" : "opacity-0",
          )}
          aria-label="Run node"
        >
          <Play size={10} />
        </button>

        <button
          type="button"
          data-ocid="node.delete_button"
          onClick={(e) => {
            e.stopPropagation();
            removeNode(id);
          }}
          className={cn(
            "flex items-center justify-center w-5 h-5 rounded-md transition-all duration-150",
            "hover:bg-destructive/20 hover:text-destructive",
            "text-muted-foreground/50",
            isHovered ? "opacity-100" : "opacity-0",
          )}
          aria-label="Delete node"
        >
          <X size={11} />
        </button>
      </div>

      <div className="p-3">{children}</div>

      {inputHandles.map((handle, idx) => {
        const totalIn = inputHandles.length;
        const topPercent = totalIn === 1 ? 50 : 20 + (idx * 60) / (totalIn - 1);
        return (
          <Handle
            key={handle.id}
            type="target"
            id={handle.id}
            position={Position.Left}
            style={{
              top: `${topPercent}%`,
              left: -6,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: HANDLE_COLORS[handle.type],
              border: "2px solid oklch(0.13 0 0)",
              boxShadow: HANDLE_GLOW[handle.type],
              cursor: "crosshair",
            }}
          />
        );
      })}

      {outputHandles.map((handle, idx) => {
        const totalOut = outputHandles.length;
        const topPercent =
          totalOut === 1 ? 50 : 20 + (idx * 60) / (totalOut - 1);
        return (
          <Handle
            key={handle.id}
            type="source"
            id={handle.id}
            position={Position.Right}
            style={{
              top: `${topPercent}%`,
              right: -6,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: HANDLE_COLORS[handle.type],
              border: "2px solid oklch(0.13 0 0)",
              boxShadow: HANDLE_GLOW[handle.type],
              cursor: "crosshair",
            }}
          />
        );
      })}
    </div>
  );
}
