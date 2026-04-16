import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Zap } from "lucide-react";
import { useEffect } from "react";
import { useCreateWorkflow } from "../hooks/useBackend";
import { cn } from "../lib/utils";

export default function LoginPage() {
  const { login, loginStatus, isAuthenticated } = useInternetIdentity();
  const createWorkflow = useCreateWorkflow();
  const navigate = useNavigate();
  const isLoggingIn = loginStatus === "logging-in";

  // Once authenticated, create a default workflow and navigate
  useEffect(() => {
    if (!isAuthenticated) return;
    createWorkflow
      .mutateAsync({
        name: "My First Workflow",
        nodes: [],
        edges: [],
      })
      .then((wf) => {
        navigate({ to: "/workflow/$id", params: { id: wf.id } });
      })
      .catch(() => {
        navigate({ to: "/workflow/$id", params: { id: "new" } });
      });
  }, [isAuthenticated, createWorkflow.mutateAsync, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient glow background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      {/* Dot grid overlay */}
      <div
        className="absolute inset-0 grid-bg opacity-30 pointer-events-none"
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative z-10 flex flex-col items-center gap-8 max-w-sm w-full mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center glow-accent">
            <Zap size={28} className="text-accent" />
          </div>
          <div className="text-center">
            <h1 className="font-display font-bold text-3xl text-foreground tracking-tight">
              NextFlow
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visual LLM workflow builder
            </p>
          </div>
        </div>

        {/* Login card */}
        <div
          className="w-full bg-card border border-border rounded-2xl p-8 flex flex-col gap-6 shadow-node animate-scale-in"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="text-center">
            <h2 className="text-base font-semibold text-foreground">
              Get started
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your Internet Identity to access your workflows
            </p>
          </div>

          <button
            type="button"
            onClick={login}
            disabled={
              isLoggingIn || isAuthenticated || createWorkflow.isPending
            }
            className={cn(
              "w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl",
              "bg-accent/10 border border-accent/40 text-accent font-semibold text-sm",
              "hover:bg-accent/20 hover:border-accent/60 transition-all duration-200",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
            )}
            data-ocid="login.connect_button"
          >
            {isLoggingIn || (isAuthenticated && createWorkflow.isPending) ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                {isLoggingIn ? "Connecting…" : "Opening workspace…"}
              </>
            ) : (
              <>
                <div className="w-5 h-5 rounded-full bg-accent/20 border border-accent/50 flex items-center justify-center">
                  <span className="text-accent font-bold text-xs">II</span>
                </div>
                Connect with Internet Identity
              </>
            )}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            No account needed — Internet Identity is anonymous and secure
          </p>
        </div>

        {/* Features */}
        <div
          className="grid grid-cols-3 gap-4 w-full animate-slide-down"
          style={{ animationDelay: "0.2s" }}
        >
          {[
            { label: "Visual canvas", desc: "Drag & drop nodes" },
            { label: "AI powered", desc: "Gemini integration" },
            { label: "Persistent", desc: "History stored on-chain" },
          ].map((f) => (
            <div
              key={f.label}
              className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted/50 border border-border text-center"
            >
              <span className="text-xs font-semibold text-foreground">
                {f.label}
              </span>
              <span className="text-xs text-muted-foreground">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-4 text-xs text-muted-foreground/50">
        © {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-muted-foreground transition-colors"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
