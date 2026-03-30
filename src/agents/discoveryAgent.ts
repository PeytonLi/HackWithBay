/**
 * Discovery Agent (Act)
 * Filters creators from the preloaded dataset using keyword matching.
 * NO YouTube search.list calls — zero quota cost.
 */

import type {
  DiscoveryAgentInput,
  DiscoveryAgentOutput,
} from "@/types/creator";
import { filterCreatorsByInterests } from "@/data/creators";

export async function runDiscoveryAgent(
  input: DiscoveryAgentInput,
): Promise<DiscoveryAgentOutput> {
  // Extract keywords from the LLM-generated queries
  // Each query is something like "fitness coach San Francisco"
  // We extract meaningful keywords and combine with the raw queries
  const keywords = new Set<string>();
  for (const query of input.queries) {
    for (const word of query.toLowerCase().split(/\s+/)) {
      if (word.length > 2) keywords.add(word);
    }
    // Also add multi-word phrases that might match topics
    keywords.add(query.toLowerCase().trim());
  }

  // Filter the preloaded dataset
  const matched = filterCreatorsByInterests([...keywords]);

  // Deduplicate channel IDs
  const uniqueChannelIds = [...new Set(matched.map((c) => c.channelId))];

  return {
    videos: [], // No raw video data — we skip search.list entirely
    uniqueChannelIds,
  };
}
