import { expect, test, type Page } from "@playwright/test";
import { fields, mockApi, submitForm } from "./fixtures";

const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const photo = (page: Page, n: number) => page.getByRole("img", { name: `Test photo number ${n}` });

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  // Marker to prove Back/Forward never triggers a full page reload.
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
});

async function expectNoReload(page: Page) {
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
}

test("Back steps through card → image → form, and Forward returns", async ({ page }) => {
  await submitForm(page, "Other", "Mountains");
  await expect(photo(page, 1)).toBeVisible();
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(photo(page, 2)).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(heading(page)).toHaveText("Your chosen image");

  // Back from the card: the image step, showing the image that was accepted.
  await page.goBack();
  await expect(heading(page)).toHaveText("Do you like this image?");
  await expect(heading(page)).toBeFocused();
  await expect(photo(page, 2)).toBeVisible();

  // Back again: the form, with the details still filled in.
  await page.goBack();
  await expect(heading(page)).toHaveText("Find your image");
  await expect(heading(page)).toBeFocused();
  await expect(fields(page).name).toHaveValue("Ada");
  await expect(fields(page).surname).toHaveValue("Lovelace");
  await expect(fields(page).topic).toHaveValue("Other");
  await expect(fields(page).other).toHaveValue("Mountains");

  // Forward goes back through the same steps.
  await page.goForward();
  await expect(heading(page)).toHaveText("Do you like this image?");
  await expect(photo(page, 2)).toBeVisible();
  await page.goForward();
  await expect(heading(page)).toHaveText("Your chosen image");
  await expect(photo(page, 2)).toBeVisible();

  await expectNoReload(page);
});

test("Back to the image step never brings back a rejected image", async ({ page }) => {
  await submitForm(page, "Cars");
  await expect(photo(page, 1)).toBeVisible();
  await page.getByRole("button", { name: "Edit details" }).click();
  await expect(heading(page)).toHaveText("Find your image");

  // Return to the image step via Back, reject the image, then go Back and Forward again.
  await page.goBack();
  await expect(photo(page, 1)).toBeVisible();
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(photo(page, 2)).toBeVisible();

  await page.goBack(); // to the first form entry
  await page.goForward(); // to the image step: shows photo 2, never the rejected photo 1
  await expect(photo(page, 2)).toBeVisible();
  await expect(photo(page, 1)).toHaveCount(0);
  await expectNoReload(page);
});

test("Back after 'Start over' returns to the previous card", async ({ page }) => {
  await submitForm(page, "Wildlife");
  await expect(photo(page, 1)).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(heading(page)).toHaveText("Find your image");
  await expect(fields(page).name).toHaveValue("");

  await page.goBack();
  await expect(heading(page)).toHaveText("Your chosen image");
  await expect(page.getByText("Wildlife", { exact: true })).toBeVisible();
  await expectNoReload(page);
});
