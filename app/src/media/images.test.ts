import { describe, expect, it } from 'vitest';
import { pngHasAlpha, sniffImageType } from './images';

/** A PNG chunk: length, type, data and a zero CRC (the check never reads CRCs). */
function chunk(type: string, data: number[] = []): number[] {
  const n = data.length;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255, ...Array.from(type, (c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
}

/** A 1×1 PNG of `colorType`, with `before` chunks ahead of the image data and `after` chunks behind it. */
function png(colorType: number, before: number[][] = [], after: number[][] = []): Uint8Array {
  const ihdr = [0, 0, 0, 1, 0, 0, 0, 1, 8, colorType, 0, 0, 0];
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', ihdr),
    ...before.flat(),
    ...chunk('IDAT', [0]),
    ...after.flat(),
    ...chunk('IEND'),
  ]);
}

describe('sniffImageType', () => {
  it('tells PNG and JPEG from their first bytes', () => {
    expect(sniffImageType(png(2))).toBe('png');
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(sniffImageType(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]))).toBe('other');
  });
});

describe('pngHasAlpha', () => {
  it('sees alpha in RGBA and in grey + alpha', () => {
    expect(pngHasAlpha(png(6))).toBe(true);
    expect(pngHasAlpha(png(4))).toBe(true);
  });

  it('sees no alpha in plain grey, RGB or palette images', () => {
    for (const colorType of [0, 2, 3]) expect(pngHasAlpha(png(colorType))).toBe(false);
  });

  it('sees alpha in a tRNS chunk before the image data', () => {
    expect(pngHasAlpha(png(2, [chunk('tRNS', [0, 0, 0, 0, 0, 0])]))).toBe(true);
    expect(pngHasAlpha(png(3, [chunk('PLTE', [0, 0, 0]), chunk('tRNS', [0])]))).toBe(true);
  });

  it('ignores a tRNS chunk after the image data', () => {
    expect(pngHasAlpha(png(2, [], [chunk('tRNS', [0, 0, 0, 0, 0, 0])]))).toBe(false);
  });

  it('answers no for a JPEG and for a head cut short', () => {
    expect(pngHasAlpha(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
    expect(pngHasAlpha(png(6).slice(0, 20))).toBe(false);
  });
});
