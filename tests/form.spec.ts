import { expect, test } from "@playwright/test";
import { fields, mockApi, submitForm } from "./fixtures";

test.describe("Topic form validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("all fields are required: empty submit shows an error summary and per-field errors", async ({ page }) => {
    const api = await mockApi(page);
    await page.getByRole("button", { name: "Find an image" }).click();

    const summary = page.getByRole("alert").filter({ hasText: "There are 3 problems" });
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(summary.getByRole("link")).toHaveText(["Enter your name.", "Enter your surname.", "Choose a preferred topic."]);

    const f = fields(page);
    for (const field of [f.name, f.surname, f.topic]) {
      await expect(field).toHaveAttribute("aria-invalid", "true");
    }
    // Errors are programmatically associated with their fields.
    await expect(f.name).toHaveAccessibleDescription(/Enter your name\./);
    await expect(f.surname).toHaveAccessibleDescription(/Enter your surname\./);
    await expect(f.topic).toHaveAccessibleDescription(/Choose a preferred topic\./);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tell us about yourself");
    expect(api.imageRequests).toHaveLength(0);
  });

  test("whitespace-only name and surname are rejected", async ({ page }) => {
    const f = fields(page);
    await f.name.fill("   ");
    await f.surname.fill("\t ");
    await f.topic.selectOption("Travel");
    await page.getByRole("button", { name: "Find an image" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "There are 2 problems" })).toBeVisible();
    await expect(f.name).toHaveAttribute("aria-invalid", "true");
    await expect(f.surname).toHaveAttribute("aria-invalid", "true");
    await expect(f.topic).toHaveAttribute("aria-invalid", "false");
  });

  test("error summary links move focus to the field", async ({ page }) => {
    await page.getByRole("button", { name: "Find an image" }).click();
    await page.getByRole("link", { name: "Enter your surname." }).click();
    await expect(fields(page).surname).toBeFocused();
  });

  test("errors clear as the user fixes them", async ({ page }) => {
    await page.getByRole("button", { name: "Find an image" }).click();
    await fields(page).name.fill("Ada");

    await expect(fields(page).name).toHaveAttribute("aria-invalid", "false");
    await expect(page.getByRole("alert").filter({ hasText: "There are 2 problems" })).toBeVisible();
  });

  test("values are trimmed before use", async ({ page }) => {
    const api = await mockApi(page);
    const f = fields(page);
    await f.name.fill("  Ada  ");
    await f.surname.fill("  Lovelace ");
    await f.topic.selectOption("Other");
    await f.other.fill("   Coffee   ");
    await page.getByRole("button", { name: "Find an image" }).click();

    await expect(page.getByRole("heading", { level: 2 })).toHaveText("Image for Coffee");
    expect(api.imageRequests[0].searchParams.get("topic")).toBe("Coffee");

    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByText("Ada", { exact: true })).toBeVisible();
    await expect(page.getByText("Lovelace", { exact: true })).toBeVisible();
  });
});

test.describe("'Other' topic input", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("is only shown when 'Other' is selected", async ({ page }) => {
    const f = fields(page);
    await expect(f.other).toHaveCount(0);
    await f.topic.selectOption("Other");
    await expect(f.other).toBeVisible();
    await f.topic.selectOption("Cars");
    await expect(f.other).toHaveCount(0);
  });

  test("selecting 'Other' does not steal focus from the dropdown", async ({ page }) => {
    const topic = fields(page).topic;
    await topic.focus();
    // Arrow through the options as a keyboard user would; "Other" is last.
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowDown");
    await expect(topic).toHaveValue("Other");
    await expect(fields(page).other).toBeVisible();
    await expect(topic).toBeFocused();
  });

  test("is required when visible (whitespace counts as empty)", async ({ page }) => {
    const api = await mockApi(page);
    await submitForm(page, "Other", "    ");

    await expect(page.getByRole("link", { name: "Enter your topic." })).toBeVisible();
    await expect(fields(page).other).toHaveAttribute("aria-invalid", "true");
    expect(api.imageRequests).toHaveLength(0);
  });

  test("is not required once hidden again", async ({ page }) => {
    await mockApi(page);
    const f = fields(page);
    await f.topic.selectOption("Other");
    await f.topic.selectOption("Wildlife");
    await submitForm(page, "Wildlife");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Do you like this image?");
  });

  test("is capped at 50 characters with a live character count", async ({ page }) => {
    const f = fields(page);
    await f.topic.selectOption("Other");
    await f.other.fill("x".repeat(60));

    await expect(f.other).toHaveValue("x".repeat(50));
    await expect(page.getByText("50 of 50 characters used")).toBeVisible();
    await expect(f.other).toHaveAccessibleDescription(/Up to 50 characters/);
  });

  test("accepts exactly 50 characters", async ({ page }) => {
    const api = await mockApi(page);
    await submitForm(page, "Other", "y".repeat(50));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Do you like this image?");
    expect(api.imageRequests[0].searchParams.get("topic")).toBe("y".repeat(50));
  });
});
