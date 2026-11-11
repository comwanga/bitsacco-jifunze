import { expect, test } from "@playwright/test";

test("a stale tab preserves another tab's completion when it next writes progress", async ({ context, page }) => {
  // Deliberately delay the cache notification. Real background tabs can receive it after a user write.
  await context.addInitScript(() => window.addEventListener("storage", (e) => e.stopImmediatePropagation()));
  await page.goto("/en/savers/money-and-bitcoin/");
  await page.getByRole("button", { name: "I have written or discussed reasoned answers", exact: true }).click();
  const other = await context.newPage();
  await other.goto("/sw/savers/wallets-keys/");
  await other.getByRole("button", { name: "Nimeandika au kujadili majibu yenye sababu", exact: true }).click();
  await expect(other.getByRole("button", { name: "Nimemaliza somo hili", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "I've finished this lesson", exact: true }).click();
  await expect(page.getByRole("button", { name: "I've finished this lesson", exact: true })).toHaveCount(0);
  await other.getByRole("button", { name: "Nimemaliza somo hili", exact: true }).click();
  const lessons = await other.evaluate(() => JSON.parse(localStorage.getItem("jifunze:progress:v1")!).lessons);
  expect(lessons["savers/money-and-bitcoin"]?.completedAt).toBeTruthy();
  expect(lessons["savers/wallets-keys"]?.completedAt).toBeTruthy();
  await other.reload();
  await other.locator('header a[hreflang="en"]').click();
  await expect(other.getByText("Lesson finished")).toBeVisible();
});
