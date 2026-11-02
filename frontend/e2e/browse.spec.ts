/** What anyone can do without signing in. Runs against the sample data. */
import { expect, test } from "./helpers";

test("every page loads", async ({ page }) => {
  const pages: [string, string][] = [
    ["/", "Auto-Generated Insights"],
    ["/players", "Batting Leaders"],
    ["/pitching", "Pitching Leaders"],
    ["/teams", "Teams & Standings"],
    ["/compare", "Compare Players"],
    ["/records", "Game Log"],
  ];
  for (const [path, text] of pages) {
    await page.goto(path);
    await expect(page.getByText(text).first()).toBeVisible();
  }
});

test("changing data asks you to sign in first", async ({ page }) => {
  const gated: [string, string][] = [
    ["/game-mode", "Sign in to score games."],
    ["/add-game", "Sign in to add records."],
    ["/upload", "Sign in to upload data."],
    ["/import", "Sign in to import MLB data."],
    ["/users", "Sign in to manage users."],
    ["/account", "Sign in to manage your account."],
  ];
  for (const [path, text] of gated) {
    await page.goto(path);
    await expect(page.getByText(text)).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Users", exact: true })).toHaveCount(0);
});

test("batting leaders sort by a column and expand a player", async ({ page }) => {
  await page.goto("/players");
  const headers = page.locator("table.data-table thead th");
  await expect(headers.first()).toBeVisible();
  const column = (await headers.allInnerTexts()).findIndex((t) => t.trim() === "HR");
  expect(column).toBeGreaterThan(-1);

  await page.getByRole("button", { name: "HR", exact: true }).click();
  const order = await headers.nth(column).getAttribute("aria-sort");
  expect(order).toMatch(/^(ascending|descending)$/);
  const values = (await page.locator(`table.data-table tbody tr td:nth-child(${column + 1})`).allInnerTexts()).map(
    Number
  );
  expect(values.length).toBeGreaterThan(3);
  const sorted = [...values].sort((a, b) => (order === "descending" ? b - a : a - b));
  expect(values).toEqual(sorted);

  await page.getByRole("cell", { name: "Luis Ortega" }).click();
  await expect(page.getByText("OPS trend")).toBeVisible();
});

test("teams page shows a team's recent games", async ({ page }) => {
  await page.goto("/teams");
  await page.getByRole("cell", { name: "Eagles", exact: true }).click();
  await expect(page.getByText("Last 10 games")).toBeVisible();
});

test("compare two players side by side", async ({ page }) => {
  await page.goto("/compare");
  const selects = page.locator("main select");
  await expect(selects.nth(0).locator("option")).not.toHaveCount(1);
  await selects.nth(0).selectOption({ label: "Luis Ortega (Tigers, RF)" });
  await selects.nth(1).selectOption({ label: "Marcus Rivera (Eagles, CF)" });
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByText("Rate stats")).toBeVisible();
});

test("the date filter narrows the dashboard", async ({ page }) => {
  await page.goto("/");
  const gamesCard = page.locator(".stat-card").first();
  await expect(gamesCard).toContainText("Games");
  const before = Number((await gamesCard.locator("p").nth(1).innerText()).trim());

  await page.getByLabel("Start date").fill("2025-04-01");
  await page.getByLabel("End date").fill("2025-04-30");
  await expect
    .poll(async () => Number((await gamesCard.locator("p").nth(1).innerText()).trim()))
    .toBeLessThan(before);
});

test("dark mode is remembered after a reload", async ({ page }) => {
  await page.goto("/teams");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("the menu works on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("link", { name: "Pitching" }).click();
  await expect(page).toHaveURL(/\/pitching$/);
  await expect(page.getByText("Pitching Leaders").first()).toBeVisible();
});
