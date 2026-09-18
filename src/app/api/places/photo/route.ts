import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxies Google Places photos so the API key never reaches the browser and we
 * can cache aggressively. Without a key (demo mode) there is nothing to fetch,
 * and the UI falls back to its generated visual.
 */
export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref");
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!ref || !apiKey || /^https?:/i.test(ref)) {
    return new NextResponse(null, { status: 404 });
  }

  const url = new URL(`https://places.googleapis.com/v1/${ref}/media`);
  url.searchParams.set("maxWidthPx", "1200");
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!response.ok || !response.body) {
      return new NextResponse(null, { status: response.status === 404 ? 404 : 502 });
    }
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse(null, { status: 504 });
  }
}
