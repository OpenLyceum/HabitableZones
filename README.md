# Habitable Zones

[![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)

SceneryStack port of the NAAP *Habitable Zones* lab — circumstellar and galactic habitability
screens. Built with [SceneryStack](https://scenerystack.org/), Vite 8, TypeScript, and Biome 2.

## Features

- Two screens: **Circumstellar** (stellar evolution + HZ) and **Galactic** (Milky Way habitability)
- English, Spanish, and French localization via `StringManager`
- Default and projector color profiles
- Progressive Web App (installable, offline-capable)
- Unit tests for star evolution and galactic habitability helpers
- Git hooks for Biome pre-commit checks
- Shared GitHub Actions CI via `OpenLyceum/Baton`

### NAAP reference sources

Upstream Flash / AIR / React NAAP sources live in the sibling
[`Baseline`](https://github.com/OpenLyceum/Baseline) repo under `Astronomy/`
(see `baselines.json`). Clone Baseline with the fleet bootstrap, then:

```bash
(cd ../Baseline && ./scripts/fetch-baselines.sh)
```

`npm run decompile` reads `.swf` files from
`../Baseline/Astronomy/flash-animations` and writes ActionScript into the
sim-local gitignored `NAAP/decompiled/` (requires Java; one-time
`npm run decompile -- --setup`).

## Quick Start

```bash
npm install
npm run icons    # generate PNG icons from public/icons/icon.svg
npm start        # dev server → http://localhost:5173
```

## Scripts

| Command | Description |
|---|---|
| `npm start` / `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run check` | TypeScript type check |
| `npm run lint` | Biome lint check |
| `npm run format` | Auto-format all files |
| `npm run fix` | Lint + auto-fix |
| `npm test` | Run Vitest unit tests |
| `npm run icons` | Regenerate PNG icons from `public/icons/icon.svg` |
| `npm run decompile` | Extract ActionScript from NAAP Flash `.swf` sources |
| `npm run clean` | Remove `dist/` |

Quality gate before release: `npm run check && npm run lint && npm run test && npm run build`.

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| [SceneryStack](https://scenerystack.org/) | ^3.0.0 | Simulation framework |
| [Vite](https://vitejs.dev/) | ^8 | Build tool + dev server |
| [TypeScript](https://www.typescriptlang.org/) | ^7 | Type-safe JavaScript |
| [Biome](https://biomejs.dev/) | ^2.5 | Linting + formatting |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | ^1 | PWA + service worker |

## License

GNU Affero General Public License v3.0 — see [OpenLyceum org license](https://github.com/OpenLyceum/.github/blob/main/LICENSE).

## Contributing

See [OpenLyceum contributing guidelines](https://github.com/OpenLyceum/.github/blob/main/CONTRIBUTING.md).
Report bugs via GitHub Issues; use org issue templates.
