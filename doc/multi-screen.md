# Multi-Screen Simulations

This template ships as a **single-screen** simulation. Many physics simulations
expose multiple conceptual modes — "Intro" + "Lab", "Basics" + "Advanced", etc.
This guide shows how to extend the template to two or more screens.

---

## Architecture patterns

### Single-screen (template default)

```
main.ts
  └─ HabitableZonesScreen            (Screen<HabitableZonesModel, HabitableZonesScreenView>)
       ├─ HabitableZonesModel         owns all state
       └─ HabitableZonesScreenView    owns all visuals
```

### Multi-screen with independent state (simplest)

Each screen is completely self-contained. Use this when screens have no shared
physical state — for instance an "Intro" that is purely explanatory and a "Lab"
with interactive controls.

```
main.ts
  ├─ IntroScreen           (Screen<IntroModel, IntroScreenView>)
  │    ├─ IntroModel
  │    └─ IntroScreenView
  └─ LabScreen             (Screen<LabModel, LabScreenView>)
       ├─ LabModel
       └─ LabScreenView
```

### Multi-screen with shared model (recommended for real sims)

A top-level "root model" owns shared state (e.g. selected material, common
parameters). Each screen model receives a reference to it.

```
main.ts  →  creates FrictionModel (shared)
  ├─ IntroScreen    receives FrictionModel → IntroModel(frictionModel)
  └─ LabScreen      receives FrictionModel → LabModel(frictionModel)
```

---

## Step-by-step: adding a second screen

### 1 — Add strings

`src/i18n/strings_en.json` (and every other locale file):

```json
{
  "title": "Friction",
  "screens": {
    "intro": "Intro",
    "lab": "Lab"
  }
}
```

**Important:** All locale files must define identical keys. TypeScript will error
at compile time if any key is missing (see the `satisfies` checks in
`StringManager.ts`).

### 2 — Expose screen-name properties in StringManager

```typescript
// src/i18n/StringManager.ts
public getScreenNames(): {
  readonly introStringProperty: ReadOnlyProperty<string>;
  readonly labStringProperty:   ReadOnlyProperty<string>;
} {
  return {
    introStringProperty: stringProperties.screens.introStringProperty,
    labStringProperty:   stringProperties.screens.labStringProperty,
  };
}
```

### 3 — Create the second screen folder

Mirror the structure of `src/habitable-zones-screen/`:

```
src/
├─ intro-screen/
│   ├─ IntroScreen.ts
│   ├─ model/
│   │   └─ IntroModel.ts
│   └─ view/
│       ├─ IntroScreenView.ts
│       ├─ IntroScreenSummaryContent.ts
│       └─ IntroKeyboardHelpContent.ts
└─ lab-screen/
    ├─ LabScreen.ts
    ├─ model/
    │   └─ LabModel.ts
    └─ view/
        ├─ LabScreenView.ts
        ├─ LabScreenSummaryContent.ts
        └─ LabKeyboardHelpContent.ts
```

Each screen file follows the same `Screen<Model, View>` pattern as the
existing `HabitableZonesScreen.ts`.

### 4 — (Optional) Create a shared root model

If screens share state, create a top-level model before constructing screens:

```typescript
// src/model/FrictionModel.ts
import { BooleanProperty, NumberProperty } from "scenerystack/axon";

export class FrictionModel {
  public readonly surfaceTypeProperty = new StringProperty("wood");
  public readonly normalForceProperty = new NumberProperty(10, { units: "N" });

  public reset(): void {
    this.surfaceTypeProperty.reset();
    this.normalForceProperty.reset();
  }
}
```

Per-screen models then take it as a constructor argument:

```typescript
// src/intro-screen/model/IntroModel.ts
export class IntroModel implements TModel {
  public constructor(public readonly shared: FrictionModel) {}

  public step(_dt: number): void { /* … */ }
  public reset(): void { this.shared.reset(); }
}
```

### 5 — Register both screens in main.ts

```typescript
// src/main.ts  (inside onReadyToLaunch)

// Shared model — created once, passed to both screens
const frictionModel = new FrictionModel();

const screens = [
  new IntroScreen(frictionModel, {
    name: stringManager.getScreenNames().introStringProperty,
    tandem: Tandem.ROOT.createTandem("introScreen"),
    backgroundColorProperty: HabitableZonesColors.backgroundColorProperty,
  }),
  new LabScreen(frictionModel, {
    name: stringManager.getScreenNames().labStringProperty,
    tandem: Tandem.ROOT.createTandem("labScreen"),
    backgroundColorProperty: HabitableZonesColors.backgroundColorProperty,
  }),
];

const sim = new Sim(stringManager.getTitleStringProperty(), screens, { … });
```

---

## Screen options reference

| Option | Type | Purpose |
|---|---|---|
| `name` | `ReadOnlyProperty<string>` | Localizable tab label |
| `tandem` | `Tandem` | PhET-iO registration root |
| `backgroundColorProperty` | `TReadOnlyProperty<Color>` | Screen background |
| `createKeyboardHelpNode` | `() => Node` | Per-screen keyboard help |
| `homeScreenIcon` | `ScreenIcon` | Icon on the home screen |
| `navigationBarIcon` | `ScreenIcon` | Smaller icon in the nav bar |
| `maxDT` | `number` | Maximum allowed dt in seconds |
| `targetFrameRate` | `number` | Target FPS for `step()` |

---

## Home screen icons

Multi-screen sims show a home screen by default. Each screen needs a 548×373 px
`ScreenIcon` (or the SceneryStack default is used):

```typescript
import { ScreenIcon } from "scenerystack/sim";
import { Rectangle } from "scenerystack/scenery";

const icon = new ScreenIcon(
  new Rectangle(0, 0, 548, 373, { fill: HabitableZonesColors.accentColorProperty }),
  { maxIconWidthProportion: 1, maxIconHeightProportion: 1 }
);
```

Pass it as `homeScreenIcon` and `navigationBarIcon` on the Screen options.

---

## Accessibility across screens

Each screen must have its own `ScreenSummaryContent` and `KeyboardHelpContent`.
The strings live under per-screen keys in the a11y block:

```json
"a11y": {
  "intro": {
    "screenSummary": { … },
    "currentDetails": "…"
  },
  "lab": {
    "screenSummary": { … },
    "currentDetails": "…"
  }
}
```

Expose them via separate methods in `StringManager`:

```typescript
public getIntroA11yStrings() { return stringProperties.a11y.intro; }
public getLabA11yStrings()   { return stringProperties.a11y.lab; }
```

---

## Using this template beyond a direct copy

### GitHub template repository

The repository is configured as a GitHub template. Use the **"Use this
template"** button on GitHub to create a new repository pre-populated with all
template files. Then run:

```sh
npm install
npm run rename -- --id my-sim --name "My Simulation"
npm run check
```

### `npm create` workflow (scaffold new projects)

If your organisation maintains multiple sims, create an npm initializer that
wraps the rename step:

```sh
npm create openlyceum-sim@latest my-sim
# → clones the template, runs npm run rename automatically
```

See `scripts/rename-sim.ts` for the rename logic you can reuse.

### Monorepo / workspace setup

For organisations building a suite of simulations, a pnpm/npm workspace lets
you share tooling while keeping each sim independent:

```
physics-sims/
├─ package.json          # workspace root (workspaces: ["sims/*"])
├─ sims/
│   ├─ friction/         # forked from this template
│   ├─ waves/
│   └─ optics/
└─ shared/               # optional: shared assets, design tokens
```

Each sim is still independently deployable; the workspace just gives you a
single `npm run build --workspaces` command to build all of them.

### Git subtree for template updates

To pull template improvements back into an existing fork:

```sh
# One-time: add the template as a remote
git remote add template https://github.com/OpenLyceum/SceneryStackTemplate.git

# Pull template changes into a branch for review
git fetch template
git merge template/main --allow-unrelated-histories --squash
```

Review the diff carefully — class-name changes in the template may conflict
with your sim-specific renames.
