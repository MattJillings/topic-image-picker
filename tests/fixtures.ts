import type { Page, Route } from "@playwright/test";
import type { ApiError, ImagePage, UnsplashImage } from "../src/lib/types";

/** A tiny valid PNG so <img> elements load without hitting the Unsplash CDN. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

export function makeImage(n: number): UnsplashImage {
  return {
    id: `photo-${n}`,
    alt: `Test photo number ${n}`,
    urls: {
      regular: `https://images.unsplash.com/photo-${n}?w=1080`,
      small: `https://images.unsplash.com/photo-${n}?w=400`,
      thumb: `https://images.unsplash.com/photo-${n}?w=200`,
    },
    photographer: { name: `Photographer ${n}`, profileUrl: `https://unsplash.com/@p${n}?utm_source=test` },
    unsplashUrl: `https://unsplash.com/photos/photo-${n}?utm_source=test`,
  };
}

type Responder = (url: URL) => { status: number; body: ImagePage | ApiError };

/** Builds a responder that serves `count` images across pages of `perPage`. */
export function pagedImages(count: number, perPage = 3): Responder {
  const totalPages = Math.ceil(count / perPage);
  return (url) => {
    const page = Number(url.searchParams.get("page") ?? "1");
    const start = (page - 1) * perPage;
    const images = Array.from({ length: Math.max(0, Math.min(perPage, count - start)) }, (_, i) =>
      makeImage(start + i + 1),
    );
    return { status: 200, body: { images, page, totalPages, total: count } };
  };
}

export interface MockApi {
  /** Every request made to GET /api/image. */
  imageRequests: URL[];
  /** Bodies POSTed to /api/image/download. */
  downloads: unknown[];
  /** Swap the responder mid-test (e.g. to simulate a failure on the next request). */
  respondWith(responder: Responder): void;
}

/** Mocks the app's API routes and the Unsplash image CDN. */
export async function mockApi(page: Page, responder: Responder = pagedImages(5)): Promise<MockApi> {
  let current = responder;
  const api: MockApi = {
    imageRequests: [],
    downloads: [],
    respondWith: (r) => {
      current = r;
    },
  };

  await page.route("**/api/image?*", async (route: Route) => {
    const url = new URL(route.request().url());
    api.imageRequests.push(url);
    const { status, body } = current(url);
    await route.fulfill({ status, json: body });
  });

  await page.route("**/api/image/download", async (route) => {
    api.downloads.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });

  await page.route("https://images.unsplash.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG }),
  );

  return api;
}

/** Fills and submits the form with valid details. */
export async function submitForm(page: Page, topic = "Cars", other?: string) {
  await fields(page).name.fill("Ada");
  await fields(page).surname.fill("Lovelace");
  await fields(page).topic.selectOption(topic);
  if (other !== undefined) await fields(page).other.fill(other);
  await page.getByRole("button", { name: "Find an image" }).click();
}

/** Form field locators (anchored so "Name" doesn't also match "Surname"). */
export function fields(page: Page) {
  return {
    name: page.getByRole("textbox", { name: /^Name/ }),
    surname: page.getByRole("textbox", { name: /^Surname/ }),
    topic: page.getByRole("combobox", { name: /^Preferred topic/ }),
    other: page.getByRole("textbox", { name: /^Your topic/ }),
  };
}
