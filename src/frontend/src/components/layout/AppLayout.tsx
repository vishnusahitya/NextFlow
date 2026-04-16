import { History } from "lucide-react";
import { cn } from "../../lib/utils";
import { useHistoryStore } from "../../stores/historyStore";
import { useWorkflowStore } from "../../stores/workflowStore";
import { Header } from "./Header";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isHistoryOpen, toggleHistory } = useHistoryStore();
  const { isSidebarOpen, toggleSidebar } = useWorkflowStore();

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />

        {/* Main canvas area */}
        <main
          className="flex-1 relative overflow-hidden bg-background"
          data-ocid="canvas.area"
        >
          {/* Show sidebar toggle when closed */}
          {!isSidebarOpen && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="absolute left-3 top-3 z-10 p-2 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shadow-node"
              aria-label="Open node library"
              data-ocid="canvas.open_sidebar_button"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M2 3h11M2 7.5h11M2 12h11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}

          {/* Show history toggle when closed */}
          {!isHistoryOpen && (
            <button
              type="button"
              onClick={toggleHistory}
              className="absolute right-3 top-3 z-10 flex items-center gap-1.5 px-2.5 py-2 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shadow-node text-xs"
              aria-label="Open execution history"
              data-ocid="canvas.open_history_button"
            >
              <History size={13} />
              <span className="font-medium">History</span>
            </button>
          )}

          {children}
        </main>

        <RightSidebar />
      </div>
    </div>
  );
}
