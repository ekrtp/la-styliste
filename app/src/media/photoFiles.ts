import { Directory, Paths } from 'expo-file-system';
import type { Db } from '../data/db';
import { allPhotoIds } from '../data/items';
import { DISPLAY_FILE, planSweep, STAGING_SUFFIX, THUMB_FILE, type SweepPlan } from './layout';

/** `<documents>/photos`, one folder per photo named by its id (spec §5). Documents survive updates; the cache does not. */
export function photosRoot(): Directory {
  return new Directory(Paths.document, 'photos');
}

export function photoDir(id: string): Directory {
  return new Directory(photosRoot(), id);
}

/** Where a photo's files are written before the folder is renamed to `photoDir(id)`. */
export function stagingDir(id: string): Directory {
  return new Directory(photosRoot(), `${id}${STAGING_SUFFIX}`);
}

let photosRootUri: string | null = null;

/** The photos root URI with a trailing slash, computed once: the grid asks for a URI per cell on every render. */
function rootUri(): string {
  if (photosRootUri === null) {
    const uri = photosRoot().uri;
    photosRootUri = uri.endsWith('/') ? uri : `${uri}/`;
  }
  return photosRootUri;
}

export function displayUri(photoId: string): string {
  return `${rootUri()}${photoId}/${DISPLAY_FILE}`;
}

export function thumbUri(photoId: string): string {
  return `${rootUri()}${photoId}/${THUMB_FILE}`;
}

/** Deletes a photo's folder if it is there. */
export function deletePhotoDir(id: string): void {
  const dir = photoDir(id);
  if (dir.exists) dir.delete();
}

/** Deletes leftover staging folders and folders no photo row points at (spec §6). Never throws: it only tidies, and a launch must not fail over it. */
export async function sweepPhotos(db: Db): Promise<SweepPlan | null> {
  try {
    const root = photosRoot();
    if (!root.exists) return null;
    const folders = root.list().flatMap((entry) => (entry instanceof Directory ? [entry.name] : []));
    const plan = planSweep(folders, await allPhotoIds(db));
    for (const name of [...plan.staging, ...plan.orphans]) {
      // One stuck folder must not keep the others from being cleaned.
      try {
        new Directory(root, name).delete();
      } catch {
        // The next launch tries again.
      }
    }
    return plan;
  } catch {
    return null;
  }
}
