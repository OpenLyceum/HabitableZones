/**
 * GalacticRadiusPlotNode.ts
 *
 * Bamboo chart of a normalized quantity vs galactocentric radius. Shows the
 * GHZ band, the full curve, and a draggable cursor synced to
 * selectedRadiusProperty (mirrors MetalsPlot / RiskPlot in the Flash original).
 */
import type { ReadOnlyProperty } from "scenerystack/axon";
import {
  AxisLine,
  ChartRectangle,
  ChartTransform,
  GridLineSet,
  LinePlot,
  TickLabelSet,
  TickMarkSet,
} from "scenerystack/bamboo";
import { Range, Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Orientation } from "scenerystack/phet-core";
import type { ProfileColorProperty } from "scenerystack/scenery";
import { Line, Node, Path, RichDragListener, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import HabitableZonesColors from "../../HabitableZonesColors.js";
import { GALACTIC_RADIUS_RANGE_KPC } from "../../HabitableZonesConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { GalacticModel } from "../model/GalacticModel.js";

const RADIUS_KEYBOARD_STEP_KPC = 0.5;

const PLOT_WIDTH = 280;
const PLOT_HEIGHT = 100;
const CURSOR_MOUSE_HALF_WIDTH = 6;
const CURSOR_TOUCH_HALF_WIDTH = 10;
const LEFT_INSET = 28;
const TOP_INSET = 20;
const TITLE_FONT = new PhetFont(10);
const TICK_FONT = new PhetFont(9);

const CURVE_SAMPLE_COUNT = 80;

export type GalacticRadiusPlotNodeOptions = {
  titleStringProperty: ReadOnlyProperty<string>;
  curveColorProperty: ProfileColorProperty;
  valueAtRadius: (radiusKpc: number) => number;
  accessibleNameProperty: ReadOnlyProperty<string>;
};

export class GalacticRadiusPlotNode extends Node {
  public readonly plotCursor: Node;

  public constructor(model: GalacticModel, options: GalacticRadiusPlotNodeOptions) {
    super({ isDisposable: false });

    const strings = StringManager.getInstance().getGalacticStrings();

    const chartTransform = new ChartTransform({
      viewWidth: PLOT_WIDTH,
      viewHeight: PLOT_HEIGHT,
      modelXRange: GALACTIC_RADIUS_RANGE_KPC,
      modelYRange: new Range(0, 1),
      modelYRangeInverted: false,
    });

    const curveData: Vector2[] = [];
    for (let i = 0; i <= CURVE_SAMPLE_COUNT; i++) {
      const r =
        GALACTIC_RADIUS_RANGE_KPC.min +
        (i / CURVE_SAMPLE_COUNT) * (GALACTIC_RADIUS_RANGE_KPC.max - GALACTIC_RADIUS_RANGE_KPC.min);
      curveData.push(new Vector2(r, options.valueAtRadius(r)));
    }

    const ghzBand = new Path(null, { fill: HabitableZonesColors.ghzBandColorProperty });

    const updateGhzBand = (): void => {
      const x1 = chartTransform.modelToViewX(model.ghzInnerProperty.value);
      const x2 = chartTransform.modelToViewX(model.ghzOuterProperty.value);
      ghzBand.shape = new Shape().rect(x1, 0, Math.max(0, x2 - x1), PLOT_HEIGHT);
    };
    model.ghzInnerProperty.link(updateGhzBand);
    model.ghzOuterProperty.link(updateGhzBand);

    const curvePlot = new LinePlot(chartTransform, curveData, {
      stroke: options.curveColorProperty,
      lineWidth: 2,
    });

    const cursorLine = new Line(0, 0, 0, PLOT_HEIGHT, {
      stroke: HabitableZonesColors.accentColorProperty,
      lineWidth: 1.5,
      cursor: "ew-resize",
      // Translated via x (not re-pointed) so these fixed hit areas follow the line.
      mouseArea: Shape.rectangle(-CURSOR_MOUSE_HALF_WIDTH, 0, 2 * CURSOR_MOUSE_HALF_WIDTH, PLOT_HEIGHT),
      touchArea: Shape.rectangle(-CURSOR_TOUCH_HALF_WIDTH, 0, 2 * CURSOR_TOUCH_HALF_WIDTH, PLOT_HEIGHT),
      tagName: "div",
      focusable: true,
      accessibleName: options.accessibleNameProperty,
    });

    model.selectedRadiusProperty.link((radius) => {
      cursorLine.x = chartTransform.modelToViewX(radius);
    });

    const chartRectangle = new ChartRectangle(chartTransform, {
      fill: HabitableZonesColors.panelBackgroundColorProperty,
      stroke: HabitableZonesColors.panelBorderColorProperty,
      lineWidth: 1,
    });

    const gridX = new GridLineSet(chartTransform, Orientation.HORIZONTAL, 0.25, {
      stroke: HabitableZonesColors.gridColorProperty,
      lineWidth: 0.5,
    });
    const gridY = new GridLineSet(chartTransform, Orientation.VERTICAL, 5, {
      stroke: HabitableZonesColors.gridColorProperty,
      lineWidth: 0.5,
    });

    const xAxis = new AxisLine(chartTransform, Orientation.HORIZONTAL, {
      stroke: HabitableZonesColors.textColorProperty,
      lineWidth: 1,
    });
    const yAxis = new AxisLine(chartTransform, Orientation.VERTICAL, {
      stroke: HabitableZonesColors.textColorProperty,
      lineWidth: 1,
    });

    const xTickMarks = new TickMarkSet(chartTransform, Orientation.HORIZONTAL, 5, { extent: 4 });
    const xTickLabels = new TickLabelSet(chartTransform, Orientation.HORIZONTAL, 5, {
      createLabel: (value) => new Text(`${value}`, { font: TICK_FONT, fill: HabitableZonesColors.textColorProperty }),
    });

    const plotContainer = new Node({
      x: LEFT_INSET,
      y: TOP_INSET,
      children: [
        chartRectangle,
        gridX,
        gridY,
        xAxis,
        yAxis,
        new Node({
          clipArea: Shape.rectangle(0, 0, PLOT_WIDTH, PLOT_HEIGHT),
          children: [ghzBand, curvePlot, cursorLine],
        }),
        xTickMarks,
        xTickLabels,
      ],
    });

    cursorLine.addInputListener(
      new RichDragListener({
        dragListenerOptions: {
          drag: (event) => {
            // Chart coordinates are plotContainer's local frame (origin at the plot corner).
            const local = plotContainer.globalToLocalPoint(event.pointer.point);
            const radius = chartTransform.viewToModelX(Math.max(0, Math.min(PLOT_WIDTH, local.x)));
            model.selectedRadiusProperty.value = GALACTIC_RADIUS_RANGE_KPC.constrainValue(radius);
          },
        },
        keyboardDragListenerOptions: {
          keyboardDragDirection: "leftRight",
          dragDelta: RADIUS_KEYBOARD_STEP_KPC,
          shiftDragDelta: RADIUS_KEYBOARD_STEP_KPC / 2,
          drag: (_event, listener) => {
            model.selectedRadiusProperty.value = GALACTIC_RADIUS_RANGE_KPC.constrainValue(
              model.selectedRadiusProperty.value + listener.modelDelta.x,
            );
          },
        },
      }),
    );

    const title = new Text(options.titleStringProperty, {
      font: TITLE_FONT,
      fill: HabitableZonesColors.textColorProperty,
      centerX: LEFT_INSET + PLOT_WIDTH / 2,
      top: 0,
    });

    const xLabel = new Text(strings.unitsKiloparsecsStringProperty, {
      font: TICK_FONT,
      fill: HabitableZonesColors.textColorProperty,
      centerX: LEFT_INSET + PLOT_WIDTH / 2,
      top: TOP_INSET + PLOT_HEIGHT + 2,
    });

    this.children = [title, plotContainer, xLabel];
    this.plotCursor = cursorLine;
  }
}
