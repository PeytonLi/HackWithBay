"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AgentStepIndicator } from "@/components/AgentStepIndicator";
import type { AgentStep } from "@/types/creator";

const INITIAL_STEPS: AgentStep[] = [
  { id: "connect",   name: "Connecting to RocketRide", emoji: "🚀", status: "pending", description: "Initialising the AI pipeline engine" },
  { id: "discovery", name: "Querying Neo4j Graph",     emoji: "🔍", status: "pending", description: "Finding creators matching your interests in the graph database" },
  { id: "ranking",   name: "Ranking & Explaining",     emoji: "⭐", status: "pending", description: "AI agent is ranking creators and generating explanations" },
];

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-400">Loading...</div>}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [steps, setSteps] = useState<AgentStep[]>(INITIAL_STEPS);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const interests = params.get("interests")?.split(",").filter(Boolean) ?? [];
  const location = params.get("location") ?? "";
  const preferAuthentic = params.get("authentic") !== "false";
  const preferDeep = params.get("deep") !== "false";

  const runPipeline = useCallback(async () => {
    try {
      const res = await fetch("/api/find-creators/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interests,
          location,
          preferAuthentic,
          preferDeepContent: preferDeep,
        }),
      });

      if (!res.ok || !res.body) {
        setError("Failed to start pipeline");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            const data = JSON.parse(line.slice(6));
            if (eventType === "step") {
              setSteps((prev) =>
                prev.map((s) => (s.id === data.id ? { ...s, ...data } : s)),
              );
            } else if (eventType === "result") {
              // Store results and navigate
              sessionStorage.setItem("creatorResults", JSON.stringify(data.creators));
              sessionStorage.setItem("totalTime", String(data.totalTime));
            } else if (eventType === "done") {
              router.push("/results");
            } else if (eventType === "error") {
              setError(data.message);
            }
            eventType = "";
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  }, [interests, location, preferAuthentic, preferDeep, router]);

  useEffect(() => {
    if (started.current || interests.length === 0) return;
    started.current = true;
    runPipeline();
  }, [runPipeline, interests.length]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 md:p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Finding your creators...
          </h1>
          <p className="text-gray-400 text-sm">
            Searching for <span className="text-purple-300">{interests.join(", ")}</span>
            {location && <> in <span className="text-cyan-300">{location}</span></>}
          </p>
        </div>

        <div className="space-y-3">
          {steps.map((step) => (
            <AgentStepIndicator key={step.id} step={step} />
          ))}
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
            <strong>Error:</strong> {error}
            <button
              onClick={() => router.push("/")}
              className="block mt-2 text-red-400 underline hover:text-red-300"
            >
              ← Go back and try again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
