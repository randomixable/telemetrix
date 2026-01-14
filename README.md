# Telemetrix v0.3.0

### High-Precision Kinematic Analysis Framework for Riding Telemetry

Telemetrix is a specialized R&D utility designed to transform high-variance GPS telemetry into actionable kinematic insights. Developed as a technical "Black Box" for vehicle dynamics, the framework addresses the critical challenges of signal noise, inconsistent sampling rates, and sensor drift in high-altitude environments.

---

## 🚀 Engineering Architecture

Telemetrix operates as a dual-stage data pipeline:

### Stage 1: Offline ETL & Normalization (Python)

Located in `/scripts`, these utilities handle raw data pre-processing:

- **Data Integrity:** `update_gpx_files.py` enforces 6-decimal coordinate precision to eliminate floating-point anomalies during calculation.
- **Efficient Merging:** `Reformat_Geojson.py` utilizes $O(1)$ hash-map lookups to synchronize disparate JSON/GPX datasets via high-resolution timestamps.
- **Schema Transformation:** Converts complex XML/GPX structures into point-based GeoJSON for granular analysis.

### Stage 2: Kinematic Engine & State Machine (JavaScript)

Located in `/js`, the core engine derives physical metrics in real-time:

- **Heuristic State Detection:** Implements temporal-spatial windows to differentiate between rest stops (`PAUSE_THRESHOLD`) and navigational traffic stops.
- **Kinematic Derivation:** Calculates **G-Force (Longitudinal/Lateral)** and **Lean Angle** by analyzing velocity vectors and Menger Curvature across sequential GPS fixes.
- **Signal De-noising:** Applied a 15-meter spatial drift tolerance to maintain distance accuracy during stationary periods.

---

## 📍 R&D Case Study: The Merbabu Terrain

The algorithms were stress-tested using field telemetry from the **Kopeng** and **Selo** mountain routes (Central Java). These routes provide a high-complexity environment for:

- **Geometric Validation:** Testing turn-radius estimation on technical hairpin turns.
- **Signal Robustness:** Developing filters for GPS attenuation in high-altitude terrain.
- **Kinematic Stress-Testing:** Validating G-Force calculations on extreme elevation gradients.

---

## 📂 Project Structure

```text
├── scripts/             # Python-based Data Engineering & ETL tools
├── js/                  # Core Kinematic Engine & Heuristic logic
├── docs/                # Formal mathematical & optimization documentation
├── data/samples/        # Normalized datasets for demonstration
├── LICENSE              # Apache License 2.0
└── index.html           # Main Visualization Dashboard
```
