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

let currentTheme = 'dark';

const darkMatter = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
});

const positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
});

const map = L.map('map', {
    center: [-7.5154, 110.2266],
    zoom: 12,
    minZoom: 3,
    layers: [darkMatter],
    maxBounds: [
        [-90, -180],
        [90, 180]
    ]
});

document.getElementById('toggleTheme').addEventListener('click', () => {
    if (currentTheme === 'dark') {
        map.removeLayer(darkMatter);
        map.addLayer(positron);
        currentTheme = 'light';
    } else {
        map.removeLayer(positron);
        map.addLayer(darkMatter);
        currentTheme = 'dark';
    }
});