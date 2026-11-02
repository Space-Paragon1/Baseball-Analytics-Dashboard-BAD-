/** Display helpers for baseball numbers. `null`/`undefined` render as an em dash. */

const DASH = "—";

/** Batting-average style: 0.3 -> ".300", 1 -> "1.000". Also used for OBP/SLG/OPS/wOBA. */
export function formatAvg(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return DASH;
  const s = val.toFixed(3);
  return s.startsWith("0.") ? s.slice(1) : s.startsWith("-0.") ? `-${s.slice(2)}` : s;
}

/** Two decimals, e.g. ERA/WHIP/FIP. */
export function formatRate(val: number | null | undefined, digits = 2): string {
  if (val == null || Number.isNaN(val)) return DASH;
  return val.toFixed(digits);
}

/** 0.231 -> "23.1%" */
export function formatPct(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return DASH;
  return `${(val * 100).toFixed(1)}%`;
}

/** Innings already arrive in baseball notation (6.1 = 6 1/3); keep one decimal. */
export function formatIP(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return DASH;
  return val.toFixed(1);
}

/** Outs -> baseball innings notation: 20 -> "6.2" */
export function outsToIP(outs: number): string {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

export function formatSigned(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return DASH;
  return val > 0 ? `+${val}` : String(val);
}

/** "2025-03-15" -> "Mar 15, 2025" (no timezone shifts). */
export function formatDate(iso: string | null | undefined, withYear = true): string {
  if (!iso) return DASH;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return withYear ? `${month} ${d}, ${y}` : `${month} ${d}`;
}

/** Short label for charts: "Marcus Rivera" -> "Rivera". */
export function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : name;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
