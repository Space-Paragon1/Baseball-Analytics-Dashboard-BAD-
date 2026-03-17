/**
 * Pure baseball statistics calculation functions.
 */

/** Batting Average: H / AB */
export function battingAverage(hits: number, atBats: number): number {
  if (atBats === 0) return 0;
  return hits / atBats;
}

/** On-Base Percentage: (H + BB + HBP) / (AB + BB + HBP) */
export function obp(hits: number, walks: number, hbp: number, atBats: number): number {
  const denominator = atBats + walks + hbp;
  if (denominator === 0) return 0;
  return (hits + walks + hbp) / denominator;
}

/** Slugging Percentage: (1B + 2*2B + 3*3B + 4*HR) / AB */
export function slg(
  singles: number,
  doubles: number,
  triples: number,
  hr: number,
  atBats: number
): number {
  if (atBats === 0) return 0;
  return (singles + 2 * doubles + 3 * triples + 4 * hr) / atBats;
}

/** On-Base Plus Slugging */
export function ops(obpVal: number, slgVal: number): number {
  return obpVal + slgVal;
}

/** Earned Run Average: (ER * 9) / IP */
export function era(earnedRuns: number, ip: number): number {
  if (ip === 0) return 0;
  return (earnedRuns * 9) / ip;
}

/** WHIP: (BB + H) / IP */
export function whip(walks: number, hits: number, ip: number): number {
  if (ip === 0) return 0;
  return (walks + hits) / ip;
}

/**
 * Format a decimal value as a batting average string.
 * e.g. 0.3 -> ".300", 0.333 -> ".333"
 */
export function formatAvg(val: number): string {
  const rounded = Math.round(val * 1000);
  return "." + rounded.toString().padStart(3, "0");
}
