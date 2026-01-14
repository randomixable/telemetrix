**1. Acceleration Calculation**
Steps:
Get two speed values speed1 and speed2.
Compute the time difference (time2 - time1) in seconds.
Calculate the acceleration (change in speed / time difference).

Implementation:

```js
function calculateAcceleration(speed1, time1, speed2, time2) {
  const timeDiff = (time2 - time1) / 1000; // Convert ms to seconds
  return timeDiff > 0 ? (speed2 - speed1) / timeDiff : 0; // m/s²
}
```

**2. Lean Angle Calculation**
Estimate Turn Radius using GPS points (advanced: use curvature formula).
Convert speed from km/h to m/s:
Compute the lean angle using arc tangent function.

Implementation:

```js
function calculateLeanAngle(speed, turnRadius) {
  const g = 9.81; // Gravity
  const v = speed * (1000 / 3600); // Convert km/h to m/s
  return turnRadius > 0
    ? Math.atan((v * v) / (turnRadius * g)) * (180 / Math.PI)
    : 0; // Convert rad to degrees
}
```

**3. Lateral G-Force Calculation**

```js
function calculateLateralG(speed, turnRadius) {
  const g = 9.81; // Gravity
  const v = speed * (1000 / 3600); // Convert km/h to m/s
  return turnRadius > 0 ? (v * v) / (turnRadius * g) : 0;
}
```

**4. Longitudinal G-Force Calculation**

```js
function calculateLongitudinalG(speed1, time1, speed2, time2) {
  const g = 9.81;
  const v1 = speed1 * (1000 / 3600); // Convert km/h to m/s
  const v2 = speed2 * (1000 / 3600);
  const timeDiff = (time2 - time1) / 1000;
  return timeDiff > 0 ? (v2 - v1) / (g * timeDiff) : 0;
}
```

**5. Elevation Over Time**
To track elevation changes:
Extract elevation (ele) from GPX/GeoJSON.
Compare over time intervals to detect climbs & descents.
Convert changes into gradient %.

Implementation:

```js
function calculateElevationChange(ele1, ele2, distance) {
  return distance > 0 ? ((ele2 - ele1) / distance) * 100 : 0; // Gradient in %
}
```

**6. Sector Analysis (20km Splits)**
Track cumulative distance from the start.
Mark a sector when distance hits 20 km, 40 km, etc.
Store average speed, time, G-forces, and elevation changes per sector.

Implementation:

```js
/**
 * Calculate sectors based on cumulative distance.
 * @param {Array} trackPoints - Array of track points with latitude and longitude.
 * @param {number} sectorDistance - Distance for each sector in meters (default is 20km).
 * @returns {Array} Array of sector objects with sector index, start, end, and distance.
 */
function getSectors(trackPoints, sectorDistance = 20000) {
  // 20km in meters
  let sectors = [];
  let cumulativeDistance = 0;
  let sectorStart = 0;
  let sectorIndex = 1;

  for (let i = 1; i < trackPoints.length; i++) {
    let d = haversine(
      trackPoints[i - 1].lat,
      trackPoints[i - 1].lon,
      trackPoints[i].lat,
      trackPoints[i].lon
    );
    cumulativeDistance += d;

    if (cumulativeDistance >= sectorIndex * sectorDistance) {
      sectors.push({
        sector: sectorIndex,
        start: sectorStart,
        end: i,
        distance: cumulativeDistance,
      });
      sectorStart = i;
      sectorIndex++;
    }
  }

  return sectors;
}
```

**7. Turn Radius Estimation from GPS Data**
You have calculations that depend on turnRadius, but no formula to determine turn radius from GPS points.
You need a curvature-based approach using three consecutive points to estimate the radius.

Implementation:

```js
function estimateTurnRadius(p1, p2, p3) {
  const d1 = haversine(p1.lat, p1.lon, p2.lat, p2.lon);
  const d2 = haversine(p2.lat, p2.lon, p3.lat, p3.lon);
  const d3 = haversine(p1.lat, p1.lon, p3.lat, p3.lon);

  const s = (d1 + d2 + d3) / 2; // Semi-perimeter
  const area = Math.sqrt(s * (s - d1) * (s - d2) * (s - d3)); // Heron's formula

  return area > 0 ? (d1 * d2 * d3) / (4 * area) : 0; // Circle radius
}
```

**8. Stopping Distance Calculation**
You have acceleration, but not how much distance is needed to stop.
Useful for braking efficiency and safety analysis.

Implementation:

```js
function calculateStoppingDistance(speed, deceleration = 5) {
  const v = speed * (1000 / 3600); // Convert km/h to m/s
  return (v * v) / (2 * deceleration); // Using kinematic equation
}
```
