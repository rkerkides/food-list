import { describe, expect, it, vi } from "vitest";
import { addCircleMember, createSharedCircle } from "@/lib/services/circles";
import {
  getViewableUploadedPlaceImage,
  resetPlaceImage,
  setStockPlaceImage,
  setUploadedPlaceImage,
} from "@/lib/services/place-images";
import { createManualPlace } from "@/lib/services/places";
import { createSecondUser, createTestContext } from "./helpers";

// place-images imports `server-only`, which throws outside a React Server Components bundle.
vi.mock("server-only", () => ({}));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

/** Owner with one place, a circle member (no edit opt-in) and an outsider sharing no circle. */
async function setup() {
  const ctx = await createTestContext("owner@example.com");
  const ownerId = ctx.userId;
  const memberId = await createSecondUser(ctx.repos, "member@example.com");
  const outsiderId = await createSecondUser(ctx.repos, "outsider@example.com");
  const circleId = await createSharedCircle(ownerId, "Dinner crew", ctx.repos);
  expect((await addCircleMember(ownerId, circleId, "member@example.com", ctx.repos)).status).toBe("added");

  const created = await createManualPlace(ownerId, { name: "Owner's Taverna", category: "restaurant" }, ctx.repos);
  if (created.status !== "created") throw new Error("Expected a created place");
  return { repos: ctx.repos, ownerId, memberId, outsiderId, place: created.place };
}

async function uploadRow(repos: Awaited<ReturnType<typeof setup>>["repos"], placeId: string) {
  return repos.db.get<{ user_id: string; byte_size: number }>(
    "select user_id, byte_size from place_image_uploads where place_id = ?",
    [placeId],
  );
}

describe("place image writes", () => {
  it("sets a stock image on the owner's place", async () => {
    const { repos, ownerId, place } = await setup();
    const updated = await setStockPlaceImage(ownerId, place.id, "greek", repos);
    expect(updated?.photoRef).toBe("stock:greek");
    expect((await repos.places.findById(ownerId, place.id))?.photoRef).toBe("stock:greek");
  });

  it("stores an upload under the owner when called with the owner's id", async () => {
    const { repos, ownerId, place } = await setup();
    const updated = await setUploadedPlaceImage(ownerId, place.id, { mimeType: "image/png", bytes: PNG }, repos);
    expect(updated?.photoRef).toMatch(new RegExp(`^upload:${place.id}:\\d+$`));
    expect(await uploadRow(repos, place.id)).toEqual({ user_id: ownerId, byte_size: PNG.byteLength });
  });

  it("returns null and writes nothing when the id is not the place's owner", async () => {
    const { repos, ownerId, memberId, place } = await setup();
    expect(await setUploadedPlaceImage(memberId, place.id, { mimeType: "image/png", bytes: PNG }, repos)).toBeNull();
    expect(await setStockPlaceImage(memberId, place.id, "greek", repos)).toBeNull();
    expect(await uploadRow(repos, place.id)).toBeNull();
    expect((await repos.places.findById(ownerId, place.id))?.photoRef).toBe(place.photoRef);
  });

  it("resets to automatic and removes the upload", async () => {
    const { repos, ownerId, place } = await setup();
    await setUploadedPlaceImage(ownerId, place.id, { mimeType: "image/png", bytes: PNG }, repos);
    const reset = await resetPlaceImage(ownerId, place.id, repos);
    expect(reset?.photoRef).toBe(place.photoRef);
    expect(reset?.overrides).not.toContain("photoRef");
    expect(await uploadRow(repos, place.id)).toBeNull();
  });
});

describe("getViewableUploadedPlaceImage", () => {
  it("serves the upload to its owner", async () => {
    const { repos, ownerId, place } = await setup();
    await setUploadedPlaceImage(ownerId, place.id, { mimeType: "image/png", bytes: PNG }, repos);
    const image = await getViewableUploadedPlaceImage(ownerId, place.id, repos);
    expect(image).toEqual({
      mimeType: "image/png",
      dataBase64: Buffer.from(PNG).toString("base64"),
      byteSize: PNG.byteLength,
    });
  });

  it("serves the upload to a circle member without an edit opt-in", async () => {
    const { repos, ownerId, memberId, place } = await setup();
    await setUploadedPlaceImage(ownerId, place.id, { mimeType: "image/png", bytes: PNG }, repos);
    expect((await getViewableUploadedPlaceImage(memberId, place.id, repos))?.mimeType).toBe("image/png");
  });

  it("hides the upload from a user who shares no circle with the owner", async () => {
    const { repos, ownerId, outsiderId, place } = await setup();
    await setUploadedPlaceImage(ownerId, place.id, { mimeType: "image/png", bytes: PNG }, repos);
    expect(await getViewableUploadedPlaceImage(outsiderId, place.id, repos)).toBeNull();
  });

  it("returns null when the place has no upload", async () => {
    const { repos, ownerId, place } = await setup();
    expect(await getViewableUploadedPlaceImage(ownerId, place.id, repos)).toBeNull();
    expect(await getViewableUploadedPlaceImage(ownerId, "place_missing", repos)).toBeNull();
  });
});
