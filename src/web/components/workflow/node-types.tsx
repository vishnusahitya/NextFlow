"use client";

import { Handle, NodeProps, Position } from "@xyflow/react";
import { useMemo } from "react";
import { useWorkflowBuilderStore } from "@/store/workflow-builder-store";

type NodeData = Record<string, unknown>;

function NodeShell({
  id,
  title,
  children,
  running,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  running?: boolean;
}) {
  const removeNode = useWorkflowBuilderStore((state) => state.removeNode);
  return (
    <div
      className={`rounded-xl border border-[#2a2a2a] bg-[#141414] min-w-[280px] shadow-[0_8px_26px_rgba(0,0,0,0.45)] ${running ? "animate-pulse-glow border-accent" : ""}`}
    >
      <div className="h-9 border-b border-[#262626] flex items-center justify-between px-3 text-xs font-medium">
        <span>{title}</span>
        <button
          type="button"
          onClick={() => removeNode(id)}
          className="text-zinc-500 hover:text-red-400"
        >
          Delete
        </button>
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  );
}

function TextNode({ id, data }: NodeProps) {
  const updateNodeData = useWorkflowBuilderStore((state) => state.updateNodeData);
  const status = useWorkflowBuilderStore((state) => state.nodeStatuses[id] ?? "idle");
  return (
    <NodeShell id={id} title="Text Node" running={status === "running"}>
      <textarea
        value={String((data as NodeData).text ?? "")}
        onChange={(event) => updateNodeData(id, { text: event.target.value })}
        className="w-full h-24 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 py-1 text-xs"
        placeholder="Enter text..."
      />
      <Handle type="source" id="text-out" position={Position.Right} style={{ background: "#b58cff" }} />
    </NodeShell>
  );
}

function UploadImageNode({ id, data }: NodeProps) {
  const updateNodeData = useWorkflowBuilderStore((state) => state.updateNodeData);
  const status = useWorkflowBuilderStore((state) => state.nodeStatuses[id] ?? "idle");
  const imageUrl = String((data as NodeData).imageUrl ?? "");
  return (
    <NodeShell id={id} title="Upload Image" running={status === "running"}>
      <input
        type="url"
        value={imageUrl}
        onChange={(event) => updateNodeData(id, { imageUrl: event.target.value })}
        className="w-full h-8 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 text-xs"
        placeholder="Paste image URL (Transloadit result)"
      />
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="w-full h-24 object-cover rounded-md border border-[#2a2a2a]" />
      ) : null}
      <Handle type="source" id="image-out" position={Position.Right} style={{ background: "#39d98a" }} />
    </NodeShell>
  );
}

function UploadVideoNode({ id, data }: NodeProps) {
  const updateNodeData = useWorkflowBuilderStore((state) => state.updateNodeData);
  const status = useWorkflowBuilderStore((state) => state.nodeStatuses[id] ?? "idle");
  const videoUrl = String((data as NodeData).videoUrl ?? "");
  return (
    <NodeShell id={id} title="Upload Video" running={status === "running"}>
      <input
        type="url"
        value={videoUrl}
        onChange={(event) => updateNodeData(id, { videoUrl: event.target.value })}
        className="w-full h-8 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 text-xs"
        placeholder="Paste video URL (Transloadit result)"
      />
      {videoUrl ? (
        <video src={videoUrl} className="w-full h-24 rounded-md border border-[#2a2a2a]" muted controls />
      ) : null}
      <Handle type="source" id="video-out" position={Position.Right} style={{ background: "#ffc65c" }} />
    </NodeShell>
  );
}

function RunLLMNode({ id, data }: NodeProps) {
  const updateNodeData = useWorkflowBuilderStore((state) => state.updateNodeData);
  const edges = useWorkflowBuilderStore((state) => state.edges);
  const status = useWorkflowBuilderStore((state) => state.nodeStatuses[id] ?? "idle");

  const connections = useMemo(() => {
    const incoming = edges.filter((edge) => edge.target === id);
    return {
      systemPrompt: incoming.some((edge) => edge.targetHandle === "system-prompt-in"),
      userMessage: incoming.some((edge) => edge.targetHandle === "user-message-in"),
    };
  }, [edges, id]);

  // ✅ Read both result and output
  const result = String((data as NodeData).result ?? "");
  const output = String((data as NodeData).output ?? "");
  const displayOutput = output || result;

  return (
    <NodeShell id={id} title="Run Any LLM" running={status === "running"}>
      <select
        value={String((data as NodeData).model ?? "gemini-2.0-flash")}
        onChange={(event) => updateNodeData(id, { model: event.target.value })}
        className="w-full h-8 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 text-xs"
      >
        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
      </select>
      <textarea
        value={String((data as NodeData).systemPrompt ?? "")}
        onChange={(event) => updateNodeData(id, { systemPrompt: event.target.value })}
        className="w-full h-16 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 py-1 text-xs disabled:opacity-45"
        placeholder="System prompt"
        disabled={connections.systemPrompt}
      />
      <textarea
        value={String((data as NodeData).userMessage ?? "")}
        onChange={(event) => updateNodeData(id, { userMessage: event.target.value })}
        className="w-full h-20 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 py-1 text-xs disabled:opacity-45"
        placeholder="User message"
        disabled={connections.userMessage}
      />
      
      {/* ✅ Enhanced output display with better styling */}
      {displayOutput ? (
        <div className="rounded-md border border-green-600 bg-green-900/30 p-2 text-xs text-green-100 max-h-40 overflow-auto">
          <strong className="text-green-400">✅ Output:</strong>
          <div className="mt-1 whitespace-pre-wrap break-words text-green-50">
            {displayOutput}
          </div>
        </div>
      ) : null}

      <Handle type="target" id="system-prompt-in" position={Position.Left} style={{ top: "22%", background: "#b58cff" }} />
      <Handle type="target" id="user-message-in" position={Position.Left} style={{ top: "50%", background: "#b58cff" }} />
      <Handle type="target" id="images-in" position={Position.Left} style={{ top: "78%", background: "#39d98a" }} />
      <Handle type="source" id="text-out" position={Position.Right} style={{ background: "#b58cff" }} />
    </NodeShell>
  );
}

function CropImageNode({ id, data }: NodeProps) {
  const updateNodeData = useWorkflowBuilderStore((state) => state.updateNodeData);
  const edges = useWorkflowBuilderStore((state) => state.edges);
  const status = useWorkflowBuilderStore((state) => state.nodeStatuses[id] ?? "idle");
  const connected = useMemo(() => {
    const incoming = edges.filter((edge) => edge.target === id);
    return {
      x: incoming.some((edge) => edge.targetHandle === "x-in"),
      y: incoming.some((edge) => edge.targetHandle === "y-in"),
      width: incoming.some((edge) => edge.targetHandle === "width-in"),
      height: incoming.some((edge) => edge.targetHandle === "height-in"),
    };
  }, [edges, id]);

  // ✅ Display cropped image output
  const croppedUrl = String((data as NodeData).croppedUrl ?? "");
  const output = String((data as NodeData).output ?? "");
  const displayImage = output || croppedUrl;

  return (
    <NodeShell id={id} title="Crop Image" running={status === "running"}>
      <label className="text-[11px] text-zinc-400">X %</label>
      <input
        type="number"
        min={0}
        max={100}
        value={Number((data as NodeData).cropX ?? 0)}
        onChange={(event) => updateNodeData(id, { cropX: Number(event.target.value) })}
        className="w-full h-8 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 text-xs disabled:opacity-45"
        disabled={connected.x}
      />
      <label className="text-[11px] text-zinc-400">Y %</label>
      <input
        type="number"
        min={0}
        max={100}
        value={Number((data as NodeData).cropY ?? 0)}
        onChange={(event) => updateNodeData(id, { cropY: Number(event.target.value) })}
        className="w-full h-8 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 text-xs disabled:opacity-45"
        disabled={connected.y}
      />
      <label className="text-[11px] text-zinc-400">Width %</label>
      <input
        type="number"
        min={0}
        max={100}
        value={Number((data as NodeData).cropW ?? 100)}
        onChange={(event) => updateNodeData(id, { cropW: Number(event.target.value) })}
        className="w-full h-8 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 text-xs disabled:opacity-45"
        disabled={connected.width}
      />
      <label className="text-[11px] text-zinc-400">Height %</label>
      <input
        type="number"
        min={0}
        max={100}
        value={Number((data as NodeData).cropH ?? 100)}
        onChange={(event) => updateNodeData(id, { cropH: Number(event.target.value) })}
        className="w-full h-8 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 text-xs disabled:opacity-45"
        disabled={connected.height}
      />
      
      {/* ✅ Display cropped output image */}
      {displayImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayImage} alt="Cropped" className="w-full h-24 object-cover rounded-md border border-green-600 bg-green-900/30" />
      ) : null}

      <Handle type="target" id="image-in" position={Position.Left} style={{ top: "16%", background: "#39d98a" }} />
      <Handle type="target" id="x-in" position={Position.Left} style={{ top: "32%", background: "#b58cff" }} />
      <Handle type="target" id="y-in" position={Position.Left} style={{ top: "48%", background: "#b58cff" }} />
      <Handle type="target" id="width-in" position={Position.Left} style={{ top: "64%", background: "#b58cff" }} />
      <Handle type="target" id="height-in" position={Position.Left} style={{ top: "80%", background: "#b58cff" }} />
      <Handle type="source" id="image-out" position={Position.Right} style={{ background: "#39d98a" }} />
    </NodeShell>
  );
}

function ExtractFrameNode({ id, data }: NodeProps) {
  const updateNodeData = useWorkflowBuilderStore((state) => state.updateNodeData);
  const edges = useWorkflowBuilderStore((state) => state.edges);
  const status = useWorkflowBuilderStore((state) => state.nodeStatuses[id] ?? "idle");
  const timestampConnected = useMemo(
    () => edges.some((edge) => edge.target === id && edge.targetHandle === "timestamp-in"),
    [edges, id],
  );

  // ✅ Display frame output
  const frameUrl = String((data as NodeData).frameUrl ?? "");
  const output = String((data as NodeData).output ?? "");
  const displayFrame = output || frameUrl;

  return (
    <NodeShell id={id} title="Extract Frame from Video" running={status === "running"}>
      <input
        type="text"
        value={String((data as NodeData).timestamp ?? "0")}
        onChange={(event) => updateNodeData(id, { timestamp: event.target.value })}
        className="w-full h-8 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 text-xs disabled:opacity-45"
        placeholder='0 or "50%"'
        disabled={timestampConnected}
      />
      
      {/* ✅ Display extracted frame output */}
      {displayFrame ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayFrame} alt="Frame" className="w-full h-24 object-cover rounded-md border border-green-600 bg-green-900/30" />
      ) : null}

      <Handle type="target" id="video-in" position={Position.Left} style={{ top: "35%", background: "#ffc65c" }} />
      <Handle type="target" id="timestamp-in" position={Position.Left} style={{ top: "70%", background: "#b58cff" }} />
      <Handle type="source" id="image-out" position={Position.Right} style={{ background: "#39d98a" }} />
    </NodeShell>
  );
}

export const workflowNodeTypes = {
  text: TextNode,
  uploadImage: UploadImageNode,
  uploadVideo: UploadVideoNode,
  runLLM: RunLLMNode,
  cropImage: CropImageNode,
  extractFrame: ExtractFrameNode,
};