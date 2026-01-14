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

def merge_geojsons(tracker_geojson, tracker_conv_geojson):
    """Merge two GeoJSONs by matching timestamps to assign correct track metadata."""
    merged_geojson = {
        "type": "FeatureCollection",
        "name": "track_points",
        "features": []
    }
    
    # Extract timestamps and metadata from Tracker-Kopeng
    track_metadata = {}
    for feature in tracker_geojson["features"]:
        time = feature["properties"].get("time")
        if time:
            track_metadata[time] = {
                "track_fid": feature["properties"].get("track_fid", 0),
                "track_seg_id": feature["properties"].get("track_seg_id", 0),
                "track_seg_point_id": feature["properties"].get("track_seg_point_id", 0)
            }
    
    # Extract timestamps and coordinates from Tracker-Kopeng-Conv
    conv_data = []
    for feature in tracker_conv_geojson["features"]:
        if feature["geometry"]["type"] == "MultiLineString":
            coordinates = feature["geometry"]["coordinates"]
            times = feature["properties"].get("coordTimes", [])
            
            for line, time in zip(coordinates, times):
                for point, timestamp in zip(line, time):
                    conv_data.append({
                        "time": timestamp,
                        "coordinates": point
                    })
    
    # Match timestamps and merge data
    for conv in conv_data:
        time = conv["time"]
        coordinates = conv["coordinates"]
        
        if time not in track_metadata:
            continue  # Skip if no exact timestamp match
        
        track_info = track_metadata[time]  # Ensure correct segment ID assignment
        
        point_feature = {
            "type": "Feature",
            "properties": {
                "track_fid": track_info["track_fid"],
                "track_seg_id": track_info["track_seg_id"],  # Preserve original segment ID
                "track_seg_point_id": track_info["track_seg_point_id"],
                "ele": coordinates[2] if len(coordinates) > 2 else 0,
                "time": time,
                "type": "paths"
            },
            "geometry": {
                "type": "Point",
                "coordinates": coordinates[:2]  # Keep full 14 decimal places
            }
        }
        
        merged_geojson["features"].append(point_feature)
    
    return merged_geojson

# Example usage
if __name__ == "__main__":
    with open("Tracker-Kopeng.geojson", "r", encoding="utf-8") as f:
        tracker_geojson = json.load(f)
    
    with open("Tracker-Kopeng-Conv.geojson", "r", encoding="utf-8") as f:
        tracker_conv_geojson = json.load(f)
    
    output_data = merge_geojsons(tracker_geojson, tracker_conv_geojson)
    output_filename = "Tracker-Kopeng-Merged.geojson"
    
    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=4)
    
    print(f"Merging complete. Saved as {output_filename}")
