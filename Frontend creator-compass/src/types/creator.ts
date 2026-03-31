export interface Creator {
  name: string;
  channelId: string;
  thumbnailUrl?: string;
  channelUrl?: string;
  subscribers: number;
  avgViews: number;
  engagementRate: number;
  score: number;
  tags: string[];
  reason: string;
  videoCount?: number;
  consistency?: string;
}

/** Shape returned by the backend API */
export interface BackendCreator {
  name: string;
  channelId: string;
  thumbnailUrl?: string;
  channelUrl?: string;
  subscribers: number;
  avg_views: number;
  engagement_rate: number;
  score: number;
  tags: string[];
  reason: string;
}

/** Shape of backend agent step SSE events */
export interface BackendStep {
  id: string;
  name: string;
  emoji: string;
  status: "pending" | "running" | "complete" | "error";
  description: string;
  startedAt?: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
}

export interface SearchParams {
  interests: string[];
  location: string;
  preferDeep: boolean;
  preferAuthentic: boolean;
}

export interface AgentStep {
  id: string;
  label: string;
  icon: string;
  status: "pending" | "active" | "done";
}
