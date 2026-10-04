/**
 * galacticHabitability.ts
 *
 * Parametric reconstruction of the NAAP galactic habitability curves. The
 * original Flash sim pre-rendered metallicity and risk plots; here we model
 * them analytically so the GHZ band emerges as the overlap region.
 *
 * Metallicity decreases outward following the Milky Way [Fe/H] gradient
 * (~−0.07 dex/kpc). Catastrophic-event risk decreases outward (supernovae,
 * central black-hole radiation, Oort-cloud perturbations are more frequent
 * toward the galactic center).
 */
import { GALACTIC_RADIUS_RANGE_KPC, SUN_GALACTOCENTRIC_KPC } from "../../HabitableZonesConstants.js";

/** Milky Way radial metallicity gradient, dex/kpc (Lin et al. 2017). */
export const FE_H_GRADIENT_DEX_PER_KPC = -0.07;

/** e-folding scale for inward catastrophic risk, kpc. */
export const RISK_SCALE_KPC = 3.5;

/**
 * Normalized metallicity must reach this for the GHZ; sets the outer edge (~10 kpc). Together with
 * RISK_THRESHOLD this gives a ~7–10 kpc band containing the Sun, consistent with the commonly cited
 * 7–9 kpc GHZ (Lineweaver, Fenner & Gibson 2004).
 */
export const METALLICITY_THRESHOLD = 0.215;

/** Normalized risk must not exceed this for the GHZ; sets the inner edge (~7 kpc). */
export const RISK_THRESHOLD = 0.19;

const R_MIN = GALACTIC_RADIUS_RANGE_KPC.min;
const R_MAX = GALACTIC_RADIUS_RANGE_KPC.max;

function rawMetallicity(radiusKpc: number): number {
  return 10 ** (FE_H_GRADIENT_DEX_PER_KPC * (radiusKpc - SUN_GALACTOCENTRIC_KPC));
}

const METALLICITY_AT_MIN = rawMetallicity(R_MIN);
const METALLICITY_AT_MAX = rawMetallicity(R_MAX);

/** Normalized heavy-element abundance, 0 at the rim → 1 near the center. */
export function metallicity(radiusKpc: number): number {
  const raw = rawMetallicity(radiusKpc);
  const span = METALLICITY_AT_MIN - METALLICITY_AT_MAX;
  if (span === 0) {
    return 0;
  }
  return (raw - METALLICITY_AT_MAX) / span;
}

/** Normalized catastrophic-event probability, 1 at the center → 0 at the rim. */
export function risk(radiusKpc: number): number {
  const raw = Math.exp(-(radiusKpc - R_MIN) / RISK_SCALE_KPC);
  const atMax = Math.exp(-(R_MAX - R_MIN) / RISK_SCALE_KPC);
  const span = 1 - atMax;
  if (span === 0) {
    return 0;
  }
  return (raw - atMax) / span;
}

/** Combined habitability score peaking at an intermediate galactocentric radius. */
export function habitability(radiusKpc: number): number {
  return metallicity(radiusKpc) * (1 - risk(radiusKpc));
}

const GHZ_SCAN_STEP_KPC = 0.05;

function isInsideGhz(radiusKpc: number): boolean {
  return metallicity(radiusKpc) >= METALLICITY_THRESHOLD && risk(radiusKpc) <= RISK_THRESHOLD;
}

/**
 * Scans the allowed radius range for the galactic habitable zone annulus.
 * Returns null if no qualifying band exists within the range.
 */
export function findGhzBounds(): { inner: number; outer: number } | null {
  let inner: number | null = null;
  let outer: number | null = null;

  for (let r = R_MIN; r <= R_MAX + GHZ_SCAN_STEP_KPC / 2; r += GHZ_SCAN_STEP_KPC) {
    if (isInsideGhz(r)) {
      if (inner === null) {
        inner = r;
      }
      outer = r;
    }
  }

  if (inner === null || outer === null) {
    return null;
  }
  return { inner, outer };
}
