export const TOPICS = ["Travel", "Cars", "Wildlife", "Technology", "Other"] as const;

export type Topic = (typeof TOPICS)[number];

/** Maximum length of the free-text "Other" topic (after trimming). */
export const MAX_TOPIC_LENGTH = 50;

export interface UserDetails {
  name: string;
  surname: string;
  /** The resolved search term: the selected topic, or the custom text when "Other" is chosen. */
  topic: string;
}

export interface UnsplashImage {
  id: string;
  /** Meaningful alt text for the image. */
  alt: string;
  /** Hotlinked Unsplash CDN URLs (must be used as-is, per the Unsplash API guidelines). */
  urls: {
    regular: string;
    small: string;
    thumb: string;
  };
  photographer: {
    name: string;
    profileUrl: string;
  };
  unsplashUrl: string;
}

/** One page of search results from GET /api/image. */
export interface ImagePage {
  images: UnsplashImage[];
  page: number;
  totalPages: number;
  total: number;
}

export type ApiErrorCode = "bad_request" | "rate_limited" | "config" | "upstream";

export interface ApiError {
  error: string;
  code: ApiErrorCode;
}
