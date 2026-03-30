import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface InterestChipsProps {
  interests: string[];
  onChange: (interests: string[]) => void;
}

const SUGGESTIONS = [
  "Fitness", "Mental Health", "Nutrition", "Yoga", "Meditation",
  "Strength Training", "Running", "Productivity", "Tech", "Finance",
];

export function InterestChips({ interests, onChange }: InterestChipsProps) {
  const [input, setInput] = useState("");

  const addInterest = useCallback((value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed && !interests.includes(trimmed)) {
      onChange([...interests, trimmed]);
    }
    setInput("");
  }, [interests, onChange]);

  const removeInterest = (interest: string) => {
    onChange(interests.filter((i) => i !== interest));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addInterest(input);
    }
    if (e.key === "Backspace" && !input && interests.length > 0) {
      onChange(interests.slice(0, -1));
    }
  };

  const availableSuggestions = SUGGESTIONS.filter(
    (s) => !interests.includes(s.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 min-h-[52px] focus-within:ring-2 focus-within:ring-primary/50 transition-shadow">
        <AnimatePresence>
          {interests.map((interest) => (
            <motion.span
              key={interest}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-primary border border-primary/20"
            >
              {interest}
              <button
                onClick={() => removeInterest(interest)}
                className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={interests.length === 0 ? "Type an interest and press Enter..." : "Add more..."}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>
      {availableSuggestions.length > 0 && interests.length < 5 && (
        <div className="flex flex-wrap gap-2">
          {availableSuggestions.slice(0, 6).map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => addInterest(suggestion)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
