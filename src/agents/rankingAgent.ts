/**
 * Ranking Agent (Decide)
 * Combines all signals into a final weighted score and sorts creators.
 *
 * Score formula:
 *   0.30 * engagement_rate
 * + 0.15 * comment_quality
 * + 0.10 * consistency
 * + 0.10 * content_depth
 * + 0.10 * niche_alignment
 * + 0.10 * graph_cluster_score
 * + 0.10 * authenticity_score
 * + 0.05 * growth_score
 */

import type {
  RankingAgentInput,
  RankingAgentOutput,
  AnalyzedCreator,
  RankingWeights,
} from "@/types/creator";

/** Normalise engagement rate to 0–1 (cap at 15% which is exceptional) */
function normaliseEngagement(rate: number): number {
  return Math.min(1, rate / 0.15);
}

function computeScore(
  c: AnalyzedCreator,
  w: RankingWeights,
  preferAuthentic: boolean,
): number {
  const base =
    w.engagement * normaliseEngagement(c.engagement.engagementRate) +
    w.commentQuality * c.commentQuality.score +
    w.consistency * c.consistency.score +
    w.contentDepth * c.contentDepth.score +
    w.nicheAlignment * c.nicheAlignment.score +
    w.graphCluster * c.graph.clusterAuthenticity +
    w.authenticity * c.authenticity.score +
    w.growth * c.growth.score;

  // Subtract echo chamber penalty
  const penalty = c.graph.echoChamberPenalty * 0.05;

  // Boost authenticity if user prefers it
  const authenticBoost = preferAuthentic
    ? c.authenticity.score * 0.05
    : 0;

  return Math.max(0, Math.min(1, base - penalty + authenticBoost));
}

export async function runRankingAgent(
  input: RankingAgentInput,
): Promise<RankingAgentOutput> {
  const weights: RankingWeights = input.weights ?? {
    engagement: 0.30,
    commentQuality: 0.15,
    consistency: 0.10,
    contentDepth: 0.10,
    nicheAlignment: 0.10,
    graphCluster: 0.10,
    authenticity: 0.10,
    growth: 0.05,
  };

  const scored = input.creators.map((c) => ({
    ...c,
    finalScore: computeScore(c, weights, input.preferAuthentic),
  }));

  // Sort descending by score
  scored.sort((a, b) => b.finalScore - a.finalScore);

  return { ranked: scored };
}
