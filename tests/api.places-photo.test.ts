import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { GET } from "@/app/api/places/photo/route";

// The route reads the session and uploaded images itself; place-images imports `server-only`, so both are mocked.
const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  getUploadedPlaceImage: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn(async () => state.user) }));
vi.mock("@/lib/services/place-images", () => ({ getUploadedPlaceImage: state.getUploadedPlaceImage }));

const VALID_REF = "places/ChIJ_a-1/photos/AbC-_9";
const originalKey = process.env.GOOGLE_PLACES_API_KEY;
let fetchMock: ReturnType<typeof vi.fn>;

function request(ref: string) {
  return new NextRequest(`http://localhost/api/places/photo?${new URLSearchParams({ ref })}`);
}

function imageResponse(contentType = "image/jpeg", status = 200) {
  return new Response(new Uint8Array([1, 2, 3]), { status, headers: { "Content-Type": contentType } });
}

beforeEach(() => {
  vi.mocked(getSessionUser).mockClear();
  state.user = { id: "user_1" };
  state.getUploadedPlaceImage.mockReset();
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  fetchMock = vi.fn(async () => imageResponse());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = originalKey;
});

describe("GET /api/places/photo — Google refs", () => {
  it("proxies a valid ref for a signed-in user with a private cache directive", async () => {
    const response = await GET(request(VALID_REF));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toMatch(/^private/);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toBe(`https://places.googleapis.com/v1/${VALID_REF}/media?maxWidthPx=1200&key=test-key`);
    const body = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(body)).toEqual([1, 2, 3]);
    expect(JSON.stringify([...response.headers])).not.toContain("test-key");
  });

  it("returns 401 without a session and never calls Google", async () => {
    state.user = null;
    const response = await GET(request(VALID_REF));
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "places/x",
    "places/x/photos/y/z",
    "foo/x/photos/y",
    "places/x/photos/y?alt=1",
    "places/../photos/y",
    "places/x/photos/y\n",
    "places/x/photos/y/../../../other",
  ])("returns 404 for malformed ref %j without calling Google", async (ref) => {
    const response = await GET(request(ref));
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks the ref shape before the session: anonymous malformed ref gets 404", async () => {
    state.user = null;
    const response = await GET(request("places/x"));
    expect(response.status).toBe(404);
    expect(getSessionUser).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 404 when no API key is configured, without calling Google", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const response = await GET(request(VALID_REF));
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps an upstream 500 to 502", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    expect((await GET(request(VALID_REF))).status).toBe(502);
  });

  it("maps an upstream 404 to 404", async () => {
    fetchMock.mockResolvedValueOnce(new Response("missing", { status: 404 }));
    expect((await GET(request(VALID_REF))).status).toBe(404);
  });

  it("rejects a non-image upstream response with 502", async () => {
    fetchMock.mockResolvedValueOnce(imageResponse("text/html"));
    expect((await GET(request(VALID_REF))).status).toBe(502);
  });

  it("maps an upstream network failure or timeout to 504", async () => {
    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    expect((await GET(request(VALID_REF))).status).toBe(504);
  });
});

describe("GET /api/places/photo — upload and commons refs (unchanged)", () => {
  it("returns 401 for an upload ref without a session", async () => {
    state.user = null;
    const response = await GET(request("upload:place_1:abc"));
    expect(response.status).toBe(401);
    expect(state.getUploadedPlaceImage).not.toHaveBeenCalled();
  });

  it("serves an uploaded image for the signed-in user", async () => {
    state.getUploadedPlaceImage.mockResolvedValueOnce({
      dataBase64: Buffer.from([7, 8]).toString("base64"),
      mimeType: "image/png",
      byteSize: 2,
    });
    const response = await GET(request("upload:place_1:abc"));
    expect(response.status).toBe(200);
    expect(state.getUploadedPlaceImage).toHaveBeenCalledWith("user_1", "place_1");
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies a commons ref without a session and keeps its public cache directive", async () => {
    state.user = null;
    const response = await GET(request("commons:Kleftiko.jpg"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Kleftiko.jpg?width=1200",
    );
  });
});
