import { Slider } from "@/components/ui/slider";
import { useWorkflowStore } from "@/stores/workflowStore";
import { CheckCircle2, Crop } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BaseNode } from "./BaseNode";

interface CropImageData extends Record<string, unknown> {
  imageUrl?: string;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
  croppedUrl?: string;
}

interface CropImageNodeProps {
  id: string;
  data: CropImageData;
  selected?: boolean;
}

const HANDLES = [
  { id: "image-in", type: "image" as const, position: "input" as const },
  { id: "x-in", type: "text" as const, position: "input" as const },
  { id: "y-in", type: "text" as const, position: "input" as const },
  { id: "width-in", type: "text" as const, position: "input" as const },
  { id: "height-in", type: "text" as const, position: "input" as const },
  { id: "image-out", type: "image" as const, position: "output" as const },
];

interface SliderRowProps {
  label: string;
  value: number;
  ocid: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}

function SliderRow({ label, value, ocid, disabled, onChange }: SliderRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/70">{label}</span>
        <span className="text-[10px] font-mono text-foreground/60 tabular-nums">
          {value}%
        </span>
      </div>
      <Slider
        data-ocid={ocid}
        value={[value]}
        min={0}
        max={100}
        step={1}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
        className="nodrag disabled:opacity-40"
      />
    </div>
  );
}

export function CropImageNode({ id, data, selected }: CropImageNodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const execStatus = useWorkflowStore(
    (s) => s.nodeExecutionStatus[id] ?? "idle",
  );
  const edges = useWorkflowStore((s) => s.edges);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);

  const imageUrl = data.imageUrl as string | undefined;
  const cropX = (data.cropX as number) ?? 0;
  const cropY = (data.cropY as number) ?? 0;
  const cropW = (data.cropW as number) ?? 100;
  const cropH = (data.cropH as number) ?? 100;
  const croppedUrl = data.croppedUrl as string | undefined;

  const connectionState = useMemo(() => {
    const incoming = edges.filter((e) => e.target === id);
    return {
      x: incoming.some((e) => e.targetHandle === "x-in"),
      y: incoming.some((e) => e.targetHandle === "y-in"),
      w: incoming.some((e) => e.targetHandle === "width-in"),
      h: incoming.some((e) => e.targetHandle === "height-in"),
    };
  }, [edges, id]);

  const update = useCallback(
    (patch: Partial<CropImageData>) =>
      updateNodeData(id, patch as Record<string, unknown>),
    [id, updateNodeData],
  );

  useEffect(() => {
    if (!imageUrl) {
      setImgEl(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImgEl(img);
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!imgEl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const previewW = 256;
    const scale = previewW / imgEl.naturalWidth;
    const previewH = imgEl.naturalHeight * scale;
    canvas.width = previewW;
    canvas.height = previewH;

    ctx.globalAlpha = 0.3;
    ctx.drawImage(imgEl, 0, 0, previewW, previewH);

    const cx = (cropX / 100) * previewW;
    const cy = (cropY / 100) * previewH;
    const cw = (cropW / 100) * previewW;
    const ch = (cropH / 100) * previewH;

    ctx.globalAlpha = 1;
    ctx.drawImage(
      imgEl,
      cx / scale,
      cy / scale,
      cw / scale,
      ch / scale,
      cx,
      cy,
      cw,
      ch,
    );

    ctx.strokeStyle = "oklch(0.65 0.21 200)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx, cy, cw, ch);
  }, [imgEl, cropX, cropY, cropW, cropH]);

  return (
    <BaseNode
      id={id}
      title="Crop Image"
      icon={<Crop size={13} />}
      accentColor="oklch(0.65 0.18 70)"
      handles={HANDLES}
      isSelected={selected}
      minWidth={280}
    >
      <div className="space-y-2.5">
        {imageUrl ? (
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="w-full rounded-lg border border-[oklch(0.22_0.06_200)]"
              style={{ imageRendering: "pixelated" }}
            />
            {execStatus === "success" && croppedUrl && (
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[oklch(0.72_0.18_155/0.15)] border border-[oklch(0.72_0.18_155/0.4)]">
                <CheckCircle2
                  size={10}
                  className="text-[oklch(0.72_0.18_155)]"
                />
                <span className="text-[9px] text-[oklch(0.72_0.18_155)] font-mono">
                  Cropped
                </span>
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex items-center justify-center h-24 rounded-lg border border-dashed border-[oklch(0.22_0.06_200)] bg-[oklch(0.09_0_0)]"
            data-ocid="crop_node.empty_state"
          >
            <p className="text-[10px] text-muted-foreground/40">
              Connect an image input
            </p>
          </div>
        )}

        <p className="text-[9px] text-muted-foreground/55">
          Connected x/y/width/height handles override manual sliders.
        </p>

        <div className="space-y-2 pt-0.5">
          <SliderRow
            label="X Offset"
            value={cropX}
            ocid="crop_node.x_slider"
            disabled={connectionState.x}
            onChange={(v) => update({ cropX: v })}
          />
          <SliderRow
            label="Y Offset"
            value={cropY}
            ocid="crop_node.y_slider"
            disabled={connectionState.y}
            onChange={(v) => update({ cropY: v })}
          />
          <SliderRow
            label="Width"
            value={cropW}
            ocid="crop_node.width_slider"
            disabled={connectionState.w}
            onChange={(v) => update({ cropW: v })}
          />
          <SliderRow
            label="Height"
            value={cropH}
            ocid="crop_node.height_slider"
            disabled={connectionState.h}
            onChange={(v) => update({ cropH: v })}
          />
        </div>
      </div>
    </BaseNode>
  );
}
