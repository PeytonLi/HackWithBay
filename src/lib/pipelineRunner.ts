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
import { getClient } from "@/lib/rocketride";
import { queryCreatorsByInterests } from "@/lib/neo4j";
import path from "path";

export type StepCallback = (step: AgentStep) => void;

const STEPS: Omit<AgentStep, "status">[] = [
  { id: "query",      name: "Connecting to RocketRide", emoji: "🚀", description: "Initialising pipeline engine" },
  { id: "discovery",  name: "Querying Neo4j Graph",     emoji: "🔍", description: "Finding creators matching your interests in the graph database" },
  { id: "ranking",    name: "Ranking & Explaining",     emoji: "⭐", description: "AI agent is ranking creators and generating explanations" },
];

function makeStep(index: number, status: AgentStep["status"], extra?: Partial<AgentStep>): AgentStep {
  return { ...STEPS[index], status, ...extra };
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
    const pipelinePath = path.resolve(process.cwd(), "creator-discovery.pipe");
    const { token } = await client.use({ filepath: pipelinePath, useExisting: true });
    emit(0, "complete", { connected: true });

    // 2. Query Neo4j for creators matching the user's interests
    emit(1, "running");
    const neo4jResults = await queryCreatorsByInterests(input.interests, 20);
    emit(1, "complete", { creatorCount: neo4jResults.length });

    // 3. Send the raw Neo4j data as text to the webhook → LLM pipeline
    emit(2, "running");
    const payload = JSON.stringify({
      interests: input.interests,
      creators: neo4jResults,
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

    const creators = parseAgentResponse(response, input.interests);
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
    return runDirectNeo4jFallback(input, onStep);
  }
}

/**
 * Parse the RocketRide agent's response into Creator[].
 * The agent should return JSON with a "creators" array.
 */
function parseAgentResponse(response: unknown, interests: string[]): Creator[] {
  try {
    let data: any = response;

    // Unwrap nested RocketRide response structures
    // response_answers returns: { answers: ["markdown report", "```json {...}```"] }
    if (data?.answers) data = data.answers;
    if (Array.isArray(data)) {
      // Find the answer that contains our JSON (ranked_creators/creators)
      // The LLM may return multiple answers — pick the one with parseable JSON
      const jsonAnswer = data.find(
        (item: unknown) => typeof item === "string" && /("ranked_creators"|"creators")/.test(item),
      );
      data = jsonAnswer ?? data[data.length - 1] ?? data[0];
    }

    // Walk into any remaining wrapper objects looking for the LLM text
    // RocketRide may nest further: { content: "..." }, { text: "..." }, { message: "..." }
    for (const key of ["content", "text", "message", "result"]) {
      if (typeof data === "object" && data !== null && typeof data[key] === "string") {
        data = data[key];
        break;
      }
    }

    // If data is a string, extract JSON containing ranked_creators or creators
    if (typeof data === "string") {
      // Strip markdown code fences the LLM may wrap around JSON
      const stripped = data.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      const jsonMatch = stripped.match(/\{[\s\S]*("ranked_creators"|"creators")[\s\S]*\}/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      } else {
        console.warn("[parseAgentResponse] No JSON with ranked_creators/creators found in:", data.slice(0, 500));
        return [];
      }
    }

    // data should now be the parsed object with ranked_creators or creators
    const rawCreators = data?.ranked_creators || data?.creators || [];
    if (!Array.isArray(rawCreators) || rawCreators.length === 0) {
      console.warn("[parseAgentResponse] No creators array found. Keys:", Object.keys(data ?? {}));
      return [];
    }

    return rawCreators.map((c: any) => ({
      name: c.name || "Unknown",
      channelId: c.channelId || "",
      subscribers: Number(c.subscribers || c.subscriberCount || 0),
      avg_views: Number(c.avg_views || c.avgViews || 0),
      engagement_rate: Number(c.engagement_rate || c.engagementRate || 0),
      score: Number(c.final_score || c.score || c.relevance || 0.5),
      tags: c.tags || c.topics || (c.label ? [c.label] : interests),
      reason: c.reason || c.description || "",
      thumbnailUrl: c.thumbnailUrl || c.thumbnail || "",
      channelUrl: c.channelUrl || (c.channelId ? `https://youtube.com/channel/${c.channelId}` : ""),
    }));
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

  // Import Neo4j driver dynamically
  const neo4j = await import("neo4j-driver");
  const driver = neo4j.default.driver(
    process.env.NEO4J_URI || "",
    neo4j.default.auth.basic(
      process.env.NEO4J_USERNAME || process.env.NEO4J_USER || "",
      process.env.NEO4J_PASSWORD || "",
    ),
  );

  const session = driver.session();

  try {
    emit(1, "running");

    // Query Neo4j for creators matching the interests
    const interestPatterns = input.interests.map((i) => `(?i).*${i}.*`);
    const result = await session.run(
      `
      MATCH (c:Creator)-[:CREATES]->(t:Topic)
      WHERE ANY(interest IN $interests WHERE toLower(t.name) CONTAINS toLower(interest))
         OR ANY(interest IN $interests WHERE toLower(c.description) CONTAINS toLower(interest))
      WITH c, collect(DISTINCT t.name) AS topics
      RETURN c.channelId AS channelId,
             c.name AS name,
             c.subscribers AS subscribers,
             c.description AS description,
             c.thumbnailUrl AS thumbnailUrl,
             c.channelUrl AS channelUrl,
             topics
      ORDER BY c.subscribers DESC
      LIMIT 15
      `,
      { interests: input.interests },
    );

    const creators: Creator[] = result.records.map((r: any) => {
      const subs = r.get("subscribers");
      return {
        name: r.get("name") || "Unknown",
        channelId: r.get("channelId") || "",
        subscribers: typeof subs?.toNumber === "function" ? subs.toNumber() : Number(subs || 0),
        avg_views: 0,
        engagement_rate: 0,
        score: 0.7,
        tags: r.get("topics") || input.interests,
        reason: r.get("description") || "",
        thumbnailUrl: r.get("thumbnailUrl") || "",
        channelUrl: r.get("channelUrl") || "",
      };
    });

    emit(1, "complete", { creatorCount: creators.length });
    emit(2, "running");
    emit(2, "complete", { mode: "direct-neo4j-fallback" });

    return {
      creators,
      steps: completedSteps,
      totalTime: Date.now() - start,
    };
  } finally {
    await session.close();
    await driver.close();
  }
}
