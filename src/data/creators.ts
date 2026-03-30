/**
 * Preloaded creator dataset
 * 80 real YouTube creators across 10 categories.
 * Used for filtering instead of calling search.list.
 */

export interface PreloadedCreator {
  channelId: string;
  name: string;
  topics: string[];
}

const CREATORS: PreloadedCreator[] = [
  // ── Fitness ───────────────────────────────────────────
  { channelId: "UCe0TLA0EsQbE-MjuHXevj2A", name: "ATHLEAN-X", topics: ["fitness", "workout", "strength training", "exercise"] },
  { channelId: "UCERm5yFZ1SptUEU4wZ2vJvw", name: "Jeff Nippard", topics: ["fitness", "bodybuilding", "science", "workout"] },
  { channelId: "UCOFCwvhDoAscjbtOsAEq9cQ", name: "Natacha Oceane", topics: ["fitness", "workout", "nutrition", "health"] },
  { channelId: "UCGXgMFkSiQ2MjOSfb65VDhA", name: "Fitness Blender", topics: ["fitness", "home workout", "exercise", "health"] },
  { channelId: "UCpQ34afVgk8cRQBjSJ1xuJQ", name: "MegSquats", topics: ["fitness", "powerlifting", "strength training", "women fitness"] },
  { channelId: "UC68TLK0mAEzUyHx5x5k-S1Q", name: "Jeremy Ethier", topics: ["fitness", "science", "workout", "body transformation"] },
  { channelId: "UCaBqRxHEMomgFU-AkSENRzw", name: "Sydney Cummings", topics: ["fitness", "home workout", "exercise", "motivation"] },
  { channelId: "UCfQgsKhHjSyRLOp9mnffqVg", name: "Hybrid Calisthenics", topics: ["fitness", "calisthenics", "bodyweight", "beginner fitness"] },

  // ── Mental Health ─────────────────────────────────────
  { channelId: "UCLiSsIpAcSqR1sEhwrws1cQ", name: "Therapy in a Nutshell", topics: ["mental health", "therapy", "anxiety", "psychology"] },
  { channelId: "UC2AG9VO4ssMl2Z-6TOHaGig", name: "HealthyGamerGG", topics: ["mental health", "psychology", "gaming", "self improvement"] },
  { channelId: "UClHVl2N3jPEbkNJVx-ItQIQ", name: "Psych2Go", topics: ["mental health", "psychology", "self improvement", "relationships"] },
  { channelId: "UCWOA1ZGiwKGKiq3LhBmR0YA", name: "Kati Morton", topics: ["mental health", "therapy", "anxiety", "depression"] },
  { channelId: "UC0QHWhjbe5fGJEPz3sVb6nw", name: "MedCircle", topics: ["mental health", "psychology", "wellness", "therapy"] },
  { channelId: "UCnQC_G5Xsjhp9fEJKuIcrSw", name: "BetterHelp", topics: ["mental health", "therapy", "counseling", "wellness"] },
  { channelId: "UCbOy_HISas8OQ0JTfmRsOeA", name: "The School of Life", topics: ["mental health", "philosophy", "self improvement", "relationships"] },
  { channelId: "UCTb_aIjAG_aMCW7c-kNZIxQ", name: "Dr. Tracey Marks", topics: ["mental health", "psychiatry", "anxiety", "depression"] },

  // ── Technology ────────────────────────────────────────
  { channelId: "UCBJycsmduvYEL83R_U4JriQ", name: "Marques Brownlee", topics: ["technology", "tech reviews", "gadgets", "smartphones"] },
  { channelId: "UCXuqSBlHAE6Xw-yeJA0Tunw", name: "Linus Tech Tips", topics: ["technology", "pc building", "tech reviews", "hardware"] },
  { channelId: "UCVHFbqXqoYvEWM1Ddxl0QDg", name: "Android Authority", topics: ["technology", "android", "smartphones", "tech reviews"] },
  { channelId: "UCsTcErHg8oDvUnTzoqsYeNw", name: "Unbox Therapy", topics: ["technology", "gadgets", "unboxing", "tech reviews"] },
  { channelId: "UCVYamHKEnwaVlUJz6McNaPg", name: "Dave Lee", topics: ["technology", "laptops", "tech reviews", "gadgets"] },
  { channelId: "UCddiUEpeqJcYeBxX1IVBKvQ", name: "The Verge", topics: ["technology", "tech news", "gadgets", "science"] },
  { channelId: "UCey_c7U86mJGz1VJWH5CYPA", name: "iJustine", topics: ["technology", "apple", "gadgets", "lifestyle"] },
  { channelId: "UCBcRF18a7Qf58cCRy5xuWwQ", name: "MKBHD Shorts", topics: ["technology", "tech reviews", "smartphones", "quick reviews"] },


  // ── Cooking & Food ───────────────────────────────────
  { channelId: "UCJFp8uSYCjXOMnkUyb3CQ3Q", name: "Tasty", topics: ["cooking", "food", "recipes", "baking"] },
  { channelId: "UCRIZtbGPi5Nf2RN7m1LtqBg", name: "Joshua Weissman", topics: ["cooking", "food", "recipes", "budget cooking"] },
  { channelId: "UCkYEyzuoy0rk5eieHupmdCQ", name: "Pro Home Cooks", topics: ["cooking", "food", "home cooking", "meal prep"] },
  { channelId: "UC9_p50tH3WmMslWRWKnM7dQ", name: "Adam Ragusea", topics: ["cooking", "food science", "recipes", "food"] },
  { channelId: "UCqqJQ_cXSat0KIAVfIfKkVA", name: "J. Kenji Lopez-Alt", topics: ["cooking", "food science", "recipes", "food"] },
  { channelId: "UCsQp6WAjhOMVfGMlONVCrKA", name: "Babish Culinary Universe", topics: ["cooking", "food", "recipes", "entertainment"] },
  { channelId: "UCmB2eFvQ8hyDJGJMuWMkXjg", name: "Internet Shaquille", topics: ["cooking", "budget cooking", "recipes", "food"] },

  // ── Finance & Business ────────────────────────────────
  { channelId: "UCnMn36GT_H0X-w5_ckLtlgQ", name: "Graham Stephan", topics: ["finance", "investing", "real estate", "money"] },
  { channelId: "UC4a-Gbdw7vOaccHmFo40b9g", name: "Khan Academy", topics: ["education", "finance", "math", "science"] },
  { channelId: "UCWB7eFmtuitIQuYPPiSolCg", name: "Andrei Jikh", topics: ["finance", "investing", "cryptocurrency", "money"] },
  { channelId: "UCnYC1GFMXHgNGJaB3fdd_hQ", name: "Ali Abdaal", topics: ["productivity", "business", "self improvement", "education"] },
  { channelId: "UCGy7SkBjmqdBluCsQ7p3Q0A", name: "How Money Works", topics: ["finance", "economics", "money", "business"] },
  { channelId: "UC2D2CMWXMOVWx7giW1n3LIg", name: "Minority Mindset", topics: ["finance", "investing", "money", "entrepreneurship"] },
  { channelId: "UC7eBNeDW1GQf2NJQ6G6gAxw", name: "Patrick Boyle", topics: ["finance", "investing", "economics", "markets"] },

  // ── Science & Education ───────────────────────────────
  { channelId: "UCsXVk37bltHxD1rDPwtNM8Q", name: "Kurzgesagt", topics: ["science", "education", "space", "biology"] },
  { channelId: "UC6107grRI4m0o2-emgoDnAA", name: "SmarterEveryDay", topics: ["science", "engineering", "education", "experiments"] },
  { channelId: "UCUHW94eEFW7hkUMVaZz4eDg", name: "MinutePhysics", topics: ["science", "physics", "education", "space"] },
  { channelId: "UCZYTClx2T1of7BRZ86-8fow", name: "SciShow", topics: ["science", "education", "biology", "chemistry"] },
  { channelId: "UCHnyfMqiRRG1u-2MsSQLbXA", name: "Veritasium", topics: ["science", "education", "physics", "engineering"] },
  { channelId: "UCvjgXvBlCQM5YYBiqj98oOg", name: "3Blue1Brown", topics: ["math", "education", "science", "visualization"] },
  { channelId: "UCo8bcnLyZH8tBIH9V1mLgqQ", name: "TED-Ed", topics: ["education", "science", "history", "philosophy"] },

  // ── Self Improvement & Motivation ─────────────────────
  { channelId: "UC5sYBwMv3dlvrMcBPLfuLNQ", name: "Matt D'Avella", topics: ["self improvement", "minimalism", "productivity", "habits"] },
  { channelId: "UCJ24N4O0bP7LGLBDvye7oCA", name: "Thomas Frank", topics: ["productivity", "self improvement", "study tips", "habits"] },
  { channelId: "UCIaH-gZIVC432YRjNVvnyCA", name: "Better Ideas", topics: ["self improvement", "productivity", "motivation", "habits"] },
  { channelId: "UCIRiKFacY9HdaltFSWLGIgw", name: "Captain Sinbad", topics: ["self improvement", "motivation", "philosophy", "lifestyle"] },
  { channelId: "UCpExuV8qJMfCaSQNL1YG6bQ", name: "After Skool", topics: ["self improvement", "philosophy", "education", "psychology"] },

  // ── Yoga & Meditation ─────────────────────────────────
  { channelId: "UCFKE7WVJfvaHW5q283SxchA", name: "Yoga With Adriene", topics: ["yoga", "fitness", "meditation", "wellness"] },
  { channelId: "UCLkL1puDRWaCgHqaJLMSz0g", name: "Boho Beautiful", topics: ["yoga", "meditation", "travel", "wellness"] },
  { channelId: "UCEwhtpXrg5MjwIA-6_KQCPQ", name: "Sarah Beth Yoga", topics: ["yoga", "flexibility", "beginner yoga", "wellness"] },

  // ── Nutrition & Diet ──────────────────────────────────
  { channelId: "UCqYPhGiB9tkShZsq0GaEBqg", name: "What I've Learned", topics: ["nutrition", "health", "science", "diet"] },
  { channelId: "UCpyhJZhJQWKDdJCR07jPY-Q", name: "Thomas DeLauer", topics: ["nutrition", "keto", "fasting", "health"] },
  { channelId: "UClqo6SAoeCvlnr8BtHTm7aA", name: "Pick Up Limes", topics: ["nutrition", "vegan", "cooking", "wellness"] },
  { channelId: "UCgJEl6I94d2URR4TIKHaNFQ", name: "Dr. Eric Berg", topics: ["nutrition", "keto", "health", "diet"] },

  // ── Gaming ────────────────────────────────────────────
  { channelId: "UCam8T03EOFBsNdR0thrFHdQ", name: "WIRED Gaming", topics: ["gaming", "technology", "culture", "reviews"] },
  { channelId: "UCLx053rWZxCiYWsBETgdKrQ", name: "LowSpecGamer", topics: ["gaming", "pc gaming", "optimization", "budget"] },
  { channelId: "UCtUbO6rBht0daVIOGML3c8w", name: "GameMaker's Toolkit", topics: ["gaming", "game design", "analysis", "education"] },
];

// ── Filter function ─────────────────────────────────────────

/**
 * Filter creators by matching user interests against creator topics.
 * Uses fuzzy keyword matching — an interest matches if any topic contains it
 * or vice versa.
 */
export function filterCreatorsByInterests(
  interests: string[],
): PreloadedCreator[] {
  const normalised = interests.map((i) => i.toLowerCase().trim());

  const scored = CREATORS.map((creator) => {
    let matchCount = 0;
    for (const interest of normalised) {
      for (const topic of creator.topics) {
        if (topic.includes(interest) || interest.includes(topic)) {
          matchCount++;
          break; // count each interest once
        }
      }
    }
    return { creator, matchCount };
  });

  return scored
    .filter((s) => s.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
    .map((s) => s.creator);
}

/** Get all unique topics in the dataset */
export function getAllTopics(): string[] {
  const set = new Set<string>();
  for (const c of CREATORS) {
    for (const t of c.topics) set.add(t);
  }
  return [...set].sort();
}

export default CREATORS;