/**
 * galacticHabitability.test.ts
 *
 * Unit tests for the parametric galactic habitability model.
 */

import { describe, expect, it } from "vitest";
import { findGhzBounds, habitability, metallicity, risk } from "../src/galactic/model/galacticHabitability.js";
import { GALACTIC_RADIUS_RANGE_KPC, SUN_GALACTOCENTRIC_KPC } from "../src/HabitableZonesConstants.js";

const R_MIN: number = GALACTIC_RADIUS_RANGE_KPC.min;
const R_MAX: number = GALACTIC_RADIUS_RANGE_KPC.max;
const SAMPLE_STEP = 0.5;

describe("galacticHabitability", () => {
  it("metallicity decreases monotonically outward", () => {
    let previous = metallicity(R_MIN);
    for (let r = R_MIN + SAMPLE_STEP; r <= R_MAX; r += SAMPLE_STEP) {
      const current = metallicity(r);
      expect(current).toBeLessThanOrEqual(previous + 1e-9);
      previous = current;
    }
  });

  it("risk decreases monotonically outward", () => {
    let previous = risk(R_MIN);
    for (let r = R_MIN + SAMPLE_STEP; r <= R_MAX; r += SAMPLE_STEP) {
      const current = risk(r);
      expect(current).toBeLessThanOrEqual(previous + 1e-9);
      previous = current;
    }
  });

  it("habitability has an interior maximum within the allowed radius range", () => {
    let maxH = -1;
    let maxRadius = R_MIN;
    for (let r = R_MIN; r <= R_MAX; r += SAMPLE_STEP) {
      const h = habitability(r);
      if (h > maxH) {
        maxH = h;
        maxRadius = r;
      }
    }
    expect(maxRadius).toBeGreaterThan(R_MIN);
    expect(maxRadius).toBeLessThan(R_MAX);
  });

  it("findGhzBounds returns a valid annulus inside the allowed range", () => {
    const bounds = findGhzBounds();
    expect(bounds).not.toBeNull();
    if (bounds === null) {
      return;
    }
    expect(bounds.inner).toBeGreaterThanOrEqual(R_MIN);
    expect(bounds.outer).toBeLessThanOrEqual(R_MAX);
    expect(bounds.inner).toBeLessThan(bounds.outer);
  });

  it("places the Sun inside a ~7–10 kpc GHZ", () => {
    const bounds = findGhzBounds();
    expect(bounds).not.toBeNull();
    if (bounds === null) {
      return;
    }
    expect(bounds.inner).toBeCloseTo(7, 0);
    expect(bounds.outer).toBeCloseTo(10, 0);
    expect(SUN_GALACTOCENTRIC_KPC).toBeGreaterThan(bounds.inner);
    expect(SUN_GALACTOCENTRIC_KPC).toBeLessThan(bounds.outer);
  });
});
