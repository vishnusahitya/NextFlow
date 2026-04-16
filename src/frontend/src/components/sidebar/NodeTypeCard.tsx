import { Crop, Film, Image, Sparkles, Type, Video } from "lucide-react";
import type React from "react";
import { cn } from "../../lib/utils";
import type { NodeTypeDefinition } from "../../types/workflow";

const ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  Type,
  Image,
  Video,
  Sparkles,
  Crop,
  Film,
};

const CATEGORY_GLOW: Record<string, string> = {
  input: "group-hover:shadow-[0_0_10px_oklch(0.65_0.15_240/0.35)]",
  ai: "group-hover:shadow-[0_0_10px_oklch(0.65_0.21_200/0.45)]",
  transform: "group-hover:shadow-[0_0_10px_oklch(0.65_0.18_70/0.35)]",
};

const CATEGORY_ICON_COLOR: Record<string, string> = {
  input: "text-blue-400",
  ai: "text-accent",
  transform: "text-amber-400",
};

const CATEGORY_ICON_BG: Record<string, string> = {
  input: "group-hover:bg-blue-400/10 group-hover:border-blue-400/30",
  ai: "group-hover:bg-accent/10 group-hover:border-accent/30",
  transform: "group-hover:bg-amber-400/10 group-hover:border-amber-400/30",
};

const CATEGORY_ACCENT_BAR: Record<string, string> = {
  input: "bg-blue-400/60",
  ai: "bg-accent/60",
  transform: "bg-amber-400/60",
};

interface NodeTypeCardProps {
  def: NodeTypeDefinition;
  index?: number;
}

export function NodeTypeCard({ def, index }: NodeTypeCardProps) {
  const Icon = ICON_MAP[def.icon] ?? Type;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/nextflow-node", def.type);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      data-ocid={`node_library.item.${(index ?? 0) + 1}`}
      className={cn(
        "group relative flex items-start gap-3 p-3 rounded-lg border cursor-grab active:cursor-grabbing select-none",
        "bg-card/60 border-border/60",
        "hover:border-border transition-all duration-200",
        "hover:bg-card",
        CATEGORY_GLOW[def.category],
      )}
    >
      {/* Left accent bar */}
      <span
        className={cn(
          "absolute left-0 top-2 bottom-2 w-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200",
          CATEGORY_ACCENT_BAR[def.category],
        )}
      />

      {/* Icon container */}
      <div
        className={cn(
          "w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-muted border border-border transition-all duration-200",
          CATEGORY_ICON_BG[def.category],
        )}
      >
        <Icon
          size={14}
          className={cn(
            CATEGORY_ICON_COLOR[def.category],
            "transition-colors duration-200",
          )}
        />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground leading-tight truncate">
          {def.label}
        </p>
        <p className="text-xs text-muted-foreground leading-tight mt-0.5 line-clamp-2">
          {def.description}
        </p>
      </div>
    </div>
  );
}
