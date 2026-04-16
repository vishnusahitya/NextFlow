import Time "mo:core/Time";

module {
  // ── Workflow definition types ──────────────────────────────────────────────

  public type NodePosition = {
    x : Float;
    y : Float;
  };

  public type NodeData = {
    nodeType : Text; // "text" | "upload-image" | "upload-video" | "run-llm" | "crop-image" | "extract-frame"
    config : Text;   // JSON-serialized node configuration
  };

  public type WorkflowNode = {
    id : Text;
    nodeType : Text;
    position : NodePosition;
    data : NodeData;
  };

  public type WorkflowEdge = {
    id : Text;
    source : Text;
    sourceHandle : ?Text;
    target : Text;
    targetHandle : ?Text;
  };

  public type Workflow = {
    id : Text;
    ownerId : Principal;
    name : Text;
    nodes : [WorkflowNode];
    edges : [WorkflowEdge];
    createdAt : Time.Time;
    updatedAt : Time.Time;
  };

  // ── Execution history types ────────────────────────────────────────────────

  public type ExecutionStatus = {
    #success;
    #failed;
    #partial;
  };

  public type ExecutionScope = {
    #full;
    #partial;
    #single;
  };

  public type NodeExecutionLog = {
    nodeId : Text;
    nodeType : Text;
    inputs : Text;   // JSON-serialized inputs
    outputs : Text;  // JSON-serialized outputs
    error : ?Text;
    durationMs : Nat;
  };

  public type Execution = {
    id : Text;
    workflowId : Text;
    ownerId : Principal;
    status : ExecutionStatus;
    scope : ExecutionScope;
    durationMs : Nat;
    nodeLogs : [NodeExecutionLog];
    createdAt : Time.Time;
  };

  // ── Request / Response types ───────────────────────────────────────────────

  public type CreateWorkflowRequest = {
    name : Text;
    nodes : [WorkflowNode];
    edges : [WorkflowEdge];
  };

  public type UpdateWorkflowRequest = {
    id : Text;
    name : Text;
    nodes : [WorkflowNode];
    edges : [WorkflowEdge];
  };

  public type AppendExecutionRequest = {
    workflowId : Text;
    status : ExecutionStatus;
    scope : ExecutionScope;
    durationMs : Nat;
    nodeLogs : [NodeExecutionLog];
  };

  public type WorkflowSummary = {
    id : Text;
    name : Text;
    createdAt : Time.Time;
    updatedAt : Time.Time;
    nodeCount : Nat;
    edgeCount : Nat;
  };

  public type ExecutionSummary = {
    id : Text;
    workflowId : Text;
    status : ExecutionStatus;
    scope : ExecutionScope;
    durationMs : Nat;
    createdAt : Time.Time;
  };

  public type ExecutionDetail = {
    summary : ExecutionSummary;
    nodeLogs : [NodeExecutionLog];
  };

  public type WorkflowResult = {
    #ok : Workflow;
    #err : Text;
  };

  public type WorkflowSummaryResult = {
    #ok : WorkflowSummary;
    #err : Text;
  };

  public type ExecutionResult = {
    #ok : ExecutionDetail;
    #err : Text;
  };
};
