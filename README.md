# Telemetrix

Telemetrix is a local-first telemetry reconstruction and analysis app for consumer-grade GPX tracks. The goal is to turn sparse phone GPS data into a cleaned, reconstructed, and confidence-aware riding telemetry workspace.

The current React version is a migration from the original vanilla HTML/CSS/JS prototype. The legacy prototype is preserved in `legacy/` for reference while the new app is rebuilt around a typed telemetry pipeline.

## Current State

The app currently supports:

- GPX-only import from the browser.
- Local persistence with IndexedDB through Dexie.
- Local track library that survives browser refreshes.
- GPX parsing into typed track points.
- Baseline derived metrics: distance, speed, cleaned top speed, sampling rate, duration, moving time, elevation range/gain, and max acceleration/braking G-force.
- Legacy-compatible speed cleaning with MAD outlier detection, acceleration jump handling, stop thresholding, and moving-average smoothing.
- Default Honda CB150R StreetFire 2017 profile used for physical speed, acceleration, braking, and plausible top-speed constraints.
- Per-point raw speed, cleaned speed, anomaly flags, anomaly reasons, and speed cleaning audit reasons.
- Quality Audit with sampling interval, time coverage, expected 1 Hz samples, missing seconds, gap count, longest gap, P95 interval, duplicate points, GPS jumps, raw max speed, cleaned max speed, and confidence labels.
- Confidence Model v1 that separates route shape, speed, acceleration, and reconstruction reliability.
- Separate Final Anomalies and Processing Adjustments so smoothing operations are not treated as final anomaly counts.
- Distance v2 reconstruction at 5 Hz with monotone cumulative distance interpolation, estimated samples, confidence values, heading, windowed curvature, and estimated lateral G fields.
- Physics-aware validation v1 for measured and reconstructed points, using the default motorcycle profile to flag implausible acceleration, braking, lateral G, plausible top speed, low confidence, and distance-derived speed mismatch.
- Raw GPX, Cleaned, and Reconstructed 5 Hz display modes.
- Bottom dock chart modes for speed, elevation, acceleration G, lateral G, and confidence over distance.
- Distance sector analysis with 5, 10, 15, 20, and 25 km options.
- Sector hover/focus highlighting on the map.
- Pause and traffic-stop detection with map markers.
- MapLibre rendering for the active GPX track with a speed-colored route, persistent route backbone, POI markers, anomaly markers, and speed legend.
- Auto-fit map bounds for imported tracks.
- Fixed full-viewport map cockpit UI where the page does not scroll and the left sidebar scrolls internally.
- Unit tests for parsing, speed cleaning, motorcycle constraints, quality audit, stop detection, sectors, reconstruction, ride metrics, and G-force calculations.

Primary sample for development:

```txt
legacy/data/samples/Tracker-Kopeng-20250310.gpx
```

## Product Direction

Telemetrix is not just a GPX editor. The intended direction is:

> A local-first telemetry reconstruction and analysis app for consumer-grade GPX, focused on cleaning, resampling, physical constraints, confidence scoring, and riding insight.

Important distinction:

- GPX data is measured by the phone GPS sensor.
- Distance and speed are derived from GPS samples.
- Cleaned speed, acceleration, reconstructed 5 Hz streams, braking zones, cornering estimates, and lean estimates are estimated or experimental.
- Advanced metrics should expose confidence rather than pretending to be hardware-grade telemetry.

## Current Pipeline

```txt
GPX text
  -> parse GPX trackpoints
  -> derive distance and raw speed
  -> legacy-compatible speed cleaning
  -> motorcycle physical constraints
  -> physics-aware validation of measured telemetry
  -> distance v2 5 Hz reconstruction
  -> physics-aware validation of reconstructed telemetry
  -> stop/pause detection
  -> quality, anomaly, and time coverage audit
  -> summary and sector analysis
```

Important implementation notes:

- `samplingHz` is based on median interval, not full data coverage.
- `timeCoveragePercent` compares actual raw points with expected 1 Hz points across the track duration.
- `Final Anomalies` are currently motorcycle/physics-level flags.
- `physics-*` audit reasons are validation flags, not automatic speed mutations.
- Synthetic reconstructed samples use source-anchor interval acceleration for charting instead of per-0.2s sample deltas, while acceleration and distance-speed mismatch hard flags are only applied to non-synthetic points to avoid repeated false positives.
- Lateral G is estimated from smoothed/windowed route curvature and should be treated as a validation signal, not IMU-grade telemetry.
- Confidence labels describe data reliability, not rider performance.
- `Processing Adjustments` are cleaner operations such as smoothing, MAD filtering, and stop thresholding.
- Existing tracks in IndexedDB may be stale after schema/pipeline changes; clear and re-import GPX files when checking new fields.

## Tech Stack

- Vite
- React
- TypeScript
- MapLibre GL JS
- Dexie / IndexedDB
- Zustand
- ECharts, planned for charts
- Comlink for Web Worker telemetry processing
- Vitest
- Oxlint

## Development

Install dependencies:

```bash
npm install
```

Run the dev server:

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

## Deploy

The app is currently a static Vite SPA and can be deployed to Netlify, Vercel, Cloudflare Pages, or GitHub Pages.

For Netlify Drop:

```bash
npm run build
```

Then upload:

```txt
dist/
```

For connected Netlify deploys:

```txt
Build command: npm run build
Publish directory: dist
```

Existing Netlify URL:

```txt
https://randomixable-telemetrix.netlify.app/
```

## Repository Layout

```txt
src/
  app/                 React app shell
  map/                 MapLibre map surface and future layers
  telemetry/           Parsing, physics, cleaning, resampling, confidence
  storage/             IndexedDB database and repositories
  motorcycles/         Motorcycle profile domain model
  state/               Client UI/app state
  types/               Shared telemetry types

legacy/                Original vanilla prototype, scripts, docs, and samples
```

## Development Roadmap

### Phase 1: GPX Foundation

Status: mostly done.

- Keep import GPX-only.
- Rename import UI to `Import GPX`.
- Add delete track.
- Add clear local library.
- Restore active track after refresh.
- Improve invalid GPX error states.

### Phase 2: Telemetry Core

Status: in progress; core cleaning and audit foundation are active.

- Separate raw points, cleaned points, and reconstructed points.
- Add quality audit for sampling interval, time coverage, missing seconds, duplicate points, GPS jumps, and stationary drift.
- Improve moving/stopped classification.
- Add pause and stop detection.
- Add top speed marker.
- Add richer summary metrics.
- Separate final anomalies from processing adjustments.
- Add top speed audit and point inspector.

### Phase 3: Cleaning and Reconstruction

Status: distance v2 is now the default; physics-aware validation v1 is active, while physics-aware smoothing is still next.

- Add speed spike filtering.
- Add stationary drift filtering.
- Add smoothing profiles.
- Add estimated 5 Hz resampling.
- Compare raw vs cleaned vs reconstructed streams.
- Add confidence scoring per metric.
- Use time gap audit to lower reconstruction confidence around sparse data.
- Refine reconstruction v2 with better confidence rules and validation against physical constraints.
- Promote validation findings into a clearer confidence model before destructive smoothing/clamping.
- Later evaluate constrained cubic/PCHIP and Kalman/RTS smoothing.

### Phase 4: Visualization

Status: map layers, sectors, chart lane, and inspector sync are active.

- Color route by speed.
- Add event markers for top speed, hard braking, stops, pauses, and GPS anomalies.
- Add bottom chart for speed, elevation, acceleration G, lateral G, and confidence over distance.
- Sync chart hover/cursor with map position.
- Add point/segment inspector.

### Phase 5: Motorcycle Database

Status: default profile exists; editable database is pending.

- Add motorcycle CRUD.
- Store weight, rider weight, category, power, max acceleration, max braking, and max lean estimates.
- Use motorcycle profile as physical constraints for anomaly detection and reconstruction.

### Phase 6: Worker Architecture

Status: worker v1 active for GPX import processing with step-based status updates; cancellation is pending.

- Move GPX parsing to a Web Worker.
- Move cleaning, resampling, and quality audit to a Web Worker.
- Add progress status during import and reconstruction.
- Use Comlink for worker communication.

### Phase 7: Lab Mode

Status: not started.

- Add smoothing and reconstruction parameter controls.
- Add algorithm versioning.
- Add confidence breakdown.
- Export reconstructed telemetry as CSV/JSON.
- Compare outputs from different algorithms.

## Notes

- Large bundle warnings are expected at this stage because MapLibre and future charting libraries are large. Code splitting should be added once map/chart features stabilize.
- Data is currently local-only. If the user clears browser site data, locally stored tracks will be removed.
- Remote database, auth, and account sync are intentionally out of scope for the first local-first version.
