import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { searchPlacesForUser } from "@/lib/services/places";
import { PlaceProviderError } from "@/lib/places/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to search for places." }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const city = request.nextUrl.searchParams.get("city");
  if (query.length < 2) {
    return NextResponse.json({
      results: [],
      provider: { id: "demo", label: "Demo Cyprus dataset", mode: "demo", configured: true },
    });
  }

  try {
    const response = await searchPlacesForUser(user.id, query, {
      city: city && city.length > 0 ? city : null,
      limit: 8,
    });
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof PlaceProviderError) {
      const status = error.code === "rate_limited" ? 429 : error.code === "not_found" ? 404 : 503;
      return NextResponse.json(
        {
          error:
            error.code === "rate_limited"
              ? "The place provider is rate limiting us. Try again shortly."
              : error.message,
        },
        { status },
      );
    }
    console.error("place search failed", error);
    return NextResponse.json({ error: "Place search failed. Please try again." }, { status: 500 });
  }
}
