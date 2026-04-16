import { ExternalBlob } from "@/backend";
import { Progress } from "@/components/ui/progress";
import { useWorkflowStore } from "@/stores/workflowStore";
import { ImageIcon, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { BaseNode } from "./BaseNode";

interface UploadImageData extends Record<string, unknown> {
  imageUrl?: string;
  fileName?: string;
  fileSize?: number;
  uploading?: boolean;
  uploadProgress?: number;
}

interface UploadImageNodeProps {
  id: string;
  data: UploadImageData;
  selected?: boolean;
}

const HANDLES = [
  { id: "image-out", type: "image" as const, position: "output" as const },
];

const ACCEPTED = ".jpg,.jpeg,.png,.webp,.gif";
const MAX_BYTES = 20 * 1024 * 1024;

export function UploadImageNode({ id, data, selected }: UploadImageNodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const imageUrl = data.imageUrl as string | undefined;
  const fileName = data.fileName as string | undefined;
  const fileSize = data.fileSize as number | undefined;
  const uploading = (data.uploading as boolean) ?? false;
  const uploadProgress = (data.uploadProgress as number) ?? 0;

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_BYTES) {
        setError("File too large (max 20MB)");
        return;
      }
      setError(null);
      updateNodeData(id, {
        uploading: true,
        uploadProgress: 0,
        fileName: file.name,
        fileSize: file.size,
      });

      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const blob = ExternalBlob.fromBytes(bytes).withUploadProgress((pct) => {
          updateNodeData(id, { uploadProgress: pct, uploading: true });
        });

        const directUrl = blob.getDirectURL();
        updateNodeData(id, {
          imageUrl: directUrl,
          uploading: false,
          uploadProgress: 100,
        });
      } catch {
        setError("Upload failed. Try again.");
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
      imageUrl: undefined,
      fileName: undefined,
      fileSize: undefined,
      uploadProgress: 0,
    });
    setError(null);
  }, [id, updateNodeData]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <BaseNode
      id={id}
      title="Upload Image"
      icon={<ImageIcon size={13} />}
      accentColor="oklch(0.65 0.18 280)"
      handles={HANDLES}
      isSelected={selected}
      minWidth={280}
    >
      <div className="space-y-2">
        {imageUrl ? (
          <div className="relative group">
            <img
              src={imageUrl}
              alt={fileName ?? "Uploaded image"}
              className="w-full h-36 object-cover rounded-lg border border-[oklch(0.22_0.06_200)]"
            />
            <button
              type="button"
              data-ocid="upload_image_node.clear_button"
              onClick={handleClear}
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[oklch(0.09_0_0/0.9)] border border-[oklch(0.22_0.06_200)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove image"
            >
              <X size={10} className="text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-ocid="upload_image_node.dropzone"
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="w-full flex flex-col items-center justify-center gap-2 h-28 rounded-lg border border-dashed border-[oklch(0.22_0.06_200)] hover:border-[oklch(0.65_0.18_280/0.6)] bg-[oklch(0.09_0_0)] hover:bg-[oklch(0.11_0_0)] cursor-pointer transition-all nodrag"
          >
            <Upload size={18} className="text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground/70">
                Drop image or click to upload
              </p>
              <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                JPG, PNG, WebP, GIF · max 20MB
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
            data-ocid="upload_image_node.error_state"
            className="text-[10px] text-destructive/80"
          >
            {error}
          </p>
        )}
      </div>
    </BaseNode>
  );
}
