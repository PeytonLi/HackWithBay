"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InterestInput } from "@/components/InterestChip";

export default function Home() {
  const router = useRouter();
  const [interests, setInterests] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [preferAuthentic, setPreferAuthentic] = useState(true);
  const [preferDeep, setPreferDeep] = useState(true);

  const canSubmit = interests.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const params = new URLSearchParams({
      interests: interests.join(","),
      location,
      authentic: String(preferAuthentic),
      deep: String(preferDeep),
    });
    router.push(`/search?${params.toString()}`);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 md:p-8">
      <div className="w-full max-w-lg">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            CreatorScope
          </h1>
          <p className="text-lg text-gray-400">
            Find authentic YouTube creators who match your interests
          </p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          <InterestInput
            interests={interests}
            onAdd={(i) => setInterests([...interests, i])}
            onRemove={(idx) => setInterests(interests.filter((_, j) => j !== idx))}
          />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. San Francisco, USA"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
            />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-4">
            <Toggle
              label={preferAuthentic ? "Authentic" : "Popular"}
              checked={preferAuthentic}
              onChange={setPreferAuthentic}
              description={preferAuthentic ? "Trust signals weighted higher" : "Popularity weighted higher"}
            />
            <Toggle
              label={preferDeep ? "Deep content" : "Short content"}
              checked={preferDeep}
              onChange={setPreferDeep}
              description={preferDeep ? "Long-form, in-depth" : "Quick, digestible"}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 text-lg"
          >
            Find Creators →
          </button>
        </div>
      </div>
    </main>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`p-3 rounded-lg border text-left transition-all duration-200 ${
        checked
          ? "border-purple-500/50 bg-purple-500/10"
          : "border-gray-700 bg-gray-800"
      }`}
    >
      <div className="text-sm font-medium text-white">{label}</div>
      <div className="text-xs text-gray-400 mt-0.5">{description}</div>
    </button>
  );
}
