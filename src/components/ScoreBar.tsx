"use client";

export function ScoreBar({ score, label }: { score: number; label?: string }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 75 ? "bg-green-500" :
    pct >= 50 ? "bg-yellow-500" :
    pct >= 25 ? "bg-orange-500" :
    "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-gray-400 w-12">{label}</span>}
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-300 w-8 text-right">{pct}</span>
    </div>
  );
}
