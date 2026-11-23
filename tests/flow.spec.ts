import { expect, test } from "@playwright/test";
import { fields, mockApi, pagedImages, submitForm } from "./fixtures";

const heading = (page: import("@playwright/test").Page) => page.getByRole("heading", { level: 1 });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("submit → accept → card, with focus moved to each new view's heading", async ({ page }) => {
  const api = await mockApi(page);
  await submitForm(page, "Cars");

  await expect(heading(page)).toHaveText("Do you like this image?");
  await expect(heading(page)).toBeFocused();
  await expect(page.getByRole("img", { name: "Test photo number 1" })).toBeVisible();

  await page.getByRole("button", { name: "Accept" }).click();

  await expect(heading(page)).toHaveText("Your card");
  await expect(heading(page)).toBeFocused();
  await expect(page.getByText("Ada", { exact: true })).toBeVisible();
  await expect(page.getByText("Lovelace", { exact: true })).toBeVisible();
  await expect(page.getByText("Cars", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Test photo number 1" })).toBeVisible();

  // Unsplash download tracking fires on accept.
  await expect.poll(() => api.downloads).toEqual([{ id: "photo-1" }]);

  await page.getByRole("button", { name: "Start over" }).click();
  await expect(heading(page)).toHaveText("Tell us about yourself");
  await expect(heading(page)).toBeFocused();
  await expect(fields(page).name).toHaveValue("");
});

test("'Edit details' returns to the form with values kept", async ({ page }) => {
  await mockApi(page);
  await submitForm(page, "Other", "Mountains");
  await page.getByRole("button", { name: "Edit details" }).click();

  await expect(heading(page)).toHaveText("Tell us about yourself");
  await expect(fields(page).name).toHaveValue("Ada");
  await expect(fields(page).surname).toHaveValue("Lovelace");
  await expect(fields(page).topic).toHaveValue("Other");
  await expect(fields(page).other).toHaveValue("Mountains");
});

test.describe("Reject", () => {
  test("shows a different image each time and never repeats a rejected one", async ({ page }) => {
    // 5 images over 2 pages of 3, so rejecting walks across a page boundary.
    await mockApi(page, pagedImages(5, 3));
    await submitForm(page, "Cars");

    const seen: string[] = [];
    for (let n = 1; n <= 5; n++) {
      const img = page.getByRole("img", { name: `Test photo number ${n}` });
      await expect(img).toBeVisible();
      seen.push((await img.getAttribute("alt"))!);
      if (n < 5) await page.getByRole("button", { name: "Reject" }).click();
    }
    expect(new Set(seen).size).toBe(5);
  });

  test("rejected images stay hidden for the session, even after a reload", async ({ page }) => {
    await mockApi(page, pagedImages(5, 3));
    await submitForm(page, "Cars");
    await expect(page.getByRole("img", { name: "Test photo number 1" })).toBeVisible();
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByRole("img", { name: "Test photo number 2" })).toBeVisible();
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByRole("img", { name: "Test photo number 3" })).toBeVisible();

    await page.reload();
    await submitForm(page, "Cars");

    // Photos 1 and 2 were rejected, so the first image shown is photo 3.
    await expect(page.getByRole("img", { name: "Test photo number 3" })).toBeVisible();
  });

  test("once every image is rejected, an 'all seen' state is shown with a way back", async ({ page }) => {
    await mockApi(page, pagedImages(2, 3));
    await submitForm(page, "Cars");

    await expect(page.getByRole("img", { name: "Test photo number 1" })).toBeVisible();
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByRole("img", { name: "Test photo number 2" })).toBeVisible();
    await page.getByRole("button", { name: "Reject" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "No more new images" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept" })).toHaveAttribute("aria-disabled", "true");

    await page.getByRole("button", { name: "Change topic" }).click();
    await expect(heading(page)).toHaveText("Tell us about yourself");
  });
});

test.describe("States", () => {
  test("loading: status is announced and buttons stay focusable but inactive", async ({ page }) => {
    await mockApi(page);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    // Hold the API response until we've checked the loading state.
    await page.route("**/api/image?*", async (route) => {
      await gate;
      await route.fallback();
    });

    await submitForm(page, "Cars");
    await expect(page.getByRole("status")).toHaveText("Loading image…");
    const reject = page.getByRole("button", { name: "Reject" });
    await expect(reject).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("button", { name: "Accept" })).toHaveAttribute("aria-disabled", "true");

    release();
    await expect(page.getByRole("img", { name: "Test photo number 1" })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText(/Showing image: Test photo number 1\. Photo by Photographer 1\./);
    await expect(reject).not.toHaveAttribute("aria-disabled", "true");
  });

  test("keyboard focus stays on Reject while the next image loads", async ({ page }) => {
    await mockApi(page);
    await submitForm(page, "Cars");
    await expect(page.getByRole("img", { name: "Test photo number 1" })).toBeVisible();

    const reject = page.getByRole("button", { name: "Reject" });
    await reject.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("img", { name: "Test photo number 2" })).toBeVisible();
    await expect(reject).toBeFocused();
  });

  test("empty result: no images found for the topic", async ({ page }) => {
    await mockApi(page, () => ({ status: 200, body: { images: [], page: 1, totalPages: 0, total: 0 } }));
    await submitForm(page, "Other", "zzzqqq");

    await expect(page.getByRole("alert").filter({ hasText: "No images found" })).toContainText('"zzzqqq"');
    await expect(page.getByRole("button", { name: "Change topic" })).toBeVisible();
  });

  test("error: shows the message and 'Try again' recovers", async ({ page }) => {
    const api = await mockApi(page, () => ({
      status: 502,
      body: { error: "We couldn't load images right now. Please try again.", code: "upstream" },
    }));
    await submitForm(page, "Cars");

    const alert = page.getByRole("alert").filter({ hasText: "Something went wrong" });
    await expect(alert).toContainText("We couldn't load images right now.");

    api.respondWith(pagedImages(3));
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("img", { name: "Test photo number 1" })).toBeVisible();
    await expect(alert).toHaveCount(0);
  });

  test("network failure is handled", async ({ page }) => {
    await mockApi(page);
    await page.route("**/api/image?*", (route) => route.abort("failed"));
    await submitForm(page, "Cars");
    await expect(page.getByRole("alert").filter({ hasText: "Network error" })).toBeVisible();
  });

  test("rate limit: shows a specific message and 'Try again'", async ({ page }) => {
    await mockApi(page, () => ({
      status: 429,
      body: { error: "We've reached the hourly limit for image requests.", code: "rate_limited" },
    }));
    await submitForm(page, "Cars");

    await expect(page.getByRole("alert").filter({ hasText: "Too many requests" })).toContainText("hourly limit");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept" })).toHaveAttribute("aria-disabled", "true");
  });

  test("an image that fails to load is skipped", async ({ page }) => {
    await mockApi(page);
    await page.route("https://images.unsplash.com/photo-1?*", (route) => route.fulfill({ status: 404 }));
    await submitForm(page, "Cars");
    await expect(page.getByRole("img", { name: "Test photo number 2" })).toBeVisible();
  });
});

test.describe("Unsplash guidelines", () => {
  test("images are hotlinked and the photographer is credited on both views", async ({ page }) => {
    await mockApi(page);
    await submitForm(page, "Cars");

    const img = page.getByRole("img", { name: "Test photo number 1" });
    await expect(img).toHaveAttribute("src", /^https:\/\/images\.unsplash\.com\//);
    await expect(page.getByRole("link", { name: /Photographer 1/ })).toHaveAttribute("href", /unsplash\.com\/@p1/);
    await expect(page.getByRole("link", { name: /^Unsplash/ })).toHaveAttribute("href", /unsplash\.com\/photos\//);

    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByRole("img", { name: "Test photo number 1" })).toHaveAttribute(
      "src",
      /^https:\/\/images\.unsplash\.com\//,
    );
    await expect(page.getByRole("link", { name: /Photographer 1/ })).toBeVisible();
  });
});
