import { describe, expect, it } from 'vitest';
import { addedLines, findProblems, MAX_BINARY_BYTES } from './publicCheck';

// Built by concatenation so this file itself never holds a key-shaped string.
const FAKE_KEY = 'sk-' + 'or-v1-' + 'a'.repeat(24);
const FAKE_PEM = '-----BEGIN ' + 'RSA PRIVATE KEY-----';

describe('findProblems', () => {
  it('passes text files and app assets', () => {
    expect(
      findProblems(
        [
          { path: 'app/src/data/db.ts', bytes: 900, binary: false },
          { path: 'app/assets/icon.png', bytes: 400_000, binary: true },
        ],
        ['+export const x = 1;'],
      ),
    ).toEqual([]);
  });

  it('refuses photos and archives outside app/assets/', () => {
    expect(findProblems([{ path: 'docs/mirror.jpg', bytes: 10, binary: true }], [])).toEqual([
      'docs/mirror.jpg: image or archive outside app/assets/',
    ]);
    expect(findProblems([{ path: 'backup.zip', bytes: 10, binary: true }], [])).toHaveLength(1);
  });

  it('refuses a large binary outside app/assets/', () => {
    expect(findProblems([{ path: 'app/thing.bin', bytes: MAX_BINARY_BYTES + 1, binary: true }], [])).toEqual([
      'app/thing.bin: binary over 200 KB outside app/assets/',
    ]);
  });

  it('refuses an added line holding a key', () => {
    expect(findProblems([], [`+const key = '${FAKE_KEY}';`])).toEqual(['an added line contains an OpenRouter key']);
    expect(findProblems([], [`+${FAKE_PEM}`])).toEqual(['an added line contains a private key']);
  });

  it('does not mistake the prefix alone in prose for a key', () => {
    expect(findProblems([], ['+a settings value starting with `sk-or-` makes export throw'])).toEqual([]);
  });
});

describe('addedLines', () => {
  const TWO_FILE_DIFF = [
    'diff --git a/one.ts b/one.ts',
    'index 111..222 100644',
    '--- a/one.ts',
    '+++ b/one.ts',
    '@@ -1,2 +1,3 @@',
    ' context',
    '-removed',
    '+added one',
    'diff --git a/two.ts b/two.ts',
    '--- a/two.ts',
    '+++ b/two.ts',
    '@@ -0,0 +1 @@',
    '+added two',
  ].join('\n');

  it('returns exactly the added lines of every file, never a file header', () => {
    expect(addedLines(TWO_FILE_DIFF)).toEqual(['+added one', '+added two']);
  });

  it('keeps an added line whose content starts with ++', () => {
    const diff = ['diff --git a/x b/x', '--- a/x', '+++ b/x', '@@ -0,0 +1 @@', '+++ x'].join('\n');
    expect(addedLines(diff)).toEqual(['+++ x']);
  });

  it('lets findProblems see a key hidden behind a ++ prefix', () => {
    const diff = ['diff --git a/x b/x', '--- a/x', '+++ b/x', '@@ -0,0 +1 @@', `+++ ${FAKE_KEY}`].join('\n');
    expect(findProblems([], addedLines(diff))).toEqual(['an added line contains an OpenRouter key']);
  });
});
