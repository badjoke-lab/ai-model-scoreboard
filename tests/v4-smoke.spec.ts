import { test, expect } from "@playwright/test";

test("v4 leaderboard and model detail render", async ({ page }) => {
  await page.goto("/v4");

  const rows = page.locator("div.divide-y > a");
  await rows.first().waitFor();
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(50);

  await rows.first().click();
  await expect(page.getByRole("heading", { name: "Evidence" })).toBeVisible();

  const evidenceSection = page.locator("section", {
    has: page.getByRole("heading", { name: "Evidence" }),
  });
  await expect(evidenceSection.locator("div.rounded-2xl")).toHaveCount(4);
  await expect(page.locator("text=/no reason/i")).toHaveCount(0);
});
