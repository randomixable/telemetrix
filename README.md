# Telemetrix v0.3.0
### High-Precision Kinematic Analysis Framework for Riding Telemetry

**Telemetrix** is a specialized R&D utility designed to bridge the gap between consumer-grade mobile GPS sensors and dedicated professional telemetry hardware (e.g., Magneti Marelli, AiM).

Developed as a technical "Black Box" for motorcycle dynamics, this framework transforms high-variance phone data into actionable kinematic insights—allowing riders to analyze top speed, braking forces, and cornering profiles without expensive dedicated data loggers.

---

## 🎯 The Mission
Most mobile GPS apps suffer from "signal noise," leading to fake top speeds or jagged acceleration data. Telemetrix uses a custom-built processing pipeline to:
1.  **Sanitize Sensor Noise:** Filter out GPS "teleportation" spikes.
2.  **Synthesize Virtual Sensors:** Calculate G-Forces and Lean Angles purely from velocity vectors ($V_{max}$ localization).
3.  **Validate Performance:** Pinpoint the exact coordinates of peak performance on technical terrain.

---

## 🚀 Engineering Architecture

Telemetrix operates as a dual-stage data pipeline:

### Stage 1: Offline ETL & Normalization (Python)
Located in `/scripts`, these utilities handle raw data pre-processing to ensure "hardware-level" data integrity:
* **Coordinate Precision:** `update_gpx_files.py` enforces 6-decimal precision to eliminate floating-point anomalies during high-speed calculations.
* **Temporal Fusion:** `Reformat_Geojson.py` utilizes $O(1)$ hash-map lookups to synchronize disparate datasets (e.g., Tracker hardware + Phone App logs) via high-resolution timestamps.
* **Schema Transformation:** Converts complex XML/GPX structures into point-based GeoJSON for granular, meter-by-meter analysis.

### Stage 2: Kinematic Engine & Virtual IMU (JavaScript)
The core browser-based engine derives physical metrics from spatial deltas:
* **Velocity Integrity:** Implements a dynamic acceleration-clamping algorithm to distinguish genuine $V_{max}$ from signal jitter.
* **Heuristic State Machine:** Differentiates between environmental stops (traffic lights) and mechanical pauses using temporal-spatial windows.
* **Inertial Synthesis:** Calculates Longitudinal G-Force and path curvature by analyzing velocity vectors across sequential GPS fixes.
* **Signal De-noising:** Applies a 15-meter spatial drift tolerance to maintain distance accuracy during stationary periods.

---

## 📍 R&D Case Study: The Merbabu Terrain
The algorithms were stress-tested using field telemetry from the **Kopeng** and **Selo** mountain routes in Central Java. These routes provide a high-complexity environment for:
* **Geometric Validation:** Testing turn-radius estimation on technical hairpin turns.
* **Elevation Integration:** Analyzing speed-over-ground metrics across extreme vertical gradients.
* **Signal Robustness:** Developing filters for GPS attenuation in high-altitude, mountainous terrain.

---

## 📂 Project Structure

```text
├── scripts/             # Python Data Engineering & Sanitization tools
├── js/                  # Kinematic Engine (Speed, G-Force, & State logic)
├── data/samples/        # Normalized datasets from Merbabu R&D runs
├── docs/                # Mathematical derivations and documentation
├── index.html           # Main Visualization Dashboard
└── LICENSE              # Apache License 2.0
