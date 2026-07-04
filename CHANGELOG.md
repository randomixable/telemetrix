# Changelog

## Unreleased

### Added

- Added Web Worker processing v1 for GPX imports using Comlink, moving parse/clean/reconstruct/quality work off the main UI thread with a local fallback.
- Added step-based import progress updates for GPX parsing, speed derivation, cleaning, reconstruction, validation, event detection, quality audit, and local saving.
- Added bottom dock chart modes for acceleration G and lateral G.
- Added physics-aware validation v1 for measured and reconstructed telemetry points using motorcycle constraints for acceleration, braking, lateral G, plausible top speed, low confidence, and distance-derived speed mismatch.
- Added `physicsAudit` per point plus physics validation counts in the Quality Audit data model.
- Added a Reconstruction Audit sidebar panel with raw/reconstructed point counts, sample rate, method, average confidence, low-confidence sample count, and estimated sample ratio.
- Added a dedicated legacy ride metrics module for moving time, elevation range/gain, top speed, and max G-force summary semantics.
- Added per-point speed cleaning audit reasons for legacy MAD filtering, acceleration jump handling, stop thresholding, moving average smoothing, and motorcycle constraints.
- Added speed cleaning audit reason counts to the Quality Audit sidebar.
- Split speed audit counts into Final Anomalies and Processing Adjustments so smoothing operations are no longer presented as anomaly counts.
- Flagged raw speeds above the active motorcycle's plausible top speed as final anomalies even when legacy smoothing already reduced the cleaned speed.
- Added Time Coverage / GPS Gap Audit metrics for expected 1 Hz points, actual raw points, missing seconds, gap count, longest gap, P95 interval, and max interval.
- Added gap-aware reconstruction confidence so samples spanning larger GPS time gaps are downgraded.
- Replaced the reconstruction estimated-ratio display with raw anchors, reconstructed samples, synthetic samples, and synthetic ratio.
- Added distance v2 reconstruction with monotone cumulative distance interpolation and made it the default reconstruction method.
- Added a Top Speed Audit sidebar panel showing active display mode, raw/cleaned source speed, source gap, source index, confidence, origin, acceleration context, lateral G, nearby anomaly status, and speed audit reasons.
- Added a Point Inspector sidebar panel for selecting anomaly/audit points and inspecting raw/cleaned source speed, confidence, source gap, acceleration, lateral G, heading, source index, and audit reasons.
- Added map-to-inspector sync: clicking map event/anomaly markers selects the point inspector entry and highlights the selected point on the map.
- Added bottom dock chart lane with toggles for metrics, speed, elevation, and confidence traces over distance, including anomaly markers.
- Added chart-to-inspector sync: hovering or clicking the chart selects the nearest telemetry point and updates the map highlight and point inspector.
- Added tests around legacy-compatible ride metrics before deeper pipeline refactors.
- Added linear v1 telemetry reconstruction scaffold with default 5 Hz resampling, estimated point metadata, confidence, heading, curvature, and lateral G fields.
- Added Raw GPX, Cleaned, and Reconstructed 5 Hz display mode selector for map rendering.
- Added configurable distance sector analysis with 5, 10, 15, 20, and 25 km options.
- Added sidebar sector list with average speed, top speed, elevation gain/loss, stop count, anomaly count, and confidence per sector.
- Added local persistence for the selected sector distance.
- Added legacy-style ride summary values to the sidebar, including total time, moving time, average speed, total elevation, start/finish time, and signed G-force display.
- Added browser-rendered map POI markers for top speed, traffic stops, and pauses using checkered flag, traffic light, and stopwatch symbols.
- Added start/finish time and legacy-style total elevation range to track summaries.
- Ported legacy pause and traffic-stop detection into the React telemetry pipeline.
- Added legacy-compatible max acceleration and max braking G-force summary metrics.
- Added pause, traffic stop, max G-force, and braking values to the quality audit surface.
- Added map event markers for detected pause and traffic-stop events.
- Added tests for stop detection and max G-force calculation.
- Added TypeScript port of the legacy speed outlier and smoothing pipeline (`detectOutliers`, MAD filtering, stop thresholding, and moving average smoothing).
- Added tests for legacy-compatible speed cleaning.
- Added cleaned speed pipeline v1 using the default CB150R physical constraints.
- Added per-point `rawSpeedKmh`, `cleanedSpeedKmh`, anomaly flags, and anomaly reasons.
- Added raw max speed vs cleaned max speed to the quality audit panel.
- Added Honda CB150R StreetFire 2017 as the default motorcycle profile with physical constraint parameters.
- Added motorcycle constraint values to the processing panel.
- Added speed-colored route rendering with per-segment MapLibre line features.
- Added speed legend overlay on the map.
- Added quality audit sidebar panel for sampling, median interval, duplicate points, GPS jumps, GPS noise, and confidence levels.
- Added MapLibre event markers for start, finish, top speed, and possible GPS jump points.
- Added local track delete and clear-library controls.
- Added active track persistence with `localStorage`.
- Added GPX import error handling and file input reset after import.
- Added initial quality audit fields for median sample interval, duplicate points, possible GPS jumps, max speed, GPS noise, and confidence notes.
- Migrated project foundation from vanilla HTML/CSS/JS to Vite, React, and TypeScript.
- Preserved the original prototype under `legacy/`.
- Added MapLibre GL JS as the new map rendering layer.
- Added Dexie and IndexedDB storage for local-first track persistence.
- Added Zustand app state for active track and motorcycle profile selection.
- Added GPX-only import flow.
- Added GPX parser for `trkpt` coordinates, elevation, and timestamps.
- Added baseline distance, speed, top speed, moving time, duration, sampling rate, and elevation gain derivation.
- Added local track library in the sidebar.
- Added active track rendering on the map with automatic bounds fitting.
- Added telemetry and motorcycle domain types.
- Added a GPX parser unit test with Vitest.
- Added Oxlint configuration that ignores `legacy/`.

### Changed

- GPX processing now validates both measured and reconstructed points after speed cleaning/reconstruction without automatically mutating validated speeds.
- Refactored GPX processing into a clearer telemetry pipeline with dedicated parser, kinematics, quality, summary, and orchestration modules.
- Refactored track summary generation to consume the legacy ride metrics module instead of duplicating calculations inline.
- Split measured telemetry preparation into a named pipeline stage before reconstruction and event analysis.
- GPX processing now runs raw speed through legacy-compatible smoothing before applying CB150R physical constraints.
- Inverted speed color scale so slower segments are red and faster segments are blue, and labeled the legend as `Speed (km/h)`.
- Reworked the UI into a fixed full-viewport map cockpit with floating panels and an internally scrollable left sidebar.
- Top speed summary, top speed marker, and speed-colored route now use cleaned speed instead of raw GPX speed.
- Renamed the import UI to GPX-only.
- Replaced the Vite starter page with the initial Telemetrix dashboard shell.
- Limited accepted upload files to GPX for the first reconstruction pipeline.
- Rewrote `README.md` to document the current app state, stack, development commands, deployment path, and roadmap.

### Known Issues

- Build emits a large chunk warning because MapLibre is bundled eagerly. Code splitting is planned later.
- Import processing uses a Web Worker with step-based progress, but cancellation is not implemented yet.
- Local tracks depend on browser IndexedDB storage and are removed if site data is cleared.
- The import button label still needs final UI copy cleanup.
