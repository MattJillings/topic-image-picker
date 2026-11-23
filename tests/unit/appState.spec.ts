import { expect, test } from "@playwright/test";
import { appReducer, initialState, type AppState } from "../../src/lib/appState";
import { makeImage } from "../fixtures";

// Pure reducer tests: no browser or server involved.

const details = { name: "Ada", surname: "Lovelace", topic: "Cars" };
const img1 = makeImage(1);

const reviewing = (overrides: Partial<AppState> = {}): AppState => ({
  ...initialState,
  view: "review",
  details,
  image: img1,
  status: "ready",
  ...overrides,
});

test.describe("appReducer", () => {
  test("SUBMITTED moves to review, stores details and starts loading", () => {
    const s = appReducer({ ...initialState, error: "old" }, { type: "SUBMITTED", details });
    expect(s).toMatchObject({ view: "review", details, image: null, status: "loading", error: null });
  });

  test("LOADING keeps the current image (dimmed) and clears errors", () => {
    const s = appReducer(reviewing(), { type: "LOADING" });
    expect(s).toMatchObject({ status: "loading", image: img1, error: null });
  });

  test("IMAGE_SHOWN shows the image as ready", () => {
    const s = appReducer(reviewing({ image: null, status: "loading" }), { type: "IMAGE_SHOWN", image: img1 });
    expect(s).toMatchObject({ image: img1, status: "ready" });
  });

  test("LOAD_FAILED clears the image and records the error", () => {
    const s = appReducer(reviewing(), { type: "LOAD_FAILED", status: "rate_limited", message: "Slow down" });
    expect(s).toMatchObject({ image: null, status: "rate_limited", error: "Slow down" });
  });

  test("NO_MORE_IMAGES sets empty / exhausted", () => {
    expect(appReducer(reviewing(), { type: "NO_MORE_IMAGES", reason: "empty" }).status).toBe("empty");
    expect(appReducer(reviewing(), { type: "NO_MORE_IMAGES", reason: "exhausted" }).status).toBe("exhausted");
  });

  test("ACCEPTED only moves to the card when an image is ready", () => {
    expect(appReducer(reviewing(), { type: "ACCEPTED" }).view).toBe("card");

    const loading = reviewing({ status: "loading" });
    expect(appReducer(loading, { type: "ACCEPTED" })).toBe(loading);
    const noImage = reviewing({ image: null });
    expect(appReducer(noImage, { type: "ACCEPTED" })).toBe(noImage);
  });

  test("WENT_BACK returns to the form keeping the details", () => {
    const s = appReducer(reviewing(), { type: "WENT_BACK" });
    expect(s).toMatchObject({ view: "form", details });
  });

  test("STARTED_OVER resets everything and remounts the form", () => {
    const s = appReducer(reviewing({ view: "card", formKey: 3 }), { type: "STARTED_OVER" });
    expect(s).toEqual({ ...initialState, formKey: 4 });
  });

  test("RESTORED redraws a stored step, falling back to the form if it's incomplete", () => {
    const card = appReducer(initialState, { type: "RESTORED", view: "card", details, image: img1 });
    expect(card).toMatchObject({ view: "card", details, image: img1, status: "ready" });

    const reviewNoImage = appReducer(initialState, { type: "RESTORED", view: "review", details, image: null });
    expect(reviewNoImage).toMatchObject({ view: "review", image: null, status: "loading" });

    const brokenCard = appReducer(initialState, { type: "RESTORED", view: "card", details, image: null });
    expect(brokenCard).toMatchObject({ view: "form", details, formKey: 1 });
  });
});
