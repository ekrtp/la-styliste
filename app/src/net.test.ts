import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sourceFiles } from './testing/sourceFiles';

// Privacy you can check (spec §7, §12): only files under src/net/ may reach a network, and only these hosts.
// This scans the app's own source; it cannot see inside node_modules.

/** The only hosts the app talks to: OpenRouter for the LLM, Open-Meteo for weather and city search. */
const ALLOWED_HOSTS = ['openrouter.ai', 'api.open-meteo.com', 'geocoding-api.open-meteo.com'];

/** Ways JavaScript reaches a network. Any match outside src/net/ fails the build. */
const NETWORK = [
  { what: 'fetch(', re: /(?<![\w$])fetch\s*(?:\?\.\s*)?\(|(?<![\w$])fetch\s*\.\s*(?:call|apply|bind)\b/ },
  { what: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/ },
  { what: 'WebSocket', re: /\bWebSocket\b/ },
  { what: 'EventSource', re: /\bEventSource\b/ },
  { what: 'sendBeacon', re: /\bsendBeacon\b/ },
  { what: 'an HTTP client import', re: /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(?\s*)['"](?:axios|ky|expo-network)(?:\/[^'"]*)?['"]/ },
  // Every expo-file-system download or upload API has one of these words in its name. Fails closed: reword a comment that uses them.
  { what: 'a download or upload', re: /\b\w*(?:download|upload)\w*\b/i },
  { what: 'an http(s) URL', re: /['"`]https?:\/\//i },
];

function networkUses(source: string): string[] {
  return NETWORK.filter(({ re }) => re.test(source)).map(({ what }) => what);
}

/** Root of src/, scanned for network code. */
const SRC = fileURLToPath(new URL('./', import.meta.url));
/** The only folder allowed to reach a network. */
const NET = join(SRC, 'net') + sep;

const rel = (f: string) => relative(SRC, f).split(sep).join('/');

describe('the network detector', () => {
  it.each([
    ['fetch', `await fetch('x')`, ['fetch(']],
    ['fetch.call', `fetch.call(globalThis, url)`, ['fetch(']],
    ['XMLHttpRequest', `new XMLHttpRequest()`, ['XMLHttpRequest']],
    ['WebSocket', `new WebSocket(url)`, ['WebSocket']],
    ['axios', `import axios from 'axios';`, ['an HTTP client import']],
    ['File.downloadFileAsync', `await File.downloadFileAsync(url, dir)`, ['a download or upload']],
    ['createUploadTask', `file.createUploadTask(url)`, ['a download or upload']],
    ['an image from the web', `<Image source={{ uri: 'https://example.com/a.png' }} />`, ['an http(s) URL']],
  ])('catches %s', (_name, source, found) => {
    expect(networkUses(source)).toEqual(found);
  });

  it('lets through words that only look like network code and the local file and share APIs', () => {
    expect(networkUses(`const refetch = () => {}; refetch();`)).toEqual([]);
    expect(networkUses(`import { File, Paths } from 'expo-file-system'; new File(Paths.document, 'x');`)).toEqual([]);
    expect(networkUses(`import * as Sharing from 'expo-sharing'; await Sharing.shareAsync(uri);`)).toEqual([]);
  });
});

describe('network code in the app', () => {
  const files = sourceFiles(SRC);

  it('scans a real tree', () => {
    // A wrong root would pass by scanning nothing.
    expect(files.length).toBeGreaterThan(15);
  });

  it('appears only under src/net/', () => {
    const found = files
      .filter((f) => !f.startsWith(NET))
      .flatMap((f) => networkUses(readFileSync(f, 'utf8')).map((u) => `${rel(f)}: ${u}`));
    expect(found).toEqual([]);
  });

  it('talks only to the allowed hosts inside src/net/', () => {
    const hosts = files
      .filter((f) => f.startsWith(NET))
      .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1].toLowerCase()));
    expect(hosts.filter((h) => !ALLOWED_HOSTS.includes(h))).toEqual([]);
  });
});
