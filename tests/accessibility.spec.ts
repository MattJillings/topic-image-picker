import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { fields, mockApi, submitForm } from "./fixtures";

/** Runs axe-core with WCAG 2.0/2.1/2.2 A + AA rules. */
async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("nextjs-portal") // Next.js dev-mode overlay, not part of the app
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("form has no axe violations, including with errors shown", async ({ page }) => {
  await expectNoViolations(page);
  await fields(page).topic.selectOption("Other");
  await page.getByRole("button", { name: "Find an image" }).click();
  await expectNoViolations(page);
});

test("review and card views have no axe violations", async ({ page }) => {
  await mockApi(page);
  await submitForm(page, "Cars");
  await expect(page.getByRole("img", { name: "Test photo number 1" })).toBeVisible();
  await expectNoViolations(page);

  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your card");
  await expectNoViolations(page);
});

test("the whole flow can be completed with the keyboard only", async ({ page }) => {
  await mockApi(page);
  const kb = page.keyboard;

  await kb.press("Tab");
  await expect(fields(page).name).toBeFocused();
  await kb.type("Ada");
  await kb.press("Tab");
  await expect(fields(page).surname).toBeFocused();
  await kb.type("Lovelace");
  await kb.press("Tab");
  await expect(fields(page).topic).toBeFocused();
  await fields(page).topic.selectOption("Technology"); // native <select>: equivalent to arrow keys
  await kb.press("Tab");
  await expect(page.getByRole("button", { name: "Find an image" })).toBeFocused();
  await kb.press("Enter");

  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.getByRole("img", { name: "Test photo number 1" })).toBeVisible();

  // Tab forward to Reject and use it.
  const reject = page.getByRole("button", { name: "Reject" });
  for (let i = 0; i < 10 && !(await reject.evaluate((el) => el === document.activeElement)); i++) {
    await kb.press("Tab");
  }
  await expect(reject).toBeFocused();
  await kb.press("Enter");
  await expect(page.getByRole("img", { name: "Test photo number 2" })).toBeVisible();

  // Then Accept with Space.
  await kb.press("Tab");
  await expect(page.getByRole("button", { name: "Accept" })).toBeFocused();
  await kb.press("Space");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your card");
});

test("focused controls have a visible focus indicator", async ({ page }) => {
  await page.keyboard.press("Tab");
  const outline = await fields(page).name.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);
});
