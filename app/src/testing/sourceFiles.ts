import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Every non-test .ts/.tsx file under `dir`, recursively. For the guard tests that scan the app's own source. */
export function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
  });
}
