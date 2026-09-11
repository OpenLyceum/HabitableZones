/**
 * main.ts
 *
 * Entry point for the simulation. Initializes SceneryStack, creates the
 * screens, and starts the main event loop.
 *
 * !! CRITICAL IMPORT ORDER !!
 * brand.js MUST be the first import. Each module imports the next, so the import nesting is
 *
 *   main → brand → splash → assert → init
 *
 * and therefore the actual EXECUTION order (deepest import runs first) is the reverse:
 *
 *   init → assert → splash → brand → main
 *
 * SceneryStack requires this exact load order. Never reorder these imports.
 */

// brand.js MUST be first; importing it runs the whole chain (init→assert→splash→brand) before main.
import "./brand.js";

import { onReadyToLaunch, PreferencesModel, Sim } from "scenerystack/sim";
import { Tandem } from "scenerystack/tandem";
import { CircumstellarScreen } from "./circumstellar/CircumstellarScreen.js";
import { GalacticScreen } from "./galactic/GalacticScreen.js";
import HabitableZonesColors from "./HabitableZonesColors.js";
import { StringManager } from "./i18n/StringManager.js";
import { HabitableZonesPreferencesModel } from "./preferences/HabitableZonesPreferencesModel.js";
import { HabitableZonesPreferencesNode } from "./preferences/HabitableZonesPreferencesNode.js";

onReadyToLaunch(() => {
  const stringManager = StringManager.getInstance();
  const screenNames = stringManager.getScreenNames();

  // Simulation-specific preferences; initial values come from habitableZonesQueryParameters.
  const simPreferences = new HabitableZonesPreferencesModel(Tandem.ROOT.createTandem("preferences"));

  // Screen name Properties update automatically when the locale changes.
  const screens = [
    new CircumstellarScreen({
      name: screenNames.circumstellarStringProperty,
      tandem: Tandem.ROOT.createTandem("circumstellarScreen"),
      backgroundColorProperty: HabitableZonesColors.backgroundColorProperty,
    }),
    new GalacticScreen({
      name: screenNames.galacticStringProperty,
      tandem: Tandem.ROOT.createTandem("galacticScreen"),
      backgroundColorProperty: HabitableZonesColors.backgroundColorProperty,
    }),
  ];

  const sim = new Sim(stringManager.getTitleStringProperty(), screens, {
    preferencesModel: new PreferencesModel({
      visualOptions: {
        // Adds a "Projector Mode" toggle in Preferences → Visual
        supportsProjectorMode: true,
        // Enables keyboard-navigation highlight outlines
        supportsInteractiveHighlights: true,
      },
      simulationOptions: {
        customPreferences: [
          {
            createContent: (tandem: Tandem) => new HabitableZonesPreferencesNode(simPreferences, tandem),
          },
        ],
      },
      localizationOptions: {
        // Adds a language picker in Preferences → Language
        supportsDynamicLocale: true,
      },
    }),

    // Optional: fill in credits shown in Help → About
    credits: {
      leadDesign: "OpenLyceum",
      softwareDevelopment: "OpenLyceum",
      team: "NAAP / OpenLyceum",
      qualityAssurance: "OpenLyceum",
    },
  });

  sim.start();
});
