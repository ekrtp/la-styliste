// Commit gate for the public repo (spec §12): refuses staged photos, archives, large binaries and secrets.
// Node strips the types of the imported .ts file (Node 22.18+ / 24).
// The script is ESM importing a .ts helper in a typeless package; the npm script silences only that one Node warning.
import { execFileSync } from 'node:child_process';
import { addedLines, findProblems } from '../src/tooling/publicCheck.ts';

/** Generous output limit: a large staged diff must not crash the gate. */
const MAX_OUTPUT = 256 * 1024 * 1024;

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: MAX_OUTPUT });

const paths = git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z').split('\0').filter(Boolean);
const files = paths.map((path) => ({
  path,
  bytes: Number(git('cat-file', '-s', `:${path}`).trim()),
  // numstat prints "-<TAB>-" for a binary file.
  binary: git('diff', '--cached', '--numstat', '--', path).startsWith('-\t-\t'),
}));
const added = addedLines(git('diff', '--cached', '-U0', '--no-color', '--no-ext-diff', '--no-textconv', '--text'));

const problems = findProblems(files, added);
if (problems.length > 0) {
  console.error(`check:public refused the commit:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`check:public: ${files.length} staged file(s) clean`);
