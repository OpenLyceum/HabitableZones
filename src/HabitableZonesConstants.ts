/**
 * HabitableZonesConstants.ts
 *
 * Central repository for every named numeric constant used across the
 * simulation. Bare numbers that carry semantic meaning (sizes, margins,
 * physics defaults, ranges) belong here rather than inline in model or view
 * code, so they are named, documented, and changed in one place.
 *
 * Conventions
 * ───────────
 *  - Physics / model values use SI units (metres, seconds, kilograms, …);
 *    note the unit in a comment on each value.
 *  - Layout / chrome values are in screen pixels.
 *  - Colour strings live in HabitableZonesColors.ts, not here.
 *  - Computed expressions (e.g. `2 * Math.PI`) may stay inline.
 *
 * Remove the example constants below and replace them with the sim's own.
 */

import { Range } from "scenerystack/dot";
import HabitableZonesNamespace from "./HabitableZonesNamespace.js";

// ── Layout / chrome (screen pixels) ───────────────────────────────────────────

/** Margin between the screen edge and edge-anchored controls (e.g. Reset All). */
export const SCREEN_VIEW_MARGIN = 20;

/** Corner radius shared by control panels and dialogs. */
export const PANEL_CORNER_RADIUS = 6;

// ── Physics / model defaults (SI units unless noted) ──────────────────────────

/** Effective temperature of the Sun, kelvin. Source: SHZDiagramStar.as:11. */
export const SOLAR_TEMPERATURE_K = 5808;

/** One solar radius expressed in AU. Source: SHZDiagramStar.as:17. */
export const AU_PER_SOLAR_RADIUS = 0.00465;

/** One solar radius, kilometres. */
export const SOLAR_RADIUS_KM = 695700;

/** One AU, kilometres. */
export const KM_PER_AU = 149597870.7;

/**
 * Circumstellar habitable-zone coefficients: hzInner/hzOuter = sqrt(L / L☉) * coeff.
 * Source: .../MainTimeline.as — optimisticInnerSHZLimit:96, optimisticOuterSHZLimit:40,
 * pessimisticInnerSHZLimit:58, pessimisticOuterSHZLimit:130.
 */
export const HZ_OPTIMISTIC = { inner: 0.8, outer: 1.5 };
export const HZ_CONSERVATIVE = { inner: 0.95, outer: 1.37 };

/** Allowed range for the orbiting planet's distance from its star, AU. */
export const PLANET_DISTANCE_RANGE_AU = new Range(0.01, 500);

/** Allowed range for the galactic screen's selected radius, kiloparsecs. */
export const GALACTIC_RADIUS_RANGE_KPC = new Range(1.2, 22);

/** The Sun's distance from the galactic center, kiloparsecs. */
export const SUN_GALACTOCENTRIC_KPC = 8;

/**
 * Solar-system planet semi-major axes, AU (eccentricity/inclination omitted —
 * drawn as circular reference orbits). Source: .../MainTimeline.as:459-506
 * (solarSystemList).
 */
export const REFERENCE_ORBITS_AU = [0.387, 0.723, 1, 1.524, 5.203, 9.54, 19.18, 30.06];

// ── Circumstellar diagram layout (screen pixels / fixed AU scale) ────────────

/**
 * Size of the wide, top-down diagram "box", pixels. The original NAAP / React
 * port render the diagram as a 980×300 black rectangle with the star anchored
 * near the left edge (STAR_ORIGIN_POINT ≈ [100, 150]) so the habitable zone and
 * inner reference orbits fan out to the right. Source: diagram.jsx:11-16.
 */
export const SHZ_DIAGRAM_VIEW_WIDTH = 1000;
export const SHZ_DIAGRAM_VIEW_HEIGHT = 200;

/** Horizontal offset of the star (transform origin) from the diagram's left edge, pixels. */
export const SHZ_STAR_ORIGIN_X = 92;

/** Radius of the circumstellar diagram's decorative rings (HZ band, reference orbits), pixels. */
export const SHZ_DIAGRAM_RADIUS = 260;

/**
 * Fixed model-to-view scale for the circumstellar diagram, px per AU. Matches
 * the React port's AU_PIXELS = 100 (diagram.jsx:15); pixelsPerAU = base / zoomAU,
 * giving 500 px/AU at the default 0.2-AU zoom so the Sun's habitable zone and
 * inner planets sit inside the diagram box.
 */
export const SHZ_DIAGRAM_PIXELS_PER_AU = 100;

/** Minimum on-screen radius for the star disc, so faint/small stars stay visible, pixels. */
export const SHZ_STAR_MIN_VIEW_RADIUS = 8;

/** Fixed on-screen radius for the planet marker (schematic, not to scale), pixels. */
export const SHZ_PLANET_VIEW_RADIUS = 7;

/**
 * Wall-clock seconds to traverse a star's full evolutionary timespan at 1×
 * playback speed on the circumstellar timeline.
 */
export const FULL_STAR_EVOLUTION_PLAYBACK_SECONDS = 120;

/**
 * Zoom levels for the circumstellar diagram: each value is the AU span shown
 * by the scale bar. Source: diagram.jsx:71-97 (25 levels); default index 8
 * (0.1 AU per scale-bar division context).
 */
export const SHZ_DIAGRAM_ZOOM_AU_VALUES = [
  0.005, 0.01, 0.02, 0.03, 0.04, 0.05, 0.075, 0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1, 2, 3, 4, 5, 7.5, 10, 20, 25, 50, 75,
  100,
] as const;

/** Default zoom-level index (0.1 AU scale reference). Source: diagram.jsx INITIAL_ZOOM_LEVEL = 8. */
export const SHZ_DIAGRAM_DEFAULT_ZOOM_LEVEL = 8;

/** Minimum grid-line spacing in view pixels. Source: SHZDiagramGrid.as minSpacing. */
export const SHZ_DIAGRAM_GRID_MIN_SPACING_PX = 15;

/** Scale-bar minimum spacing in view pixels. Source: SHZDiagramScalebar.as. */
export const SHZ_DIAGRAM_SCALEBAR_MIN_SPACING_PX = 15;

/** Width of the evolution timeline in pixels (shared by timeline + habitability plot). */
export const SHZ_TIMELINE_WIDTH_PX = 900;

/** Pixels per AU at zoom level index i: baseScale / zoomAuValue. */
export function shzDiagramPixelsPerAU(zoomLevelIndex: number): number {
  const index = Math.max(0, Math.min(SHZ_DIAGRAM_ZOOM_AU_VALUES.length - 1, zoomLevelIndex));
  const auValue = SHZ_DIAGRAM_ZOOM_AU_VALUES[index] ?? 1;
  return SHZ_DIAGRAM_PIXELS_PER_AU / auValue;
}

/** Scale-bar length in AU at a given zoom level (majorMultiple × spacing). */
export function shzDiagramScaleBarAU(zoomLevelIndex: number): number {
  const pixelsPerAU = shzDiagramPixelsPerAU(zoomLevelIndex);
  const minSpacingAU = SHZ_DIAGRAM_SCALEBAR_MIN_SPACING_PX / pixelsPerAU;
  const logSpacing = Math.log10(minSpacingAU);
  const ceiling = Math.ceil(logSpacing);
  if (ceiling - logSpacing > Math.log10(2)) {
    return 2 * 5 * 10 ** (ceiling - 1);
  }
  return 5 * 10 ** ceiling;
}

/** Grid spacing in AU for the circumstellar diagram at a given zoom level. */
export function shzDiagramGridSpacingAU(zoomLevelIndex: number): { major: number; minor: number } {
  const pixelsPerAU = shzDiagramPixelsPerAU(zoomLevelIndex);
  const minSpacingAU = SHZ_DIAGRAM_GRID_MIN_SPACING_PX / pixelsPerAU;
  const logSpacing = Math.log10(minSpacingAU);
  const ceiling = Math.ceil(logSpacing);
  if (ceiling - logSpacing > Math.log10(2)) {
    const minor = 10 ** (ceiling - 1);
    return { major: 5 * minor, minor };
  }
  const major = 10 ** ceiling;
  return { major, minor: 0.5 * major };
}

/** Model-to-view scale for the galactic disc, px per kpc. Source: MilkyWayComponent.as. */
export const GALACTIC_DISC_PIXELS_PER_KPC = 13;

/** Model-to-view scale for galactic radius plots, px per kpc. Source: MetalsPlot.as. */
export const GALACTIC_PLOT_PIXELS_PER_KPC = 14.7;

HabitableZonesNamespace.register("HabitableZonesConstants", {
  SCREEN_VIEW_MARGIN,
  PANEL_CORNER_RADIUS,
  SOLAR_TEMPERATURE_K,
  AU_PER_SOLAR_RADIUS,
  SOLAR_RADIUS_KM,
  KM_PER_AU,
  HZ_OPTIMISTIC,
  HZ_CONSERVATIVE,
  PLANET_DISTANCE_RANGE_AU,
  GALACTIC_RADIUS_RANGE_KPC,
  SUN_GALACTOCENTRIC_KPC,
  REFERENCE_ORBITS_AU,
  SHZ_DIAGRAM_VIEW_WIDTH,
  SHZ_DIAGRAM_VIEW_HEIGHT,
  SHZ_STAR_ORIGIN_X,
  SHZ_DIAGRAM_RADIUS,
  SHZ_DIAGRAM_PIXELS_PER_AU,
  SHZ_STAR_MIN_VIEW_RADIUS,
  SHZ_PLANET_VIEW_RADIUS,
  FULL_STAR_EVOLUTION_PLAYBACK_SECONDS,
  SHZ_DIAGRAM_ZOOM_AU_VALUES,
  SHZ_DIAGRAM_DEFAULT_ZOOM_LEVEL,
  SHZ_DIAGRAM_GRID_MIN_SPACING_PX,
  SHZ_DIAGRAM_SCALEBAR_MIN_SPACING_PX,
  SHZ_TIMELINE_WIDTH_PX,
  shzDiagramPixelsPerAU,
  shzDiagramScaleBarAU,
  shzDiagramGridSpacingAU,
  GALACTIC_DISC_PIXELS_PER_KPC,
  GALACTIC_PLOT_PIXELS_PER_KPC,
});
