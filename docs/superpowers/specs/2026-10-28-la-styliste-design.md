# la-styliste — design spec

| | |
|---|---|
| Date | 2026-10-28 |
| Status | Approved in conversation; reviewed through four lenses (coverage, consistency, technical, privacy/data loss); awaiting the author's written review |
| Audience | The author (builds it, wears the clothes) and the agents that implement it |
| Language | Code, comments, commits, docs: English. UI strings: Turkish |
| Input | [`BRIEF.md`](../../../BRIEF.md) (the original brief, kept verbatim) |

## 1. Purpose

A wardrobe and outfit app for one person on one iPhone 15. The wardrobe is
mostly black and dark (rock, dark-minimal), work asks for smart casual, and
classic colour-harmony advice says little about an all-black closet. The app
earns its place by doing four things:

1. Turn a photo of a garment into a clean, tagged wardrobe item with almost no
   typing: the background is removed on the phone and an LLM fills the tags.
2. Answer "Bugün ne giysem?" from the weather, the occasion and what was worn
   lately, judging dark outfits by texture, silhouette, formality and hardware
   rather than colour.
3. Keep a wear log, so cost per wear and "not worn in a while" are facts.
4. Prefill each item's brand, condition and second-hand value from the same
   photo, as guesses the user can correct, and learn from those corrections.
5. Keep every record on the phone. Only three things leave it, all on the
   user's own OpenRouter key: a redacted 768 px photo for tagging, a short text
   list of candidate outfits, and, on request, a text-only value re-estimate.

### Non-goals

Backend, accounts, sync, social features, App Store release, more than one
user, Android, 3D or AI try-on (see §14), web or PWA build.

## 2. Decisions

| Topic | Decision | Reason |
|---|---|---|
| Platform | Expo (React Native), TypeScript, SDK 58 | The user is getting a paid Apple Developer account. Native gives Apple Vision for background removal and face detection, durable SQLite storage and a real share sheet. Same toolchain as zirt-dongum. Overrides the brief's "PWA, no native app" |
| Phases | M0–M4 in **Expo Go**; the native Vision module arrives with the first **development build** (N1), once the account is active | Expo Go cannot load custom native code; everything except Vision is plain JS or ships in Expo Go |
| Copies on the phone | After N1, the **preview** build (ad hoc internal distribution) is the one primary copy and holds the real data. The **development** build has a `.dev` bundle-id suffix, its own scheme and a "TEST KOPYASI" banner, and holds test data only. TestFlight and EAS Update stay off until they are missed | One bundle id = one data set. Ad hoc profiles last about a year, so there is no 90-day TestFlight expiry. Rebuild the preview copy yearly while the membership is active |
| Storage | SQLite (`expo-sqlite`) behind zirt-dongum's `Db` interface with hand-written `PRAGMA user_version` migrations; image files under `Paths.document/photos/<id>/` with paths derived from the id | Proven in zirt-dongum; repository tests run on Node's `node:sqlite`; no absolute paths to break when the app container moves. Native storage needs no `persist()` call; backups (§10) cover reinstalls |
| Background removal | Apple Vision `VNGenerateForegroundInstanceMaskRequest` (iOS 17+) in a small local Expo module | Same engine as Photos' "lift subject"; on device; no model download; no Apple Intelligence needed |
| Face privacy | Vision `VNDetectFaceRectanglesRequest` in the same call; faces on worn photos are filled solid in the copy sent for tagging; worn photos go only to models that do not collect data | The user chose "no manual crop"; a solid fill cannot be undone by a model |
| LLM | OpenRouter, OpenAI-compatible chat completions, user's own key in `expo-secure-store`; user-editable `models` fallback list; one-time $10 top-up | $10 lifts the free cap from 50 to 1000 requests/day and funds paid models at about $0.001–0.002 per photo, enough to tag 100–200 items in one evening |
| Resale value | The tagging call also returns brand (only when a logo or label is visible), condition, visible flaws and a second-hand value range in TRY. Every AI guess is marked until the user edits it. A per-user correction factor (median of the user's corrections) scales new estimates | The user wants a prepared first draft, knowing it can be wrong. No extra request per item. LLM price knowledge is dated and TRY moves fast, so the user's own corrections are the calibration |
| Recommender | Local, rule-based, pure TypeScript in `src/core/`; then one LLM call to pick 3 of the top 10 and explain each in one Turkish sentence | Works with no key; testable on Node |
| Weather | Open-Meteo forecast + geocoding, no key, cached 60 min | Free for non-commercial use, CC BY 4.0 attribution |
| Backup | One zip (data JSON + photo files), streamed with `fflate`, shared through `expo-sharing`; staged import with a durable safety copy | The only way data survives a reinstall or the Expo Go → preview move (separate sandboxes) |
| Repo | `zz_personal/la-styliste/`, own git, **public** GitHub `ekrtp/la-styliste`, per-repo identity `ekrtp <ekrtp@users.noreply.github.com>` | No secrets, photos or company names in the repo; `.gitignore` and a commit gate enforce it (§12) |
| Process | Spec + plans in `docs/superpowers/`; TickTick section *Yan Projeler › la-styliste*; Obsidian note `01_PROJECTS/la-styliste` | Same as zirt-dongum |

## 3. Release plan

Each milestone runs on the iPhone before the next starts. "Done when" is a
state that can be checked in one sitting; longer use runs in parallel with the
next milestone.

| Milestone | Promise | Scope | Done when |
|---|---|---|---|
| **M0 Skeleton** | "It opens on my phone" | Project on SDK 58 with zirt-dongum patterns copied (Db, migrations, theme, `makeStyles`, `Text`, labels, vitest), four tabs, dark theme, network guard, `.gitignore`, public-repo gate, README | Opens in Expo Go; `npm test`, `npm run typecheck`, `npx expo export -p ios` and `npm run check:public` pass; README covers Windows setup, `npx expo start` (LAN, else `--tunnel`), Expo Go login and the gates |
| **M1 Wardrobe** | "My clothes are in it" | Add item from camera or library with a photo kind (flat / hanger / worn), alpha check, resize, crash-safe save; manual tag form; grid with filters; item detail and edit; status; backup export and staged import; backup nudge | Five items added by hand; exported to Files; the app's data deleted and restored from that zip with identical items and photos |
| **M2 AI tagging** | "It tags for me" | Key entry, editable model list, JS-side LLM image, tagging call (tags + brand, condition, resale value), AI-guess markers, value correction factor, "Değeri yeniden tahmin et", wardrobe value line, draft items, crash-safe queue with its own screen, quota badge, Turkish errors | 100–200 flat/hanger items added in one evening; killing the app mid-queue loses no result; worn photos wait in the queue for N1; after three value corrections, new estimates show the correction factor |
| **M3 Outfits** | "I can record what I wear" | Outfit builder by slot (all slots, accessories included), save and rate (-1/0/1), "Bugün bunu giydim" with an optional mirror photo, wear log, cost per wear | Three wear-log entries survive an app restart; cost per wear shows on an item with a price |
| **M4 Bugün ne giysem** | "It dresses me in the morning" | Weather, occasion rules editable in Settings, rule engine with tests, local top 3 at once, one LLM call upgrades the reasons, keyless mode | With three ratings in the database, changing the date gives a different list and a −1 outfit never appears; with the key removed, three suggestions still appear |
| **N1 Native vision** | "It cleans my photos" | `eas.json`, `app.config.ts` variants, `eas device:create`, Developer Mode, dev client, local module `wardrobe-vision`, preview build, Expo Go → preview data move, device test on 20 real photos, one-time reprocess of stored originals, worn queue released | Dev build and preview build installed; Expo Go backup restored into the preview copy and checked; flat/hanger photos show as cut-outs; a worn photo goes to tagging with the face filled; README gains the build, install and yearly-rebuild steps |

**Later** (the data model is ready, §5): "Bunu alsam mı?" via a share
extension (a product screenshot → how many new outfits it unlocks, using
`status = wishlist`), gap analysis, preference learning from ratings,
accessories and headwear in suggestions, garment cut-outs on worn photos
(iOS 27 tap-to-select or VisionKit subject pick), OAuth sign-in for the key.

## 4. Architecture

```
la-styliste/
├─ BRIEF.md · README.md · .gitignore
├─ docs/superpowers/{specs,plans}/
└─ app/
   ├─ app.config.ts            bundle id, scheme `lastyliste`; dev variant adds `.dev` / `lastyliste-dev`
   ├─ eas.json                 development + preview profiles (N1)
   ├─ scripts/check-public.mjs commit gate for the public repo
   ├─ modules/wardrobe-vision/ local Expo module, Swift (N1)
   └─ src/
      ├─ app/                  expo-router routes: (tabs)/{index,outfits,today,settings}, add, queue, item/[id]
      ├─ core/                 pure TS, no React/RN/Expo imports
      │  ├─ recommend/         config (constants), filter, generate, score, rank (+ tests)
      │  ├─ tags.ts            tag vocabulary + zod schemas
      │  └─ weather.ts         band and rain derivation from a forecast
      ├─ data/                 Db, expoDb, migrations, repositories, backup, recovery, testing/nodeDb
      ├─ net/                  the only network code: openrouter.ts, openMeteo.ts
      ├─ media/                picker, alpha check, resize, photo files, llmImage, vision bridge (stub in Expo Go)
      ├─ features/             screen logic + components per feature
      ├─ state/                AppData provider (backup db file, migrate, load, recovery screen)
      └─ ui/                   Text, themes, makeStyles, labels (Turkish)
```

Rules carried over from zirt-dongum: `src/core/**` imports nothing from React,
RN or Expo; tests sit next to their source as `*.test.ts`; components never
import static tokens (`useTheme()` / `makeStyles`); third-party APIs are
checked against the installed `.d.ts`, not memory; native packages go in with
`npx expo install`; a transparent navigation theme from day one.

### Add-item flow

```
camera / library ──► kind? flat | hanger | worn
        │
        ▼
 write files into photos/<id>.tmp/ ──► rename to photos/<id>/ ──► one transaction:
   original.<jpg|png>                  photo row + draft item + tag job
   display.webp, thumb.webp
        │
        ├─ alpha already (PNG colour type 4/6 or tRNS) ──► cutout_state = done, original.png
        ├─ Expo Go ───────► cutout_state = pending (N1 reprocesses)
        └─ dev/preview ───► wardrobe-vision.process(uri, kind)
        ▼
 queue: job ──► llm.jpg (redacted) ──► OpenRouter ──► result stored on the job
        ▼
 queue screen ──► review form (prefilled) ──► "Kaydet" ──► status draft → active
```

### Suggestion flow

```
Open-Meteo (cached) + occasion ──► filter items ──► generate combos (capped) ──► score ──► MMR top 10
        ├──► local top 3 + template reasons, shown at once
        └──► one LLM call (cached per date, occasion, band, wardrobe hash) ──► 3 picks + Turkish reasons replace them
```

## 5. Data model

SQLite, snake_case columns, English names. Enums are stored as English keys;
`ui/labels.ts` maps them to Turkish.

| Table | Columns |
|---|---|
| `items` | `id` TEXT pk, `status` (draft · active · laundry · archived · wishlist), `slot` (top · mid · bottom · onepiece · shoes · outer · accessory · headwear; NULL only for drafts), `subcategory`, `colors` JSON, `material`, `texture`, `pattern`, `silhouette` (fitted · regular · relaxed · oversized), `formality` 1–5, `warmth` 1–5, `seasons` JSON, `details` JSON, `notes`, `brand` NULL, `condition` (new_with_tags · like_new · good · worn · poor; NULL), `condition_notes` JSON NULL, `resale` JSON NULL, `ai_fields` JSON, `price` NULL, `acquired_at` NULL, `primary_photo_id`, `tag_source` (ai · manual · NULL), `tag_model` NULL, `created_at`, `updated_at` |
| `photos` | `id` TEXT pk (`^[A-Za-z0-9_-]{8,64}$`), `item_id` NULL, `outfit_id` NULL, `kind` (flat · hanger · worn · outfit), `original_ext` (jpg · png), `cutout_state` (none · pending · done · failed), `face_state` (n/a · pending · filled · none_found · confirmed), `created_at` |
| `outfits` | `id` pk, `key` unique, `source` (manual · engine · llm), `rating` (-1 · 0 · 1 · NULL), `saved_occasion` NULL, `photo_id` NULL, `created_at` |
| `outfit_items` | `outfit_id`, `item_id`, `slot` |
| `wear_log` | `id` pk, `date`, `outfit_id` NULL, `item_ids` JSON, `occasion`, `weather` JSON (`tmin`, `tmax`, `rain`, `wind`) |
| `tag_jobs` | `item_id` pk, `state` (queued · running · done · failed), `attempts`, `last_error`, `model`, `result` JSON NULL, `updated_at` |
| `settings` | key-value, JSON values, fixed key list: `city`, `occasion_rules`, `models`, `free_only`, `theme_mode`, `weather_cache`, `last_export_at`, `changes_since_export` |

- **Files** (derived from the id, never stored): `photos/<id>/original.<ext>`,
  `display.webp` (1024 px, alpha when cut out), `thumb.webp` (300 px),
  `llm.jpg` (768 px redacted copy, regenerated, never backed up).
- **Drafts.** A new photo creates a draft item and its job in one transaction.
  A finished job stores the validated tags in `tag_jobs.result`; the review
  form is prefilled from it and the user's "Kaydet" makes the item `active`.
  Drafts are hidden from the grid and the engine and listed on the queue
  screen. Nothing leaves draft without the user's tap.
- **Outfit key** = sorted ids of the engine slots only (top, mid, bottom,
  onepiece, shoes, outer) joined by `+`. Accessories and headwear are stored in
  `outfit_items` but not in the key. A rating belongs to the clothes, not to
  the occasion.
- **Derived, never stored:** `wear_count`, `last_worn_at`, cost per wear (from
  `wear_log`); job waiting reasons (§7).
- **Resale value.** `resale` = `{low, high, aiMid, basis, model, at, source}`
  in TRY: `basis` is one Turkish sentence ("Levi's 501, iyi durumda, ikinci
  elde genelde bu aralıkta"), `aiMid` keeps the model's midpoint after a user
  edit, `source` is `ai` or `user`. `price` stays the purchase price the user
  types; cost per wear uses only `price`.
- **AI guesses.** `ai_fields` lists the fields still holding an unedited AI
  guess (e.g. `["brand", "condition", "resale"]`). The UI marks them "AI
  tahmini"; editing a field removes it from the list.
- An item can hold several photos: the primary one (grid image, the only one
  ever sent for tagging) and extra worn fit photos for oversize pieces.
- The OpenRouter key lives only in `expo-secure-store` and never enters a
  backup.
- Deliberately absent: an `impressions` table. Ratings and `wear_log` already
  hold the labels preference learning needs; it comes back with that feature.

## 6. Image pipeline

**Input.** `expo-image-picker` with `allowsEditing: false`, `quality: 1`,
`preferredAssetRepresentationMode: Current`, no base64. Only this combination
keeps PNG alpha and HEIC bytes. The user picks the photo kind before shooting.

**Alpha check.** JPEG has none. For PNG, read the IHDR colour type (byte 25:
4 or 6) or a `tRNS` chunk in JS. HEIC alpha needs the native `hasAlpha(uri)`
from N1; until then HEIC is treated as opaque. An image with alpha is kept as
`original.png`, gets `cutout_state = done`, and N1 never reprocesses it.

**Resize and encode.** `expo-image-manipulator` contextual API:
`manipulate(uri).resize(...).renderAsync()` then `saveAsync({format})`. Always
pass the format: the default is JPEG, which drops alpha. Originals are kept at
≤ 2048 px (JPEG, or PNG when they carry alpha) so N1 can reprocess them.
`display.webp` is made from the cut-out when there is one; no separate cut-out
file is stored. If the M1 device check shows WEBP losing alpha, `display` and
`thumb` switch to PNG through one constant.

**Crash safety.** Files go into `photos/<id>.tmp/` and are renamed to
`photos/<id>/` before the database rows are inserted in one transaction. On
launch a sweep deletes `.tmp` folders and folders without a row, and marks rows
whose files are missing. Write errors roll the row back and show a Turkish
message; a free-space check runs before saves, exports and imports.

**LLM image (`media/llmImage.ts`).** Every upload is a fresh 768 px JPEG
(quality 0.8) written to `llm.jpg`. 768 px instead of the brief's 512: Gemini
bills a fixed 1120 tokens per image at default resolution, so smaller saves
nothing, and studs and zips stay legible. In Expo Go it is built in JS from
`display.webp` (flat and hanger only). From N1 the module's output replaces it.
Before sending, a JS check refuses any JPEG that still has an EXIF (APP1)
segment.

**`wardrobe-vision` module (N1).** About 250 lines of Swift on the Expo
Modules stable DSL, started from the MIT source of
`@westwood-dev/expo-segmentation`. `AsyncFunction process(uri, kind)`:

1. Fix EXIF orientation; downscale to ≤ 2048 px with
   `CGImageSourceCreateThumbnailAtIndex` (the template lacks this; a 48 MP
   photo must not reach Vision).
2. One `VNImageRequestHandler` runs `VNDetectFaceRectanglesRequest` and, for
   flat and hanger photos, `VNGenerateForegroundInstanceMaskRequest`.
3. Cut-out: `generateMaskedImage(ofInstances: allInstances, from:,
   croppedToInstancesExtent: true)` → PNG in the cache, encoded by JS into
   `display.webp`. An empty mask means "no clear foreground": keep the original.
4. LLM image, always with every face box (expanded 1.5×) filled solid:
   flat/hanger with a cut-out = cut-out on neutral grey; without one, or worn =
   the photo itself. Never the raw original.
5. Returns `{cutoutUri?, llmUri, faceCount, cutoutFound, ms}`. A separate
   `hasAlpha(uri)` covers HEIC.

The Expo Go stub has the same signature and returns
`{cutoutFound: false, llmUri: <JS-built image>}` for flat and hanger, and
nothing for worn. N1 replaces only the stub's body. Gated with
`#available(iOS 17, *)`. Vision masks and face detection do not run on the
Simulator, so an EAS simulator build only proves the Swift compiles. The free
EAS plan allows 15 iOS builds a month: batch native edits.

**Worn photos.** Vision's foreground mask returns the whole person, not the
garment, so worn photos stay uncut and serve as fit photos.

## 7. LLM layer

One OpenAI-compatible client in `src/net/openrouter.ts`. In a native app there
is no CORS, and response headers such as `Retry-After` are readable.

**Key.** Pasted in Settings, stored with `expo-secure-store`
(`keychainAccessible: AFTER_FIRST_UNLOCK`) and read once per queue run, so a
screen lock mid-queue does not look like a bad key.

**Models.** `settings.models` is the user's ordered list: add, remove,
reorder, free-text ids. The defaults seed it on first run only:
`google/gemma-4-31b-it:free`, `dots-studio/dots-3-note-preview:free` (expires
2026-12-31), `google/gemma-4-26b-a4b-it:free`, then paid
`google/gemini-3.1-flash-lite`. A "Güncel ücretsiz modeller" button fetches
`GET /api/v1/models` and offers ids that are `:free`, take image input and
list `structured_outputs`; it never rewrites the list, only flags ids that
are gone. "Sadece ücretsiz" filters at call time. The answering model
(`response.model`) goes into `items.tag_model`.

**Request.** `response_format: {type: "json_schema", strict}` with
`provider: {require_parameters: true}`, so the fallback array skips endpoints
that would ignore the schema; zod validation and one retry; `max_tokens` ≥
2000 (several free models reason first); `reasoning: {effort: "minimal"}` (check
once in M2 that `usage` shows few reasoning tokens); image as a
`data:image/jpeg;base64` part after the text. Timeout 45 s for tagging, 20 s
for suggestions. Stay under 20 requests a minute.

**Errors (Turkish, never blocking).**

| Case | What happens |
|---|---|
| 401 | Queue pauses: "Anahtar geçersiz, Ayarlar'dan kontrol et" |
| 402 | Queue pauses: "Kredi bitti, OpenRouter'dan yükle" |
| 429 | Wait `Retry-After`, else 3 s / 10 s / 30 s. After the third wait the job goes back to `queued` with `last_error`; the badge says "Günlük limit doldu, yarın devam eder" when the quota is 0, otherwise "Çok hızlı, bekliyorum" |
| Timeout / network | Job back to `queued`, retried on the next run |
| Invalid JSON twice | Job `failed`; the review form opens empty for manual tags |

On launch every `running` job returns to `queued` without counting an attempt.
The quota badge reads `GET /api/v1/key` (free requests left today).

### Privacy rules

1. The client accepts only a branded `RedactedImage`, which only
   `buildLlmImage(photo)` can create. It reads only `llm.jpg`, and only for an
   item's primary photo of kind flat, hanger or worn; outfit photos and extra
   fit photos are never sent.
2. A worn photo needs `face_state` `filled`, or `confirmed` (set by the user's
   tap on the preview when no face was found; a mirror selfie often hides the
   face behind the phone).
3. A worn photo is sent with `provider: {data_collection: "deny"}`, which in
   practice means a paid model. With "Sadece ücretsiz" on, worn photos wait
   with a message. Flat and hanger photos may use free models.
4. Jobs wait (shown on the queue screen with the reason) while a worn photo is
   not `filled`/`confirmed`, or while the vision stub is active.
5. An import resets `face_state` to `pending` for every worn photo and
   regenerates `llm.jpg`.
6. The suggestion payload is built from a field allowlist: short id, slot,
   subcategory, colours, material, texture, pattern, silhouette, formality,
   warmth, details; plus band, rain flag and occasion. Never notes, price,
   brand, condition, resale value, dates, city, coordinates, file names or ids
   from the database.

### Tagging call

One call per item. The prompt asks for the tag vocabulary of §5 as strict
JSON (slot, subcategory, colours, material, texture, pattern, silhouette,
formality, warmth, seasons, details) plus:

- `brand`: only if a logo or label is readable on the photo, else null (no
  guessing from style);
- `condition` from the §5 enum and `condition_notes`: visible flaws in short
  Turkish phrases ("hafif tüylenme", "yakada solma"), empty when none;
- `resale`: `{low, high, basis}` in TRY for the Turkish second-hand market
  today (the prompt carries the current date), judged from brand, type,
  material and condition.

The result is stored on the job and prefills the review form; all of these
fields start in `ai_fields`.

**Value correction factor** (`src/core/resale.ts`). Once at least 3 items
have `source = user` with an `aiMid`, factor = median of `userMid / aiMid`,
clamped to [0.25, 4]. New estimates are multiplied by it and the item shows
"senin düzeltmelerine göre ×1,3". Below 3 corrections the factor is 1.

**Re-estimate call.** When the user changes brand or condition, "Değeri
yeniden tahmin et" sends one text-only request (slot, subcategory, material,
brand, condition, notes on flaws; no image). Never automatic.

### Suggestion call

Items are listed once and candidates refer to them by short id (about
1–1.5k tokens). Temperature 0.4. The model picks 3 distinct candidates and
gives one Turkish sentence each (≤ 25 words, naming at least one texture or
detail match). zod checks: exactly 3, unique, all from the candidate set, and
no two sharing both top and bottom; else one retry, then the local top 3 stay.

- The local top 3 with template reasons render at once; the LLM answer
  replaces them in place.
- The result is cached per (date, occasion, band, wardrobe hash) and reused
  until one changes or the user taps "Yenile".
- With ≤ 3 candidates the LLM is skipped. With 0 the screen says "Bu hava ve
  durum için uygun parça yok" and names the rule that removed the most items.
- When the LLM is not used, a small line says why: "Anahtar yok", "Kredi
  bitti", "Limit doldu, birazdan dene".

## 8. Recommender

Pure TypeScript in `src/core/recommend/`. Bands, weights and caps are
constants in `config.ts`, each with a comment on why that value; only the
occasion rules are stored in `settings` and editable. Source: the rule draft
from the 2026-10-26 research round, adjusted for the mid layer.

**Inputs.** Open-Meteo daily `apparent_temperature_min/max`,
`precipitation_probability_max`, `wind_speed_10m_max`, `weather_code`,
`timezone=auto`. `tDay = (tmin + tmax) / 2`. Outfit warmth
`W = top + mid + bottom + outer`; a one-piece contributes its warmth twice (as
top and as bottom); shoes do not count.

**Slots (fixed).** One top + one bottom, or one one-piece; one pair of shoes;
mid layer 0 or 1; outer 0 or 1. Only `status = active` items. Accessories and
headwear are not suggested in v1 (§14).

**Temperature bands** (lower bound inclusive). Target `W` is a hard filter;
`warmthFit` only ranks the survivors.

| Band | `tDay` °C (apparent) | Outer | Target `W` | Seasons |
|---|---|---|---|---|
| hot | ≥ 24 | forbidden, mid too | 2–4 | summer |
| warm | [18, 24) | forbidden; optional if `tmin` < 12 | 3–6 | summer, spring |
| mild | [12, 18) | optional; required if `tmin` < 10 | 4–7 | spring, autumn |
| cool | [6, 12) | required | 6–9 | autumn, winter |
| cold | [0, 6) | required, warmth ≥ 3 | 8–11 | winter |
| freezing | < 0 | required, warmth ≥ 4 | 10–13 | winter |

Season filter (fixed): an item passes if `seasons` is empty or overlaps the
band's set; the season comes from the weather, not the calendar.

**Rain.** ≥ 60 %: reject suede/nubuck, canvas or mesh shoes, open toes.
30–59 %: same items allowed at −0.10 each.

**Hardware.** Detail weights: exposed zip 0.5, D-ring/eyelet 0.5, buckle 1,
grommets 1, chain 2, studs 3, spikes 3. An item's weight is the sum of its
details; an item is **heavy** when its own weight is > 2. An outfit's
hardware is the sum over its items and must stay within the occasion budget.

**Occasions** (editable).

| Occasion | Item formality | Mean formality | Forbidden | Hardware budget | Heavy items |
|---|---|---|---|---|---|
| İş | 2–5 | ≥ 3.0 | pattern `graphic`; details `ripped`, `distressed` | ≤ 2 | no |
| Okul | 1–5 | 1.5–4 | — | ≤ 5 | yes |
| Hafta sonu | 1–4 | ≤ 3.5 | — | ≤ 8 | yes |
| Akşam | 2–5 | 2.5–4.5 | — | ≤ 6 | yes |

Formality spread (max − min) > 2 is rejected. An exact outfit (same key) rated
−1 is never suggested again.

**Score.** `S = Σ wᵢ·fᵢ − penalties`, each `fᵢ ∈ [0, 1]`.

| Term | Weight | Gist |
|---|---|---|
| texture | 0.20 | (distinct texture families − 1) / (slots − 1); all-black leather + knit + denim = 1 |
| rating | 0.20 | pair ratings shrunk toward 0, exact-outfit rating weighted 0.6; 0.5 with no history |
| freshness | 0.15 | days since worn, capped at 14; shoes and outer count half |
| tone | 0.10 | 0.5 base; +0.25 for two dark tones; +0.25 for exactly one light/accent piece; all-black never punished |
| silhouette | 0.10 | fitted + loose = 1; both fitted 0.6; both loose 0.2 |
| hardware | 0.10 | exactly one item with weight ≥ 1 (a statement piece) = 1; none 0.6; two 0.5; three or more 0.1 |
| warmthFit | 0.10 | distance of `W` from the band's middle |
| formalityFit | 0.05 | distance from target (İş 3.5, Okul 2.5, Hafta sonu 2.5, Akşam 3.5) |

Penalties: rain 30–59 % −0.10 per sensitive item; exact outfit worn in the
last 14 days −0.15.

**Generation.** Filter items, keep the best per slot by a cheap pre-score
(top 20, mid 5 + none, bottom 12, shoes 8, outer 6 + none), nested loops with
pruning on reachable `W` and formality spread. Hard ceiling 50,000 combos;
slot caps shrink in proportion. Pair ratings come from a map built once per
run.

**Ranking (fixed).** Ties (`|ΔS| < 0.005`) break by `hash(date + key)`:
stable within a day, rotating across days. MMR with λ = 0.3 picks the top 10;
no two of the top 3 share both top and bottom, and no item appears more than
twice.

**Tests (at least these 12).** İş rejects a graphic tee; İş rejects ripped
denim; İş rejects studded boots (weight 3, heavy) but keeps a biker jacket of
two zips and a buckle (weight 2, within the budget); rain 70 % rejects suede;
rain 40 % ranks suede about 0.10 lower; hot band has no outer and rejects a
too-warm knit; cold band forces outer warmth ≥ 3, freezing ≥ 4; leather +
knit + denim beats smooth-woven + leather on texture; an item worn 20 days ago
beats one worn yesterday; a −1 outfit never appears and a +1 outfit ranks up;
top 3 is diverse and deterministic per date; Akşam rejects a mean formality of
2.0 that Hafta sonu keeps.

## 9. Weather

`src/net/openMeteo.ts`. The city is set once in Settings through the geocoding
API (name → lat, lon, timezone); no location permission. Forecast results are
cached for 60 minutes in `settings.weather_cache`. Settings shows "Hava
durumu: Open-Meteo.com" (CC BY 4.0). Offline with no cache → the user picks
the band by hand.

## 10. Backup and data safety

**Export.**

1. Free-space check (photo bytes × 1.1), with the numbers in the message.
2. Zip in the cache, streamed with fflate `Zip` + `ZipPassThrough` (store
   mode; images are already compressed), one file at a time with awaited
   `FileHandle` writes and a progress bar (CRC32 runs in JS).
3. Contents: `manifest.json` (app id, export format, schema version, counts,
   date), `data.json` (every table; settings by the fixed key list, never the
   key), `photos/<id>/original.<ext>` and `display.webp`. Thumbs and
   `llm.jpg` are regenerated.
4. Re-open the zip, compare entry count and bytes with the manifest, then say
   "Yedek hazır" and open `expo-sharing` ("Dosyalar'a Kaydet").
5. Delete the cache zip when the share sheet closes; set `last_export_at` and
   reset `changes_since_export`.

**Nudge.** Gardırop shows a banner when data changed and the last export is
older than 7 days, and after every bulk session.

**Import.**

1. `expo-document-picker` (`type: application/zip`), free-space check (zip ×
   3).
2. Stream: `new File(uri).open()`, `readBytes` in 1 MB chunks into fflate
   `Unzip` with `UnzipPassThrough`. `manifest.json` and `data.json` come first
   and are validated with zod before any photo is read.
3. Refuse: a schema version newer than the app; entry names other than
   `^photos/<id>/(original\.(jpg|png)|display\.webp)$` with `<id>` present in
   `data.json`; ids failing the id pattern; more than the entry, byte, row and
   date caps (the zirt-dongum lesson: a bad import must not crash every
   launch).
4. Confirmation shows the backup's date and counts next to the current counts,
   with a red line when the backup is older or smaller.
5. Safety copy: the current data is exported to
   `Paths.document/safety/pre-import-<date>.zip` (not the cache, which iOS may
   purge), kept until the next successful launch after the import; Settings
   can restore it.
6. Photos are unzipped into `photos.incoming/`. An older schema is loaded into
   an empty database at its `user_version` and migrated up. All rows are
   replaced in one transaction.
7. Only after the commit: `photos` → `photos.old`, `photos.incoming` →
   `photos`, delete `photos.old`. On launch, a leftover `photos.incoming` or
   `photos.old` is finished or rolled back.

**Migrations.** Before migrating, the database file is copied to
`<name>.db.bak-v<old>` (kept until the next version bump). Each migration runs
in one transaction that also sets `user_version` (zirt-dongum `migrate()`). If
opening, migrating or loading throws, AppData shows a recovery screen instead
of a blank one: export the raw database and photos, restore the `.bak`, or
retry.

**Copies.** Expo Go → preview copy is one backup and restore; the old copy is
deleted only after the restore is checked. The dev copy holds test data only.
The preview copy is rebuilt yearly (ad hoc profile) while the membership is
active; export first.

## 11. Screens

| Tab / route | Content |
|---|---|
| Gardırop (`index`) | Thumbnail grid, filter chips (slot, formality, season, texture, status), one line "Tahmini ikinci el değeri: X–Y TL" for the filtered items, queue badge, backup banner, "+" to add |
| Ekle (`add`, modal) | Kind choice → camera/library → preview → manual form, or "AI'a bırak"; bulk mode keeps the camera open and only queues |
| Kuyruk (`queue`) | Drafts with thumb, job state and waiting reason; "Onayla" opens the prefilled review form; "Yeniden dene" per failed row and for all; the face-preview confirm for worn photos with no face found |
| Parça (`item/[id]`) | Photos (primary + fit photos), tags, brand, condition and flaws, resale range with its one-sentence basis, "AI tahmini" marks, "Değeri yeniden tahmin et", wear count, cost per wear, status |
| Kombinler (`outfits`) | Saved outfits, builder by slot (accessories and headwear included), rate, "Bugün bunu giydim" with optional mirror photo |
| Bugün (`today`) | Weather line, occasion chips, 3 suggestions with reasons, "Bunu giydim" and 👍/👎, "Yenile" |
| Ayarlar (`settings`) | Key, models (edit, reorder, refresh free list), free-only, quota, city, occasion rules, backup (last export date, export, import, restore safety copy), attribution, build date |

Dark theme by default.

## 12. Testing and gates

**Vitest on Node** (`node:sqlite` behind the `Db` interface):

- `src/core/**`, including the 12 recommender tests and the value correction
  factor (fewer than 3 corrections → 1; median, not mean; clamped; an edited
  field leaves `ai_fields`).
- Repositories and migrations: every N → N+1 migration on seeded data keeps
  rows and values; a migration that throws midway leaves the database at N
  (zirt-dongum `dbAtVersion` pattern).
- Backup: round trip (export, import into an empty database, deep-equal every
  table, compare file hashes) with fixture files in a temp folder; restore of a
  schema-v1 fixture into the current version; entry-name allowlist including
  `../` entries; a settings value starting with `sk-or-` makes export throw;
  the import-recovery decision (what to do with leftover folders) as a pure
  function; the zirt-dongum export-completeness check (every table and column
  listed).
- Privacy: the `buildLlmImage` matrix (kind × face_state × primary/extra);
  the EXIF check; the suggestion allowlist (an item whose notes and price hold
  a sentinel string; the sentinel is absent from the payload); worn requests
  carry `data_collection: "deny"`.
- Queue: kill simulation at each job state (`running` → `queued`, results
  kept).

**Network guard** (`src/net.test.ts`, from zirt-dongum's no-network test):
outside `src/net/`, no `fetch`, `XMLHttpRequest`, `WebSocket`, upload or
download tasks, or `http` URIs; inside it, only `openrouter.ai`,
`api.open-meteo.com` and `geocoding-api.open-meteo.com`. Logging rule: no
`console.*` call receives a payload, header or key.

**Public repo.** `.gitignore` blocks `*.zip`, images outside `app/assets/`,
`*.mobileprovision`, `*.p12`, `credentials.json`, `.env*`. Test fixtures are
synthetic; real photos stay outside the repo. `npm run check:public` scans the
staged diff for `sk-or-`, private-key blocks and binaries over 200 KB outside
`app/assets/`.

**Gates before every commit:** `npm test`, `npm run typecheck`,
`npx expo export -p ios`, `npm run check:public`. Device checks (§13) are
recorded in the plan with their results.

## 13. Device checks (things no source could settle)

| Check | When | Fallback if it fails |
|---|---|---|
| Expo Go on the phone opens an SDK 58 project (one research pass said the store still had 57) | M0 | Create on SDK 57, upgrade at N1 |
| A lift-subject PNG from Photos keeps alpha through the picker | M1 | Treat as opaque; Vision cuts it in N1 |
| WEBP from `expo-image-manipulator` keeps alpha | M1 | Display and thumb as PNG |
| fflate export and import of ~200 photos: time and memory | M1 | Split the export into parts of ~50 photos; `react-native-zip-archive` after N1 |
| `expo-sharing` offers "Dosyalar'a Kaydet" for a zip | M1 | Another share target (iCloud Drive) |
| Free models return valid JSON for clothing photos; `reasoning.effort` keeps reasoning tokens low | M2 | Paid model first; `reasoning: {max_tokens: 0}` |
| Brand, condition and value on 20 items whose real resale range the user knows: how far off, and does a 768 px photo show pilling or fading at all | M2 | Ask for an optional close-up photo for condition; lean on the correction factor |
| Vision cut-out quality on flat, hanger and worn photos; latency at 2048 px | N1 | Keep originals as display images |
| Face detection on mirror selfies | N1 | Confirm-preview path (§7) |
| Restore into a wiped copy at every move (Expo Go → preview) | N1 | Keep the old copy until it passes |

## 14. Out of scope and deferred, with reasons

- **3D or AI try-on.** Vision has no garment-parsing or body-fitting API, and
  nothing on the device fits clothes onto a body. A cloud image model could
  draw a 2D try-on, but that sends body photos to a provider and costs per
  image. Not planned; worn fit photos cover "how does it look on me".
- **Accessories and headwear in suggestions.** They live in the wardrobe and
  the manual builder, but adding them as engine slots multiplies the combos.
  Consequence to know: a studded belt is not counted in the İş hardware
  budget, so the user checks it by eye.
- **OAuth for the key.** OpenRouter documents only https and localhost
  callbacks; paste the key, test a custom scheme later.
- **Share extension.** Needed for "Bunu alsam mı?"; later, needs a dev build.
- **TestFlight and EAS Update.** Ad hoc preview builds cover one person;
  revisit when rebuilding for every JS change becomes a chore.
- **Live market prices.** Checking resale values against current listings
  (a web-search-enabled model) would be more accurate for known brands but
  costs extra per item; revisit if the correction factor is not enough.
- **A trained price model.** There is no labelled data to train one; the
  user's corrections are the only ground truth, and the correction factor
  uses them.

## 15. Facts this design rests on (checked 2026-10-26 / 28)

| Fact | Source |
|---|---|
| `VNGenerateForegroundInstanceMaskRequest` is iOS 17+, no Apple Intelligence requirement, does not run on the Simulator | developer.apple.com Vision docs; Apple forums (2024) |
| iOS 27 `GenerateIterativeSegmentationRequest` segments from a tap; WWDC26 names clothing as a target; downloads a model | developer.apple.com; WWDC26 session 237 |
| Expo SDK 58 is current (RN 0.88, New Architecture only); App Store Expo Go 58.0.5 | expo.dev changelog (2026-10-15, 10-22) |
| EAS free plan: 15 iOS builds/month, low priority; a device build needs the paid Apple account; ad hoc profiles last about a year | expo.dev/pricing; Expo docs |
| `expo-image-picker` keeps PNG alpha only without editing, with quality 1 and the Current mode | Expo source and docs |
| OpenRouter: free tier 20 rpm, 50/day below $10 purchased, 1000/day at ≥ $10; `models` falls back on any error; `structured_outputs` + `provider.require_parameters` for strict schemas; `reasoning.effort` | openrouter.ai/docs (limits, model routing, structured outputs, reasoning tokens) |
| Free endpoints may train on prompts; `provider.data_collection: "deny"` excludes them | openrouter.ai privacy and provider routing docs |
| Gemini 3 bills a fixed 1120 tokens per image at default resolution | ai.google.dev pricing |
| Open-Meteo: non-commercial, 10,000 calls/day, CC BY 4.0 | open-meteo.com/en/terms |

Full research digests: workflow runs `wf_73b7b5c2-93b` (2026-10-26),
`wf_c9f7dd20-491` (2026-10-28) and the spec review `wf_23a3a5d3-e35`
(2026-10-28) in the author's Claude Code session folder.

## 16. Decision log

| Date | Decision |
|---|---|
| 2026-10-26 | All garment types; 100–200 items in bulk; public repo; zirt-dongum process |
| 2026-10-28 | Both flat/hanger and worn photos; extra fit photo per item, mirror photo per outfit |
| 2026-10-28 | Expo native instead of PWA (Apple Developer account coming) |
| 2026-10-28 | $10 OpenRouter top-up for the bulk import |
| 2026-10-28 | Faces filled automatically on device before upload; no manual crop; worn photos only to non-collecting (paid) models |
| 2026-10-28 | Second-hand value, brand and condition prefilled by the tagging call as editable AI guesses; user corrections calibrate later estimates |
| 2026-10-28 | Spec review: draft items and a stored job result; staged import with a durable safety copy; paths derived from ids; one preview build as the primary copy instead of TestFlight; recommender weights as constants, only occasion rules editable; `impressions`, exploration slots and weather bonuses cut |
