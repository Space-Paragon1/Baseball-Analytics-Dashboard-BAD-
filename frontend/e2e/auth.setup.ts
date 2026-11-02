/** Runs first: creates the admin (by signing up) and a regular user, and saves both sessions. */
import { test as setup } from "@playwright/test";
import { ADMIN, AUTH, SCORER, createUser, expect, signIn } from "./helpers";

setup("sign up the admin and add a regular user", async ({ page, browser, request }) => {
  await page.goto("/register");
  await expect(page.getByText("You're the first user, so this account will be the admin.")).toBeVisible();
  await page.getByLabel("Username").fill(ADMIN.username);
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByLabel("Confirm password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Account created. You're the admin.")).toBeVisible();
  await page.context().storageState({ path: AUTH.admin });

  await createUser(request, SCORER.username, SCORER.password);
  const context = await browser.newContext();
  const scorerPage = await context.newPage();
  await signIn(scorerPage, SCORER.username, SCORER.password);
  await expect(scorerPage.getByText(`Welcome back, ${SCORER.username}.`)).toBeVisible();
  await context.storageState({ path: AUTH.scorer });
  await context.close();
});
