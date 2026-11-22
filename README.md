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

Navigation is state-driven (`form → review → card`) inside a single client component.

| Path | Purpose |
| --- | --- |
| `src/app/page.tsx` | View state, image paging/queue, session-level rejected-image tracking, focus management |
| `src/components/TopicForm.tsx` | Form with per-field validation, error summary and the conditional "Other" input |
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
  - errors are announced through an error summary and linked to each field with `aria-describedby`
  - focus is visible everywhere
  - focus moves to the heading when the view changes
  - status changes are announced through live regions
  - images use Unsplash's alt descriptions
  - Reject and Accept stay focusable while loading (`aria-disabled`)
  - everything works from the keyboard
  - reduced-motion preferences are respected

The app follows the [Unsplash API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines): images are hotlinked with plain `<img>` tags (not proxied through `next/image`), the photographer and Unsplash are credited with UTM links wherever a photo appears, and downloads are tracked on accept.

## Scripts

- `npm run dev`: start the dev server
- `npm run build` / `npm start`: production build and server
- `npm run lint`: run ESLint
