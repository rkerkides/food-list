import { getSessionUser } from "@/lib/auth/session";
import { isPlaceStockImage } from "@/lib/domain/place-fallback-image";
import {
  MAX_PLACE_IMAGE_BYTES,
  PLACE_IMAGE_MIME_TYPES,
  resetPlaceImage,
  setStockPlaceImage,
  setUploadedPlaceImage,
  type PlaceImageMimeType,
} from "@/lib/services/place-images";
import { resolveEditablePlace } from "@/lib/services/sharing";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return jsonError("Sign in to change this image.", 401);

  const { id: placeId } = await context.params;
  try {
    // Shared editors act on the owner's place, so every write below uses the owner's id.
    const access = await resolveEditablePlace(user.id, placeId);
    if (access.access === "not_found" || !access.ownerUserId) {
      return jsonError("That place could not be found.", 404);
    }
    if (access.access === "forbidden") {
      return jsonError("You can't change this shared place's image.", 403);
    }
    const ownerUserId = access.ownerUserId;

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError("The image request was not valid.", 400);
    }

    const mode = form.get("mode");
    let updated;
    if (mode === "automatic") {
      updated = await resetPlaceImage(ownerUserId, placeId);
    } else if (mode === "stock") {
      const key = form.get("stockImage");
      if (typeof key !== "string" || !isPlaceStockImage(key)) {
        return jsonError("Choose one of the available stock images.", 400);
      }
      updated = await setStockPlaceImage(ownerUserId, placeId, key);
    } else if (mode === "upload") {
      const file = form.get("image");
      if (!(file instanceof File) || file.size === 0) {
        return jsonError("Choose an image to upload.", 400);
      }
      if (file.size > MAX_PLACE_IMAGE_BYTES) {
        return jsonError("The image must be 5 MB or smaller.", 413);
      }
      if (!isAllowedMimeType(file.type)) {
        return jsonError("Use a JPEG, PNG, or WebP image.", 415);
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!matchesImageSignature(file.type, bytes)) {
        return jsonError("That file does not appear to be a valid image.", 415);
      }
      updated = await setUploadedPlaceImage(ownerUserId, placeId, {
        mimeType: file.type,
        bytes,
      });
    } else {
      return jsonError("Choose automatic, stock, or upload.", 400);
    }

    if (!updated) return jsonError("That place could not be found.", 404);
    revalidatePath("/");
    revalidatePath("/places");
    revalidatePath(`/places/${placeId}`);
    revalidatePath("/profile/data-status");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("place image update failed", error);
    return jsonError("Could not save that image. Please try again.", 500);
  }
}

function isAllowedMimeType(value: string): value is PlaceImageMimeType {
  return PLACE_IMAGE_MIME_TYPES.some((type) => type === value);
}

function matchesImageSignature(type: PlaceImageMimeType, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}
