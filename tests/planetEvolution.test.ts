/**
 * planetEvolution.test.ts
 */
import { describe, expect, it } from "vitest";
import {
  computePlanetDestructionTimeMyr,
  computeTidalLockTimeMyr,
  effectivePlanetDistanceAU,
  effectivePlanetDistanceRangeAU,
  initialPlanetDistanceAU,
  planetDisplayDistanceEnvelopeAU,
} from "../src/circumstellar/model/planetEvolution.js";
import { SHZ_STARS } from "../src/circumstellar/model/shzStars.js";
import { PLANET_DISTANCE_RANGE_AU } from "../src/HabitableZonesConstants.js";

describe("planetEvolution", () => {
  it("scales effective distance outward as stellar mass decreases", () => {
    expect(effectivePlanetDistanceAU(1, 1, 0.5)).toBeCloseTo(2, 6);
  });

  it("scales the display-distance range with stellar mass loss", () => {
    const range = effectivePlanetDistanceRangeAU(1, 0.5);
    expect(range.min).toBeCloseTo(0.02, 6);
    expect(range.max).toBeCloseTo(1000, 6);
  });

  it("the NumberControl envelope covers every catalog mass-scaled range", () => {
    const envelope = planetDisplayDistanceEnvelopeAU();
    for (const star of SHZ_STARS) {
      const range = effectivePlanetDistanceRangeAU(star.mass, star.minMass);
      expect(envelope.min).toBeLessThanOrEqual(range.min);
      expect(envelope.max).toBeGreaterThanOrEqual(range.max);
    }
  });

  it("inverting the display-range max can land just above the zero-age max", () => {
    const catalogMass = 0.2;
    const currentMass = 0.15;
    const displayMax = effectivePlanetDistanceRangeAU(catalogMass, currentMass).max;
    const zeroAge = initialPlanetDistanceAU(displayMax, catalogMass, currentMass);
    expect(zeroAge).toBeGreaterThan(PLANET_DISTANCE_RANGE_AU.max);
    expect(PLANET_DISTANCE_RANGE_AU.constrainValue(zeroAge)).toBe(PLANET_DISTANCE_RANGE_AU.max);
  });

  it("computes a finite tidal-lock time for a close-in hot Jupiter", () => {
    const lockTime = computeTidalLockTimeMyr(1.06, 0.052);
    expect(lockTime).toBeGreaterThan(0);
    expect(Number.isFinite(lockTime)).toBe(true);
  });

  it("returns tidal-lock times in Myr, the catalog's age unit", () => {
    const sun = SHZ_STARS.find((entry) => entry.mass === 1);
    if (sun === undefined) {
      throw new Error("expected 1 solar-mass star");
    }
    // Sanity: the Sun's catalog track spans ~13 Gyr, i.e. ~13 000 Myr.
    expect(sun.timespan).toBeGreaterThan(10_000);
    expect(sun.timespan).toBeLessThan(20_000);
    // A close-in planet (0.05 AU) locks almost immediately (< 1 Myr)…
    expect(computeTidalLockTimeMyr(1, 0.05)).toBeLessThan(1);
    // …while Earth at 1 AU never locks within the Sun's lifetime.
    expect(computeTidalLockTimeMyr(1, 1)).toBeGreaterThan(sun.timespan);
  });

  it("finds destruction time when a planet starts close to a low-mass star", () => {
    const star = SHZ_STARS.find((entry) => entry.mass === 0.3);
    if (star === undefined) {
      throw new Error("expected 0.3 solar-mass star");
    }
    const destroyTime = computePlanetDestructionTimeMyr(star, 0.03);
    expect(destroyTime).toBeLessThan(star.timespan);
  });
});
