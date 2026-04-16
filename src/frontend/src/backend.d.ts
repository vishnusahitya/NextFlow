import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface NodeExecutionLog {
    nodeId: string;
    error?: string;
    inputs: string;
    durationMs: bigint;
    outputs: string;
    nodeType: string;
}
export interface NodeData {
    config: string;
    nodeType: string;
}
export type Time = bigint;
export type ExecutionResult = {
    __kind__: "ok";
    ok: ExecutionDetail;
} | {
    __kind__: "err";
    err: string;
};
export interface WorkflowNode {
    id: string;
    data: NodeData;
    position: NodePosition;
    nodeType: string;
}
export interface WorkflowEdge {
    id: string;
    source: string;
    targetHandle?: string;
    target: string;
    sourceHandle?: string;
}
export interface NodePosition {
    x: number;
    y: number;
}
export interface ExecutionSummary {
    id: string;
    status: ExecutionStatus;
    createdAt: Time;
    scope: ExecutionScope;
    durationMs: bigint;
    workflowId: string;
}
export interface WorkflowSummary {
    id: string;
    name: string;
    createdAt: Time;
    updatedAt: Time;
    edgeCount: bigint;
    nodeCount: bigint;
}
export interface ExecutionDetail {
    summary: ExecutionSummary;
    nodeLogs: Array<NodeExecutionLog>;
}
export interface Execution {
    id: string;
    status: ExecutionStatus;
    ownerId: Principal;
    createdAt: Time;
    scope: ExecutionScope;
    durationMs: bigint;
    nodeLogs: Array<NodeExecutionLog>;
    workflowId: string;
}
export interface AppendExecutionRequest {
    status: ExecutionStatus;
    scope: ExecutionScope;
    durationMs: bigint;
    nodeLogs: Array<NodeExecutionLog>;
    workflowId: string;
}
export interface CreateWorkflowRequest {
    name: string;
    edges: Array<WorkflowEdge>;
    nodes: Array<WorkflowNode>;
}
export type WorkflowResult = {
    __kind__: "ok";
    ok: Workflow;
} | {
    __kind__: "err";
    err: string;
};
export interface UpdateWorkflowRequest {
    id: string;
    name: string;
    edges: Array<WorkflowEdge>;
    nodes: Array<WorkflowNode>;
}
export interface Workflow {
    id: string;
    ownerId: Principal;
    name: string;
    createdAt: Time;
    edges: Array<WorkflowEdge>;
    updatedAt: Time;
    nodes: Array<WorkflowNode>;
}
export enum ExecutionScope {
    full = "full",
    single = "single",
    partial = "partial"
}
export enum ExecutionStatus {
    success = "success",
    failed = "failed",
    partial = "partial"
}
export interface backendInterface {
    appendExecution(req: AppendExecutionRequest): Promise<Execution>;
    createWorkflow(req: CreateWorkflowRequest): Promise<Workflow>;
    deleteWorkflow(id: string): Promise<boolean>;
    getExecution(executionId: string): Promise<ExecutionResult>;
    getWorkflow(id: string): Promise<Workflow | null>;
    listExecutions(): Promise<Array<ExecutionSummary>>;
    listWorkflows(): Promise<Array<WorkflowSummary>>;
    updateWorkflow(req: UpdateWorkflowRequest): Promise<WorkflowResult>;
}
