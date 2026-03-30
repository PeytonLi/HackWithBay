/**
 * YouTube Data API v3 client
 * - Caches all responses (24h TTL) to minimise API calls
 * - Batches IDs (up to 50 per request)
 * - Uses playlistItems.list instead of search.list for recent uploads (1 vs 100 quota)
 * - Falls back to cached data on quota errors
 * - Supports API key rotation via YOUTUBE_API_KEYS (comma-separated)
 */

import type {
  YouTubeChannelRaw,
  YouTubeVideoStats,
} from "@/types/creator";
import { cacheGet, cacheSet } from "./cache";

const BASE = "https://www.googleapis.com/youtube/v3";
const MAX_IDS_PER_BATCH = 50;

// ── API Key rotation ────────────────────────────────────────

function getApiKeys(): string[] {
  // Support multiple keys: YOUTUBE_API_KEYS=key1,key2,key3
  const multi = process.env.YOUTUBE_API_KEYS;
  if (multi) return multi.split(",").map((k) => k.trim()).filter(Boolean);
  const single = process.env.YOUTUBE_API_KEY;
  if (single) return [single];
  throw new Error("YOUTUBE_API_KEY is not set");
}

let currentKeyIndex = 0;

function nextKey(): string {
  const keys = getApiKeys();
  const key = keys[currentKeyIndex % keys.length];
  currentKeyIndex++;
  return key;
}

// ── Core fetch with quota fallback ──────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
class QuotaExhaustedError extends Error {
  constructor(msg: string) { super(msg); this.name = "QuotaExhaustedError"; }
}

async function ytFetch(
  path: string,
  params: Record<string, string>,
  cacheKey?: string,
): Promise<any> {
  // Check cache first
  if (cacheKey) {
    const cached = cacheGet<any>(cacheKey);
    if (cached) return cached;
  }

  const keys = getApiKeys();
  let lastError: Error | null = null;

  // Try each API key
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = nextKey();
    const qs = new URLSearchParams({ ...params, key });
    try {
      const res = await fetch(`${BASE}/${path}?${qs}`);
      if (res.status === 403) {
        const body = await res.text();
        if (body.includes("quotaExceeded") || body.includes("rateLimitExceeded")) {
          console.warn(`YouTube quota exceeded for key ...${key.slice(-4)}, trying next`);
          lastError = new QuotaExhaustedError(body);
          continue; // try next key
        }
        throw new Error(`YouTube ${path} forbidden (403): ${body}`);
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`YouTube ${path} failed (${res.status}): ${body}`);
      }
      const data = await res.json();
      if (cacheKey) cacheSet(cacheKey, data);
      return data;
    } catch (err) {
      if (err instanceof QuotaExhaustedError) { lastError = err; continue; }
      throw err;
    }
  }

  // All keys exhausted — try returning cached data even if expired
  if (cacheKey) {
    console.warn(`All API keys exhausted for ${path}, returning stale cache if available`);
    const stale = cacheGet<any>(cacheKey);
    if (stale) return stale;
  }
  throw lastError ?? new Error(`YouTube ${path} failed: no API keys available`);
}

// ── Channels (batched + cached) ─────────────────────────────

export async function getChannels(
  channelIds: string[],
): Promise<YouTubeChannelRaw[]> {
  const unique = [...new Set(channelIds)];
  const results: YouTubeChannelRaw[] = [];

  for (let i = 0; i < unique.length; i += MAX_IDS_PER_BATCH) {
    const batch = unique.slice(i, i + MAX_IDS_PER_BATCH);
    const key = `channels:${batch.sort().join(",")}`;
    const data = await ytFetch("channels", {
      part: "snippet,statistics,contentDetails",
      id: batch.join(","),
    }, key);

    for (const ch of data.items ?? []) {
      results.push({
        channelId: ch.id,
        name: ch.snippet?.title ?? "",
        description: ch.snippet?.description ?? "",
        subscriberCount: Number(ch.statistics?.subscriberCount ?? 0),
        videoCount: Number(ch.statistics?.videoCount ?? 0),
        viewCount: Number(ch.statistics?.viewCount ?? 0),
        thumbnailUrl:
          ch.snippet?.thumbnails?.medium?.url ??
          ch.snippet?.thumbnails?.default?.url ?? "",
        customUrl: ch.snippet?.customUrl,
        country: ch.snippet?.country,
        publishedAt: ch.snippet?.publishedAt ?? "",
      });
    }
  }
  return results;
}

// ── Videos (batched + cached) ───────────────────────────────

export async function getVideos(
  videoIds: string[],
): Promise<YouTubeVideoStats[]> {
  const unique = [...new Set(videoIds)];
  const results: YouTubeVideoStats[] = [];

  for (let i = 0; i < unique.length; i += MAX_IDS_PER_BATCH) {
    const batch = unique.slice(i, i + MAX_IDS_PER_BATCH);
    const key = `videos:${batch.sort().join(",")}`;
    const data = await ytFetch("videos", {
      part: "snippet,statistics,contentDetails",
      id: batch.join(","),
    }, key);

    for (const v of data.items ?? []) {
      results.push({
        videoId: v.id,
        viewCount: Number(v.statistics?.viewCount ?? 0),
        likeCount: Number(v.statistics?.likeCount ?? 0),
        commentCount: Number(v.statistics?.commentCount ?? 0),
        duration: v.contentDetails?.duration ?? "PT0S",
        publishedAt: v.snippet?.publishedAt ?? "",
      });
    }
  }
  return results;
}

// ── Channel recent uploads (playlistItems — 1 quota unit!) ──

/**
 * Uses the channel's "uploads" playlist via playlistItems.list
 * instead of search.list. Costs 1 quota unit instead of 100.
 */
export async function getChannelRecentVideoIds(
  channelId: string,
  maxResults = 10,
): Promise<string[]> {
  // The uploads playlist ID is derived from channelId:
  // Replace leading "UC" with "UU"
  const uploadsPlaylistId = "UU" + channelId.slice(2);
  const key = `playlist:${uploadsPlaylistId}:${maxResults}`;

  try {
    const data = await ytFetch("playlistItems", {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: String(maxResults),
    }, key);

    return (data.items ?? [])
      .map((item: any) => item.contentDetails?.videoId)
      .filter(Boolean);
  } catch {
    // Fallback: return empty rather than fail
    return [];
  }
}

// ── Comments (cached, graceful fallback) ────────────────────

export async function getVideoComments(
  videoId: string,
  maxResults = 20,
): Promise<string[]> {
  const key = `comments:${videoId}:${maxResults}`;
  try {
    const data = await ytFetch("commentThreads", {
      part: "snippet",
      videoId,
      maxResults: String(maxResults),
      order: "relevance",
      textFormat: "plainText",
    }, key);
    return (data.items ?? []).map(
      (item: any) =>
        item.snippet?.topLevelComment?.snippet?.textDisplay ?? "",
    );
  } catch {
    // Comments disabled or quota exhausted — return empty
    return [];
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
