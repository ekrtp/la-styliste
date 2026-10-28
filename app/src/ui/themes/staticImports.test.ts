import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sourceFiles } from '../../testing/sourceFiles';

/** Root of src/, scanned for forbidden theme imports. */
const SRC = fileURLToPath(new URL('../../', import.meta.url));
/** This folder: the only place allowed to import dark, light, base and the registry. */
const THEMES = fileURLToPath(new URL('./', import.meta.url));
/** A static import, dynamic import() or require() of a theme module, with or without a file extension. */
const THEME_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"][^'"]*themes\/(?:dark|light|base|registry)(?:\.tsx?)?['"]/;

describe('theme values', () => {
  it('are imported only inside src/ui/themes', () => {
    const offenders = sourceFiles(SRC)
      .filter((f) => !f.startsWith(THEMES))
      .filter((f) => THEME_IMPORT.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).split(sep).join('/'));
    expect(offenders).toEqual([]);
  });
});
