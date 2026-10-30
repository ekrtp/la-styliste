import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat, type SaveOptions } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { newId } from '../core/ids';
import { initialPhotoStates, type NewPhoto } from '../core/photo';
import type { ItemPhotoKind } from '../core/tags';
import { HEAD_BYTES, pngHasAlpha } from './images';
import { DISPLAY_FILE, originalFile, THUMB_FILE } from './layout';
import { stagingDir } from './photoFiles';

/** Longest side of the kept original: enough for N1's Vision pass, small enough not to fill the phone (spec §6). */
const ORIGINAL_MAX = 2048;
/** Longest side of the image the item screen shows. */
const DISPLAY_MAX = 1024;
/** Longest side of a grid image: three to a row on a 393 pt screen at 3x is about 360 px; 300 is sharp enough. */
const THUMB_MAX = 300;
/** JPEG quality of the kept original: high, since every later image is made from it. */
const ORIGINAL_QUALITY = 0.9;
/** Display and thumb encoding. WEBP keeps alpha in theory; the M1 device check confirms it (spec §13). */
const PREVIEW_FORMAT: SaveOptions = { format: SaveFormat.WEBP, compress: 0.8 };
/** Below this much free space a save is refused before it starts: a 2048 px original and two previews take a few MB. */
const MIN_FREE_BYTES = 50 * 1024 * 1024;

/** There is not enough free space to save a photo safely. */
export class LowStorageError extends Error {
  constructor() {
    super('Not enough free space to save the photo');
    this.name = 'LowStorageError';
  }
}

/**
 * Writes the original (≤ 2048 px), display and thumb into the photo's staging folder, then renames the folder into
 * place. Returns the row to insert. On any error the staging folder is deleted and the error rethrown (spec §6).
 */
export async function preparePhoto(asset: ImagePickerAsset, kind: ItemPhotoKind): Promise<NewPhoto> {
  if (Paths.availableDiskSpace < MIN_FREE_BYTES) throw new LowStorageError();
  const id = newId();
  const staging = stagingDir(id);
  staging.create({ intermediates: true });
  try {
    const hasAlpha = await readHasAlpha(asset.uri);
    const originalExt = hasAlpha ? 'png' : 'jpg';
    const original = new File(staging, originalFile(originalExt));
    // Always pass the format: the default is JPEG, which drops alpha (spec §6).
    await render(asset.uri, ORIGINAL_MAX, hasAlpha ? { format: SaveFormat.PNG } : { format: SaveFormat.JPEG, compress: ORIGINAL_QUALITY }, original);
    await render(original.uri, DISPLAY_MAX, PREVIEW_FORMAT, new File(staging, DISPLAY_FILE));
    await render(original.uri, THUMB_MAX, PREVIEW_FORMAT, new File(staging, THUMB_FILE));
    staging.rename(id);
    return { id, kind, originalExt, ...initialPhotoStates(kind, hasAlpha) };
  } catch (e) {
    if (staging.exists) staging.delete();
    throw e;
  }
}

/** Decodes `uri` no larger than `max` on either side (aspect kept, EXIF orientation applied), encodes it with `options` and moves it to `target`. */
async function render(uri: string, max: number, options: SaveOptions, target: File): Promise<void> {
  const context = ImageManipulator.manipulate(uri, { maxWidth: max, maxHeight: max });
  const image = await context.renderAsync();
  try {
    const saved = await image.saveAsync(options);
    await new File(saved.uri).move(target);
  } finally {
    // Native image buffers are freed by hand: a bulk session decodes hundreds of photos.
    image.release();
    context.release();
  }
}

async function readHasAlpha(uri: string): Promise<boolean> {
  const file = new File(uri);
  const handle = file.open();
  try {
    return pngHasAlpha(await handle.readBytes(Math.min(HEAD_BYTES, file.size)));
  } finally {
    handle.close();
  }
}
