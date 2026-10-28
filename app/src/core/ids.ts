/** Ids of items and photos; also the folder names a backup may contain (spec §5), so never `.` or `/`. */
export const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** Random base-36 characters after the time: enough that two ids made in one millisecond never meet. */
const RANDOM_CHARS = 10;

/**
 * A new id: the time in base 36 first, so ids sort by creation (8 characters until the year 2059), then random
 * characters. Not secret, only unique.
 */
export function newId(now: number = Date.now(), random: () => number = Math.random): string {
  let tail = '';
  while (tail.length < RANDOM_CHARS) tail += Math.floor(random() * 36).toString(36);
  return `${now.toString(36)}${tail}`;
}
