/**
 * Analysis Agent (Analyze)
 * Computes all signals: engagement, comment quality, consistency,
 * content depth, authenticity, niche alignment, and growth.
 */

import type {
  AnalysisAgentInput,
  AnalysisAgentOutput,
  AnalyzedCreator,
  EnrichedCreator,
  EngagementSignals,
  ConsistencySignals,
  ContentDepthSignals,
  AuthenticitySignals,
  GrowthSignals,
  GraphSignals,
} from "@/types/creator";
import { getVideoComments } from "@/lib/youtube";
import { scoreCommentQuality, scoreNicheAlignment } from "@/lib/openai";

const SPONSOR_KEYWORDS = [
  "sponsor", "sponsored", "ad", "promo", "discount code",
  "affiliate", "use code", "check out", "partner",
];

// ── ISO 8601 duration → seconds ─────────────────────────────

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || "0") * 3600) +
         (parseInt(m[2] || "0") * 60) +
         parseInt(m[3] || "0");
}

// ── Signal computations ─────────────────────────────────────

function computeEngagement(c: EnrichedCreator): EngagementSignals {
  const vids = c.recentVideos;
  if (vids.length === 0) {
    return { avgViews: 0, avgLikes: 0, avgComments: 0, engagementRate: 0, viewToSubRatio: 0 };
  }
  const avgViews = vids.reduce((s, v) => s + v.viewCount, 0) / vids.length;
  const avgLikes = vids.reduce((s, v) => s + v.likeCount, 0) / vids.length;
  const avgComments = vids.reduce((s, v) => s + v.commentCount, 0) / vids.length;
  const engagementRate = avgViews > 0 ? (avgLikes + avgComments) / avgViews : 0;
  const viewToSubRatio = c.subscriberCount > 0 ? avgViews / c.subscriberCount : 0;
  return { avgViews, avgLikes, avgComments, engagementRate, viewToSubRatio };
}

function computeConsistency(c: EnrichedCreator): ConsistencySignals {
  const dates = c.recentVideos
    .map((v) => new Date(v.publishedAt).getTime())
    .sort((a, b) => b - a);
  if (dates.length < 2) {
    return { score: 0.5, avgDaysBetweenUploads: 0, uploadVariance: 0, totalRecentUploads: dates.length };
  }
  const gaps: number[] = [];
  for (let i = 0; i < dates.length - 1; i++) {
    gaps.push((dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24));
  }
  const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const variance = gaps.reduce((s, g) => s + (g - avg) ** 2, 0) / gaps.length;
  // Lower avg gap + lower variance = higher score
  const score = Math.max(0, Math.min(1, 1 - (avg / 60) - (Math.sqrt(variance) / 30)));
  return { score, avgDaysBetweenUploads: avg, uploadVariance: variance, totalRecentUploads: dates.length };
}

function computeContentDepth(c: EnrichedCreator): ContentDepthSignals {
  const durations = c.recentVideos.map((v) => parseDuration(v.duration));
  if (durations.length === 0) return { score: 0.5, avgDurationSeconds: 0, longFormRatio: 0 };
  const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
  const longForm = durations.filter((d) => d > 600).length / durations.length;
  const score = Math.min(1, (avg / 1200) * 0.6 + longForm * 0.4);
  return { score, avgDurationSeconds: avg, longFormRatio: longForm };
}

function computeAuthenticity(c: EnrichedCreator, engagement: EngagementSignals): AuthenticitySignals {
  // Sponsor ratio from video titles/descriptions
  const titles = c.recentVideos.map((v) => v.videoId); // we only have stats, use description if available
  // Use channel description as proxy
  const text = c.description.toLowerCase();
  const sponsorHits = SPONSOR_KEYWORDS.filter((kw) => text.includes(kw)).length;
  const sponsorRatio = Math.min(1, sponsorHits / 3);
  // Follower quality: penalise if avg views << subscriber count
  const ratio = engagement.viewToSubRatio;
  const followerQuality = Math.min(1, ratio * 5); // 0.2 ratio = perfect
  const score = Math.max(0, (1 - sponsorRatio) * 0.4 + followerQuality * 0.6);
  return { score, sponsorRatio, followerQuality };
}

function computeGrowth(c: EnrichedCreator): GrowthSignals {
  const vids = c.recentVideos.slice().sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );
  if (vids.length < 3) return { score: 0.5, trajectory: "new" };
  const half = Math.floor(vids.length / 2);
  const earlyAvg = vids.slice(0, half).reduce((s, v) => s + v.viewCount, 0) / half;
  const lateAvg = vids.slice(half).reduce((s, v) => s + v.viewCount, 0) / (vids.length - half);
  const ratio = earlyAvg > 0 ? lateAvg / earlyAvg : 1;
  let trajectory: GrowthSignals["trajectory"] = "steady";
  if (ratio > 2) trajectory = "spiking";
  else if (ratio < 0.5) trajectory = "declining";
  const score = Math.min(1, Math.max(0, ratio / 2));
  return { score, trajectory };
}

const DEFAULT_GRAPH: GraphSignals = {
  clusterAuthenticity: 0.5, influenceDepth: 0, echoChamberPenalty: 0, similarCreatorCount: 0,
};


// ── Main agent ──────────────────────────────────────────────

export async function runAnalysisAgent(
  input: AnalysisAgentInput,
): Promise<AnalysisAgentOutput> {
  const analyzed: AnalyzedCreator[] = [];

  for (const creator of input.creators) {
    const engagement = computeEngagement(creator);
    const consistency = computeConsistency(creator);
    const contentDepth = computeContentDepth(creator);
    const authenticity = computeAuthenticity(creator, engagement);
    const growth = computeGrowth(creator);

    // LLM-based signals (run in parallel)
    const topVideoId = creator.recentVideos[0]?.videoId;
    const [commentsRaw, nicheResult] = await Promise.all([
      topVideoId ? getVideoComments(topVideoId, 15) : Promise.resolve([]),
      scoreNicheAlignment(
        creator.description,
        creator.recentVideos.map((v) => v.publishedAt),
        input.interests,
      ),
    ]);

    const commentQualityResult = await scoreCommentQuality(commentsRaw);

    analyzed.push({
      ...creator,
      engagement,
      commentQuality: {
        score: commentQualityResult.score,
        meaningfulRatio: commentQualityResult.meaningfulRatio,
        sampleSize: commentsRaw.length,
      },
      consistency,
      contentDepth,
      authenticity,
      nicheAlignment: {
        score: nicheResult.score,
        matchedTopics: nicheResult.matchedTopics,
      },
      growth,
      graph: DEFAULT_GRAPH, // Populated later by Graph Agent
    });
  }

  return { creators: analyzed };
}