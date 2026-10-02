/**
 * Memory-leak regression suite (fleet standard): each object below is collected after
 * dispose(), survives a double dispose(), and leaves no survivors across repeated cycles
 * (tests/helpers/memoryLeak.ts). TimeModel is the only class with a dispose();
 * CircumstellarModel and GalacticModel live for the whole sim (see
 * doc/implementation-notes.md, "Disposal"). Add sim-specific leak tests below using forceGC().
 */

import { TimeModel } from "../src/common/TimeModel.js";
import { describeDisposalLeaks } from "./helpers/memoryLeak.js";

describeDisposalLeaks([{ name: "TimeModel", create: () => new TimeModel(), idempotentDispose: true }]);
