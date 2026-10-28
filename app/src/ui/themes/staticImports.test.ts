import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Root of src/, scanned for forbidden theme imports. */
const SRC = fileURLToPath(new URL('../../', import.meta.url));
/** This folder: the only place allowed to import dark, light and base. */
const THEMES = fileURLToPath(new URL('./', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
  });
}

describe('theme values', () => {
  it('are imported only inside src/ui/themes', () => {
    const offenders = sourceFiles(SRC)
      .filter((f) => !f.startsWith(THEMES))
      .filter((f) => /from\s+['"][^'"]*themes\/(dark|light|base)['"]/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).split(sep).join('/'));
    expect(offenders).toEqual([]);
  });
});
