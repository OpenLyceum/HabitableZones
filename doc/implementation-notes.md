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
    GalacticScreenView.ts, MilkyWayDiscNode.ts, GalacticRadiusPlotNode.ts, …

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

**Stepping:** `step(dt)` advances `ageProperty` directly from `FULL_STAR_EVOLUTION_PLAYBACK_SECONDS`, star `timespan`, and `animationRateProperty` when playing. **`timer.step(dt)` is never called**; `TimeModel.timeProperty` is unused. Playback pauses at the end of the track; pressing play there resets age to 0.

**Tidal lock:** `timePlanetTidallyLockedProperty` is the raw lock time. The 4 px visibility rule (`isTidalLockMarkerVisible`) is applied only by `SHZTimelineNode` when drawing the marker — never to model state, or fast-locking close-in planets would read as unlocked.

**API highlights:** `setEffectivePlanetDistanceAU()`, `getEffectivePlanetDistanceRange()` (Flash drag limits ∝ M₀/M); `stepTimeline()` — 1/200 of timespan per step button; `zoomDiagramIn()` / `zoomDiagramOut()`.

## GalacticModel

`selectedRadiusProperty` drives derived `metallicityProperty`, `riskProperty`, `habitabilityProperty`,
`isInsideGhzProperty`. GHZ bounds (`ghzInnerProperty`, `ghzOuterProperty`) computed **once at module
load** via `findGhzBounds()` (0.05 kpc scan); throws if no band found.

`step()` is a no-op.

## View ↔ model contracts (physics-relevant)

- **`SHZTimelineNode`**: temperature curve and habitability strip both use *d_eff*. One `Multilink`
  over star, d₀ and HZ mode rebuilds the curve, strip, ticks and event markers (tidal lock +
  destruction); it reads the model's derived event times, which are already current because the model
  registered them first.
- **`SHZDiagramNode`**: status colors, elliptical real-system orbit overlays (pericenter on +x),
  blackbody star color.

## Key design decisions

- **Dual distance Properties** with guards — UI shows stretched orbit while preserving zero-age *d₀* for
  some formulas.
- **Compressed `shzStars` catalog** — regenerate via header instructions; do not hand-edit tables.
- **Parametric galactic curves** — thresholds `METALLICITY_THRESHOLD = 0.215`, `RISK_THRESHOLD = 0.19`
  (GHZ ≈ 7.0–10.0 kpc, Sun inside).
- **Partial `TimeModel` integration** — only `isPlayingProperty`; age math lives in `CircumstellarModel.step`.

## Common components

- `HabitableZonesPanel`, `HabitableZonesButtonOptions`, `HabitableZonesHotkeyData`.

## Disposal

`CircumstellarModel`, `GalacticModel` and both screen views are created once and live as long as
the sim, so their links and derived Properties are never unlinked and they have no `dispose()`;
`tests/memory-leak.test.ts` covers `TimeModel`, the one class that does. The exception inside a
view is `SHZTimelineNode`, which rebuilds its segment nodes whenever the planet distance, star or
habitable-zone mode changes; the dropped nodes release their color listeners when they leave the
display. Note that Circumstellar steps the star's age directly, so its `TimeModel.timeProperty`
stays at 0; only `isPlayingProperty` and the speed are used.

## Testing

| File | Covers |
|---|---|
| `StarEvolution.test.ts`, `planetEvolution.test.ts`, `galacticHabitability.test.ts` | Core physics |
| `circumstellar/model/CircumstellarModel.test.ts` | Distance clamping, tidal-lock state, replay at end of track |
| `formatAge.test.ts` | Age readout |
| `TimeModel.test.ts` | Clock |
| `memory-leak.test.ts` | Dispose regression |

No tests for `GalacticModel` or view integration.

## Multi-screen

Independent state — see [SceneryStackTemplate `doc/multi-screen.md`](https://github.com/OpenLyceum/SceneryStackTemplate/blob/main/doc/multi-screen.md) (note: that file may still use template
folder names; actual folders are `circumstellar/` and `galactic/`).
