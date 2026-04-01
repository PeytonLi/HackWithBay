/**
 * Pipeline Runner
 * Uses RocketRide to orchestrate creator discovery via the .pipe pipeline.
 * The pipeline sends user interests to the RocketRide agent, which queries
 * the seeded Neo4j graph database and uses the LLM to rank/explain results.
 *
 * Falls back to a direct Neo4j query + LLM chain if RocketRide is unavailable.
 */

import type {
  SearchInput,
  PipelineResult,
  AgentStep,
  Creator,
} from "@/types/creator";
import OpenAI from "openai";
import { readFile } from "fs/promises";
import { getClient, getLLMConfig } from "@/lib/rocketride";
import {
  queryCreatorsByInterests,
  type Neo4jCreatorResult,
} from "@/lib/neo4j";
import path from "path";

export type StepCallback = (step: AgentStep) => void;

const STEPS: Omit<AgentStep, "status">[] = [
  { id: "query", name: "Connecting to RocketRide", emoji: "🚀", description: "Initialising pipeline engine" },
  { id: "discovery", name: "Querying Neo4j Graph", emoji: "🔍", description: "Finding creators matching your interests in the graph database" },
  { id: "ranking", name: "Ranking & Explaining", emoji: "⭐", description: "AI agent is ranking creators and generating explanations" },
];

function makeStep(index: number, status: AgentStep["status"], extra?: Partial<AgentStep>): AgentStep {
  return { ...STEPS[index], status, ...extra };
}

function activeRuntimeLlmProvider(): "openai" | "anthropic" {
  return (process.env.LLM_PROVIDER ?? "openai").trim().toLowerCase() === "anthropic"
    ? "anthropic"
    : "openai";
}

function applyRuntimeLlmToPipeline(pipeline: Record<string, any>): Record<string, any> {
  const provider = activeRuntimeLlmProvider();
  const components = Array.isArray(pipeline.components) ? pipeline.components : [];
  const llmNode =
    components.find((c: any) => c?.provider === "llm_openai" || c?.provider === "llm_anthropic")
    ?? components.find((c: any) => typeof c?.provider === "string" && c.provider.startsWith("llm_"));

  if (!llmNode) return pipeline;

  if (provider === "anthropic") {
    const key = (process.env.ROCKETRIDE_ANTHROPIC_KEY ?? "").trim();
    const model = (process.env.ROCKETRIDE_ANTHROPIC_MODEL ?? "claude-haiku-4-5").trim();
    if (!key) {
      throw new Error("LLM_PROVIDER=anthropic but ROCKETRIDE_ANTHROPIC_KEY is not set");
    }

    llmNode.provider = "llm_anthropic";
    llmNode.config = {
      profile: "custom",
      custom: {
        apikey: key,
        model,
        modelTotalTokens: Number(process.env.ROCKETRIDE_ANTHROPIC_MODEL_TOKENS || 200000),
      },
      parameters: {},
    };

    return pipeline;
  }

  const key = (process.env.ROCKETRIDE_OPENAI_KEY ?? process.env.OPENAI_API_KEY ?? "").trim();
  const model = (process.env.ROCKETRIDE_OPENAI_MODEL ?? process.env.OPENAI_MODEL ?? "openai/gpt-5.4").trim();
  if (!key) {
    throw new Error("LLM_PROVIDER=openai but ROCKETRIDE_OPENAI_KEY / OPENAI_API_KEY is not set");
  }

  llmNode.provider = "llm_openai";
  llmNode.config = {
    profile: "custom",
    custom: {
      apikey: key,
      model,
      modelTotalTokens: Number(process.env.ROCKETRIDE_OPENAI_MODEL_TOKENS || 128000),
    },
    parameters: {},
  };

  return pipeline;
}

async function loadRuntimePipeline(pipelinePath: string): Promise<Record<string, any>> {
  const raw = await readFile(pipelinePath, "utf-8");
  const parsed = JSON.parse(raw) as Record<string, any>;
  return applyRuntimeLlmToPipeline(parsed);
}

function toCreatorFallbackRow(
  c: Neo4jCreatorResult,
  interests: string[],
  score: number,
  reason: string,
): Creator {
  const tags = [...(c.topics ?? [])];
  if (tags.length === 0) tags.push(...interests);

  return {
    name: c.name || "Unknown",
    channelId: c.channelId || "",
    subscribers: Number(c.subscribers || 0),
    avg_views: Number(c.avgViews || 0),
    engagement_rate: Number(c.engagementRate || 0),
    score,
    tags,
    reason,
    thumbnailUrl: c.thumbnailUrl || "",
    channelUrl: c.channelId ? `https://youtube.com/channel/${c.channelId}` : "",
  };
}

function completeRankedList(
  ranked: Creator[],
  source: Neo4jCreatorResult[],
  interests: string[],
): Creator[] {
  const byId = new Map(source.map((c) => [c.channelId, c]));
  const byName = new Map(source.map((c) => [c.name.trim().toLowerCase(), c]));
  const used = new Set<string>();

  const withFallbacks: Creator[] = ranked.map((creator, idx) => {
    const sourceCreator = byId.get(creator.channelId)
      ?? byName.get((creator.name ?? "").trim().toLowerCase());
    if (sourceCreator?.channelId) used.add(sourceCreator.channelId);

    const safeReason = creator.reason?.trim() ||
      `Ranked #${idx + 1} based on comment quality, audience engagement, and topic relevance.`;

    if (!sourceCreator) {
      return { ...creator, reason: safeReason };
    }

    return {
      ...creator,
      channelId: creator.channelId || sourceCreator.channelId,
      subscribers: creator.subscribers || sourceCreator.subscribers,
      avg_views: creator.avg_views || sourceCreator.avgViews,
      engagement_rate: creator.engagement_rate || sourceCreator.engagementRate,
      thumbnailUrl: creator.thumbnailUrl || sourceCreator.thumbnailUrl,
      channelUrl: creator.channelUrl || (sourceCreator.channelId ? `https://youtube.com/channel/${sourceCreator.channelId}` : ""),
      tags: creator.tags?.length ? creator.tags : sourceCreator.topics,
      reason: safeReason,
    };
  });

  // Ensure every Neo4j candidate appears exactly once in the final response.
  for (const c of source) {
    if (used.has(c.channelId)) continue;
    const fallbackScore = Math.max(
      0,
      Math.min(
        1,
        (Math.log10(Math.max(1, c.subscribers)) / 6) * 0.4 +
        Math.min(1, c.engagementRate / 0.15) * 0.6,
      ),
    );
    withFallbacks.push(
      toCreatorFallbackRow(
        c,
        interests,
        fallbackScore,
        "Included from the Neo4j candidate set via deterministic fallback ranking (engagement + subscriber signals) because the LLM output omitted this creator.",
      ),
    );
  }

  return withFallbacks;
}

async function rankCreatorsWithLLM(
  creators: Neo4jCreatorResult[],
  interests: string[],
): Promise<Creator[]> {
  if (creators.length === 0) return [];

  const cfg = getLLMConfig();
  if (!cfg.apiKey) {
    return creators
      .slice()
      .sort((a, b) => b.subscribers - a.subscribers)
      .map((c, idx) =>
        toCreatorFallbackRow(
          c,
          interests,
          Math.max(0, 1 - idx * 0.03),
          "Ranked with deterministic fallback because LLM credentials are missing.",
        ),
      );
  }

  const ai = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  const completion = await ai.chat.completions.create({
    model: cfg.model,
    temperature: 0.2,
    max_completion_tokens: 2000,
    messages: [
      {
        role: "system",
        content:
          "You are ranking creators by trust and audience quality. Return strict JSON only. Include every creator from input exactly once in ranked order with a concise reason.",
      },
      {
        role: "user",
        content: JSON.stringify({
          interests,
          creators,
          output_schema: {
            ranked_creators: [
              {
                name: "string",
                channelId: "string",
                final_score: "number 0-1",
                label: "optional string",
                reason: "1-2 sentence concise reason",
              },
            ],
          },
          rules: [
            "Use comment quality and relevance to interests as primary factors.",
            "Do not drop any creator. Return all creators exactly once.",
          ],
        }),
      },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? "";
  return completeRankedList(
    parseAgentResponse(text, interests, {
      expectedCount: creators.length,
      source: "direct-llm-ranking",
    }),
    creators,
    interests,
  );
}

/**
 * Run the creator discovery pipeline via RocketRide.
 * 1. Connect to RocketRide engine
 * 2. Load the creator-discovery.pipe pipeline
 * 3. Send the user's interests as a chat question
 * 4. Parse the agent's JSON response into Creator[]
 */
export async function runCreatorPipeline(
  input: SearchInput,
  onStep?: StepCallback,
): Promise<PipelineResult> {
  const normalizedInput: SearchInput = {
    interests: (input.interests ?? []).map((i) => i.trim()).filter(Boolean),
    location: (input.location ?? "").trim() || "global",
    preferAuthentic: Boolean(input.preferAuthentic),
    preferDeepContent: Boolean(input.preferDeepContent),
  };

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
    // 1. Connect to RocketRide and load the pipeline
    emit(0, "running");
    const client = await getClient();
    const pipelinePath = path.resolve(
      process.cwd(),
      process.env.ROCKETRIDE_PIPELINE_FILE || "creator-discovery.pipe",
    );
    const pipelineConfig = await loadRuntimePipeline(pipelinePath);

    let token: string;
    try {
      ({ token } = await client.use({ pipeline: pipelineConfig, useExisting: false }));
    } catch (err: any) {
      if (!String(err?.message ?? "").includes("already running")) {
        throw err;
      }

      const existing = await client.use({ pipeline: pipelineConfig, useExisting: true });
      await client.terminate(existing.token);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      ({ token } = await client.use({ pipeline: pipelineConfig, useExisting: false }));
    }

    emit(0, "complete", { connected: true });

    // 2. Query Neo4j for creators matching the user's interests
    emit(1, "running");
    const neo4jResults = await queryCreatorsByInterests(
      normalizedInput.interests,
      20,
    );
    emit(1, "complete", { creatorCount: neo4jResults.length });

    if (neo4jResults.length === 0) {
      emit(2, "complete", { creatorCount: 0, note: "No creators found for selected interests" });
      return {
        creators: [],
        steps: completedSteps,
        totalTime: Date.now() - start,
      };
    }

    // 3. Send the raw Neo4j data as text to the webhook → LLM pipeline
    emit(2, "running");
    const payload = JSON.stringify({
      interests: normalizedInput.interests,
      creators: neo4jResults,
      expected_creator_count: neo4jResults.length,
      return_all_creators: true,
    });

    const response = await client.send(
      token,
      payload,
      {},
      "text/plain",
      async (type: string, data: Record<string, unknown>) => {
        onStep?.({
          id: String(data.pipeId ?? "agent"),
          name: String(data.name ?? "Processing"),
          status: type === "complete" ? "complete" : "running",
          emoji: "🔄",
          description: String(data.status ?? "Agent is working..."),
        });
      },
    );

    const creators = completeRankedList(
      parseAgentResponse(response, normalizedInput.interests, {
        expectedCount: neo4jResults.length,
        source: "rocketride-response",
      }),
      neo4jResults,
      normalizedInput.interests,
    );
    emit(2, "complete", { creatorCount: creators.length });

    return {
      creators,
      steps: completedSteps,
      totalTime: Date.now() - start,
    };
  } catch (error) {
    console.error("RocketRide pipeline error:", error);

    // Fallback: query Neo4j directly if RocketRide is unavailable
    console.log("Falling back to direct Neo4j query...");
    return runDirectNeo4jFallback(normalizedInput, onStep);
  }
}

/**
 * Parse the RocketRide agent's response into Creator[].
 * The agent should return JSON with a "creators" array.
 */
function parseAgentResponse(
  response: unknown,
  interests: string[],
  options?: { expectedCount?: number; source?: string },
): Creator[] {
  try {
    const expectedCount = Number(options?.expectedCount ?? 0);
    const source = options?.source ?? "unknown";

    const candidates: unknown[] = [];
    const queue: unknown[] = [response];
    const visited = new Set<object>();

    // Collect all plausible payload fragments from wrapper formats.
    while (queue.length > 0) {
      const current = queue.shift();
      if (current == null) continue;

      candidates.push(current);

      if (Array.isArray(current)) {
        queue.push(...current);
        continue;
      }

      if (typeof current !== "object") continue;
      if (visited.has(current)) continue;
      visited.add(current);

      const record = current as Record<string, unknown>;
      if (Array.isArray(record.answers)) queue.push(...record.answers);
      for (const key of ["content", "text", "message", "result", "data", "output"]) {
        if (record[key] != null) queue.push(record[key]);
      }
    }

    const parseJson = (text: string): any | null => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    };

    const extractJsonBlocks = (text: string): string[] => {
      const blocks: string[] = [];
      let depth = 0;
      let start = -1;

      for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === "{") {
          if (depth === 0) start = i;
          depth += 1;
        } else if (ch === "}" && depth > 0) {
          depth -= 1;
          if (depth === 0 && start >= 0) {
            blocks.push(text.slice(start, i + 1));
            start = -1;
          }
        }
      }

      return blocks;
    };

    const extractStructured = (value: unknown): any | null => {
      if (value == null) return null;

      if (Array.isArray(value)) {
        // Accept bare creator arrays as a valid shape.
        if (value.length > 0 && typeof value[0] === "object") {
          return { creators: value };
        }
        return null;
      }

      if (typeof value === "object") {
        const rec = value as Record<string, unknown>;
        const hasCreatorsArray =
          Array.isArray(rec.ranked_creators)
          || Array.isArray(rec.creators)
          || Array.isArray(rec.rankedCreators)
          || Array.isArray(rec.results);
        if (hasCreatorsArray) return rec;
        return null;
      }

      if (typeof value !== "string") return null;
      const stripped = value.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      if (!stripped) return null;

      const direct = parseJson(stripped);
      if (direct) return extractStructured(direct) ?? direct;

      for (const block of extractJsonBlocks(stripped)) {
        const parsed = parseJson(block);
        if (!parsed) continue;
        const structured = extractStructured(parsed);
        if (structured) return structured;
      }

      return null;
    };

    const getRawCreatorsArray = (data: Record<string, unknown>): unknown[] => {
      const raw =
        data.ranked_creators
        ?? data.creators
        ?? data.rankedCreators
        ?? data.results
        ?? [];
      return Array.isArray(raw) ? raw : [];
    };

    const scoreStructuredCandidate = (data: Record<string, unknown>): number => {
      const rows = getRawCreatorsArray(data);
      if (rows.length === 0) return 0;

      const schemaBonus =
        Array.isArray(data.ranked_creators) ? 1.0
          : Array.isArray(data.creators) ? 0.85
            : Array.isArray(data.rankedCreators) ? 0.8
              : Array.isArray(data.results) ? 0.75
                : 0.6;

      let structuredRows = 0;
      let withName = 0;
      let withReason = 0;
      let withScore = 0;
      const channelIds = new Set<string>();

      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        structuredRows += 1;
        const rec = row as Record<string, unknown>;
        if (typeof rec.name === "string" && rec.name.trim()) withName += 1;
        if (typeof rec.reason === "string" && rec.reason.trim()) withReason += 1;
        const scoreValue = rec.final_score ?? rec.finalScore ?? rec.score ?? rec.relevance;
        if (Number.isFinite(Number(scoreValue))) withScore += 1;
        const cid = String(rec.channelId ?? rec.channel_id ?? rec.id ?? "").trim();
        if (cid) channelIds.add(cid);
      }

      const completeness =
        (withName / rows.length) * 0.2 +
        (withReason / rows.length) * 0.15 +
        (withScore / rows.length) * 0.15 +
        (structuredRows / rows.length) * 0.1;

      const uniqueness = rows.length > 0 ? Math.min(1, channelIds.size / rows.length) * 0.15 : 0;

      let expectedCoverage = 0.1;
      if (expectedCount > 0) {
        const gap = Math.abs(rows.length - expectedCount);
        expectedCoverage = Math.max(0, 1 - gap / expectedCount) * 0.25;
      }

      return schemaBonus * 0.25 + completeness + uniqueness + expectedCoverage;
    };

    const structuredCandidates: Array<{ data: Record<string, unknown>; score: number }> = [];
    for (const candidate of candidates) {
      const structured = extractStructured(candidate);
      if (!structured || typeof structured !== "object") continue;
      const record = structured as Record<string, unknown>;
      const score = scoreStructuredCandidate(record);
      structuredCandidates.push({ data: record, score });
    }

    structuredCandidates.sort((a, b) => b.score - a.score);
    const best = structuredCandidates[0];
    const data = best?.data ?? null;

    if (!data) {
      const preview = candidates.find((c) => typeof c === "string") as string | undefined;
      console.warn("[parseAgentResponse] No structured creators JSON found", {
        source,
        expectedCount,
        candidateCount: candidates.length,
        structuredCandidateCount: structuredCandidates.length,
        preview: (preview ?? String(response)).slice(0, 500),
      });
      return [];
    }

    const rawCreators = getRawCreatorsArray(data);
    if (!Array.isArray(rawCreators) || rawCreators.length === 0) {
      console.warn("[parseAgentResponse] Structured payload lacked creators array", {
        source,
        expectedCount,
        keys: Object.keys(data ?? {}),
        bestCandidateScore: best?.score ?? 0,
      });
      return [];
    }

    if (expectedCount > 0 && rawCreators.length !== expectedCount) {
      console.warn("[parseAgentResponse] Creator count mismatch in selected payload", {
        source,
        expectedCount,
        parsedCount: rawCreators.length,
        bestCandidateScore: best?.score ?? 0,
      });
    }

    return rawCreators.map((c: any) => {
      const channelId = c.channelId || c.channel_id || c.id || "";
      return {
        name: c.name || "Unknown",
        channelId,
        subscribers: Number(c.subscribers || c.subscriberCount || 0),
        avg_views: Number(c.avg_views || c.avgViews || 0),
        engagement_rate: Number(c.engagement_rate || c.engagementRate || 0),
        score: Number(c.final_score || c.finalScore || c.score || c.relevance || 0.5),
        tags: c.tags || c.topics || c.matchedTopics || (c.label ? [c.label] : interests),
        reason: c.reason || c.why_ranked || c.description || "",
        thumbnailUrl: c.thumbnailUrl || c.thumbnail || "",
        channelUrl: c.channelUrl || (channelId ? `https://youtube.com/channel/${channelId}` : ""),
      };
    });
  } catch (err) {
    console.error("[parseAgentResponse] Failed to parse:", err);
    return [];
  }
}

/**
 * Fallback: Query Neo4j directly + use OpenAI for explanations.
 * Used when RocketRide engine is not running.
 */
async function runDirectNeo4jFallback(
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

  emit(1, "running");
  const neo4jResults = await queryCreatorsByInterests(
    input.interests,
    20,
  );

  emit(1, "complete", { creatorCount: neo4jResults.length });
  emit(2, "running");

  const creators = await rankCreatorsWithLLM(
    neo4jResults,
    input.interests,
  );

  emit(2, "complete", { mode: "direct-neo4j-fallback", creatorCount: creators.length });

  return {
    creators,
    steps: completedSteps,
    totalTime: Date.now() - start,
  };
}
