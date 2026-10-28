# La Styliste

A personal wardrobe and outfit app for one iPhone: photograph a garment, let the phone cut it out and an LLM tag it,
and get three reasoned outfit suggestions each morning from the weather, the occasion and what was worn lately.
Everything stays on the phone. Design: [`docs/superpowers/specs/2026-10-28-la-styliste-design.md`](docs/superpowers/specs/2026-10-28-la-styliste-design.md).

Status: **M0 skeleton** — four empty tabs, settings, the guards. See the release plan in the spec (§3).

## Requirements

- Windows 11 (no Mac needed; native builds go through EAS in the cloud from N1 on)
- Node 24 LTS
- An Expo account, and Expo Go from the App Store on the iPhone, signed in to the same account

## Run it on the iPhone

```bash
cd app
npm install
npx expo login          # once, same account as in Expo Go
npx expo start
```

Scan the QR code with the iPhone camera; it opens in Expo Go. The phone and the PC must be on the same Wi-Fi.
If the network isolates devices (guest or office Wi-Fi), use `npx expo start --tunnel` instead.

## Checks before every commit

Run from `app/`:

```bash
npm test
npm run typecheck
npx expo export -p ios --output-dir dist
npm run check:public    # refuses photos, archives, large binaries and keys in the staged change
```

## Layout

| Path | What |
|---|---|
| `app/src/app/` | Routes (expo-router) |
| `app/src/data/` | SQLite behind a small `Db` interface, migrations, repositories |
| `app/src/ui/` | Themes, text components, Turkish labels |
| `app/src/net/` | The only code allowed to use the network (from M2) |
| `docs/superpowers/` | Spec and implementation plans |

## Privacy

The wardrobe, photos and wear log live only on the phone. The app talks to two hosts: OpenRouter (tagging and
suggestions, on the user's own key, from M2) and Open-Meteo (weather, from M4). A test fails the build if any other
code reaches the network.
