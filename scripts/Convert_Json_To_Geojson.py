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

import json
from datetime import datetime, timezone

def epoch_to_utc(epoch_time):
    """Convert epoch time to UTC format."""
    return datetime.fromtimestamp(int(epoch_time), tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def convert_json_to_geojson(input_json):
    """Convert JSON with LineString to GeoJSON with Points, preserving metadata."""
    geojson = {
        "type": "FeatureCollection",
        "name": "track_points",
        "features": []
    }
    
    for feature in input_json["features"]:
        geometry = feature.get("geometry", {})
        properties = feature.get("properties", {}).copy()  # Copy metadata
        coordinates = geometry.get("coordinates", [])
        
        for i, coord in enumerate(coordinates):
            if len(coord) < 4:
                continue  # Skip invalid entries
            
            lon, lat, ele, epoch_time = coord  # Extract data
            point_feature = {
                "type": "Feature",
                "properties": {
                    "track_fid": 0,  # You can adjust this if needed
                    "track_seg_id": 0,
                    "track_seg_point_id": i,
                    "ele": ele,
                    "time": epoch_to_utc(epoch_time)
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat]
                }
            }
            
            # Merge metadata under "properties"
            if "data" in properties:
                point_feature["properties"].update(properties["data"])  # Extract "data" properties
            else:
                point_feature["properties"].update(properties)  # Use all available metadata
            
            geojson["features"].append(point_feature)
    
    return geojson

# Example usage
if __name__ == "__main__":
    input_files = ["Rever-Kopeng - Clean.json", "Rever-Selo - Clean.json"]
    
    for input_file in input_files:
        with open(input_file, "r", encoding="utf-8") as f:
            input_data = json.load(f)
        
        output_data = convert_json_to_geojson(input_data)
        output_filename = input_file.replace(".json", "_converted.geojson")
        
        with open(output_filename, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=4)
        
        print(f"Conversion complete. Saved as {output_filename}")
