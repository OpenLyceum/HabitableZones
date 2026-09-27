/**
 * CircumstellarScreenView.ts
 *
 * Top-level view for the Circumstellar screen, laid out in the four regions of
 * the original NAAP sim:
 *   1. a wide top-down diagram box (top),
 *   2. a "General Settings" box + "Star and Planet Settings and Properties" box
 *      + the H-R diagram (middle row),
 *   3. a full-width "Timeline and Simulation Controls" region (bottom).
 */

import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { Node } from "scenerystack/scenery";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../../common/HabitableZonesButtonOptions.js";
import { HabitableZonesPanel } from "../../common/HabitableZonesPanel.js";
import { SCREEN_VIEW_MARGIN, SHZ_DIAGRAM_VIEW_HEIGHT } from "../../HabitableZonesConstants.js";
import type { CircumstellarModel } from "../model/CircumstellarModel.js";
import { CircumstellarControlPanel } from "./CircumstellarControlPanel.js";
import { CircumstellarScreenSummaryContent } from "./CircumstellarScreenSummaryContent.js";
import { GeneralSettingsPanel } from "./GeneralSettingsPanel.js";
import { HRDiagramNode } from "./HRDiagramNode.js";
import { SHZDiagramNode } from "./SHZDiagramNode.js";
import { SHZTimelineNode } from "./SHZTimelineNode.js";

const MARGIN = 12;
const ROW_GAP = 8;

// Keeps long translations of the settings panel from squeezing the middle row.
const GENERAL_SETTINGS_MAX_WIDTH = 230;

export type CircumstellarScreenViewOptions = ScreenViewOptions;

export class CircumstellarScreenView extends ScreenView {
  public constructor(model: CircumstellarModel, providedOptions?: CircumstellarScreenViewOptions) {
    const options = optionize<CircumstellarScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
      {
        screenSummaryContent: new CircumstellarScreenSummaryContent(model),
      },
      providedOptions,
    );
    super(options);

    const contentWidth = this.layoutBounds.width - 2 * MARGIN;

    // ── Region 1: wide top-down diagram box ────────────────────────────────────
    const diagramNode = new SHZDiagramNode(model, {
      viewWidth: contentWidth,
      viewHeight: SHZ_DIAGRAM_VIEW_HEIGHT,
    });
    diagramNode.left = this.layoutBounds.minX + MARGIN;
    diagramNode.top = this.layoutBounds.minY + MARGIN;
    this.addChild(diagramNode);

    const middleTop = diagramNode.bottom + ROW_GAP;

    // ── Region 2: General Settings + Star/Planet Settings + H-R diagram ────────
    const generalSettingsPanel = new GeneralSettingsPanel(model);
    generalSettingsPanel.maxWidth = GENERAL_SETTINGS_MAX_WIDTH;
    generalSettingsPanel.left = this.layoutBounds.minX + MARGIN;
    generalSettingsPanel.top = middleTop;
    this.addChild(generalSettingsPanel);

    const hrDiagramNode = new HRDiagramNode(model);
    const hrPanel = new HabitableZonesPanel(hrDiagramNode);
    hrPanel.right = this.layoutBounds.maxX - MARGIN;
    hrPanel.top = middleTop;

    // The settings panel fills the gap between its neighbours; maxWidth keeps it
    // (and longer translations) from sliding under the H-R diagram.
    const comboBoxListParent = new Node();
    const controlPanel = new CircumstellarControlPanel(model, comboBoxListParent, {
      maxWidth: hrPanel.left - generalSettingsPanel.right - 2 * ROW_GAP,
    });
    controlPanel.left = generalSettingsPanel.right + ROW_GAP;
    controlPanel.top = middleTop;
    this.addChild(controlPanel);
    this.addChild(hrPanel);

    // ── Region 3: full-width timeline ──────────────────────────────────────────
    const timelineNode = new SHZTimelineNode(model);
    timelineNode.left = this.layoutBounds.minX + MARGIN;
    timelineNode.bottom = this.layoutBounds.maxY - MARGIN;
    this.addChild(timelineNode);

    this.addChild(comboBoxListParent);

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

    // Play area: diagram planet + timeline cursor. Controls: panels, timeline
    // playback, and Reset All (MovingMan / ACCESSIBILITY.md pattern).
    this.pdomPlayAreaNode.pdomOrder = [diagramNode.planetNode, timelineNode.timelineCursor];
    this.pdomControlAreaNode.pdomOrder = [
      generalSettingsPanel.showGridCheckbox,
      generalSettingsPanel.showOrbitsCheckbox,
      controlPanel.realSystemComboBox,
      controlPanel.starComboBox,
      controlPanel.planetDistanceControl,
      controlPanel.zoomInButton,
      controlPanel.zoomOutButton,
      controlPanel.hzModeRadioButtonGroup,
      timelineNode.rateSlider,
      timelineNode.timeControl,
      resetAllButton,
    ];
  }

  public reset(): void {
    // No view-side state to reset yet.
  }

  public override step(_dt: number): void {
    // Model step is handled by the Sim framework via CircumstellarScreen.
  }
}
