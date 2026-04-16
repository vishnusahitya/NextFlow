import { Textarea } from "@/components/ui/textarea";
import { useWorkflowStore } from "@/stores/workflowStore";
import { Type } from "lucide-react";
import { useCallback } from "react";
import { BaseNode } from "./BaseNode";

interface TextNodeData extends Record<string, unknown> {
  text?: string;
}

interface TextNodeProps {
  id: string;
  data: TextNodeData;
  selected?: boolean;
}

const HANDLES = [
  {
    id: "text-out",
    type: "text" as const,
    position: "output" as const,
    label: "Text",
  },
];

export function TextNode({ id, data, selected }: TextNodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const text = (data.text as string) ?? "";
  const charCount = text.length;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { text: e.target.value });
    },
    [id, updateNodeData],
  );

  return (
    <BaseNode
      id={id}
      title="Text Node"
      icon={<Type size={13} />}
      accentColor="oklch(0.65 0.21 200)"
      handles={HANDLES}
      isSelected={selected}
      minWidth={300}
      className="text-node"
    >
      <div className="space-y-2">
        <Textarea
          data-ocid="text_node.input"
          value={text}
          onChange={handleChange}
          placeholder="Enter your text here..."
          className="min-h-[100px] resize-none bg-[oklch(0.09_0_0)] border-[oklch(0.22_0.06_200)] text-foreground/90 text-xs font-mono placeholder:text-muted-foreground/40 focus:border-accent focus:ring-0 nodrag"
          rows={5}
        />
        <div className="flex justify-end">
          <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums">
            {charCount.toLocaleString()} chars
          </span>
        </div>
      </div>
    </BaseNode>
  );
}
