/**
 * HabitableZonesPreferencesNode.ts
 *
 * Custom preferences UI shown in Preferences → Simulation. Controls are bound
 * to HabitableZonesPreferencesModel Properties.
 */

import { Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import type { Tandem } from "scenerystack/tandem";
import HabitableZonesColors from "../HabitableZonesColors.js";
import HabitableZonesNamespace from "../HabitableZonesNamespace.js";
import { StringManager } from "../i18n/StringManager.js";
import type { HabitableZonesPreferencesModel } from "./HabitableZonesPreferencesModel.js";

/** Preferences dialog content sits on a light background regardless of color profile. */
const PREFERENCES_TEXT_FILL = HabitableZonesColors.controlSurfaceTextColorProperty;

export class HabitableZonesPreferencesNode extends VBox {
  public constructor(_preferencesModel: HabitableZonesPreferencesModel, _tandem?: Tandem) {
    const prefStrings = StringManager.getInstance().getPreferences();

    const header = new Text(prefStrings.titleStringProperty, {
      font: new PhetFont({ size: 18, weight: "bold" }),
      fill: PREFERENCES_TEXT_FILL,
    });

    super({
      align: "left",
      spacing: 12,
      children: [header],
    });
  }
}

HabitableZonesNamespace.register("HabitableZonesPreferencesNode", HabitableZonesPreferencesNode);
