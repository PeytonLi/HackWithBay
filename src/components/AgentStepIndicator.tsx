"use client";

import type { AgentStep } from "@/types/creator";

const STATUS_STYLES = {
  pending: "border-gray-600 text-gray-500",
  running: "border-purple-500 text-purple-300 animate-pulse",
  complete: "border-green-500 text-green-300",
  error: "border-red-500 text-red-300",
};

const STATUS_ICONS = {
  pending: "○",
  running: "◉",
  complete: "✓",
  error: "✗",
};

export function AgentStepIndicator({ step }: { step: AgentStep }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${STATUS_STYLES[step.status]} transition-all duration-300`}
    >
      <span className="text-lg">{step.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{step.name}</span>
          <span className="text-xs opacity-60">{STATUS_ICONS[step.status]}</span>
        </div>
        <p className="text-xs opacity-60 truncate">{step.description}</p>
      </div>
      {step.status === "running" && (
        <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  );
}
