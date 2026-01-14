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

const controlPanel = document.getElementById('controlPanel');
const togglePanelBtn = document.getElementById('togglePanel');
const loadingIndicator = document.getElementById('loadingIndicator');
const fileNameDisplay = document.getElementById('fileName');
const dynamicLegend = document.getElementById('dynamicLegend');

document.getElementById('trackInput').addEventListener('change', (e) => handleFile(e.target.files));
document.getElementById('drop-zone').addEventListener('click', () => document.getElementById('trackInput').click());
document.getElementById('drop-zone').addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
document.getElementById('drop-zone').addEventListener('drop', (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files);
});

togglePanelBtn.addEventListener('click', () => {
    if (controlPanel.classList.contains('expanded')) {
        controlPanel.classList.remove('expanded');
        controlPanel.classList.add('collapsed');
        togglePanelBtn.innerHTML = '&#9650; Show';
    } else {
        controlPanel.classList.remove('collapsed');
        controlPanel.classList.add('expanded');
        togglePanelBtn.innerHTML = '&#9660; Hide';
    }
});

document.getElementById('toggleLayer').addEventListener('click', () => {
    if (geoJsonLayers.length > 0) {
        // Hide the current layer and markers
        if (currentLayerIndex >= 0) {
            map.removeLayer(geoJsonLayers[currentLayerIndex].layer);
            geoJsonLayers[currentLayerIndex].pauseMarkers.forEach(marker => map.removeLayer(marker));
            geoJsonLayers[currentLayerIndex].trafficStopMarkers.forEach(marker => map.removeLayer(marker));
        }

        // Move to the next layer
        currentLayerIndex = (currentLayerIndex + 1) % geoJsonLayers.length;

        // Show the new current layer and markers
        map.addLayer(geoJsonLayers[currentLayerIndex].layer);
        geoJsonLayers[currentLayerIndex].pauseMarkers.forEach(marker => map.addLayer(marker));
        geoJsonLayers[currentLayerIndex].trafficStopMarkers.forEach(marker => map.addLayer(marker));
        fileNameDisplay.textContent = `Displayed: ${geoJsonLayers[currentLayerIndex].filename}`;
        console.log(`GeoJSON layer displayed: ${geoJsonLayers[currentLayerIndex].filename}`);

        // Update the speed legend
        const speeds = geoJsonLayers[currentLayerIndex].speeds;
        if (speeds && speeds.length > 0) {
            updateLegend(Math.min(...speeds), Math.max(...speeds), geoJsonLayers[currentLayerIndex].summary);
        } else {
            dynamicLegend.innerHTML = ''; // Clear the legend if no speeds are available
        }

        // Update the Plotly chart
        const layers = geoJsonLayers[currentLayerIndex].layer.getLayers();
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
        updatePlotlyChart(cumulativeDistances, elevations);
    } else {
        console.log('No GeoJSON layers to toggle');
    }
});

document.getElementById('showHideLayer').addEventListener('click', () => {
    if (currentLayerIndex >= 0 && geoJsonLayers.length > 0) {
        if (map.hasLayer(geoJsonLayers[currentLayerIndex].layer)) {
            map.removeLayer(geoJsonLayers[currentLayerIndex].layer);
            geoJsonLayers[currentLayerIndex].pauseMarkers.forEach(marker => map.removeLayer(marker));
            geoJsonLayers[currentLayerIndex].trafficStopMarkers.forEach(marker => map.removeLayer(marker));
            document.getElementById('showHideLayer').textContent = 'Show GeoJSON';
            console.log('GeoJSON layer hidden');
        } else {
            map.addLayer(geoJsonLayers[currentLayerIndex].layer);
            geoJsonLayers[currentLayerIndex].pauseMarkers.forEach(marker => map.addLayer(marker));
            geoJsonLayers[currentLayerIndex].trafficStopMarkers.forEach(marker => map.addLayer(marker));
            document.getElementById('showHideLayer').textContent = 'Hide GeoJSON';
            console.log('GeoJSON layer shown');
        }
    } else {
        console.log('No GeoJSON layer to show/hide');
    }
});