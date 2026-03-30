"use client";

import type { Creator } from "@/types/creator";
import { TagBadge } from "./TagBadge";
import { ScoreBar } from "./ScoreBar";

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export function CreatorCard({ creator }: { creator: Creator }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-purple-500/40 transition-all duration-300">
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        {creator.thumbnailUrl && (
          <img
            src={creator.thumbnailUrl}
            alt={creator.name}
            className="w-14 h-14 rounded-full object-cover border-2 border-gray-700"
          />
        )}
        <div className="flex-1 min-w-0">
          <a
            href={creator.channelUrl ?? `https://youtube.com/channel/${creator.channelId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-semibold text-white hover:text-purple-300 transition-colors truncate block"
          >
            {creator.name}
          </a>
          <div className="flex gap-4 text-sm text-gray-400 mt-1">
            <span>{formatNum(creator.subscribers)} subs</span>
            <span>{formatNum(creator.avg_views)} avg views</span>
            <span>{(creator.engagement_rate * 100).toFixed(1)}% engagement</span>
          </div>
        </div>
        {/* Score */}
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            {Math.round(creator.score * 100)}
          </div>
          <div className="text-xs text-gray-500">score</div>
        </div>
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <ScoreBar score={creator.score} />
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {creator.tags.map((tag) => (
          <TagBadge key={tag} tag={tag} />
        ))}
      </div>

      {/* Explanation */}
      <p className="text-sm text-gray-400 leading-relaxed">
        {creator.reason}
      </p>
    </div>
  );
}
