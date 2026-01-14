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

function handleFile(files) {
    console.log("Files received:", files); // Debugging line
    var file = files[0];
    if (!file) return;

    const fileType = file.name.split('.').pop().toLowerCase();
    console.log("File type:", fileType); // Debugging line

    const reader = new FileReader();
    reader.onload = function (event) {
        const fileContent = event.target.result;
        try {
            if (fileType === "geojson") {
                loadGeoJson(JSON.parse(fileContent), file.name);
            } else if (fileType === "gpx") {
                loadGPX(fileContent, file.name);
            } else {
                alert("Unsupported file type. Upload .gpx or .geojson.");
            }
        } catch (error) {
            console.error("Error loading file:", error);
            alert("An error occurred while loading the file. Please try again.");
        }
    };
    reader.readAsText(file);
}

function loadGPX(gpxContent, filename) {
    try {
        let parser = new DOMParser();
        let gpxDoc = parser.parseFromString(gpxContent, "application/xml");
        if (!gpxDoc || gpxDoc.getElementsByTagName("parsererror").length > 0) {
            throw new Error("Invalid GPX format");
        }
        let geojson = convertGPXToGeoJSON(gpxDoc);
        displayGeoJson(geojson, filename);
    } catch (error) {
        handleError(error, "Error parsing GPX file");
    }
}

function loadGeoJson(geojson, filename) {
    try {
        if (!geojson || geojson.type !== "FeatureCollection") {
            throw new Error("Invalid GeoJSON format");
        }
        displayGeoJson(geojson, filename);
    } catch (error) {
        handleError(error, "Error parsing GeoJSON file");
    }
}


function handleError(error, message) {
    console.error(message, error);
    alert(`${message}: ${error.message}`);
}

function convertGPXToGeoJSON(gpxDoc) {
    let geojson = {
        type: "FeatureCollection",
        features: []
    };

    let trackpoints = gpxDoc.getElementsByTagName("trkpt");
    for (let i = 0; i < trackpoints.length; i++) {
        let trackpoint = trackpoints[i];
        let lat = parseFloat(trackpoint.getAttribute("lat"));
        let lon = parseFloat(trackpoint.getAttribute("lon"));
        let ele = trackpoint.getElementsByTagName("ele")[0]?.textContent;
        let time = trackpoint.getElementsByTagName("time")[0]?.textContent;

        let feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [lon, lat, ele ? parseFloat(ele) : null]
            },
            properties: {
                time: time ? new Date(time).toISOString() : null,
                ele: ele ? parseFloat(ele) : null,
                track_seg_point_id: i
            }
        };

        geojson.features.push(feature);
    }

    return geojson;
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}

// Function to calculate distance using Haversine formula
function calculateDistance(latlng1, latlng2) {
    const R = 6371000; // Earth radius in meters
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(latlng2.lat - latlng1.lat);
    const dLon = toRad(latlng2.lng - latlng1.lng);
    const lat1 = toRad(latlng1.lat);
    const lat2 = toRad(latlng2.lat);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
}

// Function to calculate speed with a realistic motorcycle threshold
function calculateSpeed(latlng1, latlng2, time1, time2) {
    const distance = calculateDistance(latlng1, latlng2); // Distance in meters
    const timeDiff = (time2 - time1) / 1000; // Time in seconds
    if (timeDiff === 0) return 0;

    let speed = (distance / timeDiff) * 3.6; // Convert to km/h
    return speed; // No more capping at 130 km/h, anomalies will be smoothed instead
}

function smoothSpeeds(speeds, windowSize = 5) {
    if (speeds.length < 2) return speeds;

    let smoothed = [];
    for (let i = 0; i < speeds.length; i++) {
        let start = Math.max(0, i - Math.floor(windowSize / 2));
        let end = Math.min(speeds.length - 1, i + Math.floor(windowSize / 2));

        let sum = 0, count = 0;
        for (let j = start; j <= end; j++) {
            sum += speeds[j];
            count++;
        }

        let avgSpeed = sum / count;

        // Preserve real acceleration/deceleration
        if (Math.abs(speeds[i] - avgSpeed) > 10) {
            smoothed.push(speeds[i]); // Keep real acceleration changes
        } else if (speeds[i] < 30) {
            smoothed.push(speeds[i]); // Keep stops realistic
        } else {
            smoothed.push(avgSpeed); // Apply smoothing normally
        }
    }
    return smoothed;
}

//Moving Average Speed Smoothing
function filterAndSmoothSpeeds(speeds, times, maxAccel = 1.72, maxDecel = -9.8, stopThreshold = 2) {
    if (speeds.length < 3) return speeds;

    let filteredSpeeds = detectOutliers(speeds, times, maxAccel, maxDecel, 20);

    for (let i = 1; i < speeds.length - 1; i++) {
        if (filteredSpeeds[i] < stopThreshold && filteredSpeeds[i - 1] < stopThreshold) {
            filteredSpeeds[i] = 0; // Force stop to 0 km/h
        }
    }

    return smoothSpeeds(filteredSpeeds);
}

//Outlier detection
function detectOutliers(speeds, times, maxAccel = 4, maxDecel = -9.8, maxJump = 20) {
    if (!Array.isArray(speeds) || !Array.isArray(times) || speeds.length < 3 || times.length < 3) {
        console.error("Invalid input to detectOutliers: speeds or times is undefined or too short.");
        return speeds || [];
    }

    let medianSpeed = speeds.slice().sort((a, b) => a - b)[Math.floor(speeds.length / 2)];
    let mad = medianAbsoluteDeviation(speeds, medianSpeed);

    let filteredSpeeds = speeds.map((speed, i) => {
        if (Math.abs(speed - medianSpeed) > 3 * mad) {
            console.warn(`Outlier detected at index ${i}: ${speed} km/h`);
            return i > 0 ? speeds[i - 1] : speed;
        }
        return speed;
    });

    return handleOutliers(filteredSpeeds, times, maxAccel, maxDecel, maxJump);
}

function calculateAcceleration(speeds, times, i) {
    let dt1 = (times[i] - times[i - 1]) / 1000;
    let dt2 = (i + 1 < times.length && times[i + 1]) ? (times[i + 1] - times[i]) / 1000 : dt1;

    let accel1 = (speeds[i] - speeds[i - 1]) / dt1;
    let accel2 = (i + 1 < speeds.length && speeds[i + 1]) ? (speeds[i + 1] - speeds[i]) / dt2 : accel1;

    return { accel1, accel2 };
}

function handleOutliers(speeds, times, maxAccel, maxDecel, maxJump) {
    let filteredSpeeds = [...speeds];

    for (let i = 1; i < speeds.length - 1; i++) {
        if (!times[i] || !times[i - 1]) continue;

        let { accel1, accel2 } = calculateAcceleration(speeds, times, i);

        if (accel1 > maxAccel || accel1 < maxDecel || accel2 > maxAccel || accel2 < maxDecel) {
            console.warn(`Outlier detected at index ${i}: ${speeds[i]} km/h (Accel: ${accel1.toFixed(2)} m/s²)`);

            let prevSpeed = filteredSpeeds[i - 1];
            let nextSpeed = i + 1 < speeds.length ? filteredSpeeds[i + 1] : prevSpeed;

            filteredSpeeds[i] = Math.min(Math.max(prevSpeed - maxJump, speeds[i]), prevSpeed + maxJump);
        }
    }

    return filteredSpeeds;
}

//Median Absolute Deviation
function medianAbsoluteDeviation(data, median) {
    let deviations = data.map(value => Math.abs(value - median));
    deviations.sort((a, b) => a - b);
    return deviations[Math.floor(deviations.length / 2)]; // MAD value
}

function calculateMaxGForce(speeds, times) {
    const g = 9.81; // Gravity (m/s²)
    let maxAccelGForce = 0;
    let maxDecelGForce = 0;
    let maxAccelIndex = -1;
    let maxDecelIndex = -1;

    for (let i = 1; i < speeds.length; i++) {
        let speedDiff = speeds[i] - speeds[i - 1]; // Speed difference in km/h
        let timeDiff = (times[i] - times[i - 1]) / 1000; // Convert ms to seconds

        if (timeDiff > 0) {
            let accel = (speedDiff * 1000 / 3600) / timeDiff; // Convert to m/s²
            let accelGForce = accel / g; // Convert to G-Force

            // Apply rolling window filtering (5-point avg)
            if (i >= 2) {
                let prevAccel = (speeds[i - 1] - speeds[i - 2]) * 1000 / (3600 * ((times[i - 1] - times[i - 2]) / 1000));
                accelGForce = (accelGForce + prevAccel / g) / 2;
            }

            // Apply Outlier Detection (Cap at realistic values)
            if (accelGForce > 0.5) accelGForce = 0.5; // Limit max acceleration
            if (accelGForce < -1.0) accelGForce = -1.0; // Limit max braking deceleration

            // Track Maximum G-Force & Index
            if (accelGForce > maxAccelGForce) {
                maxAccelGForce = accelGForce;
                maxAccelIndex = i; // Save index
            }
            if (accelGForce < maxDecelGForce) {
                maxDecelGForce = accelGForce;
                maxDecelIndex = i; // Save index
            }
        }
    }

    return {
        maxAccelGForce: maxAccelGForce.toFixed(2),
        maxDecelGForce: Math.abs(maxDecelGForce).toFixed(2), // Keep decel positive for display
        maxAccelIndex, // Provide index for reference
        maxDecelIndex
    };
}

function interpolateColor(speed, maxSpeed) {
    const normalizedSpeed = Math.min(speed / maxSpeed, 1);
    const hue = normalizedSpeed * 70; // 0 (red) to 240 (blue)
    const saturation = 75; // Reduced saturation to 50%
    const lightness = 50; // Reduced lightness to 40%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function calculateElevationGain(elevations) {
    let totalGain = 0;
    for (let i = 1; i < elevations.length; i++) {
        let gain = elevations[i] - elevations[i - 1];
        if (gain > 0) {
            totalGain += gain;
        }
    }
    console.log(`Total Gain: ${totalGain} meters`);
    return totalGain;

}

function calculateAverageSpeed(totalDistance, totalTime) {
    return (totalDistance / totalTime) * 3.6; // Convert m/s to km/h
}

function calculateMovingTime(totalTime, pauseTime) {
    return totalTime - pauseTime;
}

function calculateCumulativeDistances(points) {
    let cumulativeDistances = [];
    let cumulativeDistance = 0;
    for (let i = 0; i < points.length; i++) {
        if (i > 0) {
            cumulativeDistance += calculateDistance(points[i - 1], points[i]);
        }
        cumulativeDistances.push(cumulativeDistance / 1000); // Convert to km
    }
    return cumulativeDistances;
}

let currentChart = 'elevation';

document.getElementById('toggleChart').addEventListener('click', () => {
    if (currentChart === 'elevation') {
        currentChart = 'speed';
        updateSpeedChart(currentLayerIndex);
    } else {
        currentChart = 'elevation';
        updateElevationChart(currentLayerIndex);
    }
});

function updateElevationChart(layerIndex) {
    const layers = geoJsonLayers[layerIndex].layer.getLayers();
    const points = layers.flatMap(layer => {
        if (layer.getLatLng) {
            return [layer.getLatLng()];
        } else if (layer.getLatLngs) {
            return layer.getLatLngs();
        }
        return [];
    });
    const cumulativeDistances = calculateCumulativeDistances(points);
    const elevations = layers.flatMap(layer => {
        if (layer.feature && layer.feature.properties && layer.feature.properties.ele !== undefined) {
            return [layer.feature.properties.ele];
        }
        return [];
    });
    updatePlotlyChart(cumulativeDistances, elevations, 'Elevation Over Distance', 'Elevation (m)');
}

function updateSpeedChart(layerIndex) {
    const layers = geoJsonLayers[layerIndex].layer.getLayers();
    const points = layers.flatMap(layer => {
        if (layer.getLatLng) {
            return [layer.getLatLng()];
        } else if (layer.getLatLngs) {
            return layer.getLatLngs();
        }
        return [];
    });
    const cumulativeDistances = calculateCumulativeDistances(points);
    const speeds = geoJsonLayers[layerIndex].speeds;
    updatePlotlyChart(cumulativeDistances, speeds, 'Speed Over Distance', 'Speed (km/h)');
}

function updatePlotlyChart(xData, yData, title, yAxisTitle) {
    const trace = {
        x: xData, // Use cumulative distances as labels
        y: yData,
        type: 'scatter',
        mode: 'lines',
        name: yAxisTitle,
        line: { color: 'rgba(75, 192, 192, 1)' }
    };

    const layout = {
        title: {
            text: title,
            font: { size: 10 }
        },
        xaxis: {
            title: {
                text: 'Distance (Km)',
                font: { size: 10 }
            },
            showgrid: true,
            zeroline: false
        },
        yaxis: {
            title: {
                text: yAxisTitle,
                font: { size: 10 }
            },
            showgrid: true,
            zeroline: false
        },
        margin: {
            l: 50, // left margin
            r: 10, // right margin
            t: 30, // top margin
            b: 30  // bottom margin
        },
        height: 300, // height of the plot
        width: 1200,  // width of the plot
    };

    Plotly.react('elevationChart', [trace], layout);
}

function updateLegend(minSpeed, maxSpeed, summary = {}) {
    dynamicLegend.innerHTML = `
        <div><span class="color-box" style="background-color: ${interpolateColor(minSpeed)};"></span>Min: ${minSpeed !== undefined ? minSpeed.toFixed(1) : 'N/A'} km/h</div>
        <div><span class="color-box" style="background-color: ${interpolateColor(maxSpeed)};"></span>Max: ${maxSpeed !== undefined ? maxSpeed.toFixed(1) : 'N/A'} km/h</div>
        ${summary.totalTime !== undefined ? `<div>Total Time: ${formatTime(summary.totalTime)}</div>` : ''}
        ${summary.movingTime !== undefined ? `<div>Moving Time: ${formatTime(summary.movingTime)}</div>` : ''}
        ${summary.averageSpeed !== undefined ? `<div>Average Speed: ${summary.averageSpeed.toFixed(1)} km/h</div>` : ''}
        ${summary.topSpeed !== undefined ? `<div>Top Speed: ${summary.topSpeed.toFixed(1)} km/h</div>` : ''}
        ${summary.totalDistance !== undefined ? `<div>Total Distance: ${summary.totalDistance.toFixed(1)} km</div>` : ''}
        ${summary.totalElevation !== undefined ? `<div>Total Elevation: ${summary.totalElevation.toFixed(1)} m</div>` : ''}
        ${summary.startTime !== undefined ? `<div>Start Time: ${new Date(summary.startTime).toLocaleTimeString()}GMT+7</div>` : ''}
        ${summary.endTime !== undefined ? `<div>Finish Time: ${new Date(summary.endTime).toLocaleTimeString()}GMT+7</div>` : ''}
        ${summary.maxAccelGForce !== undefined ? `<div>Max Acceleration G-Force: +${summary.maxAccelGForce}g</div>` : ''}
        ${summary.maxDecelGForce !== undefined ? `<div>Max Deceleration G-Force: -${summary.maxDecelGForce}g</div>` : ''}
    `;
}