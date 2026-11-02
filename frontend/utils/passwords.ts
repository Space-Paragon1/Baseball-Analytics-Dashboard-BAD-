/** Password rules, matching the API (8 characters to 72 bytes, the bcrypt limit). */

export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

function utf8Length(s: string): number {
  let bytes = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** What's wrong with a new password, or null if it's fine. */
export function passwordProblem(password: string, confirm: string, current?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (utf8Length(password) > MAX_PASSWORD_BYTES) return "Password is too long.";
  if (password !== confirm) return "Passwords don't match.";
  if (current !== undefined && password === current) return "The new password must be different from the current one.";
  return null;
}
