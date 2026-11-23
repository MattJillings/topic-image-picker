# Topic Image Picker

A small Next.js (App Router) + TypeScript + Tailwind CSS app:

1. Enter your **Name**, **Surname** and a **Preferred Topic** (Travel, Cars, Wildlife, Technology, or Other with a free-text topic).
2. A matching photo is fetched from **Unsplash**. **Reject** fetches another one; **Accept** moves on.
3. A card shows your name, surname and a thumbnail of the chosen photo.

## Setup

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local   # then paste your Unsplash Access Key into .env.local
npm run dev                  # http://localhost:3000
```

Get a free key at <https://unsplash.com/developers> → **New Application** → copy the **Access Key**.
The demo tier allows 50 requests/hour.

## How it works

Navigation is state-driven (`form → review → card`) inside a single client component. Each step is also pushed onto the browser history (`history.pushState`, merged with Next.js's own history state). The browser's Back and Forward buttons move between steps without a page reload. They restore the entered details and the image that was on screen, and never bring back a rejected image. A reload starts again at the form.

| Path | Purpose |
| --- | --- |
| `src/app/page.tsx` | View state, image paging/queue, session-level rejected-image tracking, focus management |
| `src/components/TopicForm.tsx` | Form with per-field validation, required-field asterisks and the conditional "Other" input |
| `src/components/ImageReview.tsx` | Image preview with Accept / Reject and loading, error, rate-limit and empty states |
| `src/components/ProfileCard.tsx` | Final card with name, surname, thumbnail and attribution |
| `src/components/Attribution.tsx` | "Photo by X on Unsplash" credit |
| `src/app/api/image/route.ts` | Server route that calls Unsplash's `/search/photos` endpoint via `unsplash-js` |
| `src/app/api/image/download/route.ts` | Triggers Unsplash download tracking when a photo is accepted |
| `src/lib/unsplash.ts` | Server-only Unsplash client (the access key never reaches the browser) |

### Behaviour

- **Validation:** Name, Surname and Topic are required and trimmed. The "Other" topic is required when shown and capped at 50 characters, and the API checks the cap too.
- **Reject:** rejected photo IDs are kept in `sessionStorage`, so a rejected image is never shown again in the same browser session. Results are paged 30 at a time and filtered.
- **States:** loading, network/API errors (with "Try again"), Unsplash rate limiting (403/429), no results, and "all images seen". A photo that fails to load is skipped.
- **Accessibility (WCAG 2.2 AA):**
  - every input has a label, and required fields are marked
  - required fields are marked with an asterisk (explained by a "* Required fields" note) and the `required` attribute
  - errors appear beside each field and are linked to it with `aria-describedby`; on a failed submit, focus moves to the first invalid field so its error is announced
  - focus is visible everywhere
  - focus moves to the heading when the view changes
  - status changes are announced through live regions
  - images use Unsplash's alt descriptions
  - Reject and Accept stay focusable while loading (`aria-disabled`)
  - everything works from the keyboard
  - reduced-motion preferences are respected

The app follows the [Unsplash API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines): images are hotlinked with plain `<img>` tags (not proxied through `next/image`), the photographer and Unsplash are credited with UTM links wherever a photo appears, and downloads are tracked on accept.

## Access key handling: server-side proxy vs client-side key

This app uses the approach Unsplash recommends: all Unsplash API calls go through the app's own server routes.

```
Browser ──► /api/image (Next.js route handler) ──► api.unsplash.com   (key added here, server-side)
Browser ──► images.unsplash.com                                      (images hotlinked directly, no key needed)
```

- `UNSPLASH_ACCESS_KEY` is read only in `src/lib/unsplash.ts`, which imports `server-only`. The build fails if that module is ever imported into client code.
- The variable has no `NEXT_PUBLIC_` prefix, so Next.js never puts it in the browser bundle.
- The key lives in `.env.local`, which is git-ignored. `.env.example` holds only a placeholder.

### The trade-off

| | Server-side proxy (this app) | Client-side key (allowed alternative) |
| --- | --- | --- |
| **Key confidentiality** | The key never leaves the server and can't be seen in DevTools or the page source. | The key is in the JavaScript bundle and every request header, so anyone can copy it. |
| **Abuse / rate limit** | Others can't spend your 50 requests/hour (Demo) quota directly, only through your app. | Anyone with the copied key can use up your quota or break Unsplash's terms in your name. That can get the key or app suspended. |
| **Hosting** | Needs a server or serverless runtime (Node, Vercel, etc.), not just static files. | Can run as a purely static site (e.g. GitHub Pages). |
| **Complexity** | One extra hop and two small route handlers to maintain. | Simpler: the browser calls Unsplash directly. |
| **Latency** | One extra network hop through your server for API calls. Image downloads are unaffected because they're hotlinked from the CDN. | Slightly faster API calls. |
| **Control** | The server can validate input (e.g. the 50-character topic cap), shape and trim responses, map errors (e.g. rate limiting → a friendly message), and add caching or rate limiting later. | Input checks and error mapping happen only in the browser and can be bypassed. |

A client-side key would be acceptable for a throwaway demo. This project already needs a server for Next.js, so the proxy costs very little and avoids publishing a credential. If this were run in production, the next steps would be to:
- add per-IP rate limiting on `/api/image`
- cache popular search results
- apply for Unsplash Production access, which raises the limit to 5,000 requests/hour

## Scripts

- `npm run dev`: start the dev server
- `npm run build` / `npm start`: production build and server
- `npm run lint`: run ESLint
- `npm test`: run the Playwright end-to-end tests (starts a dev server on port 3100 automatically)
- `npm run test:ui`: open Playwright's interactive UI to watch and debug tests

## Tests

The Playwright tests in `tests/` mock `/api/image` and the Unsplash CDN in the browser, so they need no access key and use none of your rate limit. First-time setup: `npx playwright install chromium`.

| File | Covers |
| --- | --- |
| `tests/form.spec.ts` | Required fields, trimming, whitespace-only input, focus on the first invalid field, asterisks and required-fields note, live re-validation, the "Other" field (shown only when selected, required, 50-character cap) |
| `tests/flow.spec.ts` | Submit → accept → card, edit details, reject without repeats (including after a reload), loading, error, network failure, rate-limit, empty and "all seen" states, broken images, hotlinking and attribution |
| `tests/history.spec.ts` | Browser Back/Forward between steps (values and image restored, no reload, rejected images stay hidden, Back after Start over) |
| `tests/accessibility.spec.ts` | axe-core WCAG 2.2 AA scan of every view, keyboard-only completion of the flow, focus moved on view change, visible focus indicator |

After a run, `npx playwright show-report` opens the HTML report.
