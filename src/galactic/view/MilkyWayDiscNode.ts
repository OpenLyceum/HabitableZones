/**
 * MilkyWayDiscNode.ts
 *
 * Top-down Milky Way disc with the galactic habitable zone annulus, a Sun
 * marker, and a draggable selected-radius ring. Model ref: MilkyWayComponent.as.
 */
import { Vector2 } from "scenerystack/dot";
import { ModelViewTransform2 } from "scenerystack/phetcommon";
import { Circle, Line, Node, RichDragListener } from "scenerystack/scenery";
import { ShadedSphereNode } from "scenerystack/scenery-phet";
import HabitableZonesColors from "../../HabitableZonesColors.js";
import {
  GALACTIC_DISC_PIXELS_PER_KPC,
  GALACTIC_RADIUS_RANGE_KPC,
  SUN_GALACTOCENTRIC_KPC,
} from "../../HabitableZonesConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { GalacticModel } from "../model/GalacticModel.js";

const RADIUS_KEYBOARD_STEP_KPC = 0.5;

const DISC_OUTER_KPC = GALACTIC_RADIUS_RANGE_KPC.max;

export class MilkyWayDiscNode extends Node {
  public readonly radiusCursor: Node;

  public constructor(model: GalacticModel) {
    super();

    const a11y = StringManager.getInstance().getGalacticA11yStrings();

    const modelViewTransform = ModelViewTransform2.createSinglePointScaleMapping(
      Vector2.ZERO,
      Vector2.ZERO,
      GALACTIC_DISC_PIXELS_PER_KPC,
    );

    const discNode = new Circle(modelViewTransform.modelToViewDeltaX(DISC_OUTER_KPC), {
      fill: HabitableZonesColors.galacticDiskColorProperty,
      stroke: HabitableZonesColors.panelBorderColorProperty,
      lineWidth: 1,
    });
    this.addChild(discNode);

    const ghzBandNode = new Circle(1, {
      stroke: HabitableZonesColors.ghzBandColorProperty,
    });
    const updateGhzBand = (): void => {
      const innerPx = modelViewTransform.modelToViewDeltaX(model.ghzInnerProperty.value);
      const outerPx = modelViewTransform.modelToViewDeltaX(model.ghzOuterProperty.value);
      ghzBandNode.radius = Math.max(1, (innerPx + outerPx) / 2);
      ghzBandNode.lineWidth = Math.max(0, outerPx - innerPx);
    };
    model.ghzInnerProperty.link(updateGhzBand);
    model.ghzOuterProperty.link(updateGhzBand);
    this.addChild(ghzBandNode);

    const sunNode = new ShadedSphereNode(10, {
      mainColor: HabitableZonesColors.starColorProperty,
      x: modelViewTransform.modelToViewX(SUN_GALACTOCENTRIC_KPC),
      y: 0,
    });
    this.addChild(sunNode);

    const selectedRing = new Circle(1, {
      stroke: HabitableZonesColors.accentColorProperty,
      lineWidth: 2,
      cursor: "pointer",
    });
    model.selectedRadiusProperty.link((radius) => {
      selectedRing.radius = modelViewTransform.modelToViewDeltaX(radius);
    });
    this.addChild(selectedRing);

    const radialHandle = new Circle(6, {
      fill: HabitableZonesColors.accentColorProperty,
      cursor: "pointer",
      tagName: "div",
      focusable: true,
      accessibleName: a11y.controls.radiusCursorStringProperty,
    });
    model.selectedRadiusProperty.link((radius) => {
      radialHandle.x = modelViewTransform.modelToViewX(radius);
    });
    this.addChild(radialHandle);

    const setRadiusFromLocalPoint = (local: Vector2): void => {
      model.selectedRadiusProperty.value = GALACTIC_RADIUS_RANGE_KPC.constrainValue(
        Math.hypot(local.x, local.y) / GALACTIC_DISC_PIXELS_PER_KPC,
      );
    };

    radialHandle.addInputListener(
      new RichDragListener({
        dragListenerOptions: {
          drag: (event) => {
            // The disc is centered on this node's local origin.
            setRadiusFromLocalPoint(this.globalToLocalPoint(event.pointer.point));
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

    // Decorative crosshair through the galactic center.
    const armLength = modelViewTransform.modelToViewDeltaX(DISC_OUTER_KPC);
    this.addChild(
      new Line(-armLength, 0, armLength, 0, {
        stroke: HabitableZonesColors.gridColorProperty,
        lineWidth: 1,
        lineDash: [6, 6],
      }),
    );
    this.addChild(
      new Line(0, -armLength, 0, armLength, {
        stroke: HabitableZonesColors.gridColorProperty,
        lineWidth: 1,
        lineDash: [6, 6],
      }),
    );

    this.radiusCursor = radialHandle;
  }
}
