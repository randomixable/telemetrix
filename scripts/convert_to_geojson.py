# Copyright 2026 Theodore Fredrick
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
import json
from datetime import datetime, timezone

def convert_linestring_to_points(input_geojson):
    """ Converts a LineString GeoJSON to Point-based Track GeoJSON """
    feature_collection = {
        "type": "FeatureCollection",
        "name": "track_points",
        "features": []
    }

    track_fid = 0  # Track ID (assuming single track)
    track_seg_id = 0  # Segment ID

    for feature in input_geojson["features"]:
        if feature["geometry"]["type"] != "LineString":
            continue  # Skip non-LineString features

        coordinates = feature["geometry"]["coordinates"]

        for track_seg_point_id, coord in enumerate(coordinates):
            # Handle missing timestamps
            if len(coord) == 4:
                lon, lat, ele, epoch = coord
            elif len(coord) == 3:
                lon, lat, ele = coord
                epoch = None  # No timestamp available
            else:
                print(f"Skipping invalid coordinate: {coord}")
                continue

            # Convert epoch time safely
            time_str = datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if epoch else "1970-01-01T00:00:00Z"

            # Create Point feature
            point_feature = {
                "type": "Feature",
                "properties": {
                    "track_fid": track_fid,
                    "track_seg_id": track_seg_id,
                    "track_seg_point_id": track_seg_point_id,
                    "ele": ele,  # Keep original precision
                    "time": time_str
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat]  # Keep original precision
                }
            }

            feature_collection["features"].append(point_feature)

    return feature_collection

# Function to read input JSON file and convert it
def process_file(input_file, output_file):
    with open(input_file, 'r') as file:
        input_geojson = json.load(file)
    
    output_geojson = convert_linestring_to_points(input_geojson)
    
    with open(output_file, 'w') as file:
        json.dump(output_geojson, file, indent=4)

# Directories and file names
input_directory = 'data'
output_directory = 'data/converted'

# Create the output directory if it doesn't exist
if not os.path.exists(output_directory):
    os.makedirs(output_directory)

# Process Rever JSON files
process_file(
    os.path.join(input_directory, 'Rever-Selo.json'),
    os.path.join(output_directory, 'Rever-Selo-Converted.geojson')
)
process_file(
    os.path.join(input_directory, 'Rever-Kopeng.json'),
    os.path.join(output_directory, 'Rever-Kopeng-Converted.geojson')
)