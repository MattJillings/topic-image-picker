import { NextResponse, type NextRequest } from "next/server";
import { getUnsplash } from "@/lib/unsplash";

/**
 * POST /api/image/download { id }
 * Unsplash's API guidelines require triggering this endpoint when a user "uses" a photo.
 */
export async function POST(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id?: unknown };

    if (typeof id !== "string" || !/^[\w-]+$/.test(id)) {
      return NextResponse.json({ error: "Invalid photo id." }, { status: 400 });
    }

    const { error } = await getUnsplash().GET("/photos/{id}/download", {
      params: { path: { id } },
    });
    if (error) throw new Error(error.errors?.join(", "));

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Unsplash download tracking failed:", err);
    return NextResponse.json({ error: "Failed to track download." }, { status: 500 });
  }
}
