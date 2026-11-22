import "server-only";
import { createApi } from "unsplash-js";

let client: ReturnType<typeof createApi> | null = null;

/** Lazily creates the Unsplash client so the access key is only read on the server, at request time. */
export function getUnsplash() {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    throw new Error("UNSPLASH_ACCESS_KEY is not set. Add it to .env.local (see .env.example).");
  }
  client ??= createApi({ accessKey });
  return client;
}

// UTM params Unsplash asks apps to add to photographer / photo links.
export const UTM = "utm_source=topic_image_picker&utm_medium=referral";
