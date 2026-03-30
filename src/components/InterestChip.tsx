"use client";

import { useState } from "react";

interface InterestChipProps {
  label: string;
  onRemove: () => void;
}

export function InterestChip({ label, onRemove }: InterestChipProps) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-sm">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:text-white transition-colors"
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </span>
  );
}

interface InterestInputProps {
  interests: string[];
  onAdd: (interest: string) => void;
  onRemove: (index: number) => void;
}

export function InterestInput({ interests, onAdd, onRemove }: InterestInputProps) {
  const [value, setValue] = useState("");

  const addInterest = () => {
    // Support comma-separated values like "fitness, yoga, running"
    const items = value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !interests.includes(s));
    for (const item of items) {
      onAdd(item);
    }
    setValue("");
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Interests
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {interests.map((interest, i) => (
          <InterestChip
            key={interest}
            label={interest}
            onRemove={() => onRemove(i)}
          />
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addInterest();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. fitness, mental health..."
          className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          disabled={value.trim().length === 0}
        >
          Add
        </button>
      </form>
      <p className="text-xs text-gray-500 mt-1.5">
        Type and press Enter or click Add. Separate multiple with commas.
      </p>
    </div>
  );
}
