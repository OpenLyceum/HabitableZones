/**
 * CircumstellarModel.ts
 *
 * Model for the Circumstellar screen: a star (selected from the SHZ_STARS
 * catalog), an orbiting planet at a given distance, and the circumstellar
 * habitable zone (HZ) the star casts. Star properties are sampled from the
 * evolution catalog at the current age; the timeline can play or scrub through
 * the star's lifetime.
 *
 * Stage A5 adds real exoplanet presets, diagram zoom, and tidal-locking /
 * destruction times using the Flash orbital-distance scaling (d ∝ M₀/M(t)).
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { BooleanProperty, DerivedProperty, NumberProperty, StringUnionProperty } from "scenerystack/axon";
import { Range } from "scenerystack/dot";
import type { TModel } from "scenerystack/joist";
import { TimeModel } from "../../common/TimeModel.js";
import {
  FULL_STAR_EVOLUTION_PLAYBACK_SECONDS,
  HZ_CONSERVATIVE,
  HZ_OPTIMISTIC,
  PLANET_DISTANCE_RANGE_AU,
  SHZ_DIAGRAM_DEFAULT_ZOOM_LEVEL,
  SHZ_DIAGRAM_ZOOM_AU_VALUES,
} from "../../HabitableZonesConstants.js";
import { findStarIndexByMass } from "./findStarIndexByMass.js";
import {
  computePlanetDestructionTimeMyr,
  computeTidalLockTimeMyr,
  effectivePlanetDistanceAU,
  effectivePlanetDistanceRangeAU,
  initialPlanetDistanceAU,
} from "./planetEvolution.js";
import { findRealSystem, NONE_REAL_SYSTEM_ID, planetPericenterAU, REAL_SYSTEMS } from "./realSystems.js";
import { luminosity, radiusSolar, sampleStar, temperatureK } from "./StarEvolution.js";
import type { StarRecord } from "./shzStars.js";
import { SHZ_STARS } from "./shzStars.js";

export type HzMode = "optimistic" | "conservative";
export type PlanetStatus = "tooHot" | "temperate" | "tooCold";

export type RealSystemId = typeof NONE_REAL_SYSTEM_ID | (typeof REAL_SYSTEMS)[number]["id"];

const REAL_SYSTEM_IDS = [NONE_REAL_SYSTEM_ID, ...REAL_SYSTEMS.map((system) => system.id)] as const;

function getStar(index: number): StarRecord {
  const star = SHZ_STARS[index];
  if (star === undefined) {
    throw new Error(`CircumstellarModel: no star at catalog index ${index}`);
  }
  return star;
}

function findSunStarIndex(): number {
  return findStarIndexByMass(1);
}

const HZ_COEFFICIENTS: Record<HzMode, { inner: number; outer: number }> = {
  optimistic: HZ_OPTIMISTIC,
  conservative: HZ_CONSERVATIVE,
};

export function classifyPlanetDistance(distanceAU: number, hzInnerAU: number, hzOuterAU: number): PlanetStatus {
  if (distanceAU < hzInnerAU) {
    return "tooHot";
  }
  if (distanceAU > hzOuterAU) {
    return "tooCold";
  }
  return "temperate";
}

export class CircumstellarModel implements TModel {
  /** Play/pause clock for stellar evolution. */
  public readonly timer: TimeModel;

  /** Index into SHZ_STARS for the currently selected star. */
  public readonly selectedStarIndexProperty: NumberProperty;

  /** Stellar age since zero-age main sequence, Myr (SHZ catalog units). */
  public readonly ageProperty: NumberProperty;

  /**
   * Zero-age orbital distance (AU). As the star loses mass the displayed
   * distance scales as M₀/M(t); see effectivePlanetDistanceProperty.
   */
  public readonly planetDistanceProperty: NumberProperty;

  /** Which habitable-zone limit convention to display. */
  public readonly hzModeProperty: StringUnionProperty<HzMode>;

  /** Whether to draw the solar-system reference orbits (Mercury..Neptune). */
  public readonly showReferenceOrbitsProperty: BooleanProperty;

  /** Whether to overlay the AU scale grid on the diagram. Off by default (matches NAAP). */
  public readonly showGridProperty: BooleanProperty;

  /** Timeline playback speed multiplier (0.1×..2×). Source: timeline.jsx animationRate. */
  public readonly animationRateProperty: NumberProperty;

  /** Selected real exoplanet system preset, or "none". */
  public readonly selectedRealSystemIdProperty: StringUnionProperty<RealSystemId>;

  /** Diagram zoom-level index into SHZ_DIAGRAM_ZOOM_AU_VALUES. */
  public readonly diagramZoomLevelProperty: NumberProperty;

  /** Maximum age for the selected star, Myr. */
  public readonly starTimespanProperty: TReadOnlyProperty<number>;

  /** Catalog (zero-age) mass of the selected star, M☉. */
  public readonly catalogStarMassProperty: TReadOnlyProperty<number>;

  /** Current stellar mass at the selected age, M☉. */
  public readonly currentStarMassProperty: TReadOnlyProperty<number>;

  /** Mass-scaled orbital distance at the current age, AU. */
  public readonly effectivePlanetDistanceProperty: TReadOnlyProperty<number>;

  /** Writable mirror of effectivePlanetDistanceProperty for NumberControl binding. */
  public readonly displayPlanetDistanceProperty: NumberProperty;

  /** Luminosity of the selected star at the current age, solar units (L☉). */
  public readonly luminosityProperty: TReadOnlyProperty<number>;

  /** Effective temperature of the selected star at the current age, kelvin. */
  public readonly temperatureProperty: TReadOnlyProperty<number>;

  /** Radius of the selected star at the current age, solar units (R☉). */
  public readonly radiusSolarProperty: TReadOnlyProperty<number>;

  /** Inner edge of the circumstellar habitable zone, AU. */
  public readonly hzInnerProperty: TReadOnlyProperty<number>;

  /** Outer edge of the circumstellar habitable zone, AU. */
  public readonly hzOuterProperty: TReadOnlyProperty<number>;

  /** Whether the planet is too hot, temperate, or too cold at its current distance. */
  public readonly planetStatusProperty: TReadOnlyProperty<PlanetStatus>;

  /** Whether a real-system preset locks the star-mass selector. */
  public readonly isStarMassLockedProperty: TReadOnlyProperty<boolean>;

  /** Age (Myr) when tidal locking occurs (may exceed the star's timespan). */
  public readonly timePlanetTidallyLockedProperty: TReadOnlyProperty<number>;

  /** Age (Myr) when the planet is destroyed by the expanding star. */
  public readonly timePlanetDestroyedProperty: TReadOnlyProperty<number>;

  /** Whether the planet is tidally locked at the current age. */
  public readonly isPlanetTidallyLockedProperty: TReadOnlyProperty<boolean>;

  /** Whether the planet has been destroyed at the current age. */
  public readonly isPlanetDestroyedProperty: TReadOnlyProperty<boolean>;

  /** Discrete pericenter distances (AU) when a real system is selected. */
  public readonly realSystemPlanetDistancesProperty: TReadOnlyProperty<readonly number[]>;

  public constructor() {
    this.timer = new TimeModel();

    this.selectedStarIndexProperty = new NumberProperty(findSunStarIndex(), {
      numberType: "Integer",
      range: new Range(0, SHZ_STARS.length - 1),
    });

    const initialStar = getStar(findSunStarIndex());
    this.ageProperty = new NumberProperty(0, {
      range: new Range(0, initialStar.timespan),
    });

    this.planetDistanceProperty = new NumberProperty(1.0, {
      range: PLANET_DISTANCE_RANGE_AU,
      units: "AU",
    });

    this.hzModeProperty = new StringUnionProperty<HzMode>("optimistic", {
      validValues: ["optimistic", "conservative"],
    });

    this.showReferenceOrbitsProperty = new BooleanProperty(true);

    this.showGridProperty = new BooleanProperty(false);

    this.animationRateProperty = new NumberProperty(1, {
      range: new Range(0.1, 2),
    });

    this.selectedRealSystemIdProperty = new StringUnionProperty<RealSystemId>(NONE_REAL_SYSTEM_ID, {
      validValues: [...REAL_SYSTEM_IDS],
    });

    this.diagramZoomLevelProperty = new NumberProperty(SHZ_DIAGRAM_DEFAULT_ZOOM_LEVEL, {
      numberType: "Integer",
      range: new Range(0, SHZ_DIAGRAM_ZOOM_AU_VALUES.length - 1),
    });

    this.starTimespanProperty = new DerivedProperty(
      [this.selectedStarIndexProperty],
      (index) => getStar(index).timespan,
    );

    this.catalogStarMassProperty = new DerivedProperty(
      [this.selectedStarIndexProperty],
      (index) => getStar(index).mass,
    );

    this.currentStarMassProperty = new DerivedProperty(
      [this.selectedStarIndexProperty, this.ageProperty],
      (index, age) => sampleStar(getStar(index), age).mass,
    );

    this.effectivePlanetDistanceProperty = new DerivedProperty(
      [this.planetDistanceProperty, this.catalogStarMassProperty, this.currentStarMassProperty],
      (initialDistance, catalogMass, currentMass) =>
        effectivePlanetDistanceAU(initialDistance, catalogMass, currentMass),
    );

    this.displayPlanetDistanceProperty = new NumberProperty(1, {
      range: PLANET_DISTANCE_RANGE_AU,
      units: "AU",
    });

    // Bidirectional d₀ ↔ d_eff UI mirror. Never write planetDistanceProperty
    // from inside effectivePlanetDistanceProperty's listener — that reenters the
    // DerivedProperty under ?ea. setValueAndRange keeps the NumberControl range
    // and value valid in one shot as mass loss stretches the slider.
    let syncingDisplayDistance = false;

    const syncDisplayPlanetDistanceFromEffective = (distance: number): void => {
      if (syncingDisplayDistance) {
        return;
      }
      const range = this.getEffectivePlanetDistanceRange();
      const clamped = range.constrainValue(distance);
      if (
        this.displayPlanetDistanceProperty.value === clamped &&
        this.displayPlanetDistanceProperty.range.equals(range)
      ) {
        return;
      }
      syncingDisplayDistance = true;
      try {
        this.displayPlanetDistanceProperty.setValueAndRange(clamped, range);
      } finally {
        syncingDisplayDistance = false;
      }
    };

    this.effectivePlanetDistanceProperty.link(syncDisplayPlanetDistanceFromEffective);
    this.displayPlanetDistanceProperty.lazyLink((distance) => {
      if (syncingDisplayDistance) {
        return;
      }
      syncingDisplayDistance = true;
      try {
        this.setEffectivePlanetDistanceAU(distance);
      } finally {
        syncingDisplayDistance = false;
      }
    });

    this.selectedStarIndexProperty.link((index) => {
      const star = getStar(index);
      // Shrink range and value together — assigning range first asserts under ?ea
      // when the previous star's age sits above the new timespan (Reset All).
      const nextAge = Math.min(this.ageProperty.value, star.timespan);
      this.ageProperty.setValueAndRange(nextAge, new Range(0, star.timespan));
    });

    this.luminosityProperty = new DerivedProperty([this.selectedStarIndexProperty, this.ageProperty], (index, age) =>
      luminosity(sampleStar(getStar(index), age)),
    );

    this.temperatureProperty = new DerivedProperty([this.selectedStarIndexProperty, this.ageProperty], (index, age) =>
      temperatureK(sampleStar(getStar(index), age)),
    );

    this.radiusSolarProperty = new DerivedProperty([this.selectedStarIndexProperty, this.ageProperty], (index, age) =>
      radiusSolar(sampleStar(getStar(index), age)),
    );

    this.hzInnerProperty = new DerivedProperty(
      [this.luminosityProperty, this.hzModeProperty],
      (luminositySolar, mode) => Math.sqrt(luminositySolar) * HZ_COEFFICIENTS[mode].inner,
    );

    this.hzOuterProperty = new DerivedProperty(
      [this.luminosityProperty, this.hzModeProperty],
      (luminositySolar, mode) => Math.sqrt(luminositySolar) * HZ_COEFFICIENTS[mode].outer,
    );

    this.planetStatusProperty = new DerivedProperty(
      [this.effectivePlanetDistanceProperty, this.hzInnerProperty, this.hzOuterProperty],
      (distance, hzInner, hzOuter) => classifyPlanetDistance(distance, hzInner, hzOuter),
    );

    this.isStarMassLockedProperty = new DerivedProperty(
      [this.selectedRealSystemIdProperty],
      (systemId) => systemId !== NONE_REAL_SYSTEM_ID,
    );

    this.realSystemPlanetDistancesProperty = new DerivedProperty([this.selectedRealSystemIdProperty], (systemId) => {
      const system = findRealSystem(systemId);
      if (system === null) {
        return [];
      }
      return system.planets.map(planetPericenterAU);
    });

    this.selectedRealSystemIdProperty.link((systemId) => {
      const system = findRealSystem(systemId);
      if (system === null) {
        return;
      }
      this.selectedStarIndexProperty.value = findStarIndexByMass(system.massSolar);
      const firstPlanet = system.planets[0];
      if (firstPlanet !== undefined) {
        this.planetDistanceProperty.value = planetPericenterAU(firstPlanet);
      }
    });

    this.timePlanetDestroyedProperty = new DerivedProperty(
      [this.selectedStarIndexProperty, this.planetDistanceProperty],
      (index, initialDistance) => computePlanetDestructionTimeMyr(getStar(index), initialDistance),
    );

    // The raw lock time: hiding a too-narrow timeline marker (isTidalLockMarkerVisible) is a
    // view concern and must not make fast-locking, close-in planets read as unlocked.
    this.timePlanetTidallyLockedProperty = new DerivedProperty(
      [this.selectedStarIndexProperty, this.planetDistanceProperty],
      (index, initialDistance) => computeTidalLockTimeMyr(getStar(index).mass, initialDistance),
    );

    this.isPlanetTidallyLockedProperty = new DerivedProperty(
      [this.ageProperty, this.timePlanetTidallyLockedProperty],
      (age, lockTime) => Number.isFinite(lockTime) && age >= lockTime,
    );

    this.isPlanetDestroyedProperty = new DerivedProperty(
      [this.ageProperty, this.timePlanetDestroyedProperty],
      (age, destroyTime) => Number.isFinite(destroyTime) && age >= destroyTime,
    );

    // Pressing play at the end of the track replays the star's life from the start.
    this.timer.isPlayingProperty.lazyLink((isPlaying) => {
      if (isPlaying && this.ageProperty.value >= this.starTimespanProperty.value) {
        this.ageProperty.value = 0;
      }
    });
  }

  /** Sets the zero-age planet distance from a displayed (effective) distance. */
  public setEffectivePlanetDistanceAU(effectiveDistanceAU: number): void {
    const star = getStar(this.selectedStarIndexProperty.value);
    const currentMass = sampleStar(star, this.ageProperty.value).mass;
    const constrained = this.getEffectivePlanetDistanceRange().constrainValue(effectiveDistanceAU);
    const nextInitial = PLANET_DISTANCE_RANGE_AU.constrainValue(
      initialPlanetDistanceAU(constrained, star.mass, currentMass),
    );
    if (nextInitial === this.planetDistanceProperty.value) {
      return;
    }
    this.planetDistanceProperty.value = nextInitial;
  }

  /** Mass-scaled display range for the planet-distance control (Flash drag limits). */
  public getEffectivePlanetDistanceRange(): Range {
    const star = getStar(this.selectedStarIndexProperty.value);
    const currentMass = sampleStar(star, this.ageProperty.value).mass;
    return effectivePlanetDistanceRangeAU(star.mass, currentMass);
  }

  public reset(): void {
    this.timer.reset();
    this.selectedStarIndexProperty.reset();
    this.ageProperty.reset();
    this.planetDistanceProperty.reset();
    this.displayPlanetDistanceProperty.reset();
    this.hzModeProperty.reset();
    this.showReferenceOrbitsProperty.reset();
    this.showGridProperty.reset();
    this.animationRateProperty.reset();
    this.selectedRealSystemIdProperty.reset();
    this.diagramZoomLevelProperty.reset();
  }

  public step(dt: number): void {
    if (!this.timer.isPlayingProperty.value) {
      return;
    }

    const star = getStar(this.selectedStarIndexProperty.value);
    const ageDeltaMyr = (dt / FULL_STAR_EVOLUTION_PLAYBACK_SECONDS) * star.timespan * this.animationRateProperty.value;
    const nextAge = Math.min(star.timespan, this.ageProperty.value + ageDeltaMyr);
    this.ageProperty.value = nextAge;

    if (nextAge >= star.timespan) {
      this.timer.isPlayingProperty.value = false;
    }
  }

  public stepTimeline(): void {
    const star = getStar(this.selectedStarIndexProperty.value);
    const stepMyr = star.timespan / 200;
    this.ageProperty.value = Math.min(star.timespan, this.ageProperty.value + stepMyr);
  }

  public zoomDiagramIn(): void {
    this.diagramZoomLevelProperty.value = Math.max(0, this.diagramZoomLevelProperty.value - 1);
  }

  public zoomDiagramOut(): void {
    this.diagramZoomLevelProperty.value = Math.min(
      SHZ_DIAGRAM_ZOOM_AU_VALUES.length - 1,
      this.diagramZoomLevelProperty.value + 1,
    );
  }
}
