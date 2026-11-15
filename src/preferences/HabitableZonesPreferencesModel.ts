/**
 * HabitableZonesPreferencesModel.ts
 *
 * Model for the simulation-specific preferences shown in Preferences →
 * Simulation. Currently empty — add Properties here when the sim gains real
 * preferences (and optional matching startup query parameters).
 * The constructor keeps an optional tandem so main.ts can pass one without
 * changing call sites when preferences are added later.
 */

import type { Tandem } from "scenerystack/tandem";
import HabitableZonesNamespace from "../HabitableZonesNamespace.js";

export class HabitableZonesPreferencesModel {
  // biome-ignore lint/complexity/noUselessConstructor: tandem reserved for future preference Properties
  public constructor(_tandem?: Tandem) {
    // No sim-specific preferences yet.
  }

  public reset(): void {
    // No-op until preferences are added.
  }
}

HabitableZonesNamespace.register("HabitableZonesPreferencesModel", HabitableZonesPreferencesModel);
