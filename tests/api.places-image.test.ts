import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Repositories } from "@/lib/data/repositories";
import { POST } from "@/app/api/places/[id]/image/route";
import { addCircleMember, createSharedCircle } from "@/lib/services/circles";
import { setUploadedPlaceImage } from "@/lib/services/place-images";
import { createManualPlace } from "@/lib/services/places";
import { setSharedContentEditableByGroup } from "@/lib/services/sharing";
import { createSecondUser, createTestContext } from "./helpers";

// The route reads the session and calls services without repos, so route both to the in-memory test database.
const state = vi.hoisted(() => ({ repos: null as unknown as Repositories, user: null as { id: string } | null }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn(async () => state.user) }));
vi.mock("@/lib/services/library", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/library")>()),
  defaultRepositories: vi.fn(async () => state.repos),
}));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

/** Owner with one place, a circle member, and an outsider sharing no circle with the owner. */
async function setup({ optIn }: { optIn: boolean }) {
  const ctx = await createTestContext("owner@example.com");
  const ownerId = ctx.userId;
  const memberId = await createSecondUser(ctx.repos, "member@example.com");
  const outsiderId = await createSecondUser(ctx.repos, "outsider@example.com");
  const circleId = await createSharedCircle(ownerId, "Dinner crew", ctx.repos);
  expect((await addCircleMember(ownerId, circleId, "member@example.com", ctx.repos)).status).toBe("added");
  await setSharedContentEditableByGroup(ownerId, optIn, ctx.repos);

  const created = await createManualPlace(ownerId, { name: "Owner's Taverna", category: "restaurant" }, ctx.repos);
  if (created.status !== "created") throw new Error("Expected a created place");
  state.repos = ctx.repos;
  return { repos: ctx.repos, ownerId, memberId, outsiderId, place: created.place };
}

function post(placeId: string, fields: Record<string, string | File>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const request = new NextRequest(`http://localhost/api/places/${placeId}/image`, { method: "POST", body: form });
  return POST(request, { params: Promise.resolve({ id: placeId }) });
}

beforeEach(() => {
  state.repos = null as unknown as Repositories;
  state.user = null;
});

describe("POST /api/places/[id]/image", () => {
  it("returns 401 without a session", async () => {
    const { place } = await setup({ optIn: true });
    const response = await post(place.id, { mode: "stock", stockImage: "greek" });
    expect(response.status).toBe(401);
  });

  it("lets the owner set a stock image", async () => {
    const { repos, ownerId, place } = await setup({ optIn: false });
    state.user = { id: ownerId };
    const response = await post(place.id, { mode: "stock", stockImage: "greek" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect((await repos.places.findById(ownerId, place.id))?.photoRef).toBe("stock:greek");
  });

  it("lets an opted-in circle member set a stock image on the owner's place", async () => {
    const { repos, ownerId, memberId, place } = await setup({ optIn: true });
    state.user = { id: memberId };
    const response = await post(place.id, { mode: "stock", stockImage: "seafood" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect((await repos.places.findById(ownerId, place.id))?.photoRef).toBe("stock:seafood");
  });

  it("stores an opted-in member's upload under the owner", async () => {
    const { repos, ownerId, memberId, place } = await setup({ optIn: true });
    state.user = { id: memberId };
    const file = new File([PNG], "photo.png", { type: "image/png" });
    const response = await post(place.id, { mode: "upload", image: file });
    expect(response.status).toBe(200);
    expect((await repos.places.findById(ownerId, place.id))?.photoRef).toMatch(
      new RegExp(`^upload:${place.id}:\\d+$`),
    );
    const row = await repos.db.get<{ user_id: string }>(
      "select user_id from place_image_uploads where place_id = ?",
      [place.id],
    );
    expect(row?.user_id).toBe(ownerId);
  });

  it("lets an opted-in member reset the owner's upload back to automatic", async () => {
    const { repos, ownerId, memberId, place } = await setup({ optIn: true });
    await setUploadedPlaceImage(ownerId, place.id, { mimeType: "image/png", bytes: PNG }, repos);
    expect((await repos.places.findById(ownerId, place.id))?.overrides).toContain("photoRef");
    state.user = { id: memberId };
    const response = await post(place.id, { mode: "automatic" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const reset = await repos.places.findById(ownerId, place.id);
    expect(reset?.overrides).not.toContain("photoRef");
    expect(reset?.photoRef).toBe(place.photoRef);
    const row = await repos.db.get("select place_id from place_image_uploads where place_id = ?", [place.id]);
    expect(row).toBeNull();
  });

  it("refuses an upload from a member the owner has not opted in, storing nothing", async () => {
    const { repos, memberId, place } = await setup({ optIn: false });
    state.user = { id: memberId };
    const file = new File([PNG], "photo.png", { type: "image/png" });
    const response = await post(place.id, { mode: "upload", image: file });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: "You can't change this shared place's image." });
    const row = await repos.db.get("select place_id from place_image_uploads where place_id = ?", [place.id]);
    expect(row).toBeNull();
  });

  it("refuses a circle member the owner has not opted in, leaving the place unchanged", async () => {
    const { repos, ownerId, memberId, place } = await setup({ optIn: false });
    state.user = { id: memberId };
    const response = await post(place.id, { mode: "stock", stockImage: "greek" });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: "You can't change this shared place's image." });
    const unchanged = await repos.places.findById(ownerId, place.id);
    expect(unchanged?.photoRef).toBe(place.photoRef);
    expect(unchanged?.overrides).not.toContain("photoRef");
  });

  it("returns 404 to a user outside the owner's circles", async () => {
    const { repos, ownerId, outsiderId, place } = await setup({ optIn: true });
    state.user = { id: outsiderId };
    const response = await post(place.id, { mode: "stock", stockImage: "greek" });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "That place could not be found." });
    expect((await repos.places.findById(ownerId, place.id))?.photoRef).toBe(place.photoRef);
  });

  it("returns 404 for an unknown place", async () => {
    const { ownerId } = await setup({ optIn: true });
    state.user = { id: ownerId };
    const response = await post("place_missing", { mode: "stock", stockImage: "greek" });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "That place could not be found." });
  });
});
