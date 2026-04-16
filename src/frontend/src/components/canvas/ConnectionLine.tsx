import type { ConnectionLineComponentProps } from "@xyflow/react";
import { getStraightPath } from "@xyflow/react";

/** Derives handle type from handle id naming convention:
 *  Handles are named like "text-out", "image-out", "video-out",
 *  "text-in", "image-in", "video-in" */
function getHandleDataType(handleId: string | null | undefined): string {
  if (!handleId) return "any";
  if (handleId.startsWith("image")) return "image";
  if (handleId.startsWith("video")) return "video";
  if (handleId.startsWith("text")) return "text";
  return "any";
}

export function CustomConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromHandle,
  connectionStatus,
}: ConnectionLineComponentProps) {
  const [path] = getStraightPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
  });

  // fromType is used downstream for visual encoding (future enhancement)
  const _fromType = getHandleDataType(fromHandle?.id);
  const isValid = connectionStatus === "valid" || connectionStatus === null;

  const strokeColor = isValid
    ? "oklch(0.68 0.19 305)" // purple accent
    : "oklch(0.65 0.19 22)"; // destructive red

  return (
    <g>
      <defs>
        <filter id="conn-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={path}
        fill="none"
        strokeWidth={2.5}
        stroke={strokeColor}
        strokeDasharray="6 3"
        filter="url(#conn-glow)"
        strokeLinecap="round"
        style={{
          animation: "dashFlow 0.6s linear infinite",
          opacity: 0.9,
        }}
      />
      <circle cx={toX} cy={toY} r={5} fill={strokeColor} opacity={0.8} />
    </g>
  );
}
