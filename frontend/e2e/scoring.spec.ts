/** Changing data, signed in as the admin: Game Mode, editing records, CSV upload. */
import { AUTH, expect, test } from "./helpers";

test.use({ storageState: AUTH.admin });

test("score a game, undo a play, resume after a reload, save it and edit a record", async ({ page }) => {
  await page.goto("/game-mode");
  await page.getByLabel("Away team (bats first)").fill("Tigers");
  await page.getByLabel("Home team").fill("Eagles");
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.getByText("Tigers batting")).toBeVisible();
  await expect(page).toHaveURL(/game=GM-/);

  await page.getByPlaceholder("Starting pitcher").first().fill("Derek Simmons");
  await page.getByRole("button", { name: "Set" }).first().click();
  await expect(page.getByPlaceholder("Starting pitcher")).toHaveCount(1);
  await page.getByPlaceholder("Starting pitcher").fill("Sam Patel");
  await page.getByRole("button", { name: "Set" }).last().click();
  await expect(page.getByPlaceholder("Starting pitcher")).toHaveCount(0);

  const batter = page.getByPlaceholder("Type or pick a name, then choose the result");
  const plays: [string, string][] = [
    ["Luis Ortega", "Double"],
    ["Mike Torres", "Home run"],
    ["Chris Wagner", "Strikeout"],
    ["Andre Johnson", "Walk"],
    ["Luis Ortega", "Out in play"],
    ["Mike Torres", "Out in play"],
  ];
  // The play-by-play also lists pitching changes, newest first.
  const playLog = page.locator("ol li");
  await expect(playLog.first()).toContainText("is now pitching");
  const before = await playLog.count();
  for (const [i, [name, result]] of plays.entries()) {
    await batter.fill(name);
    await page.getByRole("button", { name: result, exact: true }).click();
    await expect(playLog).toHaveCount(before + i + 1);
  }
  await expect(page.getByText("Eagles batting")).toBeVisible();

  await batter.fill("Marcus Rivera");
  await page.getByRole("button", { name: "Triple", exact: true }).click();
  await expect(playLog.first()).toContainText("Marcus Rivera");
  await page.getByRole("button", { name: "Undo last" }).click();
  await expect(playLog.first()).toContainText("Mike Torres");

  await page.reload();
  await expect(page.getByText("Eagles batting")).toBeVisible();
  await expect(playLog).toHaveCount(before + plays.length);

  await page.getByRole("button", { name: "End & save" }).click();
  await page.getByRole("button", { name: "Save game" }).click();
  await expect(page.getByText("Game saved to the database")).toBeVisible();

  await page.getByRole("link", { name: "View its records" }).click();
  await expect(page.getByText(/records · page 1/)).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Runs", { exact: true }).fill("1");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Record updated.").first()).toBeVisible();
});

test("a CSV with a bad row is rejected without changing anything", async ({ page }) => {
  await page.goto("/upload");
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "player_name,team,position,game_date,game_id,opponent,at_bats,hits\n" +
        "A Player,Eagles,CF,2025-05-01,G-BAD,Tigers,2,5\n"
    ),
  });
  await page.getByRole("button", { name: "Upload CSV" }).click();
  await expect(page.getByText("No changes were made")).toBeVisible();
  await expect(page.getByText("Row 2: hits cannot exceed at_bats")).toBeVisible();

  await page.goto("/records?search=A%20Player");
  await expect(page.getByText("A Player")).toHaveCount(0);
});
