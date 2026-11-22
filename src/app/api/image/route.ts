import { NextResponse, type NextRequest } from "next/server";
import { getUnsplash, UTM } from "@/lib/unsplash";
import { MAX_TOPIC_LENGTH, type ApiError, type ApiErrorCode, type ImagePage, type UnsplashImage } from "@/lib/types";

export const dynamic = "force-dynamic";

const PER_PAGE = 30;

function fail(error: string, code: ApiErrorCode, status: number) {
  return NextResponse.json<ApiError>({ error, code }, { status });
}

/** GET /api/image?topic=cars&page=1 → one page of landscape photos matching the topic. */
export async function GET(req: NextRequest): Promise<NextResponse<ImagePage | ApiError>> {
  const topic = req.nextUrl.searchParams.get("topic")?.trim() ?? "";
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");

  if (!topic) return fail("A topic is required.", "bad_request", 400);
  if (topic.length > MAX_TOPIC_LENGTH) {
    return fail(`Topic must be ${MAX_TOPIC_LENGTH} characters or fewer.`, "bad_request", 400);
  }
  if (!Number.isInteger(page) || page < 1) return fail("Invalid page.", "bad_request", 400);

  let unsplash;
  try {
    unsplash = getUnsplash();
  } catch (err) {
    console.error(err);
    return fail("The image service is not configured. Please try again later.", "config", 500);
  }

  try {
    const { data, error, response } = await unsplash.GET("/search/photos", {
      params: {
        query: { query: topic, page, per_page: PER_PAGE, orientation: "landscape", content_filter: "high" },
      },
      cache: "no-store",
    });

    // Unsplash signals rate limiting with 403 + "Rate Limit Exceeded" (and X-Ratelimit-Remaining: 0).
    const remaining = response.headers.get("X-Ratelimit-Remaining");
    const rateLimitBody = typeof error === "string" && /rate limit/i.test(error);
    if (response.status === 429 || (response.status === 403 && (remaining === "0" || rateLimitBody))) {
      return fail(
        "We've reached the hourly limit for image requests. Please wait a few minutes and try again.",
        "rate_limited",
        429,
      );
    }

    if (!response.ok || !data) {
      console.error("Unsplash search failed with status", response.status);
      return fail("We couldn't load images right now. Please try again.", "upstream", 502);
    }

    const images: UnsplashImage[] = data.results.map((photo) => {
      // alt_description is returned by the API but missing from the generated types.
      const altDescription = (photo as { alt_description?: string | null }).alt_description;
      return {
        id: photo.id,
        alt: altDescription || photo.description || `Photo for "${topic}" by ${photo.user.name}`,
        urls: { regular: photo.urls.regular, small: photo.urls.small, thumb: photo.urls.thumb },
        photographer: {
          name: photo.user.name,
          profileUrl: `${photo.user.links.html}?${UTM}`,
        },
        unsplashUrl: `${photo.links.html}?${UTM}`,
      };
    });

    return NextResponse.json<ImagePage>({ images, page, totalPages: data.total_pages, total: data.total });
  } catch (err) {
    console.error("Unsplash request failed:", err);
    return fail("We couldn't reach the image service. Please check your connection and try again.", "upstream", 502);
  }
}
