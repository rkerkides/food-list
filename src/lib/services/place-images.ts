import "server-only";

import { createRepositories, type Repositories } from "@/lib/data/repositories";
import type { PlaceFallbackImage } from "@/lib/domain/place-fallback-image";
import type { Place } from "@/lib/domain/types";
import { defaultRepositories } from "./library";

export const MAX_PLACE_IMAGE_BYTES = 5 * 1024 * 1024;
export const PLACE_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PlaceImageMimeType = (typeof PLACE_IMAGE_MIME_TYPES)[number];

export interface StoredPlaceImage {
  mimeType: string;
  dataBase64: string;
  byteSize: number;
}

export async function setStockPlaceImage(
  userId: string,
  placeId: string,
  image: PlaceFallbackImage,
  repos?: Repositories,
): Promise<Place | null> {
  const { db } = repos ?? (await defaultRepositories());
  return db.transaction(async (tx) => {
    const txRepos = createRepositories(tx);
    const place = await txRepos.places.findById(userId, placeId);
    if (!place) return null;

    await tx.run("delete from place_image_uploads where user_id = ? and place_id = ?", [
      userId,
      placeId,
    ]);
    return txRepos.places.update(userId, placeId, imageOverridePatch(place, `stock:${image}`));
  });
}

export async function setUploadedPlaceImage(
  userId: string,
  placeId: string,
  image: { mimeType: PlaceImageMimeType; bytes: Uint8Array },
  repos?: Repositories,
): Promise<Place | null> {
  const { db } = repos ?? (await defaultRepositories());
  return db.transaction(async (tx) => {
    const txRepos = createRepositories(tx);
    const place = await txRepos.places.findById(userId, placeId);
    if (!place) return null;

    const now = new Date().toISOString();
    await tx.run(
      `insert into place_image_uploads
        (place_id, user_id, mime_type, data_base64, byte_size, updated_at)
       values (?, ?, ?, ?, ?, ?)
       on conflict(place_id) do update set
         user_id = excluded.user_id,
         mime_type = excluded.mime_type,
         data_base64 = excluded.data_base64,
         byte_size = excluded.byte_size,
         updated_at = excluded.updated_at`,
      [
        placeId,
        userId,
        image.mimeType,
        Buffer.from(image.bytes).toString("base64"),
        image.bytes.byteLength,
        now,
      ],
    );

    return txRepos.places.update(
      userId,
      placeId,
      imageOverridePatch(place, `upload:${placeId}:${Date.now()}`),
    );
  });
}

export async function resetPlaceImage(
  userId: string,
  placeId: string,
  repos?: Repositories,
): Promise<Place | null> {
  const { db } = repos ?? (await defaultRepositories());
  return db.transaction(async (tx) => {
    const txRepos = createRepositories(tx);
    const place = await txRepos.places.findById(userId, placeId);
    if (!place) return null;

    await tx.run("delete from place_image_uploads where user_id = ? and place_id = ?", [
      userId,
      placeId,
    ]);

    const meta = { ...(place.externalMeta ?? {}) };
    const providerPhoto = readProviderPhoto(meta.providerSnapshot);
    const originalPhoto = readPhotoRef(meta.imageOverrideOriginalPhotoRef);
    delete meta.imageOverrideOriginalPhotoRef;

    return txRepos.places.update(userId, placeId, {
      photoRef: providerPhoto ?? originalPhoto,
      externalMeta: Object.keys(meta).length > 0 ? meta : null,
      overrides: place.overrides.filter((field) => field !== "photoRef"),
      updatedAt: new Date().toISOString(),
    });
  });
}

/**
 * The upload for a place, when the viewer can see its owner's library: the
 * viewer themselves or anyone sharing a circle with them. No edit opt-in is
 * needed to view.
 */
export async function getViewableUploadedPlaceImage(
  viewerId: string,
  placeId: string,
  repos?: Repositories,
): Promise<StoredPlaceImage | null> {
  const repo = repos ?? (await defaultRepositories());
  const row = await repo.db.get<UploadRow>(
    "select user_id, mime_type, data_base64, byte_size from place_image_uploads where place_id = ?",
    [placeId],
  );
  if (!row) return null;
  const accessible = await repo.circles.accessibleUserIds(viewerId);
  return accessible.includes(row.user_id) ? toStoredImage(row) : null;
}

interface UploadRow {
  user_id: string;
  mime_type: string;
  data_base64: string;
  byte_size: number;
}

function toStoredImage(row: UploadRow): StoredPlaceImage {
  return { mimeType: row.mime_type, dataBase64: row.data_base64, byteSize: Number(row.byte_size) };
}

function imageOverridePatch(place: Place, photoRef: string): Partial<Place> {
  const meta = { ...(place.externalMeta ?? {}) };
  if (!("imageOverrideOriginalPhotoRef" in meta) && !isManualImageRef(place.photoRef)) {
    meta.imageOverrideOriginalPhotoRef = place.photoRef;
  }
  return {
    photoRef,
    externalMeta: meta,
    overrides: [...new Set([...place.overrides, "photoRef"])],
    updatedAt: new Date().toISOString(),
  };
}

function readProviderPhoto(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  return readPhotoRef((value as Record<string, unknown>).photoRef);
}

function readPhotoRef(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isManualImageRef(value: string | null): boolean {
  return Boolean(value?.startsWith("stock:") || value?.startsWith("upload:"));
}
