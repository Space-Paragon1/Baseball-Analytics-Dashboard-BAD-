/** Display helpers for baseball numbers. `null`/`undefined` render as an em dash. */

const DASH = "—";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  const month = MONTHS[m - 1];
  return withYear ? `${month} ${d}, ${y}` : `${month} ${d}`;
}

/** A timestamp, relative when recent: "just now", "5 min ago", "yesterday", then "Mar 15, 2025" (local time). */
export function formatWhen(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return DASH;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return iso;
  const seconds = Math.max(0, (now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  const days = Math.floor(seconds / 86400);
  if (days < 7) return days === 1 ? "yesterday" : `${days} days ago`;
  return `${MONTHS[then.getMonth()]} ${then.getDate()}, ${then.getFullYear()}`;
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
