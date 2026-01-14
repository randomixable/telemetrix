/*
 * Copyright 2026 Theodore Fredrick
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * File: [Nama_File_Kamu.js]
 * Description: [Deskripsi Singkat, contoh: Kinematic derivation and G-Force calculations]
 */

let geoJsonLayers = [];
let currentLayerIndex = -1;
let polylineLayers = [];
let pauseMarkers = [];
let trafficStopMarkers = [];
let topSpeedLocation = null;
let elevationChart = null;

const PAUSE_THRESHOLD = 3 * 60 * 1000; // 3 minutes in milliseconds
const TRAFFIC_LIGHT_MIN = 10 * 1000; // 15 seconds
const TRAFFIC_LIGHT_MAX = 2 * 60 * 1000; // 2 minutes
const STOP_DISTANCE_THRESHOLD = 15; // Meters
const MERGE_DISTANCE_THRESHOLD = 20; // Meters

function displayGeoJson(geojson, filename) {
    let points = [], times = [], speeds = [], elevations = [], pauses = [], trafficStops = [];
    let totalDistance = 0;
    let movingTime = 0;
    let totalTime = 0;
    let topSpeed = 0;
    let startTime, endTime;
    let pauseMarkers = [];
    let trafficStopMarkers = [];

    let newGeoJsonLayer = L.geoJSON(geojson, {
        style: feature => ({ color: feature.properties.color || '#FFFFFF00', weight: 6 }),
        pointToLayer: (feature, latlng) => {
            points.push(latlng);
            times.push(new Date(feature.properties.time));
            if (feature.properties.ele !== undefined) {
                elevations.push(feature.properties.ele);
            } else {
                console.log('Elevation data missing for feature:', feature);
            }
            return L.circleMarker(latlng, { radius: 6, color: '#FFFFFF00' });
        },
        onEachFeature: (feature, layer) => {
            if (feature.properties && feature.properties.time) {
                let index = points.findIndex(p => p.equals(layer.getLatLng()));
                if (index > 0) {
                    let speed = calculateSpeed(points[index - 1], points[index], times[index - 1], times[index]);
                    speeds.push(speed);
                    totalDistance += calculateDistance(points[index - 1], points[index]);
                    if (speed > 0) {
                        movingTime += (times[index] - times[index - 1]) / 1000;
                    }
                }
            }
        }
    }).addTo(map);

    // Process speeds to remove outliers and smooth values
    console.log("Raw speeds before processing:", speeds);
    speeds = detectOutliers(speeds, times);
    speeds = filterAndSmoothSpeeds(speeds, times);
    console.log("Final processed speeds:", speeds);

    // Calculate max acceleration and deceleration G-forces
    const maxGForces = calculateMaxGForce(speeds, times);
    console.log(`Max Acceleration G-Force: ${maxGForces.maxAccelGForce}g at track_seg_point_id: ${geojson.features[maxGForces.maxAccelIndex]?.properties.track_seg_point_id}`);
    console.log(`Max Deceleration G-Force: ${maxGForces.maxDecelGForce}g at track_seg_point_id: ${geojson.features[maxGForces.maxDecelIndex]?.properties.track_seg_point_id}`);


    // Detect pauses and traffic light stops
    for (let i = 1; i < times.length; i++) {
        let timeDiff = times[i] - times[i - 1];
        let distance = calculateDistance(points[i - 1], points[i]);

        if (timeDiff > PAUSE_THRESHOLD) {
            pauses.push({ location: points[i], duration: timeDiff / 1000 });
        }

        if (timeDiff >= TRAFFIC_LIGHT_MIN && timeDiff <= TRAFFIC_LIGHT_MAX && distance < STOP_DISTANCE_THRESHOLD) {
            trafficStops.push({ location: points[i], duration: timeDiff / 1000 });
        }
    }

    // Normalize traffic light stops
    let normalizedTrafficStops = [];
    trafficStops.forEach(stop => {
        let found = false;
        for (let i = 0; i < normalizedTrafficStops.length; i++) {
            if (calculateDistance(normalizedTrafficStops[i].location, stop.location) < MERGE_DISTANCE_THRESHOLD) {
                normalizedTrafficStops[i].duration += stop.duration;
                found = true;
                break;
            }
        }
        if (!found) {
            normalizedTrafficStops.push(stop);
        }
    });

    // Add pause markers to the map
    pauses.forEach(pause => {
        let marker = L.marker(pause.location).addTo(map).bindPopup(`Paused for ${formatTime(pause.duration)}`);
        pauseMarkers.push(marker);
    });

    // Add traffic light stop markers to the map
    normalizedTrafficStops.forEach(stop => {
        let marker = L.marker(stop.location, {
            icon: L.divIcon({
                className: 'traffic-stop-marker',
                html: '🚦'
            })
        })
            .addTo(map)
            .bindPopup(`Traffic Stop: ${formatTime(stop.duration)}`);
        trafficStopMarkers.push(marker);
    });

    // Now, recalculate top speed based on smoothed values
    topSpeed = Math.max(...speeds);
    topSpeedLocation = points[speeds.indexOf(topSpeed)];

    // Add top speed marker to the map
    if (topSpeedLocation) {
        console.log(`Top Speed Location: ${topSpeedLocation.lat}, ${topSpeedLocation.lng}`);
        let topSpeedMarker = L.marker(topSpeedLocation, {
            icon: L.divIcon({
                className: 'top-speed-marker',
                html: '🏁'
            })
        })
            .addTo(map)
            .bindPopup(`Top Speed: ${topSpeed.toFixed(1)} km/h`);
        trafficStopMarkers.push(topSpeedMarker);
    } else {
        console.log('No top speed location found.');
    }

    // Calculate summary statistics
    if (points.length > 1) {
        startTime = times[0];
        endTime = times[times.length - 2];
        totalTime = (endTime - startTime) / 1000;

        // Calculate moving time by subtracting pause and traffic stop durations from total time
        let totalPauseTime = pauses.reduce((acc, pause) => acc + pause.duration, 0);
        let totalTrafficStopTime = normalizedTrafficStops.reduce((acc, stop) => acc + stop.duration, 0);
        movingTime = totalTime - totalPauseTime - totalTrafficStopTime;

        let movingTimeHours = movingTime / 3600; // Convert moving time to hours
        let totalDistanceKm = totalDistance / 1000; // Convert total distance to kilometers
        let averageSpeed = totalDistanceKm / movingTimeHours;
        let totalElevation = Math.max(...elevations) - Math.min(...elevations);

        console.log(`Total Distance: ${totalDistance} meters`);
        console.log(`Total Distance: ${totalDistanceKm} kilometers`);
        console.log(`Moving Time: ${movingTime} seconds`);
        console.log(`Total Time: ${totalTime} seconds`);
        console.log(`Average Speed: ${averageSpeed} km/h`);
        console.log(`Elevation: ${totalElevation} m`);
        console.log(`Start: ${startTime} `);
        console.log(`Finish: ${endTime} `);
        console.log(`Total Distance: ${totalDistance} meters`);
        console.log(`Number of Elevation Points: ${elevations.length}`);

        const summary = {
            totalTime,
            movingTime,
            averageSpeed,
            topSpeed,
            totalDistance: totalDistanceKm, // Store distance in kilometers for display
            totalElevation,
            startTime,
            endTime,
            maxAccelGForce: maxGForces.maxAccelGForce,
            maxDecelGForce: maxGForces.maxDecelGForce
        };

        updateLegend(Math.min(...speeds), Math.max(...speeds), summary);

        geoJsonLayers.push({
            layer: newGeoJsonLayer,
            filename: filename,
            speeds: speeds,
            summary: summary,
            pauseMarkers: pauseMarkers,
            trafficStopMarkers: trafficStopMarkers,
        });

        let cumulativeDistances = calculateCumulativeDistances(points);

        // Add polylines to the map
        for (let i = 1; i < points.length; i++) {
            let polyline = L.polyline([points[i - 1], points[i]], { color: interpolateColor(speeds[i - 1], topSpeed), weight: 6 }).addTo(newGeoJsonLayer);
            polyline.bindTooltip("Speed: " + speeds[i - 1].toFixed(1) + " km/h" +
                (geojson.features[i].properties.track_seg_point_id !== undefined ? "<br>Track Segment ID: " + geojson.features[i].properties.track_seg_point_id : "") +
                "<br>Time: " + new Date(geojson.features[i].properties.time).toLocaleString() +
                "<br>Distance: " + cumulativeDistances[i].toFixed(2) + " km");
        }

        // Update the Plotly chart
        updatePlotlyChart(cumulativeDistances, elevations);

    } else {
        geoJsonLayers.push({
            layer: newGeoJsonLayer,
            filename: filename,
            speeds: speeds,
            summary: {},
            pauseMarkers: pauseMarkers,
            trafficStopMarkers: trafficStopMarkers
        });
    }

    // Automatically display the newly loaded layer
    if (currentLayerIndex >= 0) {
        map.removeLayer(geoJsonLayers[currentLayerIndex].layer);
        geoJsonLayers[currentLayerIndex].pauseMarkers.forEach(marker => map.removeLayer(marker));
        geoJsonLayers[currentLayerIndex].trafficStopMarkers.forEach(marker => map.removeLayer(marker));
    }
    currentLayerIndex = geoJsonLayers.length - 1;
    map.addLayer(newGeoJsonLayer);
    pauseMarkers.forEach(marker => map.addLayer(marker));
    trafficStopMarkers.forEach(marker => map.addLayer(marker));
    fileNameDisplay.textContent = `Displayed: ${filename}`;

    let bounds = newGeoJsonLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds);
}