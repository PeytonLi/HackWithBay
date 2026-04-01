/**
 * OpenAI-compatible LLM client (via GMI Cloud)
 * Provides structured helpers for:
 *   - Query generation (Query Agent)
 *   - Comment quality scoring (Analysis Agent)
 *   - Creator explanation generation (Explanation Agent)
 *   - Niche alignment scoring (Analysis Agent)
 */

import OpenAI from "openai";
import { getLLMConfig } from "./rocketride";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (openaiClient) return openaiClient;
  const cfg = getLLMConfig();
  openaiClient = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
  });
  return openaiClient;
}

function model(): string {
  return getLLMConfig().model;
}

// ── Query generation ────────────────────────────────────────

export async function generateSearchQueries(
  interests: string[],
  preferDeep: boolean,
): Promise<string[]> {
  const ai = getOpenAI();
  const res = await ai.chat.completions.create({
    model: model(),
    temperature: 0.7,
    max_completion_tokens: 400,
    messages: [
      {
        role: "system",
        content:
          "You generate optimised YouTube search queries to find authentic creators. Return a JSON array of 5-8 query strings. No explanation, only the JSON array.",
      },
      {
        role: "user",
        content: `Interests: ${interests.join(", ")}
Prefer ${preferDeep ? "long-form, in-depth" : "short, popular"} content.

Generate YouTube search queries that would surface authentic, high-quality creators in these niches.`,
      },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "[]";
  try {
    const parsed = JSON.parse(text.replace(/```json?\n?/g, "").replace(/```/g, ""));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Fallback: split by newlines
    return text.split("\n").filter((l) => l.trim().length > 3);
  }
}

// ── Comment quality scoring ─────────────────────────────────

export async function scoreCommentQuality(
  comments: string[],
): Promise<{ score: number; meaningfulRatio: number }> {
  if (comments.length === 0) return { score: 0.5, meaningfulRatio: 0.5 };

  const ai = getOpenAI();
  const sample = comments.slice(0, 15).join("\n---\n");
  const res = await ai.chat.completions.create({
    model: model(),
    temperature: 0,
    max_completion_tokens: 150,
    messages: [
      {
        role: "system",
        content:
          'Analyse YouTube comments for quality. Return JSON: {"score": 0.0-1.0, "meaningfulRatio": 0.0-1.0}. Score 1.0 = thoughtful discussion, 0.0 = pure spam/bots. Only JSON, no explanation.',
      },
      { role: "user", content: sample },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(text.replace(/```json?\n?/g, "").replace(/```/g, ""));
    return {
      score: Number(parsed.score ?? 0.5),
      meaningfulRatio: Number(parsed.meaningfulRatio ?? 0.5),
    };
  } catch {
    return { score: 0.5, meaningfulRatio: 0.5 };
  }
}

// ── Niche alignment scoring ─────────────────────────────────

export async function scoreNicheAlignment(
  creatorDescription: string,
  recentTitles: string[],
  interests: string[],
): Promise<{ score: number; matchedTopics: string[] }> {
  const ai = getOpenAI();
  const res = await ai.chat.completions.create({
    model: model(),
    temperature: 0,
    max_completion_tokens: 200,
    messages: [
      {
        role: "system",
        content:
          'Rate how well this creator aligns with the user\'s interests. Return JSON: {"score": 0.0-1.0, "matchedTopics": ["topic1"]}. Only JSON.',
      },
      {
        role: "user",
        content: `User interests: ${interests.join(", ")}
Creator description: ${creatorDescription}
Recent video titles: ${recentTitles.slice(0, 8).join("; ")}`,
      },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(text.replace(/```json?\n?/g, "").replace(/```/g, ""));
    return {
      score: Number(parsed.score ?? 0.5),
      matchedTopics: Array.isArray(parsed.matchedTopics) ? parsed.matchedTopics : [],
    };
  } catch {
    return { score: 0.5, matchedTopics: [] };
  }
}


// ── Explanation generation ──────────────────────────────────

export async function generateCreatorExplanation(
  creatorName: string,
  stats: { subscribers: number; avgViews: number; engagementRate: number },
  tags: string[],
  interests: string[],
): Promise<string> {
  const ai = getOpenAI();
  const res = await ai.chat.completions.create({
    model: model(),
    temperature: 0.6,
    max_completion_tokens: 150,
    messages: [
      {
        role: "system",
        content:
          "Write a 1-2 sentence explanation of why this YouTube creator is recommended. Be concise, specific, and reference concrete signals. No markdown.",
      },
      {
        role: "user",
        content: `Creator: ${creatorName}
Subscribers: ${stats.subscribers.toLocaleString()}
Avg views: ${stats.avgViews.toLocaleString()}
Engagement rate: ${(stats.engagementRate * 100).toFixed(1)}%
Tags: ${tags.join(", ")}
User interests: ${interests.join(", ")}`,
      },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "Recommended based on strong engagement and niche relevance.";
}

// ── Topic extraction ────────────────────────────────────────

export async function extractTopics(
  channelDescription: string,
  videoTitles: string[],
): Promise<string[]> {
  const ai = getOpenAI();
  const res = await ai.chat.completions.create({
    model: model(),
    temperature: 0,
    max_completion_tokens: 150,
    messages: [
      {
        role: "system",
        content:
          'Extract 3-6 content topics/niches from this creator\'s data. Return a JSON array of lowercase topic strings. Only JSON.',
      },
      {
        role: "user",
        content: `Description: ${channelDescription}
Titles: ${videoTitles.slice(0, 10).join("; ")}`,
      },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "[]";
  try {
    const parsed = JSON.parse(text.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}