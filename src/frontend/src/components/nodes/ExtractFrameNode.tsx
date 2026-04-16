import { Input } from "@/components/ui/input";
import { useWorkflowStore } from "@/stores/workflowStore";
import { CheckCircle2, Film } from "lucide-react";
import { useCallback, useMemo } from "react";
import { BaseNode } from "./BaseNode";

interface ExtractFrameData extends Record<string, unknown> {
  videoUrl?: string;
  timestamp?: string;
  frameUrl?: string;
  error?: string;
}

interface ExtractFrameNodeProps {
  id: string;
  data: ExtractFrameData;
  selected?: boolean;
}

const HANDLES = [
  { id: "video-in", type: "video" as const, position: "input" as const },
  { id: "timestamp-in", type: "text" as const, position: "input" as const },
  { id: "image-out", type: "image" as const, position: "output" as const },
];

export function ExtractFrameNode({
  id,
  data,
  selected,
}: ExtractFrameNodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const execStatus = useWorkflowStore(
    (s) => s.nodeExecutionStatus[id] ?? "idle",
  );
  const edges = useWorkflowStore((s) => s.edges);

  const videoUrl = data.videoUrl as string | undefined;
  const timestamp = (data.timestamp as string) ?? "0";
  const frameUrl = data.frameUrl as string | undefined;
  const extractError = data.error as string | undefined;

  const timestampConnected = useMemo(
    () =>
      edges.some((e) => e.target === id && e.targetHandle === "timestamp-in"),
    [edges, id],
  );

  const update = useCallback(
    (patch: Partial<ExtractFrameData>) =>
      updateNodeData(id, patch as Record<string, unknown>),
    [id, updateNodeData],
  );

  const timestampId = `extract-frame-timestamp-${id}`;

  return (
    <BaseNode
      id={id}
      title="Extract Frame from Video"
      icon={<Film size={13} />}
      accentColor="oklch(0.65 0.19 22)"
      handles={HANDLES}
      isSelected={selected}
      minWidth={280}
    >
      <div className="space-y-2.5">
        {!videoUrl ? (
          <div
            className="flex items-center justify-center h-20 rounded-lg border border-dashed border-[oklch(0.22_0.06_200)] bg-[oklch(0.09_0_0)]"
            data-ocid="extract_frame_node.empty_state"
          >
            <p className="text-[10px] text-muted-foreground/40">
              Connect a video input
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[oklch(0.09_0_0)] border border-[oklch(0.22_0.06_200)]">
            <div className="w-2 h-2 rounded-full bg-[oklch(0.7_0.19_55)] shrink-0" />
            <span className="text-[10px] text-muted-foreground/70 truncate">
              Video connected
            </span>
          </div>
        )}

        <div className="space-y-1">
          <label
            htmlFor={timestampId}
            className="text-[10px] text-muted-foreground/60"
          >
            Timestamp
          </label>
          <Input
            id={timestampId}
            data-ocid="extract_frame_node.timestamp_input"
            value={timestamp}
            onChange={(e) => update({ timestamp: e.target.value })}
            placeholder={timestampConnected ? "Connected value" : '0 or "50%"'}
            disabled={timestampConnected}
            className="h-7 text-xs font-mono bg-[oklch(0.09_0_0)] border-[oklch(0.22_0.06_200)] text-foreground/80 placeholder:text-muted-foreground/30 nodrag disabled:opacity-45 disabled:cursor-not-allowed"
          />
          <p className="text-[9px] text-muted-foreground/40">
            Seconds, HH:MM:SS, or percentage.
          </p>
        </div>

        {frameUrl && (
          <div className="rounded-lg overflow-hidden border border-[oklch(0.22_0.06_200)]">
            <img
              src={frameUrl}
              alt="Extracted frame"
              className="w-full object-cover"
              style={{ maxHeight: 120 }}
            />
            <div className="px-2 py-1 bg-[oklch(0.09_0_0)] flex items-center gap-1.5">
              {execStatus === "success" && (
                <CheckCircle2
                  size={10}
                  className="text-[oklch(0.72_0.18_155)] shrink-0"
                />
              )}
              <p className="text-[9px] text-muted-foreground/50 font-mono">
                Frame @ {timestamp}
              </p>
            </div>
          </div>
        )}

        {extractError && (
          <p
            data-ocid="extract_frame_node.error_state"
            className="text-[10px] text-destructive/80 font-mono"
          >
            {extractError}
          </p>
        )}
      </div>
    </BaseNode>
  );
}
