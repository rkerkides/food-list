import { getSessionUser } from "@/lib/auth/session";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * A deliberately small, authenticated proxy for one-off starting-point lookups.
 * The product is Cyprus-focused, so constraining results keeps Nominatim useful
 * without needing a commercial geocoding key.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to search locations." }, { status: 401 });

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 160) {
    return NextResponse.json({ error: "Enter a location with at least two characters." }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "cy");
  url.searchParams.set("addressdetails", "0");

  try {
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "Trapezi personal food list location lookup",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Location search is temporarily unavailable." }, { status: 502 });
    }
    const results = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
    }>;
    const result = results[0];
    const latitude = Number(result?.lat);
    const longitude = Number(result?.lon);
    if (!result || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "No location was found in Cyprus." }, { status: 404 });
    }
    return NextResponse.json({
      latitude,
      longitude,
      label: result.display_name ?? query,
    });
  } catch {
    return NextResponse.json({ error: "Location search timed out. Try again." }, { status: 504 });
  }
}
