import type { PhotoKind } from './tags';

/** Background removal: `done` once the stored display image is a cut-out, `pending` until N1 can make one, `none` never, `failed` when Vision found no subject. */
export type CutoutState = 'none' | 'pending' | 'done' | 'failed';

/** Redaction of faces in the image sent for tagging (spec §7); only worn photos need it. */
export type FaceState = 'n/a' | 'pending' | 'filled' | 'none_found' | 'confirmed';

/** A photo whose files are on disk and whose row is about to be written. */
export interface NewPhoto {
  id: string;
  kind: PhotoKind;
  originalExt: 'jpg' | 'png';
  cutoutState: CutoutState;
  faceState: FaceState;
}

/** The states a new photo starts in. An image that already has alpha is a cut-out; worn and outfit photos are never cut (spec §6). */
export function initialPhotoStates(kind: PhotoKind, hasAlpha: boolean): Pick<NewPhoto, 'cutoutState' | 'faceState'> {
  const neverCut = kind === 'worn' || kind === 'outfit';
  return {
    cutoutState: hasAlpha ? 'done' : neverCut ? 'none' : 'pending',
    faceState: kind === 'worn' ? 'pending' : 'n/a',
  };
}
