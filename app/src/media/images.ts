/** The 8-byte PNG signature. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
/** A JPEG starts with its SOI marker. */
const JPEG_SOI = [0xff, 0xd8] as const;
/** Where the IHDR colour type sits: signature 8 + length 4 + "IHDR" 4 + width 4 + height 4 + bit depth 1. */
const IHDR_COLOR_TYPE_OFFSET = 25;
/** PNG colour types with an alpha channel: grey + alpha (4) and RGBA (6). */
const ALPHA_COLOR_TYPES: ReadonlySet<number> = new Set([4, 6]);
/** Length, type and CRC around each PNG chunk's data. */
const CHUNK_OVERHEAD = 12;

/** How much of a file the alpha check reads. The chunks before the image data are small; 64 KB holds them in practice. */
export const HEAD_BYTES = 64 * 1024;

export type ImageType = 'png' | 'jpeg' | 'other';

/** The format, from the first bytes. HEIC and everything else are `other` (treated as opaque until N1, spec §6). */
export function sniffImageType(head: Uint8Array): ImageType {
  if (startsWith(head, PNG_SIGNATURE)) return 'png';
  if (startsWith(head, JPEG_SOI)) return 'jpeg';
  return 'other';
}

/** Whether a PNG's head says it is transparent: an alpha colour type, or a `tRNS` chunk before the image data. */
export function pngHasAlpha(head: Uint8Array): boolean {
  if (sniffImageType(head) !== 'png' || head.length <= IHDR_COLOR_TYPE_OFFSET) return false;
  if (ALPHA_COLOR_TYPES.has(head[IHDR_COLOR_TYPE_OFFSET])) return true;
  let at = PNG_SIGNATURE.length;
  while (at + 8 <= head.length) {
    const length = ((head[at] << 24) | (head[at + 1] << 16) | (head[at + 2] << 8) | head[at + 3]) >>> 0;
    const type = String.fromCharCode(head[at + 4], head[at + 5], head[at + 6], head[at + 7]);
    if (type === 'tRNS') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    at += CHUNK_OVERHEAD + length;
  }
  return false;
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return bytes.length >= prefix.length && prefix.every((b, i) => bytes[i] === b);
}
