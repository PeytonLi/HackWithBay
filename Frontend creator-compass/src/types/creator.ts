export interface Creator {
  name: string;
  channelId: string;
  thumbnailUrl: string;
  subscribers: number;
  avgViews: number;
  engagementRate: number;
  score: number;
  tags: string[];
  reason: string;
  videoCount: number;
  consistency: string;
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
