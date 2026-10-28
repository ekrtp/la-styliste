/** One staged file as the commit gate sees it. */
export interface StagedFile {
  path: string;
  bytes: number;
  binary: boolean;
}

/** Binary files above this size are refused outside app/assets/: photos and backups do not belong in a public repo. */
export const MAX_BINARY_BYTES = 200 * 1024;

/** Text that must never be committed: an OpenRouter key, a private key block. */
const SECRETS: readonly { what: string; re: RegExp }[] = [
  { what: 'an OpenRouter key', re: /sk-or-[A-Za-z0-9-]{8,}/ },
  { what: 'a private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

/** Images, video, archives and databases (plus the app's .bak-v<N> backups), allowed only under app/assets/. */
const MEDIA = /\.(jpe?g|png|webp|heic|heif|avif|gif|bmp|tiff?|mp4|mov|m4v|zip|tar|t?gz|7z|rar|db|sqlite3?)$|\.bak-v\d+$/i;

/** Where the app's own icon and splash files live; the only place media may be committed. */
const ASSETS_DIR = 'app/assets/';

/** What is wrong with a staged change; empty when it may be committed to the public repo. */
export function findProblems(files: readonly StagedFile[], addedLines: readonly string[]): string[] {
  const problems: string[] = [];
  for (const f of files) {
    if (f.path.startsWith(ASSETS_DIR)) continue;
    if (MEDIA.test(f.path)) problems.push(`${f.path}: image, video, archive or database outside ${ASSETS_DIR}`);
    else if (f.binary && f.bytes > MAX_BINARY_BYTES) problems.push(`${f.path}: binary over ${MAX_BINARY_BYTES / 1024} KB outside ${ASSETS_DIR}`);
  }
  for (const line of addedLines) {
    for (const { what, re } of SECRETS) if (re.test(line)) problems.push(`an added line contains ${what}`);
  }
  return problems;
}

/**
 * The added lines ("+..." with the marker kept) of a `git diff` output, hunk bodies only.
 * File headers ("+++ b/...") sit between "diff --git" and the first "@@", so they are skipped by position,
 * not by prefix: an added line whose content starts with "++" must still be returned and scanned.
 */
export function addedLines(diff: string): string[] {
  const lines: string[] = [];
  let inHunk = false;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git')) inHunk = false;
    else if (line.startsWith('@@')) inHunk = true;
    else if (inHunk && line.startsWith('+')) lines.push(line);
  }
  return lines;
}
