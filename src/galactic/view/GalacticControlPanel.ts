/**
 * GalacticControlPanel.ts
 *
 * Controls for the Galactic screen: radius NumberControl and readouts of
 * metallicity, risk, and habitability at the selected radius.
 */
import { DerivedProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { StringUtils } from "scenerystack/phetcommon";
import { Text, VBox } from "scenerystack/scenery";
import { NumberControl, PhetFont } from "scenerystack/scenery-phet";
import { HabitableZonesPanel } from "../../common/HabitableZonesPanel.js";
import HabitableZonesColors from "../../HabitableZonesColors.js";
import { GALACTIC_RADIUS_RANGE_KPC } from "../../HabitableZonesConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { GalacticModel } from "../model/GalacticModel.js";

export class GalacticControlPanel extends HabitableZonesPanel {
  public readonly radiusControl: NumberControl;

  public constructor(model: GalacticModel) {
    const strings = StringManager.getInstance().getGalacticStrings();
    const a11y = StringManager.getInstance().getGalacticA11yStrings();

    const radiusControl = new NumberControl(
      strings.distanceFromCenterStringProperty,
      model.selectedRadiusProperty,
      GALACTIC_RADIUS_RANGE_KPC,
      {
        accessibleName: a11y.controls.radiusControlStringProperty,
        titleNodeOptions: { fill: HabitableZonesColors.textColorProperty },
        numberDisplayOptions: {
          decimalPlaces: 1,
          // {{value}} is left in place for the NumberDisplay to fill.
          valuePattern: new DerivedProperty(
            [strings.unitsKiloparsecsStringProperty, strings.valueUnitsPatternStringProperty],
            (unit, pattern) => StringUtils.fillIn(pattern, { units: unit }),
          ),
          textOptions: { fill: HabitableZonesColors.controlSurfaceTextColorProperty },
          backgroundFill: HabitableZonesColors.controlSurfaceColorProperty,
        },
      },
    );

    const metallicityReadout = new Text(
      new DerivedProperty(
        [strings.readoutMetallicityPatternStringProperty, model.metallicityAtSelectedProperty],
        (pattern, value) => StringUtils.fillIn(pattern, { value: toFixed(value, 2) }),
      ),
      { fill: HabitableZonesColors.textColorProperty },
    );

    const riskReadout = new Text(
      new DerivedProperty([strings.readoutRiskPatternStringProperty, model.riskAtSelectedProperty], (pattern, value) =>
        StringUtils.fillIn(pattern, { value: toFixed(value, 2) }),
      ),
      { fill: HabitableZonesColors.textColorProperty },
    );

    const habitabilityReadout = new Text(
      new DerivedProperty(
        [strings.readoutHabitabilityPatternStringProperty, model.habitabilityAtSelectedProperty],
        (pattern, value) => StringUtils.fillIn(pattern, { value: toFixed(value, 2) }),
      ),
      { fill: HabitableZonesColors.textColorProperty },
    );

    const ghzStatusReadout = new Text(
      new DerivedProperty(
        [strings.readoutInsideGhzStringProperty, strings.readoutOutsideGhzStringProperty, model.isInsideGhzProperty],
        (inside, outside, isInside) => (isInside ? inside : outside),
      ),
      { font: new PhetFont({ size: 14, weight: "bold" }), fill: HabitableZonesColors.textColorProperty },
    );

    const content = new VBox({
      align: "left",
      spacing: 12,
      children: [radiusControl, metallicityReadout, riskReadout, habitabilityReadout, ghzStatusReadout],
    });

    super(content);
    this.radiusControl = radiusControl;
  }
}
