import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runLLM } from "@/lib/llm";
import { cropImage } from "@/lib/image-processing";
import { extractFrame } from "@/lib/video-processing";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { mode, selectedNodeIds } = await request.json();
    
    // Get workflow with nodes and edges
    const workflow = await prisma.workflow.findUnique({
      where: { id: params.id },
      include: { executionRuns: true },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const nodes = workflow.nodes as any[];
    const edges = workflow.edges as any[];

    // ✅ Helper function to get input value from connected nodes
    function getInputValue(nodeId: string, handleId: string): string | null {
      const edge = edges.find(
        (e) => e.target === nodeId && e.targetHandle === handleId
      );
      
      if (!edge) return null;
      
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (!sourceNode) return null;
      
      // Map handle to data field
      const handleToField: Record<string, string> = {
        "text-out": "text",
        "image-out": "imageUrl",
        "video-out": "videoUrl",
        "system-prompt-in": "systemPrompt",
        "user-message-in": "userMessage",
        "images-in": "images",
        "x-in": "cropX",
        "y-in": "cropY",
        "width-in": "cropW",
        "height-in": "cropH",
        "timestamp-in": "timestamp",
      };
      
      const field = handleToField[edge.sourceHandle];
      return sourceNode.data?.[field] || null;
    }

    const nodeLogs: any[] = [];
    const startTime = Date.now();

    // Execute nodes in topological order (simple implementation)
    const executedNodes = new Set<string>();
    
    for (const node of nodes) {
      if (mode === "single" && !selectedNodeIds.includes(node.id)) continue;
      if (mode === "partial" && !selectedNodeIds.includes(node.id)) continue;

      const nodeStartTime = Date.now();
      
      try {
        let output = null;
        
        if (node.type === "runLLM") {
          // ✅ Extract inputs from connected nodes
          const systemPrompt = getInputValue(node.id, "system-prompt-in") || node.data.systemPrompt || "";
          const userMessage = getInputValue(node.id, "user-message-in") || node.data.userMessage || "";
          const images = getInputValue(node.id, "images-in") ? [getInputValue(node.id, "images-in")] : [];
          
          console.log(`LLM Node ${node.id}:`, { systemPrompt, userMessage, images }); // Debug
          
          output = await runLLM({
            model: node.data.model || "gemini-2.0-flash",
            systemPrompt,
            userMessage,
            images,
          });
        } else if (node.type === "cropImage") {
          const imageUrl = getInputValue(node.id, "image-in") || node.data.imageUrl;
          const cropX = getInputValue(node.id, "x-in") ? parseFloat(getInputValue(node.id, "x-in")!) : node.data.cropX;
          const cropY = getInputValue(node.id, "y-in") ? parseFloat(getInputValue(node.id, "y-in")!) : node.data.cropY;
          const cropW = getInputValue(node.id, "width-in") ? parseFloat(getInputValue(node.id, "width-in")!) : node.data.cropW;
          const cropH = getInputValue(node.id, "height-in") ? parseFloat(getInputValue(node.id, "height-in")!) : node.data.cropH;
          
          output = await cropImage(imageUrl, cropX, cropY, cropW, cropH);
        } else if (node.type === "extractFrame") {
          const videoUrl = getInputValue(node.id, "video-in") || node.data.videoUrl;
          const timestamp = getInputValue(node.id, "timestamp-in") || node.data.timestamp;
          
          output = await extractFrame(videoUrl, timestamp);
        }

        executedNodes.add(node.id);
        
        nodeLogs.push({
          nodeId: node.id,
          nodeType: node.type,
          inputs: node.data,
          outputs: output,
          durationMs: Date.now() - nodeStartTime,
        });
        
      } catch (error) {
        nodeLogs.push({
          nodeId: node.id,
          nodeType: node.type,
          inputs: node.data,
          error: error instanceof Error ? error.message : "Unknown error",
          durationMs: Date.now() - nodeStartTime,
        });
      }
    }

    // Save execution
    const execution = await prisma.execution.create({
      data: {
        workflowId: params.id,
        scope: mode,
        status: nodeLogs.some(log => log.error) ? "failed" : "success",
        durationMs: Date.now() - startTime,
        nodeLogs,
      },
    });

    return NextResponse.json({
      id: execution.id,
      workflowId: execution.workflowId,
      scope: execution.scope,
      status: execution.status,
      durationMs: execution.durationMs,
      createdAt: execution.createdAt,
      nodeLogs,
    });
    
  } catch (error) {
    console.error("Execution error:", error);
    return NextResponse.json(
      { error: "Failed to execute workflow" },
      { status: 500 }
    );
  }
}