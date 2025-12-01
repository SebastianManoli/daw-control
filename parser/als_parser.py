import gzip
from xml.etree import ElementTree as ET
from pathlib import Path

from collections import Counter
from typing import Dict

als_project_path = "C:/Users/sebas/Documents/! FINAL YEAR/PROJECT/ableton-folders-test-cases/demo Project/demo.als"

def open_als_xml(path:Path) -> ET.ElementTree:
    try:
        with gzip.open(path, 'rb') as f:
            return ET.parse(f)
    except gzip.BadGzipFile:
        with open(path, 'rb') as f:
            return ET.parse(f)

test = open_als_xml(Path(als_project_path))

# print(test)

def als_inspect(path: Path) -> Dict[str, int]:
    """
    Produce a rough frequency summary of XML element paths to guide schema mapping.
    Safe to run on any ALS without knowing its exact schema.
    """
    tree = open_als_xml(path)
    root = tree.getroot()
    counter: Counter[str] = Counter()

    def walk(node, path):
        tag = node.tag.split("}")[-1]  # strip namespace if present
        here = f"{path}/{tag}" if path else tag
        counter[here] += 1
        for child in list(node):
            walk(child, here)

    walk(root, "")
    return dict(counter)
                        
def parse_als_with_values(file_path):
    tree = open_als_xml(file_path)
    root = tree.getroot()
    
    def extract_with_values(element, path="", level=0):
        current_path = f"{path}/{element.tag}" if path else element.tag
        
        # Print element with its text content if it has any
        if element.text and element.text.strip():
            print(f"{'  ' * level}{current_path}: {element.text.strip()}")
        else:
            print(f"{'  ' * level}{current_path}")
            
        # Print attributes if any
        if element.attrib:
            for attr, value in element.attrib.items():
                print(f"{'  ' * (level+1)}@{attr}: {value}")
        
        for child in element:
            extract_with_values(child, current_path, level + 1)
    
    extract_with_values(root)
    
def extract_midi_notes(file_path):
    tree = open_als_xml(file_path)
    
    # Find all MIDI notes
    notes = tree.findall(".//MidiNoteEvent")
    midi_data = []
    
    for note in notes:
        note_data = {
            'time': note.get('Time'),
            'duration': note.get('Duration'), 
            'velocity': note.get('Velocity'),
            'pitch': note.get('Key'),  # MIDI note number
            'muted': note.get('IsDisabled') == 'true'
        }
        midi_data.append(note_data)
    
    return midi_data

def count_notes_per_track(file_path):
    """Count the number of MIDI notes in each track."""
    tree = open_als_xml(file_path)
    track_note_counts = []
    
    # Find all MIDI tracks
    for i, track in enumerate(tree.findall(".//MidiTrack"), 1):
        track_name_elem = track.find(".//Name/UserName")
        track_name = track_name_elem.get('Value') if track_name_elem is not None else f'Untitled Track {i}'
        
        # Count MIDI notes in this track
        notes = track.findall(".//MidiNoteEvent")
        note_count = len(notes)
        
        track_note_counts.append({
            'track_number': i,
            'name': track_name,
            'note_count': note_count
        })
    
    return track_note_counts

def extract_tempo(file_path):
    tree = open_als_xml(file_path)
    tempo_element = tree.find(".//Tempo/Manual")
    return float(tempo_element.get('Value')) if tempo_element is not None else 120.0

def extract_track_info(file_path):
    tree = open_als_xml(file_path)
    tracks = []
    
    # Check all track types: MidiTrack, AudioTrack, ReturnTrack
    for track_type in [".//MidiTrack", ".//AudioTrack", ".//ReturnTrack"]:
        for track in tree.findall(track_type):
            track_name = track.find(".//Name/UserName")
            track_data = {
                'name': track_name.get('Value') if track_name is not None else 'Untitled',
                'type': track_type.split('/')[-1],  # Get track type name
                'color': track.find(".//Color").get('Value') if track.find(".//Color") is not None else None,
                'devices': [device.tag for device in track.findall(".//DeviceChain/DeviceChain/Devices/*")]
            }
            tracks.append(track_data)
    
    return tracks

def extract_plugin_names(file_path):
    """
    Extract the names of all third-party plugins (VST/AU) used in the project.
    Returns a list of unique plugin names with their format and vendor.
    """
    tree = open_als_xml(file_path)
    plugins = []
    
    # Search in all track types
    for track_type in [".//MidiTrack", ".//AudioTrack", ".//ReturnTrack", ".//MasterTrack"]:
        tracks = tree.findall(track_type)
        
        for track in tracks:
            # Find all devices in the track
            devices = track.findall(".//DeviceChain/DeviceChain/Devices/*")
            
            for device in devices:
                plugin_info = None
                
                # Check for VST2 plugin
                vst_info = device.find(".//PluginDesc/VstPluginInfo")
                if vst_info is not None:
                    plugin_name_elem = vst_info.find("PlugName")
                    vendor_elem = vst_info.find("PluginVendor")
                    
                    plugin_info = {
                        'name': plugin_name_elem.get('Value') if plugin_name_elem is not None else 'Unknown VST',
                        'format': 'VST',
                        'vendor': vendor_elem.get('Value') if vendor_elem is not None else 'Unknown'
                    }
                
                # Check for VST3 plugin
                vst3_info = device.find(".//PluginDesc/Vst3PluginInfo")
                if vst3_info is not None:
                    plugin_name_elem = vst3_info.find("Name")
                    vendor_elem = vst3_info.find("Vendor")
                    
                    plugin_info = {
                        'name': plugin_name_elem.get('Value') if plugin_name_elem is not None else 'Unknown VST3',
                        'format': 'VST3',
                        'vendor': vendor_elem.get('Value') if vendor_elem is not None else 'Unknown'
                    }
                
                # Check for Audio Unit plugin
                au_info = device.find(".//PluginDesc/AuPluginInfo")
                if au_info is not None:
                    au_name_elem = au_info.find("Name")
                    manufacturer_elem = au_info.find("Manufacturer")
                    
                    plugin_info = {
                        'name': au_name_elem.get('Value') if au_name_elem is not None else 'Unknown AU',
                        'format': 'Audio Unit',
                        'vendor': manufacturer_elem.get('Value') if manufacturer_elem is not None else 'Unknown'
                    }
                
                # Add plugin if found
                if plugin_info:
                    # Check if we already have this plugin in the list
                    if not any(p['name'] == plugin_info['name'] and p['format'] == plugin_info['format'] 
                              for p in plugins):
                        plugins.append(plugin_info)
    
    return plugins

if __name__ == "__main__":
    file_path = Path(als_project_path)
    
    print("\n" + "="*60)
    print(f"ABLETON PROJECT SUMMARY: {file_path.name}")
    print("="*60 + "\n")

    # 1. General Info
    tempo = extract_tempo(file_path)
    print(f"► TEMPO: {tempo} BPM\n")

    # 2. Tracks
    print("► TRACKS STRUCTURE:")
    print(f"{'#':<4} {'Type':<12} {'Name':<30} {'Devices'}")
    print("-" * 80)
    
    tracks = extract_track_info(file_path)
    note_counts = count_notes_per_track(file_path)
    
    midi_track_index = 0
    
    for i, track in enumerate(tracks, 1):
        name = track['name'] if track['name'] else "(Untitled)"
        t_type = track['type']
        devices = ", ".join(track['devices']) if track['devices'] else "-"
        
        extra_info = ""
        if t_type == 'MidiTrack':
            if midi_track_index < len(note_counts):
                count = note_counts[midi_track_index]['note_count']
                extra_info = f"[{count} notes]"
                midi_track_index += 1
        
        print(f"{i:<4} {t_type:<12} {name:<30} {devices} {extra_info}")

    print("\n")

    # 3. Plugins
    print("► THIRD-PARTY PLUGINS:")
    plugins = extract_plugin_names(file_path)
    if not plugins:
        print("  No third-party plugins found.")
    else:
        for p in plugins:
            print(f"  • {p['name']} ({p['vendor']}) [{p['format']}]")
            
    print("\n" + "="*60)