"use client";

import { Handle, NodeProps, Position } from "@xyflow/react";
import { Loader2, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { useWorkflowBuilderStore } from "@/store/workflow-builder-store";

type NodeData = Record<string, unknown>;
type TransloaditFile = {
  ssl_url?: string;
  url?: string;
};
type TransloaditAssembly = {
  ok?: string;
  error?: string;
  message?: string;
  assembly_ssl_url?: string;
  assembly_url?: string;
  uploads?: TransloaditFile[];
  results?: Record<string, TransloaditFile[]>;
};
type SignatureAlgorithm = "sha1" | "sha384";
type SignedUploadPayload = {
  params?: string;
  signature?: string;
  signatureAlgorithm?: SignatureAlgorithm;
  error?: string;
};
const SIGNATURE_FALLBACKS: SignatureAlgorithm[] = ["sha384", "sha1"];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function pickTransloaditUrl(assembly: TransloaditAssembly): string | null {
  for (const file of assembly.uploads ?? []) {
    const candidate = file?.ssl_url ?? file?.url;
    if (candidate) return candidate;
  }

  for (const files of Object.values(assembly.results ?? {})) {
    for (const file of files ?? []) {
      const candidate = file?.ssl_url ?? file?.url;
      if (candidate) return candidate;
    }
  }

  return null;
}

function isFinalAssemblyState(status: string): boolean {
  return [
    "ASSEMBLY_COMPLETED",
    "ASSEMBLY_CANCELED",
    "ASSEMBLY_ABORTED",
    "ASSEMBLY_ERROR",
    "REQUEST_ABORTED",
  ].includes(status);
}

async function waitForTransloaditResult(
  initial: TransloaditAssembly,
  timeoutMs = 45_000,
): Promise<TransloaditAssembly> {
  let current = initial;
  const pollUrl = current.assembly_ssl_url ?? current.assembly_url;
  if (!pollUrl) return current;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const currentStatus = String(current.ok ?? "");
    if (isFinalAssemblyState(currentStatus) || pickTransloaditUrl(current)) {
      return current;
    }

    await sleep(1200);
    const response = await fetch(pollUrl, { method: "GET" });
    if (!response.ok) {
      return current;
    }
    const payload = await safeJson<TransloaditAssembly>(response);
    if (!payload) {
      return current;
    }
    current = payload;
  }

  return current;
}

function isInvalidSignatureText(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid_signature") ||
    normalized.includes("signature does not match")
  );
}

async function requestSignedUploadPayload(
  kind: "image" | "video",
  accept: string[],
  signatureAlgorithm: SignatureAlgorithm,
): Promise<SignedUploadPayload> {
  const paramsRes = await fetch("/api/uploads/transloadit/params", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      accept,
      signatureAlgorithm,
    }),
  });

  const signed = (await paramsRes.json().catch(() => ({}))) as SignedUploadPayload;
  if (!paramsRes.ok) {
    throw new Error(
      signed?.error ||
        `Failed to create upload params (${paramsRes.status})`,
    );
  }
  if (!signed.params || !signed.signature) {
    throw new Error("Upload params response is missing params/signature.");
  }
  return signed;
}

async function submitToTransloadit(
  file: File,
  signed: SignedUploadPayload,
): Promise<TransloaditAssembly> {
  const formData = new FormData();
  formData.set("params", signed.params as string);
  formData.set("signature", signed.signature as string);
  formData.append("file", file);

  const uploadRes = await fetch(
    "https://api2.transloadit.com/assemblies?waitForCompletion=true",
    {
      method: "POST",
      body: formData,
    },
  );

  if (!uploadRes.ok) {
    const details = await uploadRes.text().catch(() => "Unknown error");
    throw new Error(`Transloadit upload failed (${uploadRes.status}): ${details}`);
  }

  const assembly = await safeJson<TransloaditAssembly>(uploadRes);
  if (!assembly) {
    throw new Error("Transloadit upload returned invalid JSON.");
  }
  if (assembly.error) {
    throw new Error(assembly.message ?? assembly.error);
  }
  return assembly;
}

async function uploadWithSignatureFallback(
  file: File,
  kind: "image" | "video",
  accept: string[],
): Promise<TransloaditAssembly> {
  let lastError: Error | null = null;

  for (const signatureAlgorithm of SIGNATURE_FALLBACKS) {
    try {
      const signed = await requestSignedUploadPayload(
        kind,
        accept,
        signatureAlgorithm,
      );
      return await submitToTransloadit(file, signed);
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Transloadit upload failed");
      lastError = err;
      if (isInvalidSignatureText(err.message)) {
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    `${lastError?.message ?? "Invalid Transloadit signature."} Check TRANSLOADIT key/secret pair in src/web/.env.local.`,
  );
}

type NodeShellProps = {
  id: string;
  title: string;
  children: React.ReactNode;
  running?: boolean;
};

function NodeShell({ id, title, children, running }: NodeShellProps) {
  const removeNode = useWorkflowBuilderStore((state) => state.removeNode);

  const dispatchRunSingleNode = () => {
    if (typeof window === "undefined" || running) return;
    window.dispatchEvent(
      new CustomEvent("nextflow:run-single-node", {
        detail: { nodeId: id },
      }),
    );
  };

  return (
    <div
      className={`rounded-xl border border-[#2a2a2a] bg-[#141414] min-w-[280px] shadow-[0_8px_26px_rgba(0,0,0,0.45)] ${running ? "animate-pulse-glow border-accent" : ""}`}
    >
      <div className="h-9 border-b border-[#262626] flex items-center justify-between px-3 text-xs font-medium">
        <span>{title}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={dispatchRunSingleNode}
            disabled={running}
            className="inline-flex items-center gap-1 text-zinc-400 hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Run single node"
          >
            {running ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            <span>Run</span>
          </button>
          <button
            type="button"
            onClick={() => removeNode(id)}
            className="text-zinc-500 hover:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>
      <div className="p-3 space-y-2 nodrag">{children}</div>
    </div>
  );
}

function TextNode({ id, data }: NodeProps) {
  const updateNodeData = useWorkflowBuilderStore((state) => state.updateNodeData);
  const status = useWorkflowBuilderStore(
    (state) => state.nodeStatuses[id] ?? "idle",
  );

  return (
    <NodeShell id={id} title="Text Node" running={status === "running"}>
      <textarea
        value={String((data as NodeData).text ?? "")}
        onChange={(event) => updateNodeData(id, { text: event.target.value })}
        className="w-full h-24 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 py-1 text-xs"
        placeholder="Enter text..."
      />
      <Handle
        type="source"
        id="text-out"
        position={Position.Right}
        style={{ background: "#b58cff" }}
      />
    </NodeShell>
  );
}

function UploadImageNode({ id, data }: NodeProps) {
  const updateNodeData = useWorkflowBuilderStore((state) => state.updateNodeData);
  const status = useWorkflowBuilderStore(
    (state) => state.nodeStatuses[id] ?? "idle",
  );
  const imageUrl = String((data as NodeData).imageUrl ?? "");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onImageFileSelected(file: File) {
    setUploadError(null);
    setUploading(true);

    try {
      const initialAssembly = await uploadWithSignatureFallback(file, "image", [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
      ]);
      const finalAssembly = await waitForTransloaditResult(initialAssembly);
      const url = pickTransloaditUrl(finalAssembly);

      if (!url) {
        throw new Error(
          `Upload completed with status "${String(finalAssembly.ok ?? "unknown")}" but no URL was returned.`,
        );
      }

      updateNodeData(id, { imageUrl: String(url) });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <NodeShell id={id} title="Upload Image" running={status === "running"}>
      <label className="w-full">
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void onImageFileSelected(file);
            event.target.value = "";
          }}
        />
        <span className="inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-md border border-[#2a2a2a] bg-[#171717] text-xs hover:bg-[#202020]">
          {uploading ? "Uploading image..." : "Upload image"}
        </span>
      </label>

      <input
        type="url"
        value={imageUrl}
        onChange={(event) => updateNodeData(id, { imageUrl: event.target.value })}
        className="w-full h-8 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 text-xs"
        placeholder="Paste image URL (Transloadit result)"
      />

      {uploadError ? (
        <div className="text-[11px] text-red-300">{uploadError}</div>
      ) : null}

      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Uploaded"
          className="w-full h-24 object-cover rounded-md border border-[#2a2a2a]"
        />
      ) : null}

      <Handle
        type="source"
        id="image-out"
        position={Position.Right}
        style={{ background: "#39d98a" }}
      />
    </NodeShell>
  );
}

function UploadVideoNode({ id, data }: NodeProps) {
  const updateNodeData = useWorkflowBuilderStore((state) => state.updateNodeData);
  const status = useWorkflowBuilderStore(
    (state) => state.nodeStatuses[id] ?? "idle",
  );
  const videoUrl = String((data as NodeData).videoUrl ?? "");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onVideoFileSelected(file: File) {
    setUploadError(null);
    setUploading(true);

    try {
      const initialAssembly = await uploadWithSignatureFallback(file, "video", [
        "mp4",
        "mov",
        "webm",
        "m4v",
      ]);
      const finalAssembly = await waitForTransloaditResult(initialAssembly);
      const url = pickTransloaditUrl(finalAssembly);

      if (!url) {
        throw new Error(
          `Upload completed with status "${String(finalAssembly.ok ?? "unknown")}" but no URL was returned.`,
        );
      }

      updateNodeData(id, { videoUrl: String(url) });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Video upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <NodeShell id={id} title="Upload Video" running={status === "running"}>
      <label className="w-full">
        <input
          type="file"
          accept=".mp4,.mov,.webm,.m4v,video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void onVideoFileSelected(file);
            event.target.value = "";
          }}
        />
        <span className="inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-md border border-[#2a2a2a] bg-[#171717] text-xs hover:bg-[#202020]">
          {uploading ? "Uploading video..." : "Upload video"}
        </span>
      </label>

      <input
        type="url"
        value={videoUrl}
        onChange={(event) => updateNodeData(id, { videoUrl: event.target.value })}
        className="w-full h-8 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 text-xs"
        placeholder="Paste video URL (Transloadit result)"
      />

      {uploadError ? (
        <div className="text-[11px] text-red-300">{uploadError}</div>
      ) : null}

      {videoUrl ? (
        <video
          src={videoUrl}
          className="w-full h-24 rounded-md border border-[#2a2a2a]"
          muted
          controls
        />
      ) : null}

      <Handle
        type="source"
        id="video-out"
        position={Position.Right}
        style={{ background: "#ffc65c" }}
      />
    </NodeShell>
  );
}

function RunLLMNode({ id, data }: NodeProps) {
  const updateNodeData = useWorkflowBuilderStore((state) => state.updateNodeData);
  const edges = useWorkflowBuilderStore((state) => state.edges);
  const status = useWorkflowBuilderStore(
    (state) => state.nodeStatuses[id] ?? "idle",
  );

  const connections = useMemo(() => {
    const incoming = edges.filter((edge) => edge.target === id);
    return {
      systemPrompt: incoming.some(
        (edge) => edge.targetHandle === "system-prompt-in",
      ),
      userMessage: incoming.some(
        (edge) => edge.targetHandle === "user-message-in",
      ),
    };
  }, [edges, id]);

  const result = String((data as NodeData).result ?? "");
  const output = String((data as NodeData).output ?? "");
  const displayOutput = output || result;
  const errorMessage = String((data as NodeData).errorMessage ?? "");

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
        placeholder="System prompt (optional)"
        disabled={connections.systemPrompt}
      />

      <textarea
        value={String((data as NodeData).userMessage ?? "")}
        onChange={(event) => updateNodeData(id, { userMessage: event.target.value })}
        className="w-full h-20 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 py-1 text-xs disabled:opacity-45"
        placeholder="User message"
        disabled={connections.userMessage}
      />

      {status === "running" ? (
        <div className="rounded-md border border-accent/40 bg-accent/10 p-2 text-xs text-accent inline-flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" />
          Running LLM request...
        </div>
      ) : null}

      {errorMessage && status === "error" ? (
        <div className="rounded-md border border-red-500/50 bg-red-900/30 p-2 text-xs text-red-100">
          {errorMessage}
        </div>
      ) : null}

      {displayOutput ? (
        <div className="rounded-md border border-green-600 bg-green-900/30 p-2 text-xs text-green-100 max-h-40 overflow-auto">
          <strong className="text-green-400">Output:</strong>
          <div className="mt-1 whitespace-pre-wrap break-words text-green-50">
            {displayOutput}
          </div>
        </div>
      ) : null}

      <Handle
        type="target"
        id="system-prompt-in"
        position={Position.Left}
        style={{ top: "22%", background: "#b58cff" }}
      />
      <Handle
        type="target"
        id="user-message-in"
        position={Position.Left}
        style={{ top: "50%", background: "#b58cff" }}
      />
      <Handle
        type="target"
        id="images-in"
        position={Position.Left}
        style={{ top: "78%", background: "#39d98a" }}
      />
      <Handle
        type="source"
        id="text-out"
        position={Position.Right}
        style={{ background: "#b58cff" }}
      />
    </NodeShell>
  );
}

function CropImageNode({ id, data }: NodeProps) {
  const updateNodeData = useWorkflowBuilderStore((state) => state.updateNodeData);
  const edges = useWorkflowBuilderStore((state) => state.edges);
  const status = useWorkflowBuilderStore(
    (state) => state.nodeStatuses[id] ?? "idle",
  );

  const connected = useMemo(() => {
    const incoming = edges.filter((edge) => edge.target === id);
    return {
      x: incoming.some((edge) => edge.targetHandle === "x-in"),
      y: incoming.some((edge) => edge.targetHandle === "y-in"),
      width: incoming.some((edge) => edge.targetHandle === "width-in"),
      height: incoming.some((edge) => edge.targetHandle === "height-in"),
    };
  }, [edges, id]);

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

      {displayImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayImage}
          alt="Cropped"
          className="w-full h-24 object-cover rounded-md border border-green-600 bg-green-900/30"
        />
      ) : null}

      <Handle
        type="target"
        id="image-in"
        position={Position.Left}
        style={{ top: "16%", background: "#39d98a" }}
      />
      <Handle
        type="target"
        id="x-in"
        position={Position.Left}
        style={{ top: "32%", background: "#b58cff" }}
      />
      <Handle
        type="target"
        id="y-in"
        position={Position.Left}
        style={{ top: "48%", background: "#b58cff" }}
      />
      <Handle
        type="target"
        id="width-in"
        position={Position.Left}
        style={{ top: "64%", background: "#b58cff" }}
      />
      <Handle
        type="target"
        id="height-in"
        position={Position.Left}
        style={{ top: "80%", background: "#b58cff" }}
      />
      <Handle
        type="source"
        id="image-out"
        position={Position.Right}
        style={{ background: "#39d98a" }}
      />
    </NodeShell>
  );
}

function ExtractFrameNode({ id, data }: NodeProps) {
  const updateNodeData = useWorkflowBuilderStore((state) => state.updateNodeData);
  const edges = useWorkflowBuilderStore((state) => state.edges);
  const status = useWorkflowBuilderStore(
    (state) => state.nodeStatuses[id] ?? "idle",
  );

  const timestampConnected = useMemo(
    () =>
      edges.some(
        (edge) => edge.target === id && edge.targetHandle === "timestamp-in",
      ),
    [edges, id],
  );

  const frameUrl = String((data as NodeData).frameUrl ?? "");
  const output = String((data as NodeData).output ?? "");
  const displayFrame = output || frameUrl;

  return (
    <NodeShell
      id={id}
      title="Extract Frame from Video"
      running={status === "running"}
    >
      <input
        type="text"
        value={String((data as NodeData).timestamp ?? "0")}
        onChange={(event) => updateNodeData(id, { timestamp: event.target.value })}
        className="w-full h-8 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2 text-xs disabled:opacity-45"
        placeholder='0 or "50%"'
        disabled={timestampConnected}
      />

      {displayFrame ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayFrame}
          alt="Frame"
          className="w-full h-24 object-cover rounded-md border border-green-600 bg-green-900/30"
        />
      ) : null}

      <Handle
        type="target"
        id="video-in"
        position={Position.Left}
        style={{ top: "35%", background: "#ffc65c" }}
      />
      <Handle
        type="target"
        id="timestamp-in"
        position={Position.Left}
        style={{ top: "70%", background: "#b58cff" }}
      />
      <Handle
        type="source"
        id="image-out"
        position={Position.Right}
        style={{ background: "#39d98a" }}
      />
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
