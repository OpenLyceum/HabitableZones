/**
 * CircumstellarModel.test.ts
 *
 * Guards planet-distance round trips and star-switch age clamping. Axon
 * NumberProperty asserts under ?ea if a range shrinks below the current value.
 */
import { enableAssert } from "scenerystack/assert";
import { describe, expect, it } from "vitest";
import { CircumstellarModel } from "../../../src/circumstellar/model/CircumstellarModel.js";
import { SHZ_STARS } from "../../../src/circumstellar/model/shzStars.js";
import { PLANET_DISTANCE_RANGE_AU } from "../../../src/HabitableZonesConstants.js";

enableAssert();

describe("CircumstellarModel planet distance", () => {
  it("clamps a round-trip of the display-range max into the zero-age range", () => {
    const model = new CircumstellarModel();
    // 0.3 M☉ track loses mass, so the display max exceeds 500 AU at late times.
    model.selectedStarIndexProperty.value = 0;
    model.ageProperty.value = model.starTimespanProperty.value;

    const displayRange = model.getEffectivePlanetDistanceRange();
    expect(() => model.setEffectivePlanetDistanceAU(displayRange.max)).not.toThrow();
    expect(() => model.setEffectivePlanetDistanceAU(displayRange.max + 1)).not.toThrow();
    expect(model.planetDistanceProperty.value).toBeLessThanOrEqual(PLANET_DISTANCE_RANGE_AU.max);
    expect(model.planetDistanceProperty.value).toBeGreaterThanOrEqual(PLANET_DISTANCE_RANGE_AU.min);
  });

  it("scrubs age at max zero-age distance without axon reentry", () => {
    const model = new CircumstellarModel();
    model.selectedStarIndexProperty.value = 0;
    model.planetDistanceProperty.value = PLANET_DISTANCE_RANGE_AU.max;
    const timespan = model.starTimespanProperty.value;
    const steps = 40;
    expect(() => {
      for (let i = 0; i <= steps; i++) {
        model.ageProperty.value = model.ageProperty.range.constrainValue((timespan * i) / steps);
        model.displayPlanetDistanceProperty.value = model.displayPlanetDistanceProperty.range.max;
      }
    }).not.toThrow();
    expect(model.planetDistanceProperty.value).toBeLessThanOrEqual(PLANET_DISTANCE_RANGE_AU.max);
    expect(model.displayPlanetDistanceProperty.range.contains(model.displayPlanetDistanceProperty.value)).toBe(true);
  });
});

describe("CircumstellarModel age range", () => {
  const sunIndex = SHZ_STARS.findIndex((star) => star.mass === 1);

  it("clamps age when switching from a long-lived star to the Sun", () => {
    const model = new CircumstellarModel();
    expect(sunIndex).toBeGreaterThanOrEqual(0);
    model.selectedStarIndexProperty.value = 0;
    model.ageProperty.value = 62488.78250041381;
    expect(() => {
      model.selectedStarIndexProperty.value = sunIndex;
    }).not.toThrow();
    expect(model.ageProperty.range.contains(model.ageProperty.value)).toBe(true);
    expect(model.ageProperty.value).toBe(model.starTimespanProperty.value);
  });

  it("resets after a late-age low-mass track without shrinking the age range first", () => {
    const model = new CircumstellarModel();
    model.selectedStarIndexProperty.value = 0;
    model.ageProperty.value = 62488.78250041381;
    expect(() => {
      model.reset();
    }).not.toThrow();
    expect(model.ageProperty.value).toBe(0);
    expect(model.ageProperty.range.contains(model.ageProperty.value)).toBe(true);
  });
});

describe("CircumstellarModel tidal locking", () => {
  it("reports a fast-locking close-in planet as locked after the first timeline step", () => {
    const model = new CircumstellarModel();
    // 51 Peg b at 0.052 AU locks within thousands of years — far narrower than a timeline pixel.
    model.selectedRealSystemIdProperty.value = "51pegasi";
    expect(model.timePlanetTidallyLockedProperty.value).toBeLessThan(0.01);
    model.stepTimeline();
    expect(model.isPlanetTidallyLockedProperty.value).toBe(true);
  });

  it("never locks Earth at 1 AU within the Sun's lifetime", () => {
    const model = new CircumstellarModel();
    model.ageProperty.value = model.starTimespanProperty.value;
    expect(model.timePlanetTidallyLockedProperty.value).toBeGreaterThan(model.starTimespanProperty.value);
    expect(model.isPlanetTidallyLockedProperty.value).toBe(false);
  });
});

describe("CircumstellarModel playback", () => {
  it("replays from age 0 when play is pressed at the end of the track", () => {
    const model = new CircumstellarModel();
    model.ageProperty.value = model.starTimespanProperty.value;
    model.timer.isPlayingProperty.value = true;
    expect(model.ageProperty.value).toBe(0);
  });

  it("keeps the current age when play is pressed mid-track", () => {
    const model = new CircumstellarModel();
    model.ageProperty.value = model.starTimespanProperty.value / 2;
    model.timer.isPlayingProperty.value = true;
    expect(model.ageProperty.value).toBe(model.starTimespanProperty.value / 2);
  });
});
