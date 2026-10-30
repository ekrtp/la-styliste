import { ID_PATTERN } from '../core/ids';

/** Suffix of a photo folder still being written; it is renamed away when the files are complete (spec §6). */
export const STAGING_SUFFIX = '.tmp';
/** The image the item screen shows: 1024 px, a cut-out when there is one. If WEBP loses alpha on the phone (spec §13), this and `THUMB_FILE` become `.png` together with `PREVIEW_FORMAT` in `pipeline.ts`. */
export const DISPLAY_FILE = 'display.webp';
/** The grid image: 300 px. */
export const THUMB_FILE = 'thumb.webp';
/** At most this many orphan folders are deleted per launch. A crash leaves one; more means the database is not the one these photos belong to (a wrong restore), and deleting would lose photos. */
const ORPHAN_DELETE_LIMIT = 5;

/** The kept original's file name: PNG when it carries alpha, else JPEG. */
export function originalFile(ext: 'jpg' | 'png'): string {
  return `original.${ext}`;
}

export interface SweepPlan {
  /** Staging folders a crash left behind. */
  staging: string[];
  /** Complete folders no photo row points at. */
  orphans: string[];
  /** Orphans kept because there were too many to be crash leftovers. */
  keptOrphans: number;
}

/**
 * Which photo folders to delete, from the folder names on disk and the photo ids in the database. Names that are not ids are never touched.
 * A database with no photo rows deletes no orphans: it is a fresh or just-imported one, and every folder would look like an orphan.
 */
export function planSweep(folders: readonly string[], photoIds: ReadonlySet<string>): SweepPlan {
  const staging = folders.filter((name) => name.endsWith(STAGING_SUFFIX) && ID_PATTERN.test(name.slice(0, -STAGING_SUFFIX.length)));
  const orphans = folders.filter((name) => ID_PATTERN.test(name) && !photoIds.has(name));
  const tooMany = photoIds.size === 0 || orphans.length > ORPHAN_DELETE_LIMIT;
  return { staging, orphans: tooMany ? [] : orphans, keptOrphans: tooMany ? orphans.length : 0 };
}
