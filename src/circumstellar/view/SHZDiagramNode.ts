/**
 * SHZDiagramNode.ts
 *
 * Top-down circumstellar diagram rendered as a wide rectangular "box" (matching
 * the original NAAP / React port): the star is anchored near the left edge and
 * the habitable-zone annulus, reference orbits, and planet fan out to the right.
 * Contains the star, habitable-zone band, reference orbits, real-system planet
 * overlays, draggable planet, an optional AU grid, and a scale bar.
 *
 * Model ref: SHZDiagram.as, SHZDiagramGrid.as, SHZDiagramScalebar.as,
 * diagram.jsx (STAR_ORIGIN_POINT ≈ [100, 150], AU_PIXELS = 100, HZONE fill).
 */
import { DerivedProperty, Multilink, PatternStringProperty } from "scenerystack/axon";
import { Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { ModelViewTransform2 } from "scenerystack/phetcommon";
import { Circle, Node, Path, Rectangle, RichDragListener, Text } from "scenerystack/scenery";
import { PhetFont, ShadedSphereNode } from "scenerystack/scenery-phet";
import HabitableZonesColors from "../../HabitableZonesColors.js";
import {
  AU_PER_SOLAR_RADIUS,
  REFERENCE_ORBITS_AU,
  SHZ_DIAGRAM_VIEW_HEIGHT,
  SHZ_DIAGRAM_VIEW_WIDTH,
  SHZ_PLANET_VIEW_RADIUS,
  SHZ_STAR_MIN_VIEW_RADIUS,
  SHZ_STAR_ORIGIN_X,
  shzDiagramGridSpacingAU,
  shzDiagramPixelsPerAU,
  shzDiagramScaleBarAU,
} from "../../HabitableZonesConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { CircumstellarModel, PlanetStatus } from "../model/CircumstellarModel.js";
import { findRealSystem, NONE_REAL_SYSTEM_ID, planetPericenterAU } from "../model/realSystems.js";
import { blackbodyColor } from "./blackbodyColor.js";

const STATUS_COLOR_PROPERTIES: Record<PlanetStatus, typeof HabitableZonesColors.tooHotColorProperty> = {
  tooHot: HabitableZonesColors.tooHotColorProperty,
  temperate: HabitableZonesColors.temperateColorProperty,
  tooCold: HabitableZonesColors.tooColdColorProperty,
};

const LABEL_FONT = new PhetFont(10);
const SCALEBAR_FONT = new PhetFont(11);
const HZ_LABEL_FONT = new PhetFont({ size: 12, weight: "bold" });

// Keyboard drag steps, view pixels (converted to AU through the zoom transform).
const KEYBOARD_DRAG_DELTA_PX = 5;
const KEYBOARD_SHIFT_DRAG_DELTA_PX = 1;

export type SHZDiagramNodeOptions = {
  viewWidth?: number;
  viewHeight?: number;
  starOriginX?: number;
};

export class SHZDiagramNode extends Node {
  public readonly planetNode: Node;

  public constructor(model: CircumstellarModel, options?: SHZDiagramNodeOptions) {
    super();

    const viewWidth = options?.viewWidth ?? SHZ_DIAGRAM_VIEW_WIDTH;
    const viewHeight = options?.viewHeight ?? SHZ_DIAGRAM_VIEW_HEIGHT;
    const originX = options?.starOriginX ?? SHZ_STAR_ORIGIN_X;
    const originView = new Vector2(originX, viewHeight / 2);

    const strings = StringManager.getInstance().getCircumstellarStrings();
    const a11y = StringManager.getInstance().getCircumstellarA11yStrings();

    // Framed black "space" box.
    const boxNode = new Rectangle(0, 0, viewWidth, viewHeight, {
      fill: HabitableZonesColors.backgroundColorProperty,
      stroke: HabitableZonesColors.panelBorderColorProperty,
      lineWidth: 1,
    });
    this.addChild(boxNode);

    // Everything inside the box is clipped to its rectangle.
    const contentLayer = new Node({
      clipArea: Shape.rectangle(0, 0, viewWidth, viewHeight),
    });
    this.addChild(contentLayer);

    const gridNode = new Path(null, { stroke: HabitableZonesColors.gridColorProperty, lineWidth: 0.5 });
    contentLayer.addChild(gridNode);

    const referenceOrbitsNode = new Node();
    contentLayer.addChild(referenceOrbitsNode);

    const realSystemOrbitsNode = new Node();
    contentLayer.addChild(realSystemOrbitsNode);

    // Habitable-zone annulus, drawn as a thick stroked ring centered on the star
    // (stroke color = band fill, stroke width = outer − inner radius in px).
    const hzBandNode = new Circle(1, {
      stroke: HabitableZonesColors.habitableZoneFillColorProperty,
      center: originView,
    });
    contentLayer.addChild(hzBandNode);

    const hzLabel = new Text(strings.habitableZoneStringProperty, {
      font: HZ_LABEL_FONT,
      fill: HabitableZonesColors.habitableZoneStrokeColorProperty,
    });
    contentLayer.addChild(hzLabel);

    const starColorProperty = new DerivedProperty([model.temperatureProperty], (temperature) =>
      blackbodyColor(temperature),
    );
    const starNode = new ShadedSphereNode(2 * SHZ_STAR_MIN_VIEW_RADIUS, {
      mainColor: starColorProperty,
    });
    contentLayer.addChild(starNode);

    const realPlanetMarkersNode = new Node();
    contentLayer.addChild(realPlanetMarkersNode);

    const planetColorProperty = new DerivedProperty(
      [
        model.planetStatusProperty,
        model.isPlanetDestroyedProperty,
        model.isPlanetTidallyLockedProperty,
        HabitableZonesColors.tooHotColorProperty,
        HabitableZonesColors.temperateColorProperty,
        HabitableZonesColors.tooColdColorProperty,
        HabitableZonesColors.orbitStrokeColorProperty,
      ],
      (status, destroyed, locked, _tooHot, _temperate, _tooCold, lockedColor) => {
        if (destroyed) {
          return HabitableZonesColors.tooHotColorProperty.value;
        }
        if (locked) {
          return lockedColor;
        }
        return STATUS_COLOR_PROPERTIES[status].value;
      },
    );

    const planetNode = new ShadedSphereNode(2 * SHZ_PLANET_VIEW_RADIUS, {
      mainColor: planetColorProperty,
      cursor: "pointer",
      tagName: "div",
      focusable: true,
      accessibleName: a11y.controls.planetDraggableStringProperty,
    });
    contentLayer.addChild(planetNode);

    const destroyedIndicator = new Text(strings.planetDestroyedMarkStringProperty, {
      font: new PhetFont(28),
      fill: HabitableZonesColors.tooHotColorProperty,
      center: planetNode.center,
      visible: false,
    });
    contentLayer.addChild(destroyedIndicator);

    // A sibling, not a child, of the planet so it doesn't enlarge the drag area or focus highlight.
    const lockedIndicator = new Text(strings.planetTidallyLockedStringProperty, {
      font: LABEL_FONT,
      fill: HabitableZonesColors.textColorProperty,
      pickable: false,
      visible: false,
    });
    contentLayer.addChild(lockedIndicator);

    // Scale bar, top-right of the box.
    const scaleBarAUProperty = new DerivedProperty([model.diagramZoomLevelProperty], (zoom) =>
      shzDiagramScaleBarAU(zoom),
    );
    const scaleBarLabel = new Text(
      new PatternStringProperty(strings.scaleBarPatternStringProperty, { value: scaleBarAUProperty }),
      {
        font: SCALEBAR_FONT,
        fill: HabitableZonesColors.textColorProperty,
      },
    );
    const scaleBarRect = new Rectangle(0, 0, 10, 5, {
      fill: HabitableZonesColors.textColorProperty,
      stroke: HabitableZonesColors.textColorProperty,
      lineWidth: 1,
    });
    const scaleBarNode = new Node({ children: [scaleBarLabel, scaleBarRect] });
    this.addChild(scaleBarNode);

    // Solar-system reference orbits: built once, resized on zoom.
    const referenceOrbitLabels = [
      strings.referenceOrbits.mercuryStringProperty,
      strings.referenceOrbits.venusStringProperty,
      strings.referenceOrbits.earthStringProperty,
      strings.referenceOrbits.marsStringProperty,
      strings.referenceOrbits.jupiterStringProperty,
      strings.referenceOrbits.saturnStringProperty,
      strings.referenceOrbits.uranusStringProperty,
      strings.referenceOrbits.neptuneStringProperty,
    ];
    const referenceOrbits = REFERENCE_ORBITS_AU.map((distanceAU, index) => {
      const circle = new Circle(1, {
        stroke: HabitableZonesColors.orbitStrokeColorProperty,
        lineDash: [4, 4],
      });
      const labelStringProperty = referenceOrbitLabels[index];
      const label =
        labelStringProperty === undefined
          ? null
          : new Text(labelStringProperty, { font: LABEL_FONT, fill: HabitableZonesColors.textColorProperty });
      referenceOrbitsNode.addChild(circle);
      if (label !== null) {
        referenceOrbitsNode.addChild(label);
      }
      return { distanceAU, circle, label };
    });

    const modelViewTransformProperty = new DerivedProperty([model.diagramZoomLevelProperty], (zoom) =>
      ModelViewTransform2.createSinglePointScaleMapping(Vector2.ZERO, originView, shzDiagramPixelsPerAU(zoom)),
    );

    // Zoom-dependent static geometry: grid, scale bar, reference orbits.
    Multilink.multilink([model.diagramZoomLevelProperty, modelViewTransformProperty], (zoom, modelViewTransform) => {
      const pixelsPerAU = shzDiagramPixelsPerAU(zoom);

      const barPx = shzDiagramScaleBarAU(zoom) * pixelsPerAU;
      scaleBarRect.setRect(0, 12, barPx, 6);
      scaleBarLabel.centerX = barPx / 2;
      scaleBarNode.right = viewWidth - 14;
      scaleBarNode.top = 12;

      const { major, minor } = shzDiagramGridSpacingAU(zoom);
      const majorEvery = Math.max(1, Math.round(major / minor));
      const spacingPx = minor * pixelsPerAU;
      const shape = new Shape();
      const leftCount = Math.ceil(originView.x / spacingPx);
      const rightCount = Math.ceil((viewWidth - originView.x) / spacingPx);
      for (let i = -leftCount; i <= rightCount; i++) {
        if (i % majorEvery !== 0) {
          continue;
        }
        const px = originView.x + i * spacingPx;
        shape.moveTo(px, 0);
        shape.lineTo(px, viewHeight);
      }
      const upCount = Math.ceil(originView.y / spacingPx);
      const downCount = Math.ceil((viewHeight - originView.y) / spacingPx);
      for (let j = -upCount; j <= downCount; j++) {
        if (j % majorEvery !== 0) {
          continue;
        }
        const py = originView.y + j * spacingPx;
        shape.moveTo(0, py);
        shape.lineTo(viewWidth, py);
      }
      gridNode.shape = shape;

      const labelAngle = Math.PI / 4;
      for (const { distanceAU, circle, label } of referenceOrbits) {
        const radiusPx = modelViewTransform.modelToViewDeltaX(distanceAU);
        circle.radius = radiusPx;
        circle.center = originView;
        if (label !== null) {
          label.left = originView.x + radiusPx * Math.cos(labelAngle) + 2;
          label.centerY = Math.min(viewHeight - 8, originView.y + radiusPx * Math.sin(labelAngle));
        }
      }
    });

    Multilink.multilink(
      [model.hzInnerProperty, model.hzOuterProperty, modelViewTransformProperty],
      (hzInner, hzOuter, modelViewTransform) => {
        const innerPx = modelViewTransform.modelToViewDeltaX(hzInner);
        const outerPx = modelViewTransform.modelToViewDeltaX(hzOuter);
        const midPx = (innerPx + outerPx) / 2;
        hzBandNode.radius = Math.max(0.5, midPx);
        hzBandNode.lineWidth = Math.max(0, outerPx - innerPx);
        hzBandNode.center = originView;

        // Place the "Habitable Zone" label just above the band arc, clamped inside the box.
        hzLabel.centerX = Math.min(viewWidth - hzLabel.width / 2 - 4, originView.x + midPx);
        hzLabel.centerY = Math.max(hzLabel.height / 2 + 4, originView.y - midPx);
      },
    );

    Multilink.multilink([model.radiusSolarProperty, modelViewTransformProperty], (radiusSolar, modelViewTransform) => {
      const radiusAU = radiusSolar * AU_PER_SOLAR_RADIUS;
      starNode.radius = Math.max(SHZ_STAR_MIN_VIEW_RADIUS, modelViewTransform.modelToViewDeltaX(radiusAU));
      starNode.center = originView;
    });

    Multilink.multilink(
      [
        model.effectivePlanetDistanceProperty,
        model.isPlanetDestroyedProperty,
        model.isPlanetTidallyLockedProperty,
        modelViewTransformProperty,
      ],
      (effectiveDistance, destroyed, locked, modelViewTransform) => {
        planetNode.x = originView.x + modelViewTransform.modelToViewDeltaX(effectiveDistance);
        planetNode.y = originView.y;
        planetNode.visible = !destroyed;
        destroyedIndicator.visible = destroyed;
        destroyedIndicator.center = new Vector2(planetNode.x, originView.y);
        lockedIndicator.visible = locked && !destroyed;
        lockedIndicator.centerX = planetNode.x;
        lockedIndicator.top = planetNode.y + SHZ_PLANET_VIEW_RADIUS + 4;
      },
    );

    // Real-system orbits depend on the mass-loss ratio, so they follow age too.
    Multilink.multilink(
      [
        model.selectedRealSystemIdProperty,
        model.catalogStarMassProperty,
        model.currentStarMassProperty,
        model.effectivePlanetDistanceProperty,
        modelViewTransformProperty,
      ],
      (systemId, catalogMass, currentMass, selectedEffective, modelViewTransform) => {
        realSystemOrbitsNode.removeAllChildren();
        realPlanetMarkersNode.removeAllChildren();

        const system = findRealSystem(systemId);
        if (system === null) {
          return;
        }

        const massRatio = currentMass === 0 ? 1 : catalogMass / currentMass;

        for (const planet of system.planets) {
          const semiMajorPx = modelViewTransform.modelToViewDeltaX(planet.semiMajorAxisAU * massRatio);
          const semiMinorPx = semiMajorPx * Math.sqrt(1 - planet.eccentricity ** 2);
          const pericenterPx = modelViewTransform.modelToViewDeltaX(planetPericenterAU(planet) * massRatio);

          // The planet sits at pericenter a(1 − e); compare like with like.
          const isHighlighted = Math.abs(planetPericenterAU(planet) * massRatio - selectedEffective) < 0.002;

          // Ellipse with the star at one focus and pericenter on the +x axis, where the
          // draggable planet is placed.
          realSystemOrbitsNode.addChild(
            new Path(
              new Shape().ellipse(originView.x + pericenterPx - semiMajorPx, originView.y, semiMajorPx, semiMinorPx, 0),
              {
                stroke: isHighlighted
                  ? HabitableZonesColors.accentColorProperty
                  : HabitableZonesColors.orbitStrokeColorProperty,
                lineWidth: isHighlighted ? 2 : 1,
                lineDash: isHighlighted ? [] : [3, 3],
              },
            ),
          );

          realPlanetMarkersNode.addChild(
            new Circle(3, {
              fill: HabitableZonesColors.planetColorProperty,
              x: originView.x + pericenterPx,
              y: originView.y,
            }),
          );

          realPlanetMarkersNode.addChild(
            new Text(planet.label, {
              font: LABEL_FONT,
              fill: HabitableZonesColors.textColorProperty,
              left: originView.x + pericenterPx + 6,
              centerY: originView.y,
            }),
          );
        }
      },
    );

    const updateGridVisibility = (): void => {
      gridNode.visible = model.showGridProperty.value;
    };
    model.showGridProperty.link(updateGridVisibility);

    const updateOrbitVisibility = (): void => {
      const noRealSystem = model.selectedRealSystemIdProperty.value === NONE_REAL_SYSTEM_ID;
      referenceOrbitsNode.visible = model.showReferenceOrbitsProperty.value && noRealSystem;
      realSystemOrbitsNode.visible = !noRealSystem;
      realPlanetMarkersNode.visible = !noRealSystem;
    };
    model.showReferenceOrbitsProperty.link(updateOrbitVisibility);
    model.selectedRealSystemIdProperty.link(updateOrbitVisibility);

    // Accessor shim: drag writes go through the model's d_eff → d₀ back-mapping.
    const planetPositionProperty = {
      get value(): Vector2 {
        return new Vector2(model.effectivePlanetDistanceProperty.value, 0);
      },
      set value(newValue: Vector2) {
        model.setEffectivePlanetDistanceAU(Math.abs(newValue.x));
      },
    };

    // The transform is a Property so pointer and keyboard drags stay correct after
    // zooming. Keyboard deltas are in view pixels, so the step feels the same at
    // every zoom level.
    planetNode.addInputListener(
      new RichDragListener({
        positionProperty: planetPositionProperty,
        transform: modelViewTransformProperty,
        keyboardDragListenerOptions: {
          dragDelta: KEYBOARD_DRAG_DELTA_PX,
          shiftDragDelta: KEYBOARD_SHIFT_DRAG_DELTA_PX,
        },
      }),
    );

    this.planetNode = planetNode;
  }
}
