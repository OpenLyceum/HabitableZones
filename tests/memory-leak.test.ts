/**
 * Memory-leak regression suite (fleet standard): each object below is collected after
 * dispose(), survives a double dispose(), and leaves no survivors across repeated cycles
 * (tests/helpers/memoryLeak.ts). TimeModel is the only class with a dispose();
 * CircumstellarModel and GalacticModel live for the whole sim (see
 * doc/implementation-notes.md, "Disposal"), so they are checked with create/drop + forceGC.
 *
 * HRDiagramNode and GalacticRadiusPlotNode are constructed with isDisposable: false and are
 * deliberately not disposed here.
 */

import { describe, expect, it } from "vitest";
import { CircumstellarModel } from "../src/circumstellar/model/CircumstellarModel.js";
import { TimeModel } from "../src/common/TimeModel.js";
import { GalacticModel } from "../src/galactic/model/GalacticModel.js";
import { describeDisposalLeaks, forceGC } from "./helpers/memoryLeak.js";

type ScreenModel = CircumstellarModel | GalacticModel;

const SCREEN_MODELS: readonly { name: string; create: () => ScreenModel }[] = [
  { name: "CircumstellarModel", create: () => new CircumstellarModel() },
  { name: "GalacticModel", create: () => new GalacticModel() },
];

function createAndDropModel(create: () => ScreenModel): WeakRef<object> {
  const model = create();
  if (model instanceof CircumstellarModel) {
    model.timer.isPlayingProperty.value = true;
  }
  for (let i = 0; i < 30; i++) {
    model.step(1 / 60);
  }
  model.reset();
  return new WeakRef<object>(model);
}

describe("Screen models (no dispose(): create/drop)", () => {
  for (const { name, create } of SCREEN_MODELS) {
    it(`${name} is collected after drop`, async () => {
      const ref = createAndDropModel(create);
      await forceGC(ref);
      expect(ref.deref()).toBeUndefined();
    });

    it(`${name}: repeated create/drop cycles leave no survivors`, async () => {
      const refs: WeakRef<object>[] = [];
      for (let i = 0; i < 10; i++) {
        refs.push(createAndDropModel(create));
      }
      await forceGC(refs);
      expect(refs.filter((r) => r.deref() !== undefined).length).toBe(0);
    });
  }
});

describeDisposalLeaks([{ name: "TimeModel", create: () => new TimeModel(), idempotentDispose: true }]);
