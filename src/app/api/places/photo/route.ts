import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getViewableUploadedPlaceImage } from "@/lib/services/place-images";

const GOOGLE_PHOTO_REF = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

/**
 * Serves private user uploads and proxies Google Places / explicitly tagged
 * Wikimedia Commons photos without exposing credentials or third-party URLs.
 * Google photos require a session and accept only `places/{placeId}/photos/{photoId}`
 * resource names.
 */
export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref");
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!ref || /^https?:/i.test(ref)) {
    return new NextResponse(null, { status: 404 });
  }

  if (ref.startsWith("upload:")) {
    return serveUploadedPhoto(ref);
  }

  if (ref.startsWith("commons:")) {
    return proxyCommonsPhoto(ref.slice("commons:".length));
  }

  // Anonymous callers and refs that are not Google photo resource names
  // (`places/{placeId}/photos/{photoId}`) never reach the keyed upstream.
  if (!GOOGLE_PHOTO_REF.test(ref)) return new NextResponse(null, { status: 404 });
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  if (!apiKey) return new NextResponse(null, { status: 404 });

  const url = new URL(`https://places.googleapis.com/v1/${ref}/media`);
  url.searchParams.set("maxWidthPx", "1200");
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!response.ok || !response.body) {
      return new NextResponse(null, { status: response.status === 404 ? 404 : 502 });
    }
    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new NextResponse(null, { status: 502 });
    }
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 504 });
  }
}

async function serveUploadedPhoto(ref: string): Promise<NextResponse> {
  const placeId = ref.slice("upload:".length).split(":", 1)[0]?.trim();
  if (!placeId) return new NextResponse(null, { status: 404 });

  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const image = await getViewableUploadedPlaceImage(user.id, placeId);
  if (!image) return new NextResponse(null, { status: 404 });

  const bytes = Uint8Array.from(Buffer.from(image.dataBase64, "base64"));
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.byteSize),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function proxyCommonsPhoto(fileName: string): Promise<NextResponse> {
  const trimmed = fileName.trim();
  if (!trimmed || trimmed.length > 300 || /[\r\n]/.test(trimmed)) {
    return new NextResponse(null, { status: 404 });
  }

  const url = new URL(
    `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(trimmed)}`,
  );
  url.searchParams.set("width", "1200");
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(7000),
      headers: { "User-Agent": "Trapezi/0.1 (Wikimedia Commons image proxy)" },
    });
    if (!response.ok || !response.body) {
      return new NextResponse(null, { status: response.status === 404 ? 404 : 502 });
    }
    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new NextResponse(null, { status: 502 });
    }
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse(null, { status: 504 });
  }
}
