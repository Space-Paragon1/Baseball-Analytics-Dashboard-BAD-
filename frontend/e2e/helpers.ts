import { readFileSync } from "node:fs";
import { type APIRequestContext, expect, type Page, test as base } from "@playwright/test";

export const API_URL = "http://localhost:8000";

export const ADMIN = { username: "admin", email: "admin@example.com", password: "admin-password-1" };
export const SCORER = { username: "scorer", email: "scorer@example.com", password: "scorer-password-1" };

/** Signed-in browser state saved by auth.setup.ts. */
export const AUTH = { admin: "e2e/.auth/admin.json", scorer: "e2e/.auth/scorer.json" };

// Requests that are supposed to fail in these tests (bad uploads, wrong passwords,
// permission checks) still log "Failed to load resource" in the browser console.
const EXPECTED_FAILURES = /status of (400|401|403|409|422|429)\b/;

/**
 * `test` with one addition: any unexpected browser console error or uncaught
 * exception fails the test.
 */
export const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [
    async ({ page }, provide) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error" && !EXPECTED_FAILURES.test(m.text())) errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await provide(errors);
      expect(errors, "browser console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** A username that's new on every run and retry, e.g. "coach-lx3k9a". */
export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

/** The API token stored in a saved browser state. */
export function tokenFrom(stateFile: string): string {
  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  for (const origin of state.origins ?? []) {
    const item = origin.localStorage?.find((i: { name: string }) => i.name === "auth_token");
    if (item) return item.value;
  }
  throw new Error(`No auth token in ${stateFile}`);
}

/** Create an account through the API, as the admin. */
export async function createUser(
  request: APIRequestContext,
  username: string,
  password = "starting-password-1"
): Promise<{ username: string; password: string }> {
  const r = await request.post(`${API_URL}/users`, {
    headers: { Authorization: `Bearer ${tokenFrom(AUTH.admin)}` },
    data: { username, email: `${username}@example.com`, password },
  });
  expect(r.status(), await r.text()).toBe(201);
  return { username, password };
}

export async function signIn(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
