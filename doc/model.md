# Model - Habitable Zones

This document describes the model (the underlying physics, math, and behavior) for the simulation,
in terms appropriate for an educator. It is the companion to
[implementation-notes.md](./implementation-notes.md), which targets developers.

## Overview

This sim ports the NAAP *Habitable Zones* lab and has two screens that ask where liquid-water
conditions can persist — around a single star, and across the Milky Way.

- **Circumstellar** follows a star through its evolutionary track. As luminosity changes, the
  circumstellar habitable zone (HZ) moves. Students place a planet at a chosen distance, scrub or play
  the stellar timeline, switch between optimistic and conservative HZ limits, overlay solar-system
  reference orbits, and load six real exoplanet systems. Timeline markers show when the planet
  becomes **tidally locked** and when it would be **destroyed** as the star expands; the status
  readout reports both.
- **Galactic** lets students pick a galactocentric radius and read off normalized metallicity,
  catastrophic-event risk, and a combined habitability score. The galactic habitable zone (GHZ) is the
  annular band where metallicity is high enough and risk low enough. Those radial curves are a
  **parametric reconstruction** of the NAAP pedagogy, not a byte-for-byte port of unpublished Flash
  formulae.

Together the screens connect "is this orbit temperate?" with "is this neighborhood of the Galaxy
favorable for rocky planets and long-term stability?"

## Quantities and units

| Quantity | Symbol | Units | Range / notes |
|---|---|---|---|
| Stellar mass (catalog) | M₀ | M☉ | 0.3–30 (17-star evolution catalog) |
| Stellar age | t | Myr since ZAMS (catalog units) | 0 – star's timespan |
| Luminosity / radius / Teff | L, R, T | L☉, R☉, K | sampled from the track |
| Planet distance (zero-age) | d₀ | AU | ~0.01–500 |
| Effective planet distance | d_eff | AU | scales as M₀/M(t) |
| HZ inner / outer | d_in, d_out | AU | √(L/L☉) × coefficients |
| Diagram zoom | — | AU scale | 25 discrete levels |
| Animation rate | — | × | 0.1–2 (full lifetime ≈ 120 s wall-clock at 1×) |
| Galactocentric radius | R | kiloparsecs (kpc) | 1.2–22 (Sun ≈ 8 kpc) |
| Metallicity / risk / habitability | — | normalized 0–1 | Galactic screen |

## Governing equations

### Circumstellar habitable zone

At each age the star's luminosity *L* (in solar units) sets the HZ edges:

```
d_in  = √(L / L☉) · c_in
d_out = √(L / L☉) · c_out
```

Optimistic limits use `c_in = 0.8`, `c_out = 1.5` (AU for a solar twin). Conservative limits use
`0.95` and `1.37`. The planet is classified too hot / temperate / too cold by comparing its
**effective** distance *d_eff* to those edges.

### Orbital distance while the star evolves

As the star loses mass, specific angular momentum conservation in the NAAP model stretches the orbit:

```
d_eff(t) = d₀ · (M₀ / M(t))
```

**Destruction** occurs when *d_eff* falls inside a Roche-like limit from the star's instantaneous
radius and density (with a minimum helper of 1.5 AU).

**Tidal-locking time** uses an Earth-like spin-down formula that depends strongly on distance (∝ d⁶)
and stellar mass, evaluated at the **zero-age distance d₀** — it does **not** update as the orbit
stretches with mass loss. Close-in planets often lock within the first timeline step.

### Stellar tracks

Seventeen tabulated stars (0.3–30 M☉) store mass, log luminosity, log radius, and log temperature
versus age. Values at intermediate ages are linearly interpolated from a compressed track (every 3rd
point + endpoints). Epoch markers follow Hurley–Pols–Tout stellar-type codes for main-sequence end and
final remnant. Zero-age main-sequence Sun in the catalog is dimmer/cooler than present-day Sun.

### Timeline displays

The circumstellar timeline shows:

- An **equilibrium-temperature curve** (0–100 °C clamp) at the effective distance *d_eff*.
- A **habitability color strip** comparing *d_eff* with the HZ edges.
- Tidal-lock and destruction markers, epoch labels, and a scrubbable age cursor; play/pause/step
  advance age, and pressing play at the end of the track replays from age 0.

### Real exoplanet presets

Six systems: Gliese 581, 55 Cancri A, 51 Pegasi, HD 40307, HD 189733, HD 93083. Selecting a preset
locks star mass to the nearest catalog entry, places the primary draggable planet at the **first**
planet's **pericenter** *a(1−e)*, and draws every preset planet's elliptical orbit (star at a focus,
pericenter toward the draggable planet) with a marker at its pericenter.

### Galactic habitability (reconstructed)

Relative to the Sun's radius (~8 kpc), metallicity follows a radial [Fe/H] gradient
(~−0.07 dex/kpc), then is normalized across the plotted range. Catastrophic risk falls off
exponentially with radius (e-folding scale 3.5 kpc from inner edge). Combined habitability is:

```
H(R) = Z(R) · (1 − Risk(R))
```

The GHZ is the contiguous annulus where normalized metallicity ≥ **0.215** and risk ≤ **0.19** — about
**7.0–10.0 kpc** in this reconstruction, close to the commonly cited 7–9 kpc (Lineweaver et al. 2004).
The default Sun location at **8 kpc** is **inside** it (Z ≈ 0.31, risk ≈ 0.14, H ≈ 0.27). The combined
score *H* peaks further in (~4.7 kpc) because the GHZ edges are separate pass/fail criteria, not a
cut on *H*. Habitability is shown as a numeric readout; plots show metallicity and risk only.

## Initial conditions (Circumstellar reset)

Sun (1 M☉), age 0, planet at 1 AU, optimistic HZ, reference orbits on, grid off.

## Simplifications and assumptions

- Circumstellar HZ uses **insolation-only** scaling with luminosity; no climate, atmosphere, or
  greenhouse modeling beyond the optimistic/conservative coefficient pairs.
- Planet is a test particle: no feedback on the star; tidal lock and destruction are diagnostic
  markers, not full dynamical integrations.
- Reference solar-system orbits are **circular** fixed semi-major axes (Mercury through Neptune; eight
  orbits).
- Tidal-lock timeline marker is not drawn if it would sit within 4 px of the start of the 900 px
  timeline (as in Flash); the planet still reports as tidally locked once that time has passed.
- Galactic curves are **pedagogical reconstructions**, not the original Flash plot data or a full
  chemical-evolution model.

## References

- NAAP *Habitable Zones* lab: circumstellar and galactic simulators / student guide under
  `../Baseline/Astronomy/astroUNL/naap/`.
- Circumstellar evolution catalog transcribed from the NAAP circumstellar habitable-zone simulator
  (`shzStars` data; Hurley, Pols & Tout 2000 stellar-type codes).
- Galactic metallicity gradient scale consistent with published Milky Way [Fe/H] gradients (e.g. Lin
  et al. 2017); risk/habitability thresholds chosen for classroom GHZ geometry.
