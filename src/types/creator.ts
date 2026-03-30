// ── User Input ──────────────────────────────────────────────

export interface SearchInput {
  interests: string[];
  location: string;
  preferAuthentic: boolean;
  preferDeepContent: boolean;
}

// ── YouTube Raw Data ────────────────────────────────────────

export interface YouTubeVideoRaw {
  videoId: string;
  channelId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
}

export interface YouTubeChannelRaw {
  channelId: string;
  name: string;
  description: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  thumbnailUrl: string;
  customUrl?: string;
  country?: string;
  publishedAt: string;
}

export interface YouTubeVideoStats {
  videoId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: string; // ISO 8601
  publishedAt: string;
}

// ── Enriched Creator (post-enrichment) ──────────────────────

export interface EnrichedCreator {
  channelId: string;
  name: string;
  description: string;
  subscriberCount: number;
  totalVideoCount: number;
  totalViewCount: number;
  thumbnailUrl: string;
  channelUrl: string;
  country?: string;
  recentVideos: YouTubeVideoStats[];
}

// ── Signal Types ────────────────────────────────────────────

export interface EngagementSignals {
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  engagementRate: number; // (avgLikes + avgComments) / avgViews
  viewToSubRatio: number; // avgViews / subscriberCount
}

export interface CommentQualitySignals {
  score: number;        // 0–1
  meaningfulRatio: number;
  sampleSize: number;
}

export interface ConsistencySignals {
  score: number;         // 0–1
  avgDaysBetweenUploads: number;
  uploadVariance: number;
  totalRecentUploads: number;
}

export interface ContentDepthSignals {
  score: number;         // 0–1
  avgDurationSeconds: number;
  longFormRatio: number; // % of videos > 10 min
}

export interface AuthenticitySignals {
  score: number;         // 0–1
  sponsorRatio: number;  // % of videos with sponsor keywords
  followerQuality: number; // penalise sub/view mismatch
}

export interface NicheAlignmentSignals {
  score: number;  // 0–1 — how well creator matches user interests
  matchedTopics: string[];
}

export interface GrowthSignals {
  score: number;      // 0–1
  trajectory: "steady" | "spiking" | "declining" | "new";
}

export interface GraphSignals {
  clusterAuthenticity: number;  // 0–1
  influenceDepth: number;       // 0–1
  echoChamberPenalty: number;   // 0–1 (subtracted)
  similarCreatorCount: number;
}

// ── Analyzed Creator (all signals computed) ─────────────────

export interface AnalyzedCreator extends EnrichedCreator {
  engagement: EngagementSignals;
  commentQuality: CommentQualitySignals;
  consistency: ConsistencySignals;
  contentDepth: ContentDepthSignals;
  authenticity: AuthenticitySignals;
  nicheAlignment: NicheAlignmentSignals;
  growth: GrowthSignals;
  graph: GraphSignals;
}

// ── Ranking ─────────────────────────────────────────────────

export interface RankingWeights {
  engagement: number;      // 0.30
  commentQuality: number;  // 0.15
  consistency: number;     // 0.10
  contentDepth: number;    // 0.10
  nicheAlignment: number;  // 0.10
  graphCluster: number;    // 0.10
  authenticity: number;    // 0.10
  growth: number;          // 0.05
}

export const DEFAULT_WEIGHTS: RankingWeights = {
  engagement: 0.30,
  commentQuality: 0.15,
  consistency: 0.10,
  contentDepth: 0.10,
  nicheAlignment: 0.10,
  graphCluster: 0.10,
  authenticity: 0.10,
  growth: 0.05,
};

// ── Final Output ────────────────────────────────────────────

export interface Creator {
  name: string;
  channelId: string;
  subscribers: number;
  avg_views: number;
  engagement_rate: number;
  score: number;
  tags: string[];
  reason: string;
  thumbnailUrl?: string;
  channelUrl?: string;
}

// ── Pipeline / Agent Orchestration ──────────────────────────

export interface AgentStep {
  id: string;
  name: string;
  status: "pending" | "running" | "complete" | "error";
  emoji: string;
  description: string;
  startedAt?: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
}

export interface PipelineResult {
  creators: Creator[];
  steps: AgentStep[];
  totalTime: number;
}

// ── Agent I/O Interfaces ────────────────────────────────────

export interface QueryAgentInput {
  interests: string[];
  location: string;
  preferAuthentic: boolean;
  preferDeepContent: boolean;
}
export interface QueryAgentOutput {
  queries: string[];
}

export interface DiscoveryAgentInput {
  queries: string[];
}
export interface DiscoveryAgentOutput {
  videos: YouTubeVideoRaw[];
  uniqueChannelIds: string[];
}

export interface EnrichmentAgentInput {
  channelIds: string[];
  videosPerChannel?: number;
}
export interface EnrichmentAgentOutput {
  creators: EnrichedCreator[];
}

export interface AnalysisAgentInput {
  creators: EnrichedCreator[];
  interests: string[];
}
export interface AnalysisAgentOutput {
  creators: AnalyzedCreator[];
}

export interface GraphAgentInput {
  creators: AnalyzedCreator[];
  interests: string[];
}
export interface GraphAgentOutput {
  creators: AnalyzedCreator[]; // graph signals now populated
}

export interface RankingAgentInput {
  creators: AnalyzedCreator[];
  weights?: RankingWeights;
  preferAuthentic: boolean;
}
export interface RankingAgentOutput {
  ranked: Array<AnalyzedCreator & { finalScore: number }>;
}

export interface ExplanationAgentInput {
  ranked: Array<AnalyzedCreator & { finalScore: number }>;
  interests: string[];
}
export interface ExplanationAgentOutput {
  creators: Creator[];
}
