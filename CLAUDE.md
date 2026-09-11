# CLAUDE.md — Habitable Zones

Sim-specific context for AI assistants. General SceneryStack guidance: [OpenLyceum/.github/CLAUDE.md](https://github.com/OpenLyceum/.github/blob/main/CLAUDE.md).

## Project

SceneryStack port of the NAAP **Habitable Zones** lab. Two screens explore where liquid-water conditions can persist — around an evolving star, and across the Milky Way. Architecture and formulas: [doc/model.md](doc/model.md), [doc/implementation-notes.md](doc/implementation-notes.md).

- **Circumstellar** (`src/circumstellar/`) — star evolution track, moving circumstellar HZ, orbiting planet, six real exoplanet presets.
- **Galactic** (`src/galactic/`) — galactocentric radius vs metallicity, catastrophic-event risk, and combined habitability.

Shared code uses the `HabitableZones` prefix; per-screen code uses `Circumstellar` / `Galactic`. Concept-named folders, no `-screen` suffix.

## Key files

| Area | Location |
|---|---|
| Screens | `src/circumstellar/CircumstellarScreen.ts`, `src/galactic/GalacticScreen.ts` |
| Circumstellar model | `circumstellar/model/CircumstellarModel.ts`, `StarEvolution.ts`, `shzStars.ts`, `planetEvolution.ts`, `realSystems.ts` |
| Galactic model | `galactic/model/GalacticModel.ts`, `galacticHabitability.ts` |
| Shared UI | `src/common/HabitableZonesPanel.ts`, `HabitableZonesButtonOptions.ts`, `HabitableZonesHotkeyData.ts` |
| Animation | `src/common/TimeModel.ts` (partial use on Circumstellar) |
| Colors / constants | `src/HabitableZonesColors.ts`, `src/HabitableZonesConstants.ts` |
| Strings | `src/i18n/StringManager.ts` |
| Preferences | `src/preferences/` (empty scaffold + query params) |
| Entry | `src/main.ts` |

## Model

Two **independent** screen models — no shared root state.

| Screen | Model | Notes |
|---|---|---|
| **Circumstellar** | `CircumstellarModel` | 17-star evolution catalog (0.3–30 M☉); HZ edges `d = √(L/L☉) × c`; optimistic vs conservative limits; planet at zero-age distance *d₀* with effective distance *d_eff = d₀·(M₀/M(t))*; destruction marker when engulfed; six real-system presets |
| **Galactic** | `GalacticModel` | Parametric metallicity, risk, and habitability vs galactocentric radius; GHZ annulus from combined score |

**Shared gotchas**

- HZ scaling uses **`√(L/L☉)`** with optimistic coefficients (0.8 / 1.5 AU for a solar twin) or conservative (0.95 / 1.37).
- **Tidal-locking time** is evaluated at the **zero-age distance *d₀*** — it does not update as the orbit stretches with stellar mass loss.
- Galactic radial curves are a **parametric reconstruction** of NAAP pedagogy, not a byte-for-byte port of unpublished Flash formulae.
- Full stellar lifetime ≈ **120 s wall-clock** at 1× animation on Circumstellar.

## Accessibility

Follows the shared [OpenLyceum accessibility convention](https://github.com/OpenLyceum/Baton/blob/main/ACCESSIBILITY.md).
Each screen registers `*ScreenSummaryContent` and explicit `pdomOrder` on its `*ScreenView`. A11y strings live under `a11y.circumstellar` and `a11y.galactic` in each locale JSON, via `StringManager.getCircumstellarA11yStrings()` / `getGalacticA11yStrings()`. Keep `currentDetailsContent` live over model state; every interactive node needs an `accessibleName`.

## Testing

Fleet-standard Vitest layout:

| Path | Purpose |
|---|---|
| `vitest.config.ts` | Test environment + `setupFiles`; `execArgv: ["--expose-gc"]` with memory-leak suite |
| `tests/setup.ts` | Canvas / AudioContext mocks + `init({ name: "…" })` before SceneryStack imports |
| `tests/**/*.test.ts` | Model/physics unit tests |
| `tests/memory-leak.test.ts` | WeakRef + `forceGC` dispose regression (fleet pattern) |

| File | Covers |
|---|---|
| `StarEvolution.test.ts` | Catalog sampling, luminosity/temperature/radius |
| `planetEvolution.test.ts` | *d_eff*, Roche limit, destruction scan, tidal lock |
| `galacticHabitability.test.ts` | Metallicity, risk, habitability, GHZ bounds |
| `TimeModel.test.ts` | Play/pause elapsed time |
| `memory-leak.test.ts` | Dispose regression |

- Put unit tests only under root `tests/` (never co-locate or use `__tests__/`).
- Run `npm test`. CI runs the suite when a `test` script is present.

## Commands

```bash
npm run lint && npm run check && npm run build && npm test
```

`npm run release` intentionally skips `npm test` in some sims — append `&& npm test` before the version bump so a release cannot ship a failing suite.

## Development notes

- **`npm run decompile`** extracts NAAP Flash ActionScript via JPEXS FFDec from `../Baseline/Astronomy/flash-animations` into gitignored `NAAP/decompiled/`.
- Screens are independent; see [doc/multi-screen.md](doc/multi-screen.md) for the fleet multi-screen pattern.
- After `npm run build`, the sim is installable offline via Workbox (`dist/manifest.webmanifest`).

## Compliance carve-outs

### `package.json` overrides

JSON cannot carry comments, so the rationale for forced transitive pins lives here. Prefer
**tilde (`~`) or exact** versions — caret (`^`) lets minors drift under what is meant to be a
hard pin. Dependabot ignores these three names (see `.github/dependabot.yml`) so it does not
open PRs that fight the overrides. Revisit when SceneryStack drops or re-pins them upstream.

| Override | Pin | Why |
|---|---|---|
| `lodash` | `~4.18.1` | SceneryStack declares `~4.17.12`. Bump clears Dependabot/npm advisories patched in 4.18.x (e.g. GHSA-r5fr-rjxr-66jc, GHSA-f23m-r3pf-42rh). |
| `three` | `~0.125.2` | SceneryStack declares `^0.104.0`. Floor is 0.125.0 for GHSA-fq6p-x6j3-cmmq (ReDoS). Staying on the 0.125 line avoids a larger API jump; **0.125.x still has open CVEs** (e.g. XSS GHSA-7vvq-7r29-5vg3, fixed only in ≥0.137.0). Remove this override if/when SceneryStack stops depending on `three` or pins a patched line itself. LightPropagation keeps a higher `three` pin — do not force 0.125 there. |
| `brace-expansion` | `~5.0.9` | Transitive via `vite-plugin-pwa` / Workbox. Clears npm audit (originally GHSA-mh99-v99m-4gvg; keep ≥5.0.9 for GHSA-rgw5-rvv9-x895). |
