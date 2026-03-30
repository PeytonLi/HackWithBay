/**
 * Graph Agent (Analyze via Neo4j)
 * Stores creators + topics in Neo4j, computes graph-based signals:
 *   - Cluster authenticity
 *   - Influence depth
 *   - Echo chamber detection
 *   - Similar creators
 */

import type { GraphAgentInput, GraphAgentOutput } from "@/types/creator";
import {
  ensureIndexes,
  upsertCreator,
  linkCreatorToTopics,
  linkUserInterests,
  computeSimilarCreators,
  computeGraphSignals,
} from "@/lib/neo4j";
import { extractTopics } from "@/lib/openai";

export async function runGraphAgent(
  input: GraphAgentInput,
): Promise<GraphAgentOutput> {
  await ensureIndexes();

  const channelIds: string[] = [];

  // 1. Upsert each creator and link to topics
  for (const creator of input.creators) {
    await upsertCreator(creator);
    channelIds.push(creator.channelId);

    // Extract topics from creator content via LLM
    const titles = creator.recentVideos.map((v) => v.publishedAt); // stats only, using desc
    const topics = await extractTopics(creator.description, titles);

    if (topics.length > 0) {
      await linkCreatorToTopics(creator.channelId, topics);
    }
  }

  // 2. Link user interests as Topic nodes
  const userId = `session-${Date.now()}`;
  await linkUserInterests(userId, input.interests);

  // 3. Compute SIMILAR_TO edges between all creators in this batch
  await computeSimilarCreators(channelIds);

  // 4. Compute graph signals for each creator
  const updatedCreators = await Promise.all(
    input.creators.map(async (creator) => {
      const graphSignals = await computeGraphSignals(creator.channelId);
      return {
        ...creator,
        graph: graphSignals,
      };
    }),
  );

  return { creators: updatedCreators };
}
