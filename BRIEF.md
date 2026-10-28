# la-styliste — brief and decisions so far

Status 2026-10-26: **planning paused.** No code, no git repo yet. Next step: present the
plan (folder structure, data model, milestones) and get approval. Brainstorming path:
architectural (new project) → spec → writing-plans.

## Decisions so far (2026-10-26)

| Topic | Decision |
|---|---|
| Garment types | Everything: top, bottom, shoes, outer **plus** mid layer (cardigan, knit, overshirt), one-piece (dress, jumpsuit; fills top+bottom), accessories (belt, bag, watch, jewellery; counts toward hardware), headwear (hat, beanie) |
| Scale | 100–200 items, added **in bulk** at the start → tagging cannot rely on the ~50 req/day free tier alone; plan a bulk-add queue and the cheap paid fallback |
| Repo | Public, `ekrtp/la-styliste`, GitHub Pages; per-repo identity `ekrtp <ekrtp@users.noreply.github.com>`; no company names in the repo |
| Location | `zz_personal/la-styliste/` (root repo ignores `zz_personal/`) |
| Process | Like zirt-dongum: `docs/superpowers/specs/` + `docs/superpowers/plans/`, a TickTick section, an Obsidian project note |
| **Platform (2026-10-28)** | **Expo native, not a PWA** — the user is getting a paid Apple Developer account. Overrides the brief's "no native app" non-goal and makes the hosting question moot. Background removal + face blur via Apple Vision in a native module (needs a dev build, i.e. the account); everything else is built in Expo Go first |
| Bulk tagging (2026-10-28) | One-time $10 OpenRouter top-up (free cap 1000/day + cheap paid fallback) |
| Worn photos (2026-10-28) | Both flat/hanger and worn photos supported; optional extra "fit photo" per item and a mirror photo per worn outfit. Before tagging, the app blurs the face automatically on device; no manual crop |
| Plan (2026-10-28) | Approved in chat → write spec + plan. Research digests: PWA round `wf_73b7b5c2-93b` (LLM, weather, recommender draft still valid), native round launched 2026-10-28 |

## Original brief (user, 2026-10-26, verbatim)

# Project: "la-styliste" — personal wardrobe & outfit PWA

## Context
- Single user (me), personal use only. No backend, no accounts.
- Target: iPhone 15 Safari, installed as a home-screen PWA. iPhone 15 has NO Apple Intelligence, so no on-device Apple LLM.
- I develop on Windows (no Mac/Xcode).
- Budget ≈ $0: free hosting (GitHub Pages or Cloudflare Pages), free weather API, LLM via my own API key.
- UI language: Turkish. Default theme: dark.

## Stack
Vite + React + TypeScript, Tailwind, Dexie (IndexedDB), vite-plugin-pwa, zod. Propose alternatives only if there's a strong reason.

## Data model (refine if needed)
- Item: id, image (WebP, transparent bg), thumb, category, subcategory, colors[], material, texture, pattern, silhouette, formality (1–5), warmth (1–5), seasons[], details[] (zips, studs, buckles…), notes, price?, wearCount, lastWornAt, createdAt
- Outfit: id, itemIds[], occasion, rating (-1/0/1), source (manual|suggested), createdAt
- WearLog: date, itemIds[]
- Settings: provider, models[], apiKey, city, occasion rules

## MVP features
1. Add item: camera or photo library → client-side background removal → compress to WebP (~1024px) → AI tagging → I review/edit tags → save.
   - Background removal runs fully in the browser inside a Web Worker. Evaluate @imgly/background-removal or a transformers.js model; check license and iPhone Safari performance; cache the model; show progress.
   - If the image already has transparency (e.g. exported via iOS Photos "lift subject"), skip removal.
2. Wardrobe grid with filters (category, formality, season, texture).
3. Manual outfit builder: pick items per slot, save outfit.
4. "Bugün ne giysem?": weather from Open-Meteo (no key) + occasion (İş / Okul / Hafta sonu / Akşam).
   - Recommender is LOCAL and rule-based first: hard constraints (slots: top + bottom + shoes, optional outer layer; formality range per occasion; warmth vs temperature; rain → avoid suede), then scoring (texture contrast, tonal contrast, not worn recently, my past ratings).
   - Then exactly ONE LLM call: send the top ~10 candidates as compact JSON (no images), ask it to pick 3 and explain each in one Turkish sentence.
   - Must work with no API key (rules only).
5. Wear log ("Bugün bunu giydim") + cost-per-wear.
6. Backup: export/import everything as a zip (JSON + images). Call navigator.storage.persist() on first run.

## Style context for the recommender
My wardrobe is mostly black/dark (rock, dark-minimal), and work requires smart casual. Classic color-harmony rules are weak here: treat black/charcoal/navy/dark neutrals as one family and lean on texture mixing (leather, denim, knit, cotton), silhouette, formality and hardware details. Default "İş" rules: no graphic tees, no ripped denim, no heavy hardware — make occasion rules editable in Settings.

## LLM layer
- Provider abstraction over an OpenAI-compatible chat completions API. Default: OpenRouter, using its `models` fallback array (first a current :free model that supports image input — check OpenRouter's list — then a cheap paid one). Model IDs editable in Settings.
- API key entered in Settings and stored only in IndexedDB on the device. Never hardcode or commit it; no secrets in .env.
- Tagging: downscale to ~512px before sending; require strict JSON validated by a zod schema; one retry on parse failure, then fall back to manual tagging.
- Handle 429/402 with a clear Turkish message; never block the UI.
- Keep calls minimal: tagging once per item, one call per suggestion request.

## Later (don't build now, but keep the data model ready)
- "Bunu alsam mı?": upload a product screenshot → how many new outfits it unlocks with my wardrobe.
- Gap analysis: which single item would unlock the most outfits.
- Learn preferences from outfit ratings.

## Non-goals
No backend, auth, social features, virtual try-on, or native app.

## How to work
1. Start with a short plan: folder structure, data model, milestones. Wait for my approval.
2. Build milestone by milestone; each must run locally and on my phone.
3. Unit-test the recommender rules.
4. iOS PWA details: safe-area insets, <input type="file" accept="image/*" capture="environment">, offline app shell, no reliance on Web Share Target (unsupported on iOS).
5. README: local dev on Windows, testing on iPhone (service worker needs HTTPS — use a tunnel or deploy previews), deploy to GitHub Pages / Cloudflare Pages, Add to Home Screen.
