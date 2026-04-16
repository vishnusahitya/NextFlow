import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/stores/workflowStore";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { BaseNode, type NodeHandle } from "./BaseNode";

type LLMStatus = "idle" | "running" | "success" | "error";

interface RunLLMData extends Record<string, unknown> {
  model?: string;
  systemPrompt?: string;
  userMessage?: string;
  status?: LLMStatus;
  result?: string;
  errorMessage?: string;
  showSystemPrompt?: boolean;
}

interface RunLLMNodeProps {
  id: string;
  data: RunLLMData;
  selected?: boolean;
}

const MODELS = [
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
];

const STATUS_CONFIG: Record<
  LLMStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  idle: { label: "Idle", variant: "outline" },
  running: { label: "Running", variant: "secondary" },
  success: { label: "Done", variant: "default" },
  error: { label: "Error", variant: "destructive" },
};

const HANDLES: NodeHandle[] = [
  {
    id: "system-prompt-in",
    type: "text",
    position: "input",
    label: "System",
  },
  {
    id: "user-message-in",
    type: "text",
    position: "input",
    label: "User",
  },
  { id: "images-in", type: "image", position: "input", label: "Images" },
  { id: "text-out", type: "text", position: "output", label: "Output" },
];

export function RunLLMNode({ id, data, selected }: RunLLMNodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const edges = useWorkflowStore((s) => s.edges);
  const storeStatus = useWorkflowStore(
    (s) => s.nodeExecutionStatus[id] ?? "idle",
  );

  const model = (data.model as string) ?? "gemini-2.0-flash";
  const systemPrompt = (data.systemPrompt as string) ?? "";
  const userMessage = (data.userMessage as string) ?? "";
  const dataStatus: LLMStatus = (data.status as LLMStatus) ?? "idle";
  const status: LLMStatus =
    storeStatus === "running" ||
    storeStatus === "error" ||
    storeStatus === "success"
      ? (storeStatus as LLMStatus)
      : dataStatus;
  const result = data.result as string | undefined;
  const errorMessage = data.errorMessage as string | undefined;
  const showSystemPrompt = (data.showSystemPrompt as boolean) ?? true;
  const [showResult, setShowResult] = useState(false);

  const connectionState = useMemo(() => {
    const incoming = edges.filter((e) => e.target === id);
    const systemPromptConnected = incoming.some(
      (e) => e.targetHandle === "system-prompt-in",
    );
    const userMessageConnected = incoming.some(
      (e) => e.targetHandle === "user-message-in",
    );
    const imagesConnected = incoming.filter(
      (e) =>
        e.targetHandle === "images-in" ||
        (e.targetHandle ?? "").startsWith("image-in-"),
    ).length;

    return {
      systemPromptConnected,
      userMessageConnected,
      imagesConnected,
    };
  }, [edges, id]);

  const update = useCallback(
    (patch: Partial<RunLLMData>) =>
      updateNodeData(id, patch as Record<string, unknown>),
    [id, updateNodeData],
  );

  const isRunning = status === "running";
  const statusCfg = STATUS_CONFIG[status];

  return (
    <BaseNode
      id={id}
      title="Run Any LLM"
      icon={<Sparkles size={13} />}
      accentColor="oklch(0.65 0.21 200)"
      handles={HANDLES}
      isSelected={selected}
      hasError={status === "error"}
      minWidth={300}
    >
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Badge
            data-ocid="llm_node.status_badge"
            variant={statusCfg.variant}
            className={cn(
              "text-[9px] px-1.5 py-0.5 font-mono uppercase tracking-wider shrink-0",
              isRunning && "animate-pulse",
            )}
          >
            {statusCfg.label}
          </Badge>
          <Select value={model} onValueChange={(v) => update({ model: v })}>
            <SelectTrigger
              data-ocid="llm_node.model_select"
              className="h-6 text-[10px] bg-[oklch(0.09_0_0)] border-[oklch(0.22_0.06_200)] flex-1 nodrag"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[oklch(0.13_0_0)] border-[oklch(0.22_0.06_200)]">
              {MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
          <span>
            System:{" "}
            {connectionState.systemPromptConnected ? "connected" : "manual"}
          </span>
          <span>
            User: {connectionState.userMessageConnected ? "connected" : "manual"}
          </span>
          <span>Images: {connectionState.imagesConnected}</span>
        </div>

        <button
          type="button"
          data-ocid="llm_node.system_prompt_toggle"
          onClick={() => update({ showSystemPrompt: !showSystemPrompt })}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground/70 transition-colors nodrag"
        >
          {showSystemPrompt ? (
            <ChevronUp size={10} />
          ) : (
            <ChevronDown size={10} />
          )}
          System Prompt (optional)
        </button>

        {showSystemPrompt && (
          <Textarea
            data-ocid="llm_node.system_prompt_input"
            value={systemPrompt}
            onChange={(e) => update({ systemPrompt: e.target.value })}
            placeholder={
              connectionState.systemPromptConnected
                ? "Connected from Text Node"
                : "You are a helpful assistant..."
            }
            disabled={connectionState.systemPromptConnected}
            className="min-h-[56px] resize-none bg-[oklch(0.09_0_0)] border-[oklch(0.22_0.06_200)] text-foreground/80 text-[10px] font-mono placeholder:text-muted-foreground/30 focus:border-accent focus:ring-0 nodrag disabled:opacity-45 disabled:cursor-not-allowed"
            rows={3}
          />
        )}

        <Textarea
          data-ocid="llm_node.user_message_input"
          value={userMessage}
          onChange={(e) => update({ userMessage: e.target.value })}
          placeholder={
            connectionState.userMessageConnected
              ? "Connected from Text or LLM Node"
              : "Enter your message or use {{node_id}} to reference outputs..."
          }
          disabled={connectionState.userMessageConnected}
          className="min-h-[80px] resize-none bg-[oklch(0.09_0_0)] border-[oklch(0.22_0.06_200)] text-foreground/80 text-xs font-mono placeholder:text-muted-foreground/30 focus:border-accent focus:ring-0 nodrag disabled:opacity-45 disabled:cursor-not-allowed"
          rows={4}
        />

        {status === "success" && result && (
          <div className="rounded-lg border border-[oklch(0.65_0.21_200/0.3)] bg-[oklch(0.09_0_0)] overflow-hidden">
            <button
              type="button"
              data-ocid="llm_node.result_toggle"
              onClick={() => setShowResult((p) => !p)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] text-accent hover:bg-accent/5 transition-colors nodrag"
            >
              <span className="font-semibold">Result</span>
              {showResult ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {showResult && (
              <div className="px-2.5 pb-2.5">
                <p className="text-[11px] text-foreground/80 font-mono leading-relaxed whitespace-pre-wrap break-words">
                  {result}
                </p>
              </div>
            )}
          </div>
        )}

        {status === "error" && errorMessage && (
          <div
            data-ocid="llm_node.error_state"
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5"
          >
            <p className="text-[10px] text-destructive/80 font-mono">
              {errorMessage}
            </p>
          </div>
        )}
      </div>
    </BaseNode>
  );
}
