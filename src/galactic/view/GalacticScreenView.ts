/**
 * GalacticScreenView.ts
 *
 * The top-level view for the Galactic screen: Milky Way disc, metallicity and
 * risk plots, and a control panel — all sharing one selected-radius Property.
 */

import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { Rectangle, VBox } from "scenerystack/scenery";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../../common/HabitableZonesButtonOptions.js";
import HabitableZonesColors from "../../HabitableZonesColors.js";
import { SCREEN_VIEW_MARGIN } from "../../HabitableZonesConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { GalacticModel } from "../model/GalacticModel.js";
import { metallicity, risk } from "../model/galacticHabitability.js";
import { GalacticControlPanel } from "./GalacticControlPanel.js";
import { GalacticRadiusPlotNode } from "./GalacticRadiusPlotNode.js";
import { GalacticScreenSummaryContent } from "./GalacticScreenSummaryContent.js";
import { MilkyWayDiscNode } from "./MilkyWayDiscNode.js";

export type GalacticScreenViewOptions = ScreenViewOptions;

export class GalacticScreenView extends ScreenView {
  public constructor(model: GalacticModel, providedOptions?: GalacticScreenViewOptions) {
    const options = optionize<GalacticScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
      {
        screenSummaryContent: new GalacticScreenSummaryContent(model),
      },
      providedOptions,
    );
    super(options);

    const strings = StringManager.getInstance().getGalacticStrings();
    const a11y = StringManager.getInstance().getGalacticA11yStrings();

    const backgroundRect = new Rectangle(0, 0, this.layoutBounds.width, this.layoutBounds.height, {
      fill: HabitableZonesColors.backgroundColorProperty,
    });
    this.addChild(backgroundRect);

    // Disc on the left, vertically centered; control panel and plots stacked on the right.
    const discNode = new MilkyWayDiscNode(model);
    discNode.left = this.layoutBounds.minX + SCREEN_VIEW_MARGIN;
    discNode.centerY = this.layoutBounds.centerY;
    this.addChild(discNode);

    const controlPanel = new GalacticControlPanel(model);

    const metallicityPlot = new GalacticRadiusPlotNode(model, {
      titleStringProperty: strings.plots.metallicityTitleStringProperty,
      curveColorProperty: HabitableZonesColors.metallicityCurveColorProperty,
      valueAtRadius: metallicity,
      accessibleNameProperty: a11y.controls.metallicityPlotCursorStringProperty,
    });

    const riskPlot = new GalacticRadiusPlotNode(model, {
      titleStringProperty: strings.plots.riskTitleStringProperty,
      curveColorProperty: HabitableZonesColors.riskCurveColorProperty,
      valueAtRadius: risk,
      accessibleNameProperty: a11y.controls.riskPlotCursorStringProperty,
    });

    const rightColumn = new VBox({
      spacing: 16,
      align: "center",
      children: [controlPanel, metallicityPlot, riskPlot],
    });
    rightColumn.right = this.layoutBounds.maxX - SCREEN_VIEW_MARGIN;
    rightColumn.top = this.layoutBounds.minY + SCREEN_VIEW_MARGIN;
    this.addChild(rightColumn);
    discNode.centerX = (this.layoutBounds.minX + rightColumn.left) / 2;

    const resetAllButton = new ResetAllButton({
      ...FLAT_RESET_ALL_BUTTON_OPTIONS,
      listener: () => {
        model.reset();
        this.reset();
      },
      right: this.layoutBounds.maxX - SCREEN_VIEW_MARGIN,
      bottom: this.layoutBounds.maxY - SCREEN_VIEW_MARGIN,
    });
    this.addChild(resetAllButton);

    this.pdomPlayAreaNode.pdomOrder = [discNode.radiusCursor, metallicityPlot.plotCursor, riskPlot.plotCursor];
    this.pdomControlAreaNode.pdomOrder = [controlPanel.radiusControl, resetAllButton];
  }

  public reset(): void {
    // No view-side state to reset yet.
  }

  public override step(_dt: number): void {
    // No animation on the galactic screen.
  }
}
