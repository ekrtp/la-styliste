import { describe, expect, it } from 'vitest';
import { initialPhotoStates } from './photo';

describe('initialPhotoStates', () => {
  it('waits for N1 to cut flat and hanger photos, and takes an image with alpha as already cut', () => {
    expect(initialPhotoStates('flat', false)).toEqual({ cutoutState: 'pending', faceState: 'n/a' });
    expect(initialPhotoStates('hanger', true)).toEqual({ cutoutState: 'done', faceState: 'n/a' });
  });

  it('never cuts worn or outfit photos, and only worn photos wait for a face check', () => {
    expect(initialPhotoStates('worn', false)).toEqual({ cutoutState: 'none', faceState: 'pending' });
    expect(initialPhotoStates('outfit', false)).toEqual({ cutoutState: 'none', faceState: 'n/a' });
  });
});
