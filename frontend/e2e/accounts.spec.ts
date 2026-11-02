/** Users page, Account page, disabled accounts and sign-in lockouts. */
import { AUTH, SCORER, createUser, expect, signIn, test, uniqueName } from "./helpers";

test.describe("as the admin", () => {
  test.use({ storageState: AUTH.admin });

  test("add, promote, demote, disable and reset users", async ({ page, browser }) => {
    const coach = uniqueName("coach");
    const bench = uniqueName("bench");
    await page.goto("/users");
    await expect(page.getByText("Change your password on the Account page")).toBeVisible();

    // A generated password is shown once.
    await page.getByRole("button", { name: "Add user" }).click();
    let dialog = page.getByRole("dialog", { name: "Add user" });
    await dialog.getByLabel("Username").fill(coach);
    await dialog.getByLabel("Email").fill(`${coach}@example.com`);
    await dialog.getByRole("button", { name: "Add user" }).click();
    await expect(page.getByRole("dialog", { name: `Account created for ${coach}` })).toBeVisible();
    await expect(page.getByTestId("temporary-password")).toHaveText(/^\S{16}$/);
    await page.getByRole("button", { name: "Done" }).click();

    // A chosen password: no dialog.
    await page.getByRole("button", { name: "Add user" }).click();
    dialog = page.getByRole("dialog", { name: "Add user" });
    await dialog.getByLabel("Username").fill(bench);
    await dialog.getByLabel("Email").fill(`${bench}@example.com`);
    await dialog.getByLabel("Password (optional)").fill("bench-password-1");
    await dialog.getByRole("button", { name: "Add user" }).click();
    await expect(page.getByText(`Added ${bench}.`)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const coachRow = page.locator("tbody tr", { hasText: `${coach}@` });
    const benchRow = page.locator("tbody tr", { hasText: `${bench}@` });
    const confirm = (label: string) => page.getByRole("dialog").getByRole("button", { name: label }).click();

    await coachRow.getByRole("button", { name: "Make admin" }).click();
    await confirm("Make admin");
    await expect(coachRow.getByText("Admin", { exact: true })).toBeVisible();
    await coachRow.getByRole("button", { name: "Remove admin" }).click();
    await confirm("Remove admin");
    await expect(coachRow.getByText("User", { exact: true })).toBeVisible();

    await benchRow.getByRole("button", { name: "Disable" }).click();
    await confirm("Disable account");
    await expect(benchRow.getByText("Disabled", { exact: true })).toBeVisible();

    await coachRow.getByRole("button", { name: "Reset password" }).click();
    await confirm("Reset password");
    await expect(page.getByRole("dialog", { name: `New password for ${coach}` })).toBeVisible();
    const coachPassword = await page.getByTestId("temporary-password").innerText();
    await page.getByRole("button", { name: "Done" }).click();

    // In a separate browser: the disabled account is refused, the reset password works.
    const other = await browser.newContext();
    const visitor = await other.newPage();
    await signIn(visitor, bench, "bench-password-1");
    await expect(visitor.getByText("This account is disabled")).toBeVisible();
    await signIn(visitor, coach, coachPassword);
    await expect(visitor.getByText(`Welcome back, ${coach}.`)).toBeVisible();
    await other.close();
  });
});

test.describe("as a regular user", () => {
  test.use({ storageState: AUTH.scorer });

  test("admin pages are off limits", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: SCORER.username, exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Users", exact: true })).toHaveCount(0);
    for (const [path, text] of [
      ["/users", "Only an admin can manage users."],
      ["/upload", "Only an admin can upload data."],
      ["/import", "Only an admin can import MLB data."],
    ]) {
      await page.goto(path);
      await expect(page.getByText(text)).toBeVisible();
    }
    await page.goto("/game-mode");
    await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
  });
});

test("change your password: a wrong current password keeps you signed in", async ({ page, request }) => {
  const user = await createUser(request, uniqueName("changer"));
  await signIn(page, user.username, user.password);
  await expect(page.getByText(`Welcome back, ${user.username}.`)).toBeVisible();

  await page.goto("/account");
  await page.getByLabel("Current password").fill("not-my-password");
  await page.getByLabel("New password", { exact: true }).fill("a-brand-new-password");
  await page.getByLabel("Confirm new password").fill("a-brand-new-password");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Your current password is incorrect.")).toBeVisible();
  await expect(page.getByRole("link", { name: user.username, exact: true }).first()).toBeVisible();

  await page.getByLabel("Current password").fill(user.password);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed. Other devices have been signed out.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible(); // still signed in

  await page.getByRole("button", { name: "Sign out" }).first().click();
  await signIn(page, user.username, user.password);
  await expect(page.getByText("Incorrect username or password.")).toBeVisible();
  await signIn(page, user.username, "a-brand-new-password");
  await expect(page.getByText(`Welcome back, ${user.username}.`)).toBeVisible();
});

test("repeated wrong passwords lock the account for a while", async ({ page, request }) => {
  const user = await createUser(request, uniqueName("locked"));
  for (let i = 0; i < 5; i++) {
    await signIn(page, user.username, `wrong-guess-${i}`);
    await expect(page.getByText("Incorrect username or password.")).toBeVisible();
  }
  await signIn(page, user.username, user.password);
  await expect(page.getByText("Too many failed attempts. Try again in 15 minutes.")).toBeVisible();
});
