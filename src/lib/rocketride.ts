/**
 * RocketRide AI pipeline client
 * Orchestrates the multi-agent pipeline for creator discovery
 *
 * Uses the RocketRide TypeScript SDK to connect to the local engine,
 * load .pipe pipelines, execute them, and stream status updates.
 * Docs: https://docs.rocketride.org/sdk/node-sdk
 */

import { RocketRideClient, Question, QuestionType } from "rocketride";
import type { RocketRideClientConfig } from "rocketride";
import type { AgentStep } from "@/types/creator";

// ── Config helpers ──────────────────────────────────────────

export function getRocketRideConfig(): RocketRideClientConfig {
  return {
    uri: process.env.ROCKETRIDE_URI || "http://localhost:5565",
    auth: process.env.ROCKETRIDE_APIKEY || undefined,
  };
}

export function getLLMConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY || "",
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "gpt-4o",
  };
}

// ── Singleton client ────────────────────────────────────────

let client: RocketRideClient | null = null;

export async function getClient(): Promise<RocketRideClient> {
  if (client?.isConnected()) return client;

  client = new RocketRideClient(getRocketRideConfig());
  await client.connect();
  return client;
}

export async function disconnectClient(): Promise<void> {
  if (client) {
    await client.disconnect();
    client = null;
  }
}

// ── Pipeline execution ──────────────────────────────────────

export interface PipelineRunOptions {
  /** Path to the .pipe file */
  pipelinePath: string;
  /** Data to send into the webhook source */
  input: Record<string, unknown>;
  /** Called on each SSE event (for real-time UI updates) */
  onEvent?: (step: AgentStep) => void;
}

/**
 * Execute a RocketRide pipeline and return the result.
 * Connects → loads pipeline → sends data → collects result.
 */
export async function runPipeline(
  opts: PipelineRunOptions,
): Promise<Record<string, unknown> | undefined> {
  const c = await getClient();

  // Load the pipeline and get a task token
  const { token } = await c.use({
    filepath: opts.pipelinePath,
  });

  // Subscribe to status events for real-time tracking
  if (opts.onEvent) {
    await c.setEvents(token, [
      "apaevt_status_processing",
      "apaevt_status_upload",
    ]);
  }

  // Send the input data as JSON and collect result via SSE
  const result = await c.send(
    token,
    JSON.stringify(opts.input),
    { filename: "input.json" },
    "application/json",
    opts.onEvent
      ? async (type: string, data: Record<string, unknown>) => {
          opts.onEvent!({
            id: String(data.pipeId ?? type),
            name: String(data.name ?? type),
            status: type === "complete" ? "complete" : "running",
            emoji: "🔄",
            description: String(data.status ?? ""),
          });
        }
      : undefined,
  );

  return result as Record<string, unknown> | undefined;
}

// ── Chat helper (for LLM nodes) ────────────────────────────

/**
 * Send a question to a running RocketRide chat pipeline.
 */
export async function chatWithPipeline(
  token: string,
  questionText: string,
  onSSE?: (type: string, data: Record<string, unknown>) => Promise<void>,
) {
  const c = await getClient();
  const q = new Question({ type: QuestionType.QUESTION });
  q.addQuestion(questionText);
  return c.chat({ token, question: q, onSSE });
}
