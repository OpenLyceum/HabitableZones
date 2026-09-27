/**
 * StarEvolution.ts
 *
 * Pure functions for sampling a star's evolutionary track at a given age.
 * `dataTable` entries are irregularly spaced in time, so `sampleStar` linearly
 * interpolates between the two bracketing entries (clamping at both ends).
 */
import type { StarDataPoint, StarRecord } from "./shzStars.js";

/**
 * Samples a star's dataTable at the given age (Myr since zero-age main
 * sequence), linearly interpolating between bracketing entries. Ages outside
 * [0, timespan] clamp to the first/last entry.
 */
export function sampleStar(star: StarRecord, ageMyr: number): StarDataPoint {
  const table = star.dataTable;
  const first = table[0];
  const last = table[table.length - 1];
  if (first === undefined || last === undefined) {
    throw new Error("sampleStar: star.dataTable must not be empty");
  }

  if (ageMyr <= first.time) {
    return first;
  }
  if (ageMyr >= last.time) {
    return last;
  }

  // table.time is sorted ascending; find the bracketing pair.
  let hi = 1;
  while ((table[hi]?.time ?? Number.POSITIVE_INFINITY) < ageMyr) {
    hi++;
  }
  const a = table[hi - 1];
  const b = table[hi];
  if (a === undefined || b === undefined) {
    throw new Error("sampleStar: could not find bracketing dataTable entries");
  }
  const span = b.time - a.time;
  const t = span === 0 ? 0 : (ageMyr - a.time) / span;

  return {
    time: ageMyr,
    mass: a.mass + t * (b.mass - a.mass),
    logLum: a.logLum + t * (b.logLum - a.logLum),
    logRadius: a.logRadius + t * (b.logRadius - a.logRadius),
    logTemp: a.logTemp + t * (b.logTemp - a.logTemp),
  };
}

/** Luminosity in solar units (L☉). */
export const luminosity = (p: StarDataPoint): number => 10 ** p.logLum;

/** Effective temperature in kelvin. */
export const temperatureK = (p: StarDataPoint): number => 10 ** p.logTemp;

/** Radius in solar units (R☉). */
export const radiusSolar = (p: StarDataPoint): number => 10 ** p.logRadius;
