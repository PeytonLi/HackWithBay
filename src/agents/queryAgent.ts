/**
 * Query Agent (Plan)
 * Takes user interests + location → generates 5-8 optimised YouTube search queries
 */

import type { QueryAgentInput, QueryAgentOutput } from "@/types/creator";
import { generateSearchQueries } from "@/lib/openai";

export async function runQueryAgent(
  input: QueryAgentInput,
): Promise<QueryAgentOutput> {
  const queries = await generateSearchQueries(
    input.interests,
    input.location,
    input.preferDeepContent,
  );

  // Ensure we have at least some fallback queries if LLM returns too few
  if (queries.length < 3) {
    for (const interest of input.interests) {
      queries.push(`${interest} ${input.location} YouTube creator`);
      if (input.preferDeepContent) {
        queries.push(`${interest} in-depth guide long form`);
      }
    }
  }

  // Cap at 8 queries to manage API quota
  return { queries: queries.slice(0, 8) };
}
