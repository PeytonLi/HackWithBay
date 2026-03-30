/**
 * Enrichment Agent (Act)
 * Calls channels.list and videos.list to collect full stats for each creator
 */

import type {
  EnrichmentAgentInput,
  EnrichmentAgentOutput,
  EnrichedCreator,
} from "@/types/creator";
import { getChannels, getChannelRecentVideoIds, getVideos } from "@/lib/youtube";

export async function runEnrichmentAgent(
  input: EnrichmentAgentInput,
): Promise<EnrichmentAgentOutput> {
  const videosPerChannel = input.videosPerChannel ?? 8;

  // 1. Fetch channel details in batch
  const channels = await getChannels(input.channelIds);

  // 2. For each channel, get recent video IDs then full video stats
  const creators: EnrichedCreator[] = [];

  for (const ch of channels) {
    try {
      const videoIds = await getChannelRecentVideoIds(
        ch.channelId,
        videosPerChannel,
      );
      const recentVideos = videoIds.length > 0 ? await getVideos(videoIds) : [];

      creators.push({
        channelId: ch.channelId,
        name: ch.name,
        description: ch.description,
        subscriberCount: ch.subscriberCount,
        totalVideoCount: ch.videoCount,
        totalViewCount: ch.viewCount,
        thumbnailUrl: ch.thumbnailUrl,
        channelUrl: ch.customUrl
          ? `https://youtube.com/${ch.customUrl}`
          : `https://youtube.com/channel/${ch.channelId}`,
        country: ch.country,
        recentVideos,
      });
    } catch (err) {
      console.warn(`Enrichment skipped for ${ch.channelId}:`, err);
    }
  }

  return { creators };
}
