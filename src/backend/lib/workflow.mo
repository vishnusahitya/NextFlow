import Types "../types/workflow";
import List "mo:core/List";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Text "mo:core/Text";

module {
  let MAX_HISTORY : Nat = 100;

  // ── Internal helpers ───────────────────────────────────────────────────────

  public func generateId(prefix : Text, seed : Nat) : Text {
    prefix # "-" # seed.toText()
  };

  public func pruneExecutions(history : List.List<Types.Execution>, maxSize : Nat) {
    let size = history.size();
    if (size > maxSize) {
      history.truncate(maxSize)
    }
  };

  // ── Workflow CRUD ──────────────────────────────────────────────────────────

  public func createWorkflow(
    workflows : Map.Map<Text, Types.Workflow>,
    caller : Principal,
    req : Types.CreateWorkflowRequest,
    idSeed : Nat,
  ) : Types.Workflow {
    let id = generateId("wf", idSeed);
    let now = Time.now();
    let workflow : Types.Workflow = {
      id;
      ownerId = caller;
      name = req.name;
      nodes = req.nodes;
      edges = req.edges;
      createdAt = now;
      updatedAt = now;
    };
    workflows.add(id, workflow);
    workflow
  };

  public func getWorkflow(
    workflows : Map.Map<Text, Types.Workflow>,
    caller : Principal,
    id : Text,
  ) : ?Types.Workflow {
    switch (workflows.get(id)) {
      case (?wf) {
        if (Principal.equal(wf.ownerId, caller)) { ?wf } else { null }
      };
      case null { null };
    }
  };

  public func updateWorkflow(
    workflows : Map.Map<Text, Types.Workflow>,
    caller : Principal,
    req : Types.UpdateWorkflowRequest,
  ) : Types.WorkflowResult {
    switch (workflows.get(req.id)) {
      case null { #err("Workflow not found") };
      case (?existing) {
        if (not Principal.equal(existing.ownerId, caller)) {
          return #err("Not authorized")
        };
        let updated : Types.Workflow = {
          existing with
          name = req.name;
          nodes = req.nodes;
          edges = req.edges;
          updatedAt = Time.now();
        };
        workflows.add(req.id, updated);
        #ok(updated)
      };
    }
  };

  public func deleteWorkflow(
    workflows : Map.Map<Text, Types.Workflow>,
    caller : Principal,
    id : Text,
  ) : Bool {
    switch (workflows.get(id)) {
      case null { false };
      case (?wf) {
        if (not Principal.equal(wf.ownerId, caller)) {
          return false
        };
        workflows.remove(id);
        true
      };
    }
  };

  public func listWorkflows(
    workflows : Map.Map<Text, Types.Workflow>,
    caller : Principal,
  ) : [Types.WorkflowSummary] {
    let results = List.empty<Types.WorkflowSummary>();
    for ((_, wf) in workflows.entries()) {
      if (Principal.equal(wf.ownerId, caller)) {
        results.add({
          id = wf.id;
          name = wf.name;
          createdAt = wf.createdAt;
          updatedAt = wf.updatedAt;
          nodeCount = wf.nodes.size();
          edgeCount = wf.edges.size();
        })
      }
    };
    results.toArray()
  };

  // ── Execution history ──────────────────────────────────────────────────────

  public func appendExecution(
    executions : Map.Map<Principal, List.List<Types.Execution>>,
    caller : Principal,
    req : Types.AppendExecutionRequest,
    idSeed : Nat,
  ) : Types.Execution {
    let id = generateId("ex", idSeed);
    let execution : Types.Execution = {
      id;
      workflowId = req.workflowId;
      ownerId = caller;
      status = req.status;
      scope = req.scope;
      durationMs = req.durationMs;
      nodeLogs = req.nodeLogs;
      createdAt = Time.now();
    };
    let history = switch (executions.get(caller)) {
      case (?h) { h };
      case null {
        let h = List.empty<Types.Execution>();
        executions.add(caller, h);
        h
      };
    };
    // Prepend so newest is first
    let prev = history.toArray();
    history.clear();
    history.add(execution);
    for (e in prev.values()) {
      history.add(e)
    };
    pruneExecutions(history, MAX_HISTORY);
    execution
  };

  public func listExecutions(
    executions : Map.Map<Principal, List.List<Types.Execution>>,
    caller : Principal,
  ) : [Types.ExecutionSummary] {
    switch (executions.get(caller)) {
      case null { [] };
      case (?history) {
        history.map<Types.Execution, Types.ExecutionSummary>(func(e) {
          {
            id = e.id;
            workflowId = e.workflowId;
            status = e.status;
            scope = e.scope;
            durationMs = e.durationMs;
            createdAt = e.createdAt;
          }
        }).toArray()
      };
    }
  };

  public func getExecution(
    executions : Map.Map<Principal, List.List<Types.Execution>>,
    caller : Principal,
    executionId : Text,
  ) : Types.ExecutionResult {
    switch (executions.get(caller)) {
      case null { #err("Execution not found") };
      case (?history) {
        switch (history.find(func(e : Types.Execution) : Bool { Text.equal(e.id, executionId) })) {
          case null { #err("Execution not found") };
          case (?e) {
            #ok({
              summary = {
                id = e.id;
                workflowId = e.workflowId;
                status = e.status;
                scope = e.scope;
                durationMs = e.durationMs;
                createdAt = e.createdAt;
              };
              nodeLogs = e.nodeLogs;
            })
          };
        }
      };
    }
  };
};
