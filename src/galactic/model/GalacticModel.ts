/**
 * GalacticModel.ts
 *
 * Model for the Galactic screen: a selected galactocentric radius drives
 * readouts of metallicity, catastrophic risk, and combined habitability. The
 * galactic habitable zone (GHZ) is the annulus where both metallicity and risk
 * are acceptable — reconstructed parametrically from the NAAP pedagogy.
 */
import type { TReadOnlyProperty } from "scenerystack/axon";
import { DerivedProperty, NumberProperty, Property } from "scenerystack/axon";
import type { TModel } from "scenerystack/joist";
import { GALACTIC_RADIUS_RANGE_KPC, SUN_GALACTOCENTRIC_KPC } from "../../HabitableZonesConstants.js";
import { findGhzBounds, habitability, metallicity, risk } from "./galacticHabitability.js";

const ghzBounds = findGhzBounds();
if (ghzBounds === null) {
  throw new Error("GalacticModel: could not determine GHZ bounds in the allowed radius range");
}

const GHZ_INNER_KPC = ghzBounds.inner;
const GHZ_OUTER_KPC = ghzBounds.outer;

export class GalacticModel implements TModel {
  /** Selected galactocentric radius, kiloparsecs. */
  public readonly selectedRadiusProperty: NumberProperty;

  /** Normalized heavy-element abundance at the selected radius. */
  public readonly metallicityAtSelectedProperty: TReadOnlyProperty<number>;

  /** Normalized catastrophic-event probability at the selected radius. */
  public readonly riskAtSelectedProperty: TReadOnlyProperty<number>;

  /** Combined habitability score at the selected radius. */
  public readonly habitabilityAtSelectedProperty: TReadOnlyProperty<number>;

  /** Inner edge of the galactic habitable zone, kpc. */
  public readonly ghzInnerProperty: TReadOnlyProperty<number>;

  /** Outer edge of the galactic habitable zone, kpc. */
  public readonly ghzOuterProperty: TReadOnlyProperty<number>;

  /** Whether the selected radius falls inside the GHZ annulus. */
  public readonly isInsideGhzProperty: TReadOnlyProperty<boolean>;

  public constructor() {
    this.selectedRadiusProperty = new NumberProperty(SUN_GALACTOCENTRIC_KPC, {
      range: GALACTIC_RADIUS_RANGE_KPC,
    });

    this.metallicityAtSelectedProperty = new DerivedProperty([this.selectedRadiusProperty], (radius) =>
      metallicity(radius),
    );

    this.riskAtSelectedProperty = new DerivedProperty([this.selectedRadiusProperty], (radius) => risk(radius));

    this.habitabilityAtSelectedProperty = new DerivedProperty([this.selectedRadiusProperty], (radius) =>
      habitability(radius),
    );

    // The GHZ is fixed by the reconstruction; exposed as Properties for view/a11y binding.
    this.ghzInnerProperty = new Property(GHZ_INNER_KPC);
    this.ghzOuterProperty = new Property(GHZ_OUTER_KPC);

    this.isInsideGhzProperty = new DerivedProperty(
      [this.selectedRadiusProperty],
      (radius) => radius >= GHZ_INNER_KPC && radius <= GHZ_OUTER_KPC,
    );
  }

  public reset(): void {
    this.selectedRadiusProperty.reset();
  }

  public step(_dt: number): void {
    // No time dimension on the galactic screen.
  }
}
