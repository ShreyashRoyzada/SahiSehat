# SahiSehat MVP

**Sahi hai? Lab-tested food, matched to your body.**

This is the MVP web app for the SahiSehat PRD v0.2: an installable web app that checks Indian packaged food against lab evidence and tells each person whether one serving fits their own blood-sugar, cholesterol and blood-pressure numbers, then names a better swap and where to buy it.

It's built for the 11 December 2026 invite-only beta scope (PRD "MVP scope" and the P0 requirements). Rules decide every verdict, and AI only reads and words.

## Run it

```bash
npm install          # also copies the PDF.js worker into public/vendor
npm run dev          # http://localhost:3000
```

Then tap **Try it as Riya (demo)** on the home page. Riya is the PRD's fictional persona (HbA1c 6.1% and LDL 138 mg/dL, both flagged high, Aug 2026). Her demo account is deleted after 24 hours or when you end the demo.

- Admin console: `/admin`. In development the password is `sahisehat-admin`, and two-factor is skipped unless `ADMIN_TOTP_SECRET` is set.
- Invite code for sign-up: `SAHI-BETA-2026` (set `INVITE_CODES`).
- `npm test` runs the unit and golden tests. `npm run lint` and `npm run typecheck` should both be clean.

See `.env.example` for configuration. In production you **must** set `VAULT_KEY`, `ADMIN_PASSWORD` and `ADMIN_TOTP_SECRET`.

## Where the data comes from

| File | What it is |
|---|---|
| `data/source/QC_lab_report_products_2026-10-02.xlsx` | The 2 October research workbook, as supplied |
| `scripts/import_workbook.py` | Converts the workbook into `data/seed/lab-reports.json` (245 report rows), `listings.json` (110 quick-commerce listings) and `qc-lines.json` (the 39 shortlisted lines) |
| `data/source/label-seed.tsv` | Label nutrition, ingredients, allergens and serving size for 157 products, editable in a spreadsheet |
| `scripts/build-catalogue.mjs` | Joins the two into `data/seed/products.json` (all 39 shortlisted lines are covered; 124 report rows are mapped to products) |
| `data/rules/rule-table-v1.json` | Fit rule table v1.0.0: the PRD's placeholder thresholds, stored as data |

Run `npm run data:import` after you edit the workbook or the TSV (needs `pip install openpyxl`). The database seeds itself from `data/seed` on first start.

> **Important: the label values are seed estimates.** The workbook has no nutrition data, so `label-seed.tsv` holds typical values for each product. They have not been checked against the packs. Every product page says so. Thirteen products whose labels I couldn't estimate are left blank on purpose and show *Insufficient data*. Before the beta, check each product in the admin console against its pack photo, tick "checked against the pack", add the GTIN and publish. `CATALOGUE_MODE=beta` then shows only published products.

## What's built (PRD P0 coverage)

| PRD | Where |
|---|---|
| A1 product record, publish checks | `src/lib/types.ts`, `src/lib/publish.ts`, admin › Products |
| A2 search with typos and Hinglish | `src/lib/search.ts` (22 test queries, all in the top 3) |
| A3/A4/A5 Trust Report, evidence level, staleness | `src/lib/trust.ts`, `src/lib/quality.ts`, product page |
| Lab display rules and the publication gate (G2) | `src/lib/trust.ts`, admin › Lab reports & gate, admin › Sources |
| B1 onboarding and out-of-scope screening | `/start` |
| B2 typed numbers, units, conversions, plausible ranges | `/me/numbers`, `src/lib/units.ts` |
| B3/B4 report upload with a confirm step | `/me/report`. The file is read **on the device** (PDF.js / Tesseract.js); only text reaches the server; nothing from the file is stored |
| B5 redaction before any model call | `src/lib/extraction/redact.ts` (tested on 20 fictional reports) |
| B6 purpose-specific consent | `/start`, `/me/privacy` (notice version and time recorded; withdrawing deletes stored health data) |
| B7 export and two-tap delete | `/me/privacy`, `/api/me/export` |
| C1 rules as versioned data, approval before going live | `src/lib/fit/rules.ts`, admin › Rules |
| C2 My limits | `/me/limits` |
| C3–C7 Fit engine | `src/lib/fit/engine.ts`, a pure deterministic function |
| C8 golden set (30 cases) | `src/lib/fit/golden.ts`, run in tests and before any rule version is activated |
| D1 product page | `/p/[id]` |
| D2 share-in | `src/app/manifest.ts` (`share_target`) → `/share`; pasted links also work in search |
| D3 cart check | `/cart` (screenshot OCR on the device, or pasted text; unmatched items are listed, never guessed) |
| D4 grounded assistant | `/ask`. A medical-boundary guard always runs first. Answers come from catalogue tools with sources |
| E1 swaps, E2 where to buy | `src/lib/swaps.ts`, product page, `/go/[id]` (counts the click) |
| G1/G3 admin console, audit trail | `/admin`; every verdict stores its rule version, product version and inputs hash in the vault |
| G4 medical-boundary copy | Persistent footer, no condition names in verdict text (tested) |
| G6 "This looks wrong" (P1) | Product page → admin › Queue |

The admin overview also tracks the north-star metric (Weekly Personalised Decisions) and the other PRD success metrics, from events that hold only a hashed actor, an event kind and a product id.

## Architecture

- **Next.js 16 (App Router) + TypeScript + Tailwind**: one installable web app, server-rendered.
- **Two SQLite databases** (`better-sqlite3`): `app.db` holds the catalogue, accounts, audit log and events. `vault.db` holds people, markers, consents, uploads and Fit results, with every value AES-256-GCM encrypted under `VAULT_KEY`. Logs and events never hold health values.
- **Pure domain core** in `src/lib`: Fit engine, Quality Score, trust rules, swaps and search. No network calls, unit-tested.
- **Claude (optional)**: with `ANTHROPIC_API_KEY` set, report extraction (`src/lib/server/extract.ts`) and the assistant (`src/lib/server/assistant.ts`) use `claude-opus-5-5` through the official SDK. They have server-side refusal fallbacks enabled and receive redacted text only. Without a key, both fall back to deterministic rule-based code. Verdicts always come from the rule engine.

For hosting, run it as a single Node server with a persistent disk in an Indian region (PRD). SQLite is a deliberate MVP choice for one builder and 100 beta users; the data layer is small enough to move to Postgres later.

## Not done yet (needs people, not code)

These gates from the PRD's "beta is ready when" checklist can't be met in code:

- A clinician must sign rule table v1. It's marked *placeholder* everywhere until then.
- Counsel must approve the consent notice (`notice-0.1-draft`), the medical-boundary wording and the lab-display rules.
- The Trustified licence. All lab sources start as *link out only*, so Passed and Failed verdicts stay hidden until it's granted.
- Report extraction must reach 95% accuracy on 50 real reports from 5+ labs. The rule-based reader is tested only on fictional formats.
- Every label value must be verified against its pack, with GTINs added.
- The incident-response tabletop drill (G5).
