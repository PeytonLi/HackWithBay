import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Sparkles, ArrowLeft, Zap } from "lucide-react";
import { InterestChips } from "@/components/InterestChips";
import { AgentPipeline } from "@/components/AgentPipeline";
import { CreatorCard } from "@/components/CreatorCard";
import { MOCK_CREATORS, AGENT_STEPS } from "@/data/mockData";
import { AgentStep, Creator, SearchParams } from "@/types/creator";

type AppPhase = "input" | "loading" | "results";

const Index = () => {
  const [phase, setPhase] = useState<AppPhase>("input");
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
    const stepsCopy = AGENT_STEPS.map((s) => ({ ...s, status: "pending" as const }));
    setSteps(stepsCopy);

    for (let i = 0; i < stepsCopy.length; i++) {
      setSteps((prev) =>
        prev.map((s, idx) => ({
          ...s,
          status: idx === i ? "active" : idx < i ? "done" : "pending",
        }))
      );
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
    }

    setSteps((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
    await new Promise((r) => setTimeout(r, 500));

    // Filter/sort mock data based on preferences
    let filtered = [...MOCK_CREATORS];
    if (params.preferAuthentic) {
      filtered.sort((a, b) => b.engagementRate - a.engagementRate);
    }
    setResults(filtered);
    setPhase("results");
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
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
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
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Index;
