/**
 * shrinkPhoto — downscale a picked/captured photo before it is uploaded.
 *
 * Profile photos used to go up at camera resolution (up to ~4300px, ~1.8MB
 * average), and every avatar on every roster downloaded and disk-cached that
 * whole file to draw a 40px circle. 512px on the longest side is still sharp
 * in the full-screen ProfileImageExpander, at ~30-50KB as JPEG.
 *
 * expo-image-manipulator is a native module, and builds that predate it don't
 * contain it. Importing the package on such a build throws at import time
 * (it calls requireNativeModule), so it is only required once the native side
 * is known to exist; otherwise the original file is uploaded unchanged, which
 * is exactly the old behaviour. That keeps this safe to ship over the air.
 */
import { requireOptionalNativeModule } from "expo";

export const MAX_PHOTO_SIDE = 512;
const JPEG_COMPRESS = 0.8;

let manipulator; // undefined = not looked up yet, null = unavailable

function getManipulator() {
  if (manipulator === undefined) {
    try {
      manipulator = requireOptionalNativeModule("ExpoImageManipulator")
        ? require("expo-image-manipulator")
        : null;
    } catch {
      manipulator = null;
    }
  }
  return manipulator;
}

/**
 * @param {{ uri: string, width?: number, height?: number }} asset an
 *   expo-image-picker asset
 * @returns {Promise<{ uri: string, contentType?: string }>} the file to upload.
 *   `contentType` is set only when the file was re-encoded.
 */
export async function shrinkPhoto(asset) {
  const { uri, width = 0, height = 0 } = asset || {};
  const mod = getManipulator();
  if (!mod || !uri) return { uri };

  // Picker assets always carry dimensions; without them, resize by width.
  const longest = Math.max(width, height);
  if (longest && longest <= MAX_PHOTO_SIDE) return { uri };

  let context;
  let image;
  try {
    context = mod.ImageManipulator.manipulate(uri);
    context.resize(
      width >= height ? { width: MAX_PHOTO_SIDE } : { height: MAX_PHOTO_SIDE }
    );
    image = await context.renderAsync();
    const result = await image.saveAsync({
      format: mod.SaveFormat.JPEG,
      compress: JPEG_COMPRESS,
    });
    return { uri: result.uri, contentType: "image/jpeg" };
  } catch (e) {
    // A failed resize must never block the upload; the full-size file still works.
    console.warn("[shrinkPhoto] resize failed, uploading original:", e?.message);
    return { uri };
  } finally {
    image?.release?.();
    context?.release?.();
  }
}
