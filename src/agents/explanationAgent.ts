/**
 * Explanation Agent (Explain)
 * Generates human-readable reasons and tags for each recommended creator.
 */

import type {
  ExplanationAgentInput,
  ExplanationAgentOutput,
  Creator,
  AnalyzedCreator,
} from "@/types/creator";
import { generateCreatorExplanation } from "@/lib/openai";

/** Derive tags from computed signals */
function deriveTags(c: AnalyzedCreator & { finalScore: number }): string[] {
  const tags: string[] = [];

  if (c.engagement.engagementRate > 0.05) tags.push("High engagement");
  else if (c.engagement.engagementRate > 0.03) tags.push("Good engagement");

  if (c.consistency.score > 0.7) tags.push("Consistent");
  if (c.commentQuality.score > 0.7) tags.push("Quality discussions");
  if (c.authenticity.score > 0.7) tags.push("Authentic");
  if (c.contentDepth.score > 0.7) tags.push("In-depth content");
  if (c.graph.clusterAuthenticity > 0.7) tags.push("Trusted network");

  // Hidden gem: low subs but high engagement
  if (
    c.subscriberCount < 50000 &&
    c.engagement.engagementRate > 0.04
  ) {
    tags.push("Hidden gem 💎");
  }

  if (c.growth.trajectory === "spiking") tags.push("Trending 📈");
  if (c.nicheAlignment.score > 0.8) tags.push("Strong niche fit");

  return tags.length > 0 ? tags : ["Recommended"];
}

export async function runExplanationAgent(
  input: ExplanationAgentInput,
): Promise<ExplanationAgentOutput> {
  const creators: Creator[] = [];

  // Process in parallel (batch of 5 to manage rate limits)
  const batchSize = 5;
  for (let i = 0; i < input.ranked.length; i += batchSize) {
    const batch = input.ranked.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (c) => {
        const tags = deriveTags(c);
        const reason = await generateCreatorExplanation(
          c.name,
          {
            subscribers: c.subscriberCount,
            avgViews: c.engagement.avgViews,
            engagementRate: c.engagement.engagementRate,
          },
          tags,
          input.interests,
        );

        const creator: Creator = {
          name: c.name,
          channelId: c.channelId,
          subscribers: c.subscriberCount,
          avg_views: Math.round(c.engagement.avgViews),
          engagement_rate: Math.round(c.engagement.engagementRate * 10000) / 10000,
          score: Math.round(c.finalScore * 100) / 100,
          tags,
          reason,
          thumbnailUrl: c.thumbnailUrl,
          channelUrl: c.channelUrl,
        };
        return creator;
      }),
    );

    creators.push(...results);
  }

  return { creators };
}
