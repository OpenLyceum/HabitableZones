# Implementation Notes - Habitable Zones

Developer-facing notes on the architecture. Educator-facing physics are in [model.md](./model.md).

## Architecture Overview

Two independent screens, each `Screen<Model, ScreenView>`. No shared root model.

```
src/main.ts
  ├─ CircumstellarScreen   (Screen<CircumstellarModel, CircumstellarScreenView>)
  └─ GalacticScreen        (Screen<GalacticModel, GalacticScreenView>)

src/circumstellar/
  CircumstellarScreen.ts
  model/
    CircumstellarModel.ts       coordinator + classifyPlanetDistance()
    StarEvolution.ts            sampleStar, luminosity, temperatureK, radiusSolar
    shzStars.ts                 SHZ_STARS catalog (17 masses; compressed tables)
    planetEvolution.ts          d_eff, Roche, tidal lock, destruction scan
    realSystems.ts              6 presets + NONE
    findStarIndexByMass.ts      nearest catalog mass for real-system lock
    formatAge.ts                My/Gy/y display helper
  view/
    CircumstellarScreenView.ts, SHZDiagramNode.ts, SHZTimelineNode.ts
    CircumstellarControlPanel.ts, HRDiagramNode.ts, …

src/galactic/
  GalacticScreen.ts
  model/
    GalacticModel.ts
    galacticHabitability.ts       parametric Z, risk, H; findGhzBounds()
  view/
    GalacticScreenView.ts, GalacticDiscNode.ts, GalacticPlotNode.ts, …

src/common/
  TimeModel.ts                    play/pause only — partial use on Circumstellar
  HabitableZonesPanel.ts, HabitableZonesButtonOptions.ts, HabitableZonesHotkeyData.ts

src/HabitableZonesConstants.ts    HZ coeffs, ranges, diagram/timeline layout, playback duration
src/preferences/                  empty scaffold + query params (no params yet)
```

Data flows Model → View through AXON `Property` / `DerivedProperty` / `Multilink`.

## CircumstellarModel

| Property | Role |
|---|---|
| `selectedStarIndexProperty`, `ageProperty` | Catalog star + timeline position |
| `planetDistanceProperty` (d₀), `displayPlanetDistanceProperty` (d_eff UI) | Dual distance with sync guards |
| `hzModeProperty` | Optimistic vs conservative |
| `realSystemProperty`, `isStarMassLockedProperty` | Preset systems |
| `zoomIndexProperty`, `referenceOrbitsVisibleProperty`, `gridVisibleProperty` | Diagram |
| `animationRateProperty`, `timer.isPlayingProperty` | Playback |
| Derived | `luminosityProperty`, `hzInnerProperty`, `hzOuterProperty`, `planetStatusProperty`, `timePlanetDestroyedProperty`, `timePlanetTidallyLockedProperty`, `isPlanetTidallyLockedProperty`, … |

**Stepping:** `step(dt)` advances `ageProperty` directly from `FULL_STAR_EVOLUTION_PLAYBACK_SECONDS`, star `timespan`, and `animationRateProperty` when playing. **`timer.step(dt)` is never called**; `TimeModel.timeProperty` is unused. Playback stops at end of track and pauses.

**API highlights:** `setEffectivePlanetDistanceAU()`, `getEffectivePlanetDistanceRange()` (Flash drag limits ∝ M₀/M); `stepTimeline()` — 1/200 of timespan per step button; `zoomDiagramIn()` / `zoomDiagramOut()`.

## GalacticModel

`selectedRadiusProperty` drives derived `metallicityProperty`, `riskProperty`, `habitabilityProperty`,
`isInsideGhzProperty`. GHZ bounds (`ghzInnerProperty`, `ghzOuterProperty`) computed **once at module
load** via `findGhzBounds()` (0.05 kpc scan); throws if no band found.

`step()` is a no-op.

## View ↔ model contracts (physics-relevant)

- **`SHZTimelineNode`**: temperature curve uses `planetDistanceProperty` (d₀); habitability strip uses
  `effectivePlanetDistanceAU` — document mismatch for maintainers.
- **`SHZTimelineNode`**: draws **destruction marker only** on timeline (tidal-lock time computed but not
  drawn).
- **`SHZDiagramNode`**: status colors, real-system orbit overlays, blackbody star color.

## Key design decisions

- **Dual distance Properties** with guards — UI shows stretched orbit while preserving zero-age *d₀* for
  some formulas.
- **Compressed `shzStars` catalog** — regenerate via header instructions; do not hand-edit tables.
- **Parametric galactic curves** — thresholds `METALLICITY_THRESHOLD = 0.35`, `RISK_THRESHOLD = 0.45`.
- **Partial `TimeModel` integration** — only `isPlayingProperty`; age math lives in `CircumstellarModel.step`.

## Common components

- `HabitableZonesPanel`, `HabitableZonesButtonOptions`, `HabitableZonesHotkeyData`.

## Disposal

Screen-lifetime models/views. No mid-session teardown.

## Testing

| File | Covers |
|---|---|
| `StarEvolution.test.ts`, `planetEvolution.test.ts`, `galacticHabitability.test.ts` | Core physics |
| `TimeModel.test.ts` | Clock |
| `memory-leak.test.ts` | Dispose regression |

No tests for `CircumstellarModel`, `GalacticModel`, or view integration.

## Multi-screen

Independent state — see [SceneryStackTemplate `doc/multi-screen.md`](https://github.com/OpenLyceum/SceneryStackTemplate/blob/main/doc/multi-screen.md) (note: that file may still use template
folder names; actual folders are `circumstellar/` and `galactic/`).
