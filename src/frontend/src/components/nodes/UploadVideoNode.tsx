import { ExternalBlob } from "@/backend";
import { Progress } from "@/components/ui/progress";
import { useWorkflowStore } from "@/stores/workflowStore";
import { Clock, Upload, VideoIcon, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { BaseNode } from "./BaseNode";

interface UploadVideoData extends Record<string, unknown> {
  videoUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  uploading?: boolean;
  uploadProgress?: number;
}

interface UploadVideoNodeProps {
  id: string;
  data: UploadVideoData;
  selected?: boolean;
}

const HANDLES = [
  { id: "video-out", type: "video" as const, position: "output" as const },
];

const ACCEPTED = ".mp4,.mov,.webm,.m4v";
const MAX_BYTES = 200 * 1024 * 1024;

export function UploadVideoNode({ id, data, selected }: UploadVideoNodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const videoUrl = data.videoUrl as string | undefined;
  const fileName = data.fileName as string | undefined;
  const fileSize = data.fileSize as number | undefined;
  const duration = data.duration as number | undefined;
  const uploading = (data.uploading as boolean) ?? false;
  const uploadProgress = (data.uploadProgress as number) ?? 0;

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_BYTES) {
        setError("File too large (max 200MB)");
        return;
      }
      setError(null);

      const blobUrl = URL.createObjectURL(file);
      let dur: number | undefined;
      try {
        dur = await new Promise<number>((resolve) => {
          const v = document.createElement("video");
          v.src = blobUrl;
          v.onloadedmetadata = () => resolve(v.duration);
          v.onerror = () => resolve(0);
        });
      } catch {
        dur = undefined;
      }

      updateNodeData(id, {
        uploading: true,
        uploadProgress: 0,
        fileName: file.name,
        fileSize: file.size,
        duration: dur,
      });

      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const blob = ExternalBlob.fromBytes(bytes).withUploadProgress((pct) => {
          updateNodeData(id, { uploadProgress: pct, uploading: true });
        });

        const directUrl = blob.getDirectURL();
        URL.revokeObjectURL(blobUrl);
        updateNodeData(id, {
          videoUrl: directUrl,
          uploading: false,
          uploadProgress: 100,
        });
      } catch {
        setError("Upload failed. Try again.");
        URL.revokeObjectURL(blobUrl);
        updateNodeData(id, { uploading: false, uploadProgress: 0 });
      }
    },
    [id, updateNodeData],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleClear = useCallback(() => {
    updateNodeData(id, {
      videoUrl: undefined,
      fileName: undefined,
      fileSize: undefined,
      duration: undefined,
      uploadProgress: 0,
    });
    setError(null);
  }, [id, updateNodeData]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <BaseNode
      id={id}
      title="Upload Video"
      icon={<VideoIcon size={13} />}
      accentColor="oklch(0.7 0.19 55)"
      handles={HANDLES}
      isSelected={selected}
      minWidth={280}
    >
      <div className="space-y-2">
        {videoUrl ? (
          <div className="relative group">
            <video
              src={videoUrl}
              className="w-full h-36 object-cover rounded-lg border border-[oklch(0.22_0.06_200)]"
              controls={false}
              muted
              preload="metadata"
            />
            {duration !== undefined && duration > 0 && (
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-[oklch(0.09_0_0/0.85)] rounded px-1.5 py-0.5 border border-[oklch(0.22_0.06_200)]">
                <Clock size={9} className="text-[oklch(0.7_0.19_55)]" />
                <span className="text-[10px] text-foreground/80 font-mono">
                  {formatDuration(duration)}
                </span>
              </div>
            )}
            <button
              type="button"
              data-ocid="upload_video_node.clear_button"
              onClick={handleClear}
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[oklch(0.09_0_0/0.9)] border border-[oklch(0.22_0.06_200)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove video"
            >
              <X size={10} className="text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-ocid="upload_video_node.dropzone"
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="w-full flex flex-col items-center justify-center gap-2 h-28 rounded-lg border border-dashed border-[oklch(0.22_0.06_200)] hover:border-[oklch(0.7_0.19_55/0.6)] bg-[oklch(0.09_0_0)] hover:bg-[oklch(0.11_0_0)] cursor-pointer transition-all nodrag"
          >
            <Upload size={18} className="text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground/70">
                Drop video or click to upload
              </p>
              <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                MP4, MOV, WebM, M4V · max 200MB
              </p>
            </div>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {uploading && (
          <div className="space-y-1">
            <Progress value={uploadProgress} className="h-1" />
            <p className="text-[10px] text-muted-foreground/60 text-right">
              {uploadProgress}%
            </p>
          </div>
        )}

        {fileName && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground/70 truncate min-w-0">
              {fileName}
            </span>
            {fileSize !== undefined && (
              <span className="text-[10px] text-muted-foreground/50 shrink-0">
                {formatBytes(fileSize)}
              </span>
            )}
          </div>
        )}

        {error && (
          <p
            data-ocid="upload_video_node.error_state"
            className="text-[10px] text-destructive/80"
          >
            {error}
          </p>
        )}
      </div>
    </BaseNode>
  );
}
