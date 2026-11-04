export type ScoreTone = "high" | "mid" | "low";

/** Score bands from the design brief: >= 75 strong, 50-74 partial, < 50 weak. */
export function scoreTone(score: number): ScoreTone {
  if (score >= 75) return "high";
  if (score >= 50) return "mid";
  return "low";
}
