"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreatorCard } from "@/components/CreatorCard";
import type { Creator } from "@/types/creator";

export default function ResultsPage() {
  const router = useRouter();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [totalTime, setTotalTime] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("creatorResults");
    const time = sessionStorage.getItem("totalTime");
    if (!raw) {
      router.push("/");
      return;
    }
    setCreators(JSON.parse(raw));
    setTotalTime(Number(time ?? 0));
    setLoaded(true);
  }, [router]);

  if (!loaded) return null;

  const gems = creators.filter((c) => c.tags.includes("Hidden gem 💎"));
  const main = creators.filter((c) => !c.tags.includes("Hidden gem 💎"));

  return (
    <main className="min-h-screen p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Your Creators</h1>
            <p className="text-gray-400 text-sm mt-1">
              {creators.length} creators found in{" "}
              {(totalTime / 1000).toFixed(1)}s
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:text-white hover:border-gray-600 transition-colors"
          >
            ← New search
          </button>
        </div>

        {/* Hidden gems section */}
        {gems.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-yellow-300 mb-4 flex items-center gap-2">
              💎 Hidden Gems
              <span className="text-xs text-gray-400 font-normal">
                Low followers, high engagement
              </span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {gems.map((c) => (
                <CreatorCard key={c.channelId} creator={c} />
              ))}
            </div>
          </section>
        )}

        {/* Main results */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">
            Top Ranked Creators
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {main.map((c) => (
              <CreatorCard key={c.channelId} creator={c} />
            ))}
          </div>
        </section>

        {creators.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-xl mb-2">No creators found</p>
            <p className="text-sm">Try different interests or a broader location</p>
          </div>
        )}
      </div>
    </main>
  );
}
