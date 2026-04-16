import Types "types/workflow";
import WorkflowMixin "mixins/workflow-api";
import Map "mo:core/Map";
import List "mo:core/List";

actor {
  let workflows = Map.empty<Text, Types.Workflow>();
  let executions = Map.empty<Principal, List.List<Types.Execution>>();

  include WorkflowMixin(workflows, executions);
};
