import gzip
import json
import sys
from xml.etree import ElementTree as ET
from pathlib import Path
import math

from collections import Counter
from typing import Dict, Optional


def _parse_bool(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {'true', '1', 'yes', 'on'}


def _to_float(value: Optional[str], default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _linear_gain_to_db(gain: float) -> float:
    # Ableton stores mixer gain as linear amplitude.
    # Convert to dB for UI display: dB = 20 * log10(gain)
    if gain <= 0.0:
        return float('-inf')
    return 20.0 * math.log10(gain)


def _find_mixer_element(track_element, relative_path: str):
    # Prefer the track mixer path; fall back to legacy direct lookup.
    # NOTE: must use `is not None` — XML elements with no children are falsy,
    # so `or` would incorrectly skip a found-but-empty element (e.g. <Manual Value="false"/>).
    result = track_element.find(f".//Mixer/{relative_path}")
    if result is not None:
        return result
    result = track_element.find(f".//DeviceChain/Mixer/{relative_path}")
    if result is not None:
        return result
    return track_element.find(f".//{relative_path}")


def _find_mixer_elements(track_element, relative_path: str):
    """Return candidate matches in priority order for robust parameter reads."""
    selectors = [
        f".//Mixer/{relative_path}",
        f".//DeviceChain/Mixer/{relative_path}",
        f"./{relative_path}",
        f".//{relative_path}",
    ]

    seen = set()
    results = []

    for selector in selectors:
        for elem in track_element.findall(selector):
            elem_id = id(elem)
            if elem_id in seen:
                continue
            seen.add(elem_id)
            results.append(elem)

    return results


def _extract_bool_from_element(elem):
    if elem is None:
        return None

    for attr in ('Value', 'value', 'On', 'Enabled'):
        attr_value = elem.get(attr)
        if attr_value is not None:
            return _parse_bool(attr_value)

    manual = elem.find('./Manual')
    if manual is not None and manual.get('Value') is not None:
        return _parse_bool(manual.get('Value'))

    return None


def _extract_bool_from_paths(track_element, relative_paths, default: bool = False) -> bool:
    """
    Extract a boolean from a list of possible ALS paths.
    Handles both direct attributes (Value) and nested Manual Value forms.
    """
    bool_values = []

    for relative_path in relative_paths:
        for elem in _find_mixer_elements(track_element, relative_path):
            parsed_value = _extract_bool_from_element(elem)
            if parsed_value is not None:
                bool_values.append(parsed_value)

    if not bool_values:
        return default

    # If any candidate says true, treat as active.
    # This avoids false negatives when multiple bool nodes exist.
    return any(bool_values)


def open_als_xml(path: Path) -> ET.ElementTree:
    """Open an ALS file from disk (handles both gzipped and raw XML)."""
    try:
        with gzip.open(path, 'rb') as f:
            return ET.parse(f)
    except gzip.BadGzipFile:
        with open(path, 'rb') as f:
            return ET.parse(f)


def parse_als_from_string(xml_content: str) -> ET.ElementTree:
    """Parse ALS XML content from a string (already decompressed)."""
    root = ET.fromstring(xml_content)
    tree = ET.ElementTree(root)
    return tree

# print(test)

def als_inspect(tree: ET.ElementTree) -> Dict[str, int]:
    """
    Produce a rough frequency summary of XML element paths to guide schema mapping.
    Safe to run on any ALS without knowing its exact schema.
    """
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
                        
def parse_als_with_values(tree: ET.ElementTree):
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
    
def extract_midi_notes(tree: ET.ElementTree):
    
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

def count_notes_per_track(tree: ET.ElementTree):
    """Count the number of MIDI notes in each track."""
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

def extract_tempo(tree: ET.ElementTree):
    tempo_element = tree.find(".//Tempo/Manual")
    return float(tempo_element.get('Value')) if tempo_element is not None else 120.0

def get_device_info(device_element):
    """
    Resolve the device name and type.
    Returns a dict with 'name' and 'type'.
    """
    name = device_element.tag
    dev_type = "native"
    
    # Check for Plugin info
    # VST2
    vst = device_element.find(".//PluginDesc/VstPluginInfo/PlugName")
    if vst is not None and vst.get('Value'):
        name = vst.get('Value')
        dev_type = "vst2"
    
    # VST3
    vst3 = device_element.find(".//PluginDesc/Vst3PluginInfo/Name")
    if vst3 is not None and vst3.get('Value'):
        name = vst3.get('Value')
        dev_type = "vst3"

    # AU
    au = device_element.find(".//PluginDesc/AuPluginInfo/Name")
    if au is not None and au.get('Value'):
        name = au.get('Value')
        dev_type = "au"
        
    # Device active state (On/Manual = false means bypassed)
    on_manual = device_element.find('./On/Manual')
    active = _parse_bool(on_manual.get('Value'), default=True) if on_manual is not None else True

    return {'name': name, 'type': dev_type, 'active': active}

def get_device_name(device_element):
    return get_device_info(device_element)['name']


def get_clip_names(track_element):
    """
    Extract clips (Session and Arrangement) from the track.
    Returns a list of {name, color} dicts.
    """
    clip_names = []

    def _extract_name(node, index):
        # Direct Value attribute on Name element (Live 12+)
        name_elem = node.find('./Name')
        if name_elem is not None and name_elem.get('Value'):
            return name_elem.get('Value')
        # UserName child (older format)
        user = node.find('.//Name/UserName')
        if user is not None and user.get('Value'):
            return user.get('Value')
        # EffectiveName child (older format)
        eff = node.find('.//Name/EffectiveName')
        if eff is not None and eff.get('Value'):
            return eff.get('Value')
        # Fall back to positional label
        return f"Clip {index + 1}"

    def _extract_color(node):
        color_elem = node.find('./Color')
        if color_elem is not None and color_elem.get('Value') is not None:
            return int(color_elem.get('Value'))
        return None

    def _extract_length(node):
        # Use loop length (LoopEnd - LoopStart) — this is the unique musical content,
        # independent of how many times it repeats in the arrangement.
        loop_end = node.find('./Loop/LoopEnd')
        loop_start = node.find('./Loop/LoopStart')
        if loop_end is not None and loop_start is not None:
            length = _to_float(loop_end.get('Value'), default=0.0) - _to_float(loop_start.get('Value'), default=0.0)
            if length > 0:
                return length
        # Fallback to clip boundaries
        end = node.find('./CurrentEnd')
        start = node.find('./CurrentStart')
        if end is not None:
            return _to_float(end.get('Value'), default=0.0) - _to_float(start.get('Value') if start is not None else None, default=0.0)
        return 0.0

    def _extract_midi_notes(clip_node, clip_length):
        loop_start_elem = clip_node.find('./Loop/LoopStart')
        loop_start = _to_float(loop_start_elem.get('Value'), default=0.0) if loop_start_elem is not None else 0.0
        loop_end = loop_start + clip_length

        notes = []
        for key_track in clip_node.findall('.//KeyTrack'):
            midi_key = key_track.find('./MidiKey')
            if midi_key is None:
                continue
            pitch = int(midi_key.get('Value', 0))
            for note in key_track.findall('./Notes/MidiNoteEvent'):
                time = _to_float(note.get('Time'), default=0.0)
                if time < loop_start or time >= loop_end:
                    continue
                notes.append({
                    'pitch': pitch,
                    'time': time - loop_start,
                    'duration': _to_float(note.get('Duration'), default=0.25),
                    'velocity': int(note.get('Velocity', 100)),
                })
        return notes

    for i, clip in enumerate(track_element.findall(".//MidiClip") + track_element.findall(".//AudioClip")):
        is_midi = clip.tag == 'MidiClip'
        clip_length = _extract_length(clip)
        clip_names.append({
            'name': _extract_name(clip, i),
            'color': _extract_color(clip),
            'length': clip_length,
            'notes': _extract_midi_notes(clip, clip_length) if is_midi else [],
        })

    return clip_names

def extract_track_volume(track_element):
    """Extract the volume value from a track (in dB)."""
    volume_elem = _find_mixer_element(track_element, "Volume/Manual")
    gain_linear = _to_float(volume_elem.get('Value') if volume_elem is not None else None, default=1.0)
    db = _linear_gain_to_db(gain_linear)

    # Clamp to Ableton-like display floor used by UI.
    if db == float('-inf'):
        return -145.0
    return db

def extract_track_pan(track_element):
    """Extract the pan value from a track (Ableton UI-like -50 to 50)."""
    pan_elem = _find_mixer_element(track_element, "Pan/Manual")
    pan_raw = _to_float(pan_elem.get('Value') if pan_elem is not None else None, default=0.0)

    # Ableton pan is commonly stored as -1..1. The UI shows roughly -50..50 (L/R).
    if -1.0 <= pan_raw <= 1.0:
        return pan_raw * 50.0
    return pan_raw

def extract_track_solo(track_element):
    """Extract solo state from a track."""
    return _extract_bool_from_paths(
        track_element,
        [
            'SoloSink',
            'SoloSink/Manual',
            'Solo',
            'Solo/Manual',
            'TrackSolo',
            'TrackSolo/Manual',
        ],
        default=False,
    )

def extract_track_muted(track_element):
    """Extract muted/disabled state from a track."""
    # Ableton stores the mute (speaker) state in Speaker/Manual
    speaker_manual = _find_mixer_element(track_element, "Speaker/Manual")
    if speaker_manual is not None:
        return not _parse_bool(speaker_manual.get('Value'), default=True)

    # Fallback: On/Manual (track activator, older format)
    on_manual = _find_mixer_element(track_element, "On/Manual")
    if on_manual is not None:
        return not _parse_bool(on_manual.get('Value'), default=True)

    return False

def extract_track_armed(track_element):
    """Extract recording armed state from a track."""
    return _extract_bool_from_paths(
        track_element,
        [
            'Recorder/IsArmed',
            'IsArmed',
            'ArmedForRecording',
            'ArmedForRecording/Manual',
            'Arm',
            'Arm/Manual',
            'RecordArm',
            'RecordArm/Manual',
            'ExplicitArm',
            'ExplicitArm/Manual',
            'ImplicitArm',
            'ImplicitArm/Manual',
        ],
        default=False,
    )

def extract_track_sends(track_element):
    """Extract send levels to return tracks."""
    sends = {
        'sendA': 0.0,
        'sendB': 0.0,
        'sendC': 0.0,
        'sendD': 0.0
    }
    
    # Look for Sends container
    sends_container = _find_mixer_element(track_element, "Sends")
    if sends_container is not None:
        send_list = sends_container.findall(".//Send")
        for idx, send_elem in enumerate(send_list[:4]):  # Max 4 sends
            send_key = f'send{chr(65 + idx)}'  # sendA, sendB, sendC, sendD
            volume_elem = send_elem.find(".//Volume/Manual")
            if volume_elem is not None and volume_elem.get('Value'):
                try:
                    sends[send_key] = _linear_gain_to_db(float(volume_elem.get('Value')))
                except (ValueError, TypeError):
                    sends[send_key] = 0.0
    
    return sends

def extract_master_track_info(tree: ET.ElementTree):
    # Check for MainTrack (Live 12+) or MasterTrack (older versions)
    master_track = tree.find(".//MainTrack")
    if master_track is None:
        master_track = tree.find(".//MasterTrack")
    
    if master_track is None:
        return None
        
    devices = []
    # Note: Structure might be slightly deeper or different in newer versions
    # Debug output showed: Ableton/LiveSet/MainTrack/DeviceChain/DeviceChain/Devices/...
    
    # Try looking for Devices container recursively inside the master track
    devices_container = master_track.find(".//Devices")
    if devices_container is not None:
        for device in devices_container:
            devices.append(get_device_info(device))
    
    # Extract master track controls
    volume = extract_track_volume(master_track)
    pan = extract_track_pan(master_track)
    solo = extract_track_solo(master_track)
    muted = extract_track_muted(master_track)
    armed = extract_track_armed(master_track)
    sends = extract_track_sends(master_track)
            
    return {
        'type': 'Master',
        'devices': devices,
        'controls': {
            'volume': volume,
            'pan': pan,
            'solo': solo,
            'muted': muted,
            'armed': armed,
            'sends': sends
        }
    }

def extract_track_info(tree: ET.ElementTree):
    tracks = []
    
    # Check all track types: MidiTrack, AudioTrack, ReturnTrack
    for track_type in [".//MidiTrack", ".//AudioTrack", ".//ReturnTrack"]:
        for track in tree.findall(track_type):
            # Try UserName (custom name) first
            track_name_elem = track.find(".//Name/UserName")
            track_name_val = track_name_elem.get('Value') if track_name_elem is not None else ""

            # If UserName is empty, try EffectiveName (default/displayed name)
            if not track_name_val:
                effective_name_elem = track.find(".//Name/EffectiveName")
                if effective_name_elem is not None:
                    track_name_val = effective_name_elem.get('Value')

            devices = []
            # Find the main device chain. 
            # Instead of a fixed path, look for the first <Devices> element.
            # This is usually the track's main device chain.
            devices_container = track.find(".//Devices")
            if devices_container is not None:
                for device in devices_container:
                    devices.append(get_device_info(device))

            # Extract Clips
            clips = get_clip_names(track)
            
            # Extract track controls
            volume = extract_track_volume(track)
            pan = extract_track_pan(track)
            solo = extract_track_solo(track)
            muted = extract_track_muted(track)
            armed = extract_track_armed(track)
            sends = extract_track_sends(track)

            track_data = {
                'id': track.get('Id'),
                'name': track_name_val if track_name_val else 'Untitled',
                'type': track_type.split('/')[-1],  # Get track type name
                'color': track.find(".//Color").get('Value') if track.find(".//Color") is not None else None,
                'devices': devices,
                'clips': clips,
                'controls': {
                    'volume': volume,
                    'pan': pan,
                    'solo': solo,
                    'muted': muted,
                    'armed': armed,
                    'sends': sends
                }
            }

            tracks.append(track_data)
    
    return tracks

def extract_plugin_names(tree: ET.ElementTree):
    """
    Extract the names of all third-party plugins (VST/AU) used in the project.
    Returns a list of unique plugin names with their format and vendor.
    """
    plugins = []
    
    # Search in all track types including MainTrack/MasterTrack
    for track_type in [".//MidiTrack", ".//AudioTrack", ".//ReturnTrack", ".//MasterTrack", ".//MainTrack"]:
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
                    }
                
                # Check for VST3 plugin
                vst3_info = device.find(".//PluginDesc/Vst3PluginInfo")
                if vst3_info is not None:
                    plugin_name_elem = vst3_info.find("Name")
                    vendor_elem = vst3_info.find("Vendor")
                    
                    plugin_info = {
                        'name': plugin_name_elem.get('Value') if plugin_name_elem is not None else 'Unknown VST3',
                        'format': 'VST3',
                    }
                
                # Check for Audio Unit plugin
                au_info = device.find(".//PluginDesc/AuPluginInfo")
                if au_info is not None:
                    au_name_elem = au_info.find("Name")
                    manufacturer_elem = au_info.find("Manufacturer")
                    
                    plugin_info = {
                        'name': au_name_elem.get('Value') if au_name_elem is not None else 'Unknown AU',
                        'format': 'Audio Unit',
                    }
                
                # Add plugin if found
                if plugin_info:
                    # Check if we already have this plugin in the list
                    if not any(p['name'] == plugin_info['name'] and p['format'] == plugin_info['format'] 
                              for p in plugins):
                        plugins.append(plugin_info)
    
    return plugins

def parse_als_to_json(tree: ET.ElementTree, project_name: str = "Unknown") -> dict:
    """
    Parse an ALS ElementTree and return a dictionary with project data.
    """
    # Gather data
    tempo = extract_tempo(tree)
    master_info = extract_master_track_info(tree)
    raw_tracks = extract_track_info(tree)
    plugins = extract_plugin_names(tree)

    # Process tracks into categories
    midi_tracks = [t for t in raw_tracks if t['type'] == 'MidiTrack']
    audio_tracks = [t for t in raw_tracks if t['type'] == 'AudioTrack']
    return_tracks = [t for t in raw_tracks if t['type'] == 'ReturnTrack']

    # Build final dictionary
    project_data = {
        "project_name": project_name,
        "tempo": tempo,
        "tracks": {
            "master": master_info if master_info else {"type": "Master", "devices": []},
            "midi_tracks": midi_tracks,
            "audio_tracks": audio_tracks,
            "return_tracks": return_tracks
        },
        "third_party_vsts": plugins
    }

    return project_data


if __name__ == "__main__":
    project_name = "Unknown"

    if len(sys.argv) > 1:
        # File path provided as argument
        file_path = Path(sys.argv[1])
        project_name = file_path.name
        tree = open_als_xml(file_path)
    else:
        # Read from stdin (already decompressed XML from git show)
        xml_content = sys.stdin.read()
        tree = parse_als_from_string(xml_content)

    # Parse and output JSON
    project_data = parse_als_to_json(tree, project_name)
    print(json.dumps(project_data, indent=2))