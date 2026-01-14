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
import xml.etree.ElementTree as ET
from datetime import datetime

# Define the namespace
namespace = "http://www.topografix.com/GPX/1/1"
ET.register_namespace('', namespace)

# Function to format coordinates to a consistent decimal precision
def format_coordinates(lat, lon, precision=6):
    return round(float(lat), precision), round(float(lon), precision)

# Function to convert epoch time to UTC format
def epoch_to_utc(epoch_time):
    return datetime.utcfromtimestamp(int(epoch_time)).strftime('%Y-%m-%dT%H:%M:%SZ')

# Function to update GPX files and save to a new folder
def update_gpx(file_path, output_folder):
    tree = ET.parse(file_path)
    root = tree.getroot()
    
    for trkpt in root.findall('.//{http://www.topografix.com/GPX/1/1}trkpt'):
        lat, lon = format_coordinates(trkpt.get('lat'), trkpt.get('lon'))
        trkpt.set('lat', str(lat))
        trkpt.set('lon', str(lon))
        
        ele = trkpt.find('{http://www.topografix.com/GPX/1/1}ele')
        if ele is None:
            ele = ET.SubElement(trkpt, '{http://www.topografix.com/GPX/1/1}ele')
            ele.text = '0.0'  # Default elevation if missing
        
        time = trkpt.find('{http://www.topografix.com/GPX/1/1}time')
        if time is None:
            time = ET.SubElement(trkpt, '{http://www.topografix.com/GPX/1/1}time')
            time.text = '1970-01-01T00:00:00Z'  # Default time if missing
        else:
            # Convert epoch time to UTC format if necessary
            try:
                epoch_time = int(time.text)
                time.text = epoch_to_utc(epoch_time)
            except ValueError:
                pass  # Time is already in UTC format

    # Create the output folder if it doesn't exist
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    # Save the updated GPX file to the new folder
    output_file_path = os.path.join(output_folder, os.path.basename(file_path))
    tree.write(output_file_path, xml_declaration=True, encoding='utf-8')

# Directory containing the GPX files to update
input_directory = 'data'
output_directory = 'data/updated'

# Iterate over all GPX files in the directory
for filename in os.listdir(input_directory):
    if filename.endswith('.gpx'):
        file_path = os.path.join(input_directory, filename)
        update_gpx(file_path, output_directory)