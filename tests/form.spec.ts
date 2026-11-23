import { expect, test } from "@playwright/test";
import { fields, mockApi, submitForm } from "./fixtures";

test.describe("Topic form validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("all fields are required: empty submit highlights each field, with no summary box", async ({ page }) => {
    const api = await mockApi(page);
    await page.getByRole("button", { name: "Find an image" }).click();

    const f = fields(page);
    for (const field of [f.name, f.surname, f.topic]) {
      await expect(field).toHaveAttribute("aria-invalid", "true");
    }
    // Errors are shown beside, and programmatically associated with, their fields.
    await expect(f.name).toHaveAccessibleDescription(/Enter your name\./);
    await expect(f.surname).toHaveAccessibleDescription(/Enter your surname\./);
    await expect(f.topic).toHaveAccessibleDescription(/Choose a preferred topic\./);

    await expect(page.getByText(/There (is a problem|are \d+ problems)/)).toHaveCount(0);

    // Focus moves to the first invalid field so its error is announced.
    await expect(f.name).toBeFocused();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find your image");
    expect(api.imageRequests).toHaveLength(0);
  });

  test("whitespace-only name and surname are rejected", async ({ page }) => {
    const f = fields(page);
    await f.name.fill("   ");
    await f.surname.fill("\t ");
    await f.topic.selectOption("Travel");
    await page.getByRole("button", { name: "Find an image" }).click();

    await expect(f.name).toHaveAttribute("aria-invalid", "true");
    await expect(f.surname).toHaveAttribute("aria-invalid", "true");
    await expect(f.topic).toHaveAttribute("aria-invalid", "false");
  });

  test("focus goes to the first invalid field, not always the first field", async ({ page }) => {
    await fields(page).name.fill("Ada");
    await page.getByRole("button", { name: "Find an image" }).click();
    await expect(fields(page).surname).toBeFocused();
  });

  test("errors clear as the user fixes them", async ({ page }) => {
    await page.getByRole("button", { name: "Find an image" }).click();
    await fields(page).name.fill("Ada");

    await expect(fields(page).name).toHaveAttribute("aria-invalid", "false");
    await expect(page.getByText("Enter your name.")).toHaveCount(0);
    await expect(page.getByText("Enter your surname.")).toBeVisible();
  });

  test("labels show an asterisk and the required-fields note sits below the submit button", async ({ page }) => {
    for (const text of ["Name", "Surname", "Preferred topic"]) {
      await expect(page.locator("label", { hasText: text }).first()).toContainText("*");
    }
    // The asterisk is decorative; the fields themselves are marked required for assistive tech.
    await expect(fields(page).name).toHaveAccessibleName("Name");
    await expect(fields(page).name).toHaveAttribute("required", "");

    const note = page.getByText("Required fields");
    await expect(note).toContainText("* Required fields");
    const buttonBox = (await page.getByRole("button", { name: "Find an image" }).boundingBox())!;
    const noteBox = (await note.boundingBox())!;
    expect(noteBox.y).toBeGreaterThan(buttonBox.y + buttonBox.height);
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

    await expect(page.getByText("Enter your topic.")).toBeVisible();
    await expect(fields(page).other).toBeFocused();
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
