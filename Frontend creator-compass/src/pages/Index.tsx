import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Sparkles, ArrowLeft, Zap } from "lucide-react";
import { InterestChips } from "@/components/InterestChips";
import { AgentPipeline } from "@/components/AgentPipeline";
import { CreatorCard } from "@/components/CreatorCard";
import { AGENT_STEPS } from "@/data/mockData";
import { AgentStep, Creator, SearchParams, BackendCreator, BackendStep } from "@/types/creator";

type AppPhase = "input" | "loading" | "results" | "error";

/** Map backend snake_case creator to frontend camelCase */
function mapCreator(c: BackendCreator): Creator {
  return {
    name: c.name,
    channelId: c.channelId,
    thumbnailUrl: c.thumbnailUrl ?? "",
    channelUrl: c.channelUrl,
    subscribers: c.subscribers,
    avgViews: c.avg_views,
    engagementRate: c.engagement_rate,
    score: c.score > 1 ? c.score / 100 : c.score, // normalise to 0-1 if needed
    tags: c.tags,
    reason: c.reason,
  };
}

/** Map backend step status to frontend step status */
function mapStepStatus(s: BackendStep["status"]): AgentStep["status"] {
  if (s === "running") return "active";
  if (s === "complete") return "done";
  if (s === "error") return "done";
  return "pending";
}

const Index = () => {
  const [phase, setPhase] = useState<AppPhase>("input");
  const [errorMsg, setErrorMsg] = useState("");
  const [params, setParams] = useState<SearchParams>({
    interests: [],
    location: "",
    preferDeep: false,
    preferAuthentic: true,
  });
  const [steps, setSteps] = useState<AgentStep[]>(
    AGENT_STEPS.map((s) => ({ ...s, status: "pending" as const }))
  );
  const [results, setResults] = useState<Creator[]>([]);

  const runPipeline = useCallback(async () => {
    setPhase("loading");
    setErrorMsg("");
    setResults([]);
    setSteps(AGENT_STEPS.map((s) => ({ ...s, status: "pending" as const })));

    try {
      const res = await fetch("/api/find-creators/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interests: params.interests,
          location: params.location,
          preferAuthentic: params.preferAuthentic,
          preferDeepContent: params.preferDeep,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (currentEvent === "step") {
              const backendStep = data as BackendStep;
              setSteps((prev) =>
                prev.map((s) =>
                  s.id === backendStep.id
                    ? { ...s, status: mapStepStatus(backendStep.status) }
                    : s
                )
              );
            } else if (currentEvent === "result") {
              const creators = (data.creators as BackendCreator[]).map(mapCreator);
              setResults(creators);
            } else if (currentEvent === "done") {
              setSteps((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
            } else if (currentEvent === "error") {
              throw new Error(data.message || "Pipeline failed");
            }
          }
        }
      }

      setPhase("results");
    } catch (err) {
      console.error("Pipeline error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setPhase("error");
    }
  }, [params]);

  const canSearch = params.interests.length > 0 && params.location.trim().length > 0;

  return (
    <div className="relative min-h-screen bg-grid">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          {phase !== "input" && (
            <button
              onClick={() => { setPhase("input"); setResults([]); }}
              className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              New search
            </button>
          )}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-4">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">AI-Powered Creator Discovery</span>
          </div>
          <p className="mb-2 font-display text-3xl font-black uppercase tracking-[0.16em] text-primary md:text-4xl">
            CreatorScope
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            <span className="text-gradient-primary">Find creators</span>
            <br />
            <span className="text-foreground">worth following</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            Cut through the noise. Discover authentic YouTube creators who genuinely align with your interests.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* INPUT PHASE */}
          {phase === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-auto max-w-xl space-y-6"
            >
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  <Search className="inline h-4 w-4 mr-1.5 text-primary" />
                  Your interests
                </label>
                <InterestChips
                  interests={params.interests}
                  onChange={(interests) => setParams((p) => ({ ...p, interests }))}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  <MapPin className="inline h-4 w-4 mr-1.5 text-primary" />
                  Location
                </label>
                <input
                  type="text"
                  value={params.location}
                  onChange={(e) => setParams((p) => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. San Francisco, USA"
                  className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                />
              </div>

              {/* Toggles */}
              <div className="flex gap-3">
                <button
                  onClick={() => setParams((p) => ({ ...p, preferAuthentic: !p.preferAuthentic }))}
                  className={`flex-1 rounded-lg border p-3 text-center text-sm transition-all ${
                    params.preferAuthentic
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <span className="block text-lg mb-1">🛡️</span>
                  Prioritize Authenticity
                </button>
                <button
                  onClick={() => setParams((p) => ({ ...p, preferDeep: !p.preferDeep }))}
                  className={`flex-1 rounded-lg border p-3 text-center text-sm transition-all ${
                    params.preferDeep
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <span className="block text-lg mb-1">📚</span>
                  Prefer Deep Content
                </button>
              </div>

              <button
                onClick={runPipeline}
                disabled={!canSearch}
                className={`w-full rounded-lg py-3.5 text-sm font-semibold transition-all ${
                  canSearch
                    ? "bg-primary text-primary-foreground hover:opacity-90 glow-primary"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                <Sparkles className="inline h-4 w-4 mr-2" />
                Find Creators
              </button>
            </motion.div>
          )}

          {/* LOADING PHASE */}
          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-auto max-w-lg"
            >
              <h2 className="font-display text-xl font-semibold text-foreground mb-2 text-center">
                Agent Pipeline Running
              </h2>
              <p className="text-sm text-muted-foreground mb-8 text-center">
                Analyzing creators for: {params.interests.join(", ")} in {params.location}
              </p>
              <AgentPipeline steps={steps} />
            </motion.div>
          )}

          {/* RESULTS PHASE */}
          {phase === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    {results.length} Creators Found
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Ranked by authenticity score
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs text-primary border border-primary/20">
                  <Sparkles className="h-3 w-3" />
                  {params.interests.join(", ")} · {params.location}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {results.map((creator, i) => (
                  <CreatorCard key={creator.channelId} creator={creator} index={i} />
                ))}
              </div>
            </motion.div>
          )}

          {/* ERROR PHASE */}
          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-lg text-center"
            >
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8">
                <p className="text-lg font-semibold text-destructive mb-2">Something went wrong</p>
                <p className="text-sm text-muted-foreground mb-4">{errorMsg}</p>
                <button
                  onClick={() => setPhase("input")}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Index;
