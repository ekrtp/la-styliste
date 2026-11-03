# Working on La Styliste

Read this before changing anything; then the [spec](docs/superpowers/specs/2026-10-28-la-styliste-design.md),
the current plan in [`docs/superpowers/plans/`](docs/superpowers/plans/) and [`app/AGENTS.md`](app/AGENTS.md)
(Expo APIs change every SDK: check the versioned docs, never memory).

## Where the work stands (2026-11-03)

| Milestone | Branch | State |
|---|---|---|
| M0 skeleton | `main` | done, checked on the phone |
| M1a wardrobe | `feat/m1` | done, published to EAS `preview`; **not merged**: waits for the author's device check (M1a plan, Task 8 Step 3) |
| M1b backup | — | next: write its plan from the M1a plan's "Handover to M1b" |

Work continues on `feat/m1` until the device check passes. Merging into `main` is the author's call.

## How work is done

- Spec first, then a plan in `docs/superpowers/plans/`, then one task at a time with tests and a review.
  A decision that changes the spec goes into the spec's decision log.
- English for identifiers, comments, docs and commit messages. Turkish only in UI text
  ([`app/src/ui/labels.ts`](app/src/ui/labels.ts) and screen copy).
- Every constant gets a comment line directly above it: what it is, why that value.
- Add Expo packages with `npx expo install`, not `npm install <pkg>`.
- Before every commit, from `app/`: `npm test`, `npm run typecheck`, `npx expo export -p ios --output-dir dist`.
  Run `git config core.hooksPath .githooks` once per clone so the commit gate runs.
- Phone delivery: README, "Run it on the iPhone". Needs the project owner's Expo login.

## The repo is public

No photos, backups, archives, keys, signing files, absolute paths, or names of employers or people in any
commit. The OpenRouter key lives only in `expo-secure-store` on the phone: never in code, `.env` or a commit.

## Known minor issues (M1a reviews, not blocking)

Paths are under `app/src/`.

- `data/db.ts`: the `tx` object passed to `transaction(work)` still works after COMMIT; calling the outer `db`
  inside `work` waits forever without an error.
- `data/expoDb.ts`: the backup is written next to `dbPath`, but old backups are looked up in
  `Paths.document/SQLite`; they are the same folder on iOS today.
- `media/images.ts`: the alpha check misses a `tRNS` chunk that starts after the first 64 KB.
- `state/AppData.tsx`: a failed `close()` is swallowed; a failed open keeps its connection until the retry.
- `features/items/addItem.ts`: no test for the cleanup path (needs `vi.mock` of the Expo modules).
- `features/items/PhotoImage.tsx`: the `failed` flag does not reset when `photoId` changes; the loading view is blank.
- `app/item/[id].tsx`: no in-flight guard on status and edit writes (both are idempotent).
