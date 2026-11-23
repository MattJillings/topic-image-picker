import type { UnsplashImage, UserDetails } from "./types";

/**
 * App state management: a single reducer (React `useReducer`) owns all the state that drives what's
 * on screen. Components never change state directly; the page dispatches named actions describing
 * what happened, and this pure function decides the next state. Side effects (fetching images,
 * browser history, focus) live in the page component and dispatch actions with their results.
 */

export type View = "form" | "review" | "card";

export type ReviewStatus = "loading" | "ready" | "error" | "rate_limited" | "empty" | "exhausted";

export interface AppState {
  view: View;
  details: UserDetails | null;
  image: UnsplashImage | null;
  status: ReviewStatus;
  error: string | null;
  /** Bumped whenever the form should remount with fresh initial values (e.g. restored from history). */
  formKey: number;
}

export type AppAction =
  /** The form was submitted with valid details: go to the review step and start loading. */
  | { type: "SUBMITTED"; details: UserDetails }
  /** A new image is being fetched (reject, retry, or skipping a broken image). */
  | { type: "LOADING" }
  /** The next image is ready to show. */
  | { type: "IMAGE_SHOWN"; image: UnsplashImage }
  /** Fetching failed. */
  | { type: "LOAD_FAILED"; status: "error" | "rate_limited"; message: string }
  /** There's nothing (more) to show for this topic. */
  | { type: "NO_MORE_IMAGES"; reason: "empty" | "exhausted" }
  /** The user accepted the current image. */
  | { type: "ACCEPTED" }
  /** The user chose "Edit details" / "Change topic": back to the form with their values. */
  | { type: "WENT_BACK" }
  /** The user chose "Start over": back to an empty form. */
  | { type: "STARTED_OVER" }
  /** Browser Back/Forward landed on a stored step. */
  | { type: "RESTORED"; view: View; details: UserDetails | null; image: UnsplashImage | null };

export const initialState: AppState = {
  view: "form",
  details: null,
  image: null,
  status: "loading",
  error: null,
  formKey: 0,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SUBMITTED":
      return { ...state, view: "review", details: action.details, image: null, status: "loading", error: null };

    case "LOADING":
      // Keep the current image on screen (dimmed) until the next one arrives.
      return { ...state, status: "loading", error: null };

    case "IMAGE_SHOWN":
      return { ...state, image: action.image, status: "ready", error: null };

    case "LOAD_FAILED":
      return { ...state, image: null, status: action.status, error: action.message };

    case "NO_MORE_IMAGES":
      return { ...state, image: null, status: action.reason, error: null };

    case "ACCEPTED":
      // Only a ready image can be accepted.
      return state.status === "ready" && state.image ? { ...state, view: "card" } : state;

    case "WENT_BACK":
      return { ...state, view: "form", error: null };

    case "STARTED_OVER":
      return { ...initialState, formKey: state.formKey + 1 };

    case "RESTORED": {
      const { view, details, image } = action;
      if (view === "card" && details && image) {
        return { ...state, view: "card", details, image, status: "ready", error: null };
      }
      if (view === "review" && details) {
        // With no image to restore, the page fetches the next one.
        return image
          ? { ...state, view: "review", details, image, status: "ready", error: null }
          : { ...state, view: "review", details, image: null, status: "loading", error: null };
      }
      // Anything else (including an incomplete entry) falls back to the form.
      return { ...state, view: "form", details, image: null, error: null, formKey: state.formKey + 1 };
    }
  }
}
