# Telemetrix

**Version:** `0.2.0-alpha.0`

Telemetrix is a local-first telemetry reconstruction and analysis app for consumer-grade GPX tracks. It turns phone-recorded GPX data into a cleaned, reconstructed, and auditable motorcycle telemetry workspace.

The short version:

> From phone GPX into confidence-aware motorcycle telemetry.

Telemetrix does not try to pretend that phone GPX is the same as data from racing GPS, IMU, or datalogger hardware. Instead, it keeps the workflow transparent: raw data, cleaned data, reconstructed data, physics checks, confidence scoring, and visible audit trails.

## Version Meaning

Telemetrix currently uses pre-1.0 versioning because the core product is still being shaped.

```txt
0.1.x          Vanilla HTML/CSS/JS legacy prototype
0.2.0-alpha.0 React + TypeScript telemetry cockpit migration
1.0.0          Future stable local-first GPX telemetry analyzer
```

This repository is currently on the `0.2.0-alpha.0` line.

Why alpha:

- The React app already has import, map, local storage, reconstruction, audits, sectors, charts, and worker processing.
- The telemetry model is still being validated against the legacy prototype.
- Advanced metrics such as reconstructed acceleration, braking, lateral G, and confidence scoring are still estimation-first and should remain auditable.

## Current Product Direction

Telemetrix is being built as:

> A local-first telemetry reconstruction and analysis app for consumer-grade GPX, focused on cleaning, resampling, physical constraints, confidence scoring, and riding insight.

Core principles:

- Local-first: GPX files and processed tracks stay in the browser through IndexedDB.
- GPX-only first: the app starts from common phone GPX exports.
- Auditable: raw, cleaned, and reconstructed values should be inspectable.
- Physics-aware: motorcycle constraints should guide validation, not silently fabricate certainty.
- Confidence-aware: estimated telemetry should clearly show how trustworthy it is.

## Legacy vs React

The original Telemetrix prototype was a vanilla HTML/CSS/JS app. It proved the first idea: load GPX, process speed/elevation/time data, and show ride metrics.

The React version is the active direction. It keeps the useful legacy logic, but rebuilds the app around typed data, a clearer telemetry pipeline, local persistence, map interaction, reconstruction, and worker processing.

```txt
Legacy prototype
  - Vanilla HTML/CSS/JS
  - Useful reference for ride metrics and post-processing behavior
  - Best kept as the historical baseline

React app
  - Vite + React + TypeScript
  - Local-first storage
  - MapLibre cockpit UI
  - Raw / cleaned / reconstructed display modes
  - Motorcycle constraints and confidence audits
  - Web Worker processing
```

For repository management, the intended branch layout is:

```txt
main    React app, used for active development and deployment
legacy  Preserved vanilla prototype branch
```

## What Works Now

- GPX-only import.
- Browser-local persistence with IndexedDB.
- Local track library that survives browser refreshes.
- MapLibre track rendering with speed-colored route segments.
- Slow speed is red, higher speed is blue.
- Start, finish, top speed, pause, traffic stop, and anomaly markers.
- Raw GPX, cleaned, and reconstructed display modes.
- Legacy-compatible speed cleaning with MAD filtering, acceleration jump handling, stop thresholding, and moving average smoothing.
- Default Honda CB150R StreetFire 2017 motorcycle constraints.
- Distance v2 reconstruction at 5 Hz using monotone cumulative distance interpolation.
- Physics validation for plausible speed, acceleration, braking, lateral G, low confidence, and distance-speed mismatch.
- Top speed audit and point inspector.
- Ride summary with total time, moving time, average speed, top speed, distance, elevation, start/finish time, and max acceleration/braking G.
- Distance sectors with 5, 10, 15, 20, and 25 km options.
- Bottom dock charts for metrics, speed, elevation, acceleration/braking G, lateral G, and confidence.
- Worker-based GPX processing with progress updates.
- Unit tests for parser, cleaning, reconstruction, sectors, stops, quality, physics, and ride metrics.

## Current Pipeline

```txt
GPX text
  -> parse GPX trackpoints
  -> derive distance and raw speed
  -> legacy-compatible speed cleaning
  -> apply motorcycle physical constraints
  -> validate measured telemetry
  -> reconstruct 5 Hz telemetry with distance v2
  -> validate reconstructed telemetry
  -> detect stops and pauses
  -> build quality, anomaly, and time coverage audit
  -> build summary and sector analysis
```

Important interpretation notes:

- GPX position and timestamp are measured by the recording device.
- Speed, acceleration, braking, lateral G, and reconstructed samples are derived or estimated.
- Lateral G is based on route curvature, not an IMU.
- Confidence labels describe data reliability, not rider skill.
- `physics-*` reasons are validation flags, not always automatic speed mutations.
- Existing browser-stored tracks can become stale after pipeline changes; clear the local library and re-import GPX when validating new telemetry fields.

## Default Motorcycle Profile

The default profile is the owner's motorcycle:

```txt
Honda CB150R StreetFire 2017
Category: 150cc naked sport / street bike
Wet weight: 136 kg
Rider weight: 75 kg
Estimated top speed: 125 km/h
Max plausible speed: 135 km/h
GPS spike threshold: 180 km/h
Max acceleration: 0.55g
Max braking: 1.00g
Max corner lateral G: 0.75g
```

This profile is used as a practical constraint model for anomaly detection and reconstruction confidence.

## Tech Stack

- Vite
- React
- TypeScript
- MapLibre GL JS
- Dexie / IndexedDB
- Zustand
- Comlink + Web Worker
- lucide-react
- Vitest
- Oxlint

ECharts is installed for future chart work, but the current bottom dock chart is still an inline SVG implementation.

## Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Test:

```bash
npx vitest run
```

## Deployment

Telemetrix is currently a static Vite SPA, so Netlify is a good fit.

Recommended Netlify settings:

```txt
Branch: main
Build command: npm run build
Publish directory: dist
```

For Netlify Drop:

```bash
npm run build
```

Then upload:

```txt
dist/
```

Existing deployment:

```txt
https://randomixable-telemetrix.netlify.app/
```

## Repository Layout

```txt
src/
  app/                 React app shell and cockpit UI
  map/                 MapLibre track rendering and map interaction
  telemetry/           Parsing, cleaning, reconstruction, physics, quality, analysis
  storage/             IndexedDB database and track repository
  motorcycles/         Motorcycle profile model and defaults
  state/               Client app state
  types/               Shared telemetry types

public/                Static browser assets
data/                  Local development GPX samples, not intended for production push
legacy/                Local preserved prototype copy, if present
```

## Roadmap

### 0.2 Alpha: React Telemetry Cockpit

Status: active.

- Finish legacy metric parity checks.
- Clarify raw vs cleaned vs reconstructed semantics in every UI surface.
- Reduce inspector noise from repeated low-value anomaly points.
- Add raw-clean conflict audit for cases where raw source speed and cleaned speed strongly disagree.
- Add worker cancellation during import.
- Improve chart interaction and map hover selection.
- Keep README and changelog aligned with the actual pipeline.

### 0.3 Alpha: Reconstruction and Confidence

Status: planned.

- Refine distance v2 confidence scoring.
- Add smoothing profiles.
- Evaluate constrained cubic / PCHIP reconstruction for smoother visual telemetry.
- Keep Kalman / RTS smoothing experimental until the current pipeline is better audited.
- Improve top speed validity scoring.

### 0.4 Alpha: Motorcycle Database

Status: planned.

- Add editable motorcycle profiles.
- Store bike/rider parameters locally.
- Use profile constraints in anomaly detection and reconstruction confidence.
- Support comparing telemetry behavior across motorcycles.

### 0.5 Alpha: Analysis and Insight

Status: planned.

- Add braking zone detection.
- Add corner entry/apex/exit heuristics where data quality allows it.
- Add sector comparison.
- Add export for cleaned and reconstructed telemetry.

### 1.0: Stable Local GPX Telemetry Analyzer

Status: future.

- Stable import, analysis, visualization, and export workflow.
- Clear confidence model for every derived metric.
- Strong parity with legacy outputs where legacy semantics still make sense.
- Reliable deployment from `main`.

## Known Limits

- Phone GPX is usually around 1 Hz and can contain gaps, jumps, pauses, and smoothing from the recording app.
- Reconstructed 5 Hz telemetry is estimated, not measured.
- Lateral G and acceleration are useful as validation and insight signals, but not as IMU-grade values.
- MapLibre currently contributes a large build chunk; code splitting is planned later.
- Local tracks are stored in browser IndexedDB and will be removed if site data is cleared.
