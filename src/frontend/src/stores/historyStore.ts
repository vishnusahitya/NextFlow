import { create } from "zustand";
import type { ExecutionRecord } from "../types/workflow";

interface HistoryState {
  executions: ExecutionRecord[];
  expandedExecutionId: string | null;
  isHistoryOpen: boolean;

  // Actions
  setExecutions: (executions: ExecutionRecord[]) => void;
  addExecution: (execution: ExecutionRecord) => void;
  setExpandedExecutionId: (id: string | null) => void;
  toggleHistory: () => void;
  setHistoryOpen: (open: boolean) => void;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  executions: [],
  expandedExecutionId: null,
  isHistoryOpen: true,

  setExecutions: (executions) => set({ executions }),
  addExecution: (execution) =>
    set((state) => ({
      executions: [execution, ...state.executions].slice(0, 100),
    })),
  setExpandedExecutionId: (expandedExecutionId) => set({ expandedExecutionId }),
  toggleHistory: () =>
    set((state) => ({ isHistoryOpen: !state.isHistoryOpen })),
  setHistoryOpen: (isHistoryOpen) => set({ isHistoryOpen }),
}));
