/**
 * Pipeline Runner
 * Chains all 7 agents in sequence, emitting step updates for real-time UI.
 * When RocketRide API key is available, this can delegate to runPipeline().
 */

import type {
  SearchInput,
  PipelineResult,
  AgentStep,
  Creator,
} from "@/types/creator";
import {
  runQueryAgent,
  runDiscoveryAgent,
  runEnrichmentAgent,
  runAnalysisAgent,
  runGraphAgent,
  runRankingAgent,
  runExplanationAgent,
} from "@/agents";

export type StepCallback = (step: AgentStep) => void;

const STEPS: Omit<AgentStep, "status">[] = [
  { id: "query",      name: "Planning Queries",      emoji: "🧠", description: "Generating optimised YouTube search queries" },
  { id: "discovery",  name: "Searching YouTube",     emoji: "🔍", description: "Searching for videos and discovering channels" },
  { id: "enrichment", name: "Enriching Channels",    emoji: "📊", description: "Fetching channel stats and recent videos" },
  { id: "analysis",   name: "Analysing Signals",     emoji: "📈", description: "Computing engagement, consistency, and quality signals" },
  { id: "graph",      name: "Building Creator Graph", emoji: "🧩", description: "Storing relationships in Neo4j and computing graph signals" },
  { id: "ranking",    name: "Ranking Creators",      emoji: "⭐", description: "Applying weighted scoring formula" },
  { id: "explain",    name: "Generating Explanations", emoji: "💬", description: "Writing personalised creator recommendations" },
];

function makeStep(index: number, status: AgentStep["status"], extra?: Partial<AgentStep>): AgentStep {
  return { ...STEPS[index], status, ...extra };
}

export async function runCreatorPipeline(
  input: SearchInput,
  onStep?: StepCallback,
): Promise<PipelineResult> {
  const start = Date.now();
  const completedSteps: AgentStep[] = [];

  const emit = (idx: number, status: AgentStep["status"], result?: unknown) => {
    const step = makeStep(idx, status, {
      result,
      startedAt: status === "running" ? Date.now() : undefined,
      completedAt: status === "complete" ? Date.now() : undefined,
    });
    if (status === "complete") completedSteps.push(step);
    onStep?.(step);
  };

  try {
    // 1. Query Agent
    emit(0, "running");
    const queryResult = await runQueryAgent(input);
    emit(0, "complete", { queryCount: queryResult.queries.length });

    // 2. Discovery Agent
    emit(1, "running");
    const discoveryResult = await runDiscoveryAgent(queryResult);
    emit(1, "complete", {
      videoCount: discoveryResult.videos.length,
      channelCount: discoveryResult.uniqueChannelIds.length,
    });

    // 3. Enrichment Agent
    emit(2, "running");
    const enrichmentResult = await runEnrichmentAgent({
      channelIds: discoveryResult.uniqueChannelIds,
      videosPerChannel: 8,
    });
    emit(2, "complete", { creatorCount: enrichmentResult.creators.length });

    // 4. Analysis Agent
    emit(3, "running");
    const analysisResult = await runAnalysisAgent({
      creators: enrichmentResult.creators,
      interests: input.interests,
    });
    emit(3, "complete", { analysedCount: analysisResult.creators.length });

    // 5. Graph Agent
    emit(4, "running");
    const graphResult = await runGraphAgent({
      creators: analysisResult.creators,
      interests: input.interests,
    });
    emit(4, "complete", { graphedCount: graphResult.creators.length });

    // 6. Ranking Agent
    emit(5, "running");
    const rankingResult = await runRankingAgent({
      creators: graphResult.creators,
      preferAuthentic: input.preferAuthentic,
    });
    emit(5, "complete", { rankedCount: rankingResult.ranked.length });

    // 7. Explanation Agent
    emit(6, "running");
    const explanationResult = await runExplanationAgent({
      ranked: rankingResult.ranked.slice(0, 15), // Top 15
      interests: input.interests,
    });
    emit(6, "complete", { creatorCount: explanationResult.creators.length });

    return {
      creators: explanationResult.creators,
      steps: completedSteps,
      totalTime: Date.now() - start,
    };
  } catch (error) {
    // Mark current step as error
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    onStep?.(makeStep(completedSteps.length, "error", { error: errMsg }));
    throw error;
  }
}
