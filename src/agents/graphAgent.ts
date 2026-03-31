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
  upsertComments,
  linkCreatorToTopics,
  linkUserInterests,
  computeSimilarCreators,
  computeGraphSignals,
} from "@/lib/neo4j";
import { extractTopics } from "@/lib/openai";
import { getChannelRecentVideoIds, getVideoComments } from "@/lib/youtube";

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

  // 2. Scrape top 20 comments from each creator's most recent video
  await Promise.all(
    input.creators.map(async (creator) => {
      try {
        // Get the most recent video ID for this creator
        const recentVideoIds = await getChannelRecentVideoIds(creator.channelId, 1);
        const videoId = recentVideoIds[0];
        if (!videoId) return;

        // Fetch top 20 comments
        const comments = await getVideoComments(videoId, 20);
        if (comments.length === 0) return;

        // Store in Neo4j
        await upsertComments(creator.channelId, videoId, comments);
        console.log(`[GraphAgent] Stored ${comments.length} comments for ${creator.name}`);
      } catch (err) {
        console.warn(`[GraphAgent] Failed to scrape comments for ${creator.name}:`, err);
      }
    }),
  );

  // 3. Link user interests as Topic nodes
  const userId = `session-${Date.now()}`;
  await linkUserInterests(userId, input.interests);

  // 4. Compute SIMILAR_TO edges between all creators in this batch
  await computeSimilarCreators(channelIds);

  // 5. Compute graph signals for each creator
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
