/**
 * CircumstellarControlPanel.ts
 *
 * The "Star and Planet Settings and Properties" box from the original NAAP
 * layout: real-system preset, star selector, planet distance, diagram zoom,
 * habitable-zone mode, a live star-properties readout, and a status readout.
 */
import { DerivedProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { combineOptions } from "scenerystack/phet-core";
import { StringUtils } from "scenerystack/phetcommon";
import { HBox, type Node, Text, VBox } from "scenerystack/scenery";
import { NumberControl, PhetFont } from "scenerystack/scenery-phet";
import type { ComboBoxItem, RectangularRadioButtonGroupItem } from "scenerystack/sun";
import { ComboBox, RectangularPushButton, RectangularRadioButtonGroup } from "scenerystack/sun";
import {
  FLAT_RECTANGULAR_BUTTON_OPTIONS,
  LIGHT_SURFACE_TEXT_FILL,
  SIM_COMBO_BOX_OPTIONS,
  SIM_RADIO_BUTTON_GROUP_OPTIONS,
} from "../../common/HabitableZonesButtonOptions.js";
import { HabitableZonesPanel, type HabitableZonesPanelOptions } from "../../common/HabitableZonesPanel.js";
import HabitableZonesColors from "../../HabitableZonesColors.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { CircumstellarModel, HzMode, RealSystemId } from "../model/CircumstellarModel.js";
import { planetDisplayDistanceEnvelopeAU } from "../model/planetEvolution.js";
import { NONE_REAL_SYSTEM_ID, REAL_SYSTEMS } from "../model/realSystems.js";
import { SHZ_STARS } from "../model/shzStars.js";

const TITLE_FONT = new PhetFont({ size: 14, weight: "bold" });
const LABEL_FONT = new PhetFont(12);
const READOUT_FONT = new PhetFont(12);
const READOUT_LABEL_FONT = new PhetFont({ size: 12, style: "italic" });
const STATUS_FONT = new PhetFont({ size: 14, weight: "bold" });

export class CircumstellarControlPanel extends HabitableZonesPanel {
  public readonly realSystemComboBox: ComboBox<RealSystemId>;
  public readonly starComboBox: ComboBox<number>;
  public readonly planetDistanceControl: NumberControl;
  public readonly hzModeRadioButtonGroup: RectangularRadioButtonGroup<HzMode>;
  public readonly zoomInButton: RectangularPushButton;
  public readonly zoomOutButton: RectangularPushButton;

  public constructor(model: CircumstellarModel, listParent: Node, providedOptions?: HabitableZonesPanelOptions) {
    const strings = StringManager.getInstance().getCircumstellarStrings();
    const a11y = StringManager.getInstance().getCircumstellarA11yStrings();

    const labelText = (property: TReadOnlyProperty<string>): Text =>
      new Text(property, { font: LABEL_FONT, fill: HabitableZonesColors.textColorProperty });

    const comboItemText = (property: TReadOnlyProperty<string> | string): Text =>
      new Text(property, { font: LABEL_FONT, fill: LIGHT_SURFACE_TEXT_FILL });

    const realSystemItems: ComboBoxItem<RealSystemId>[] = [
      {
        value: NONE_REAL_SYSTEM_ID,
        createNode: () => comboItemText(strings.realSystemNoneStringProperty),
        accessibleName: strings.realSystemNoneStringProperty,
      },
      ...REAL_SYSTEMS.map((system) => ({
        value: system.id as RealSystemId,
        createNode: () => comboItemText(system.name),
        accessibleName: system.name,
      })),
    ];
    const realSystemComboBox = new ComboBox(model.selectedRealSystemIdProperty, realSystemItems, listParent, {
      ...SIM_COMBO_BOX_OPTIONS,
      accessibleName: a11y.controls.realSystemSelectorStringProperty,
    });

    const starItems: ComboBoxItem<number>[] = SHZ_STARS.map((star, index) => {
      const labelProperty = new DerivedProperty(
        [strings.unitsSolarMassesStringProperty],
        (unit) => `${star.mass} ${unit}`,
      );
      return {
        value: index,
        createNode: () => comboItemText(labelProperty),
        accessibleName: labelProperty,
      };
    });
    const starComboBox = new ComboBox(model.selectedStarIndexProperty, starItems, listParent, {
      ...SIM_COMBO_BOX_OPTIONS,
      accessibleName: a11y.controls.starSelectorStringProperty,
      enabledProperty: DerivedProperty.not(model.isStarMassLockedProperty),
    });

    const planetDistanceControl = new NumberControl(
      strings.orbitalRadiusStringProperty,
      model.displayPlanetDistanceProperty,
      planetDisplayDistanceEnvelopeAU(),
      {
        enabledRangeProperty: model.displayPlanetDistanceProperty.rangeProperty,
        accessibleName: a11y.controls.planetDistanceControlStringProperty,
        titleNodeOptions: { font: LABEL_FONT, fill: HabitableZonesColors.textColorProperty },
        numberDisplayOptions: {
          decimalPlaces: 3,
          valuePattern: new DerivedProperty([strings.unitsAuStringProperty], (unit) => `{{value}} ${unit}`),
          textOptions: { fill: HabitableZonesColors.controlSurfaceTextColorProperty },
          backgroundFill: HabitableZonesColors.controlSurfaceColorProperty,
        },
        arrowButtonOptions: FLAT_RECTANGULAR_BUTTON_OPTIONS,
      },
    );

    const zoomOutButton = new RectangularPushButton({
      ...FLAT_RECTANGULAR_BUTTON_OPTIONS,
      content: new Text(strings.zoomOutStringProperty, { font: LABEL_FONT, fill: LIGHT_SURFACE_TEXT_FILL }),
      listener: () => model.zoomDiagramOut(),
      accessibleName: a11y.controls.zoomOutStringProperty,
    });
    const zoomInButton = new RectangularPushButton({
      ...FLAT_RECTANGULAR_BUTTON_OPTIONS,
      content: new Text(strings.zoomInStringProperty, { font: LABEL_FONT, fill: LIGHT_SURFACE_TEXT_FILL }),
      listener: () => model.zoomDiagramIn(),
      accessibleName: a11y.controls.zoomInStringProperty,
    });

    const hzModeItems: RectangularRadioButtonGroupItem<HzMode>[] = [
      { value: "optimistic", createNode: () => comboItemText(strings.hzOptimisticStringProperty) },
      { value: "conservative", createNode: () => comboItemText(strings.hzConservativeStringProperty) },
    ];
    const hzModeRadioButtonGroup = new RectangularRadioButtonGroup(model.hzModeProperty, hzModeItems, {
      ...SIM_RADIO_BUTTON_GROUP_OPTIONS,
      orientation: "horizontal",
      accessibleName: a11y.controls.hzModeSelectorStringProperty,
    });

    const readout = (
      patternProperty: TReadOnlyProperty<string>,
      valueProperty: TReadOnlyProperty<number>,
      decimals: number,
    ): Text => {
      const textProperty = new DerivedProperty([patternProperty, valueProperty], (pattern, value) =>
        StringUtils.fillIn(pattern, { value: toFixed(value, decimals) }),
      );
      return new Text(textProperty, { font: READOUT_FONT, fill: HabitableZonesColors.textColorProperty });
    };

    const propertiesReadout = new VBox({
      align: "left",
      spacing: 2,
      children: [
        new Text(strings.starPropertiesNowStringProperty, {
          font: READOUT_LABEL_FONT,
          fill: HabitableZonesColors.textColorProperty,
        }),
        readout(strings.massReadoutPatternStringProperty, model.currentStarMassProperty, 2),
        readout(strings.luminosityReadoutPatternStringProperty, model.luminosityProperty, 3),
        readout(strings.temperatureReadoutPatternStringProperty, model.temperatureProperty, 0),
        readout(strings.radiusReadoutPatternStringProperty, model.radiusSolarProperty, 3),
      ],
    });

    const distanceNowProperty = new DerivedProperty(
      [strings.planetDistanceNowPatternStringProperty, model.effectivePlanetDistanceProperty],
      (pattern, distance) => StringUtils.fillIn(pattern, { value: toFixed(distance, 3) }),
    );

    const statusTextProperty = new DerivedProperty(
      [
        strings.statusReadoutPatternStringProperty,
        model.planetStatusProperty,
        model.isPlanetDestroyedProperty,
        model.isPlanetTidallyLockedProperty,
        strings.status.tooHotStringProperty,
        strings.status.temperateStringProperty,
        strings.status.tooColdStringProperty,
        strings.status.destroyedStringProperty,
        strings.status.tidallyLockedStringProperty,
      ],
      (pattern, status, destroyed, locked, tooHot, temperate, tooCold, destroyedLabel, lockedLabel) => {
        let statusLabel = status === "tooHot" ? tooHot : status === "tooCold" ? tooCold : temperate;
        if (destroyed) {
          statusLabel = destroyedLabel;
        } else if (locked) {
          statusLabel = lockedLabel;
        }
        return StringUtils.fillIn(pattern, { status: statusLabel });
      },
    );

    const controlsColumnA = new VBox({
      align: "left",
      spacing: 8,
      children: [
        new VBox({
          align: "left",
          spacing: 3,
          children: [labelText(strings.realSystemLabelStringProperty), realSystemComboBox],
        }),
        new VBox({
          align: "left",
          spacing: 3,
          children: [labelText(strings.initialStarMassStringProperty), starComboBox],
        }),
        planetDistanceControl,
      ],
    });

    const controlsColumnB = new VBox({
      align: "left",
      spacing: 8,
      children: [
        new HBox({
          spacing: 6,
          align: "center",
          children: [labelText(strings.diagramZoomStringProperty), zoomInButton, zoomOutButton],
        }),
        new VBox({
          align: "left",
          spacing: 3,
          children: [labelText(strings.habitableZoneStringProperty), hzModeRadioButtonGroup],
        }),
      ],
    });

    const readoutsColumn = new VBox({
      align: "left",
      spacing: 8,
      children: [
        propertiesReadout,
        new Text(distanceNowProperty, { font: READOUT_FONT, fill: HabitableZonesColors.textColorProperty }),
        new Text(statusTextProperty, { font: STATUS_FONT, fill: HabitableZonesColors.textColorProperty }),
      ],
    });

    const content = new VBox({
      align: "left",
      spacing: 8,
      children: [
        new Text(strings.starPlanetSettingsTitleStringProperty, {
          font: TITLE_FONT,
          fill: HabitableZonesColors.textColorProperty,
          maxWidth: 520,
        }),
        new HBox({
          spacing: 18,
          align: "top",
          children: [controlsColumnA, controlsColumnB, readoutsColumn],
        }),
      ],
    });

    super(content, combineOptions<HabitableZonesPanelOptions>({ align: "left" }, providedOptions));

    this.realSystemComboBox = realSystemComboBox;
    this.starComboBox = starComboBox;
    this.planetDistanceControl = planetDistanceControl;
    this.hzModeRadioButtonGroup = hzModeRadioButtonGroup;
    this.zoomInButton = zoomInButton;
    this.zoomOutButton = zoomOutButton;
  }
}
