/**
 * CircumstellarScreenSummaryContent.ts
 *
 * The accessible screen summary read by screen readers (SceneryStack's
 * Interactive Description). currentDetailsContent is a live DerivedProperty
 * built from CircumstellarModel state via StringUtils.fillIn, so it always
 * describes the star, its habitable zone, and the planet's current status.
 */
import { DerivedProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { StringManager } from "../../i18n/StringManager.js";
import type { CircumstellarModel } from "../model/CircumstellarModel.js";
import { formatAgeMyr } from "../model/formatAge.js";
import { SHZ_STARS } from "../model/shzStars.js";

export class CircumstellarScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: CircumstellarModel) {
    const strings = StringManager.getInstance().getCircumstellarStrings();
    const a11y = StringManager.getInstance().getCircumstellarA11yStrings();

    // Model ages are in Myr (SHZ catalog units).
    const ageLabelProperty = new DerivedProperty(
      [a11y.ageBillionYearsPatternStringProperty, a11y.ageMillionYearsPatternStringProperty, model.ageProperty],
      (billionYearsPattern, millionYearsPattern, age) => formatAgeMyr(age, billionYearsPattern, millionYearsPattern),
    );

    const statusLabelProperty = new DerivedProperty(
      [
        model.planetStatusProperty,
        model.isPlanetDestroyedProperty,
        model.isPlanetTidallyLockedProperty,
        strings.status.tooHotStringProperty,
        strings.status.temperateStringProperty,
        strings.status.tooColdStringProperty,
        strings.status.destroyedStringProperty,
        strings.status.tidallyLockedStringProperty,
      ],
      (status, destroyed, locked, tooHot, temperate, tooCold, destroyedLabel, lockedLabel) => {
        if (destroyed) {
          return destroyedLabel;
        }
        if (locked) {
          return lockedLabel;
        }
        return status === "tooHot" ? tooHot : status === "tooCold" ? tooCold : temperate;
      },
    );

    const currentDetailsProperty = new DerivedProperty(
      [
        a11y.currentDetailsPatternStringProperty,
        model.selectedStarIndexProperty,
        ageLabelProperty,
        model.temperatureProperty,
        model.hzInnerProperty,
        model.hzOuterProperty,
        model.effectivePlanetDistanceProperty,
        statusLabelProperty,
      ],
      (pattern, starIndex, ageLabel, temperature, hzInner, hzOuter, distance, statusLabel) => {
        const star = SHZ_STARS[starIndex];
        const mass = star === undefined ? 0 : star.mass;
        return StringUtils.fillIn(pattern, {
          mass: toFixed(mass, 1),
          age: ageLabel,
          temperature: toFixed(temperature, 0),
          hzInner: toFixed(hzInner, 2),
          hzOuter: toFixed(hzOuter, 2),
          distance: toFixed(distance, 2),
          status: statusLabel,
        });
      },
    );

    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: currentDetailsProperty,
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
  }
}
