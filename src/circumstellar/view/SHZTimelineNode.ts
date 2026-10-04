/**
 * SHZTimelineNode.ts
 *
 * Full-width "Timeline and Simulation Controls" region matching the original
 * NAAP / React layout: a time-since-formation readout, an animation-speed
 * slider and play/step controls, a planet-temperature curve bounded by
 * "Too hot" (top) and "Too cold" (bottom) axes, a habitability gradient strip,
 * a My/Gy time axis, epoch markers, and a draggable age cursor.
 *
 * Model ref: SHZTimeline.as, SHZTimelineCursor.as, SHZHabitabilityPlot.as,
 * timeline.jsx.
 */
import { DerivedProperty, Multilink } from "scenerystack/axon";
import { Dimension2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { StringUtils } from "scenerystack/phetcommon";
import { HBox, Line, Node, Path, Rectangle, RichDragListener, Text, VBox } from "scenerystack/scenery";
import { PhetFont, TimeControlNode } from "scenerystack/scenery-phet";
import { HSlider } from "scenerystack/sun";
import HabitableZonesColors from "../../HabitableZonesColors.js";
import { HZ_CONSERVATIVE, HZ_OPTIMISTIC, SHZ_TIMELINE_WIDTH_PX } from "../../HabitableZonesConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import { type CircumstellarModel, classifyPlanetDistance, type PlanetStatus } from "../model/CircumstellarModel.js";
import { formatAgeMyr } from "../model/formatAge.js";
import { effectivePlanetDistanceAU, isTidalLockMarkerVisible } from "../model/planetEvolution.js";
import { luminosity, sampleStar } from "../model/StarEvolution.js";
import { SHZ_STARS } from "../model/shzStars.js";

const TIMELINE_WIDTH = SHZ_TIMELINE_WIDTH_PX;

/** One arrow-key press scrubs this fraction of the selected star's total lifetime. */
const AGE_STEP_FRACTION = 0.01;
/** Keyboard drag deltas in whole AGE_STEP_FRACTION units; Shift gives a quarter step. */
const AGE_KEY_STEP = 1;
const AGE_KEY_SHIFT_STEP = 0.25;
const HEADER_HEIGHT = 34;
const TEMP_CHART_TOP = HEADER_HEIGHT + 8;
const TEMP_CHART_HEIGHT = 60;
const STRIP_TOP = TEMP_CHART_TOP + TEMP_CHART_HEIGHT + 8;
const STRIP_HEIGHT = 14;
const AXIS_LABEL_Y = STRIP_TOP + STRIP_HEIGHT + 4;

const TITLE_FONT = new PhetFont({ size: 14, weight: "bold" });
const READOUT_FONT = new PhetFont(12);
const LABEL_FONT = new PhetFont(12);
const TICK_FONT = new PhetFont(9);
const EPOCH_LABEL_ROW_HEIGHT = 11;

const HZ_COEFFICIENTS = {
  optimistic: HZ_OPTIMISTIC,
  conservative: HZ_CONSERVATIVE,
} as const;

const STATUS_COLORS: Record<PlanetStatus, typeof HabitableZonesColors.tooHotColorProperty> = {
  tooHot: HabitableZonesColors.tooHotColorProperty,
  temperate: HabitableZonesColors.temperateColorProperty,
  tooCold: HabitableZonesColors.tooColdColorProperty,
};

/** Planet equilibrium temperature (°C). Source: timeline.jsx getPlanetTemp. */
function planetTempC(logRadius: number, logTemp: number, planetDistanceAU: number): number {
  const rStarM = 10 ** logRadius * 6.96e8;
  const tStarK = 10 ** logTemp;
  const dM = planetDistanceAU * 1.495978707e11;
  return ((rStarM ** 2 * tStarK ** 4) / (4 * dM ** 2)) ** 0.25 - 273;
}

export class SHZTimelineNode extends Node {
  public readonly timelineCursor: Node;
  public readonly rateSlider: HSlider;
  public readonly timeControl: TimeControlNode;

  public constructor(model: CircumstellarModel) {
    super();

    const strings = StringManager.getInstance().getCircumstellarStrings();

    // End-state label by Hurley stellar type (see STAR_EPOCH_LABELS in shzStars.ts).
    const finalEpochLabel = (type: number): string => {
      if (type >= 10 && type <= 12) {
        return strings.epochWhiteDwarfStringProperty.value;
      }
      if (type === 13) {
        return strings.epochNeutronStarStringProperty.value;
      }
      if (type === 14) {
        return strings.epochBlackHoleStringProperty.value;
      }
      return strings.epochDisruptedStringProperty.value;
    };
    const a11y = StringManager.getInstance().getCircumstellarA11yStrings();

    const timeToX = (timeYears: number, timespan: number): number =>
      timespan === 0 ? 0 : (timeYears / timespan) * TIMELINE_WIDTH;
    const xToTime = (x: number, timespan: number): number => (x / TIMELINE_WIDTH) * timespan;

    // ── Header: title, readout, animation-speed slider, play/step ──────────────
    const title = new Text(strings.timelineControlsTitleStringProperty, {
      font: TITLE_FONT,
      fill: HabitableZonesColors.textColorProperty,
      left: 0,
      top: 0,
    });

    const readoutProperty = new DerivedProperty(
      [
        strings.timeSinceFormationPatternStringProperty,
        strings.ageGigayearsPatternStringProperty,
        strings.ageMegayearsPatternStringProperty,
        model.ageProperty,
      ],
      (pattern, gigayearsPattern, megayearsPattern, age) =>
        StringUtils.fillIn(pattern, { value: formatAgeMyr(age, gigayearsPattern, megayearsPattern) }),
    );
    const readout = new Text(readoutProperty, {
      font: READOUT_FONT,
      fill: HabitableZonesColors.textColorProperty,
    });

    this.rateSlider = new HSlider(model.animationRateProperty, model.animationRateProperty.range, {
      trackSize: new Dimension2(90, 3),
      accessibleName: strings.rateStringProperty,
    });
    const rateControl = new HBox({
      spacing: 6,
      align: "center",
      children: [
        new Text(strings.rateStringProperty, { font: LABEL_FONT, fill: HabitableZonesColors.textColorProperty }),
        this.rateSlider,
      ],
    });

    this.timeControl = new TimeControlNode(model.timer.isPlayingProperty, {
      playPauseStepButtonOptions: {
        stepForwardButtonOptions: {
          listener: () => model.stepTimeline(),
        },
      },
    });

    const header = new HBox({
      spacing: 24,
      align: "center",
      children: [new VBox({ align: "left", spacing: 3, children: [title, readout] }), rateControl, this.timeControl],
    });
    header.left = 0;
    header.top = 0;

    // ── Temperature curve chart (too hot / too cold) ───────────────────────────
    const tempChartRect = new Rectangle(0, TEMP_CHART_TOP, TIMELINE_WIDTH, TEMP_CHART_HEIGHT, {
      fill: HabitableZonesColors.panelBackgroundColorProperty,
    });
    const tooHotLine = new Line(0, TEMP_CHART_TOP, TIMELINE_WIDTH, TEMP_CHART_TOP, {
      stroke: HabitableZonesColors.tooHotColorProperty,
      lineWidth: 1.5,
    });
    const tooColdLine = new Line(
      0,
      TEMP_CHART_TOP + TEMP_CHART_HEIGHT,
      TIMELINE_WIDTH,
      TEMP_CHART_TOP + TEMP_CHART_HEIGHT,
      {
        stroke: HabitableZonesColors.tooColdColorProperty,
        lineWidth: 1.5,
      },
    );
    const tooHotLabel = new Text(strings.tooHotStripStringProperty, {
      font: TICK_FONT,
      fill: HabitableZonesColors.tooHotColorProperty,
      right: TIMELINE_WIDTH,
      bottom: TEMP_CHART_TOP - 1,
    });
    const tooColdLabel = new Text(strings.tooColdStripStringProperty, {
      font: TICK_FONT,
      fill: HabitableZonesColors.tooColdColorProperty,
      right: TIMELINE_WIDTH,
      top: TEMP_CHART_TOP + TEMP_CHART_HEIGHT + 1,
    });
    const tempCurve = new Path(null, {
      stroke: HabitableZonesColors.textColorProperty,
      lineWidth: 1.5,
    });
    const tempCurveClip = new Node({
      clipArea: Shape.rectangle(0, TEMP_CHART_TOP, TIMELINE_WIDTH, TEMP_CHART_HEIGHT),
      children: [tempCurve],
    });

    // ── Habitability gradient strip ────────────────────────────────────────────
    const stripBands = new Node();
    const stripClip = new Node({
      clipArea: Shape.rectangle(0, STRIP_TOP, TIMELINE_WIDTH, STRIP_HEIGHT),
      children: [stripBands],
    });

    // ── Axis, ticks, epoch markers ─────────────────────────────────────────────
    const axisTicksLayer = new Node();
    const epochTicksLayer = new Node();
    const eventMarkersLayer = new Node();

    const rebuild = (): void => {
      const star = SHZ_STARS[model.selectedStarIndexProperty.value];
      if (star === undefined) {
        return;
      }
      const timespan = star.timespan;
      const initialDistance = model.planetDistanceProperty.value;

      // Temperature curve (clamped y-domain 0..100 °C like the React port). Uses the
      // mass-stretched distance d_eff, like the habitability strip below it.
      const tempShape = new Shape();
      let started = false;
      for (const point of star.dataTable) {
        const distance = effectivePlanetDistanceAU(initialDistance, star.mass, point.mass);
        const tempC = planetTempC(point.logRadius, point.logTemp, distance);
        const clamped = Math.max(0, Math.min(100, tempC));
        const x = timeToX(point.time, timespan);
        const y = TEMP_CHART_TOP + TEMP_CHART_HEIGHT - (clamped / 100) * TEMP_CHART_HEIGHT;
        if (!started) {
          tempShape.moveTo(x, y);
          started = true;
        } else {
          tempShape.lineTo(x, y);
        }
      }
      tempCurve.shape = tempShape;

      // Habitability bands.
      stripBands.removeAllChildren();
      const coeffs = HZ_COEFFICIENTS[model.hzModeProperty.value];
      const catalogMass = star.mass;
      const destroyTime = model.timePlanetDestroyedProperty.value;
      const table = star.dataTable;
      for (let i = 0; i < table.length - 1; i++) {
        const a = table[i];
        const b = table[i + 1];
        if (a === undefined || b === undefined) {
          continue;
        }
        if (Number.isFinite(destroyTime) && a.time >= destroyTime) {
          break;
        }
        const midTime = (a.time + b.time) / 2;
        const sample = sampleStar(star, midTime);
        const distance = effectivePlanetDistanceAU(initialDistance, catalogMass, sample.mass);
        const lum = luminosity(sample);
        const inner = Math.sqrt(lum) * coeffs.inner;
        const outer = Math.sqrt(lum) * coeffs.outer;
        const status = classifyPlanetDistance(distance, inner, outer);
        const x1 = timeToX(a.time, timespan);
        const x2 = timeToX(b.time, timespan);
        stripBands.addChild(
          new Rectangle(x1, STRIP_TOP, Math.max(0.5, x2 - x1), STRIP_HEIGHT, {
            fill: STATUS_COLORS[status],
          }),
        );
      }

      // Axis tick labels (My / Gy).
      axisTicksLayer.removeAllChildren();
      const tickCount = 8;
      for (let i = 0; i <= tickCount; i++) {
        const timeMyr = (i / tickCount) * timespan;
        const x = timeToX(timeMyr, timespan);
        axisTicksLayer.addChild(
          new Line(x, STRIP_TOP + STRIP_HEIGHT, x, STRIP_TOP + STRIP_HEIGHT + 4, {
            stroke: HabitableZonesColors.textColorProperty,
            lineWidth: 1,
          }),
        );
        axisTicksLayer.addChild(
          new Text(
            formatAgeMyr(
              timeMyr,
              strings.ageGigayearsPatternStringProperty.value,
              strings.ageMegayearsPatternStringProperty.value,
            ),
            {
              font: TICK_FONT,
              fill: HabitableZonesColors.textColorProperty,
              centerX: x,
              top: AXIS_LABEL_Y,
              maxWidth: 90,
            },
          ),
        );
      }

      // Epoch markers: a grid line at every catalog transition, but — like the
      // Flash original — labels only at the start, the end of the main sequence,
      // and the star's final state, so they never pile up near the end of life.
      epochTicksLayer.removeAllChildren();
      for (const epoch of star.epochsList) {
        const x = timeToX(epoch.time, timespan);
        epochTicksLayer.addChild(
          new Line(x, TEMP_CHART_TOP, x, STRIP_TOP + STRIP_HEIGHT, {
            stroke: HabitableZonesColors.gridColorProperty,
            lineWidth: 1,
          }),
        );
      }
      const epochs = star.epochsList;
      const endOfMainSequence = epochs[1];
      const finalEpoch = epochs.length > 2 ? epochs[epochs.length - 1] : undefined;
      // The start label sits inside the chart's top-left corner, clear of the header readout.
      epochTicksLayer.addChild(
        new Text(strings.epochMainSequenceStringProperty.value, {
          font: TICK_FONT,
          fill: HabitableZonesColors.textColorProperty,
          maxWidth: 160,
          left: 3,
          top: TEMP_CHART_TOP + 3,
        }),
      );
      const epochLabels: { time: number; label: string; row: number }[] = [];
      if (endOfMainSequence !== undefined) {
        epochLabels.push({ time: endOfMainSequence.time, label: strings.epochStopFusingStringProperty.value, row: 0 });
      }
      if (finalEpoch !== undefined) {
        epochLabels.push({ time: finalEpoch.time, label: finalEpochLabel(finalEpoch.type), row: 1 });
      }
      for (const { time, label, row } of epochLabels) {
        const text = new Text(label, {
          font: TICK_FONT,
          fill: HabitableZonesColors.textColorProperty,
          maxWidth: 160,
          centerX: timeToX(time, timespan),
          bottom: TEMP_CHART_TOP - 2 - row * EPOCH_LABEL_ROW_HEIGHT,
        });
        text.left = Math.max(0, Math.min(text.left, TIMELINE_WIDTH - text.width));
        epochTicksLayer.addChild(text);
      }

      // Event markers: tidal lock (only when wide enough to see, as in Flash) and destruction.
      eventMarkersLayer.removeAllChildren();
      const addMarker = (timeMyr: number, color: typeof HabitableZonesColors.tooHotColorProperty): void => {
        if (!Number.isFinite(timeMyr) || timeMyr > timespan) {
          return;
        }
        const x = timeToX(timeMyr, timespan);
        eventMarkersLayer.addChild(
          new Line(x, TEMP_CHART_TOP, x, STRIP_TOP + STRIP_HEIGHT, {
            stroke: color,
            lineWidth: 2,
            lineDash: [3, 3],
          }),
        );
      };
      const lockTime = model.timePlanetTidallyLockedProperty.value;
      if (isTidalLockMarkerVisible(lockTime, timespan, TIMELINE_WIDTH) && lockTime < destroyTime) {
        addMarker(lockTime, HabitableZonesColors.orbitStrokeColorProperty);
      }
      addMarker(destroyTime, HabitableZonesColors.tooHotColorProperty);
    };

    // ── Draggable cursor ───────────────────────────────────────────────────────
    const cursorLine = new Line(0, TEMP_CHART_TOP, 0, STRIP_TOP + STRIP_HEIGHT, {
      stroke: HabitableZonesColors.accentColorProperty,
      lineWidth: 2,
      cursor: "ew-resize",
      tagName: "div",
      focusable: true,
      accessibleName: a11y.controls.timelineCursorStringProperty,
    });
    const updateCursor = (): void => {
      const star = SHZ_STARS[model.selectedStarIndexProperty.value];
      if (star === undefined) {
        return;
      }
      cursorLine.x = timeToX(model.ageProperty.value, star.timespan);
    };
    cursorLine.addInputListener(
      new RichDragListener({
        dragListenerOptions: {
          drag: (event) => {
            const star = SHZ_STARS[model.selectedStarIndexProperty.value];
            if (star === undefined) {
              return;
            }
            const localPoint = cursorLine.globalToParentPoint(event.pointer.point);
            const x = Math.max(0, Math.min(TIMELINE_WIDTH, localPoint.x));
            model.ageProperty.value = xToTime(x, star.timespan);
          },
        },
        keyboardDragListenerOptions: {
          keyboardDragDirection: "leftRight",
          // The age step is a fraction of the selected star's lifetime, which differs per star, so
          // the drag deltas are expressed in whole AGE_STEP units and scaled below. Without an
          // explicit dragDelta this would fall back to continuous drag and step once per animation
          // frame; taking modelDelta's magnitude (rather than just its sign) is also what makes
          // shiftDragDelta produce the finer step it advertises.
          dragDelta: AGE_KEY_STEP,
          shiftDragDelta: AGE_KEY_SHIFT_STEP,
          drag: (_event, listener) => {
            const star = SHZ_STARS[model.selectedStarIndexProperty.value];
            if (star === undefined || star.timespan === 0) {
              return;
            }
            const delta = listener.modelDelta.x * (star.timespan * AGE_STEP_FRACTION);
            model.ageProperty.value = Math.max(0, Math.min(star.timespan, model.ageProperty.value + delta));
          },
        },
      }),
    );

    // One rebuild per input change. The destruction and tidal-lock times derive from the star and
    // distance, and the model registered those DerivedProperties first, so they are already current.
    Multilink.multilink([model.selectedStarIndexProperty, model.planetDistanceProperty, model.hzModeProperty], rebuild);
    // Tick and epoch labels read localized strings by value; rebuild on locale change.
    Multilink.lazyMultilinkAny(
      [
        strings.ageGigayearsPatternStringProperty,
        strings.ageMegayearsPatternStringProperty,
        strings.epochMainSequenceStringProperty,
        strings.epochStopFusingStringProperty,
        strings.epochWhiteDwarfStringProperty,
        strings.epochNeutronStarStringProperty,
        strings.epochBlackHoleStringProperty,
        strings.epochDisruptedStringProperty,
      ],
      rebuild,
    );
    model.ageProperty.link(updateCursor);
    model.selectedStarIndexProperty.link(updateCursor);

    this.children = [
      header,
      tempChartRect,
      stripClip,
      tempCurveClip,
      tooHotLine,
      tooColdLine,
      tooHotLabel,
      tooColdLabel,
      axisTicksLayer,
      epochTicksLayer,
      eventMarkersLayer,
      cursorLine,
    ];
    this.timelineCursor = cursorLine;
  }
}
