"use client";

import type { Creator } from "@/types/creator";
import { TagBadge } from "./TagBadge";

function formatNum(n: number): string {
  if (!n || n === 0) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export function CreatorCard({ creator, rank }: { creator: Creator; rank?: number }) {
  const channelUrl =
    creator.channelUrl ||
    (creator.channelId ? `https://youtube.com/channel/${creator.channelId}` : "#");

  const hasThumbnail = !!creator.thumbnailUrl;
  const initials = creator.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-purple-500/40 transition-all duration-300 group">
      {/* Header row */}
      <div className="flex items-start gap-4 mb-4">
        {/* Rank badge */}
        {rank != null && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-sm font-bold text-purple-300">
            {rank}
          </div>
        )}

        {/* Thumbnail */}
        <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
          {hasThumbnail ? (
            <img
              src={creator.thumbnailUrl}
              alt={creator.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-gray-700 group-hover:border-purple-500/60 transition-colors"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-lg border-2 border-gray-700">
              {initials}
            </div>
          )}
        </a>

        {/* Name + stats */}
        <div className="flex-1 min-w-0">
          <a
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-semibold text-white hover:text-purple-300 transition-colors truncate block"
          >
            {creator.name}
          </a>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400 mt-1">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
              {formatNum(creator.subscribers)} subscribers
            </span>
            {creator.avg_views > 0 && (
              <span>{formatNum(creator.avg_views)} avg views</span>
            )}
            {creator.engagement_rate > 0 && (
              <span>{(creator.engagement_rate * 100).toFixed(1)}% engagement</span>
            )}
          </div>
        </div>
      </div>

      {/* Tags */}
      {creator.tags && creator.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {creator.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      )}

      {/* Description / Reason */}
      {creator.reason && (
        <p className="text-sm text-gray-400 leading-relaxed mb-4 line-clamp-3">
          {creator.reason}
        </p>
      )}

      {/* Channel link button */}
      <a
        href={channelUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-600/30 hover:text-red-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.377.504A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.504 9.376.504 9.376.504s7.505 0 9.377-.504a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
          <path fill="#1a1a2e" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
        View Channel on YouTube
      </a>
    </div>
  );
}
