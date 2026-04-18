"""Unit tests for als_parser.py targeting ~60% coverage."""

import gzip
import math
import os
import sys
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'parser'))

from als_parser import (
    _parse_bool,
    _to_float,
    _linear_gain_to_db,
    open_als_xml,
    parse_als_from_string,
    extract_tempo,
    get_device_info,
    get_clip_names,
    extract_track_volume,
    extract_track_pan,
    extract_track_muted,
    extract_track_armed,
    extract_track_solo,
    extract_track_info,
    extract_master_track_info,
    parse_als_to_json,
)

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

SIMPLE_PROJECT = """<Ableton>
  <LiveSet>
    <Tempo><Manual Value="140.0" /></Tempo>
    <Tracks>
      <MidiTrack Id="1">
        <Name><UserName Value="Drums" /><EffectiveName Value="Drums" /></Name>
        <Color Value="5" />
        <DeviceChain>
          <Mixer>
            <Volume><Manual Value="0.85" /></Volume>
            <Pan><Manual Value="-0.5" /></Pan>
            <Speaker><Manual Value="true" /></Speaker>
          </Mixer>
          <DeviceChain><Devices>
            <Operator Id="0"><On><Manual Value="true" /></On></Operator>
          </Devices></DeviceChain>
        </DeviceChain>
        <MidiClip>
          <Name Value="Kick Loop" />
          <Color Value="3" />
          <Loop><LoopStart Value="0.0" /><LoopEnd Value="4.0" /></Loop>
          <Notes><KeyTracks><KeyTrack>
            <MidiKey Value="36" />
            <Notes>
              <MidiNoteEvent Time="0.0" Duration="0.25" Velocity="100" IsDisabled="false" />
              <MidiNoteEvent Time="2.0" Duration="0.25" Velocity="80"  IsDisabled="false" />
            </Notes>
          </KeyTrack></KeyTracks></Notes>
        </MidiClip>
      </MidiTrack>
      <AudioTrack Id="2">
        <Name><UserName Value="Guitar" /><EffectiveName Value="Guitar" /></Name>
        <Color Value="7" />
        <DeviceChain>
          <Mixer>
            <Volume><Manual Value="0.7" /></Volume>
            <Pan><Manual Value="0.0" /></Pan>
            <Speaker><Manual Value="false" /></Speaker>
          </Mixer>
          <DeviceChain><Devices /></DeviceChain>
        </DeviceChain>
        <AudioClip>
          <Name Value="Riff" />
          <Color Value="2" />
          <Loop><LoopStart Value="0.0" /><LoopEnd Value="8.0" /></Loop>
        </AudioClip>
      </AudioTrack>
      <ReturnTrack Id="3">
        <Name><UserName Value="Reverb" /><EffectiveName Value="Reverb" /></Name>
        <Color Value="1" />
        <DeviceChain>
          <Mixer>
            <Volume><Manual Value="1.0" /></Volume>
            <Pan><Manual Value="0.0" /></Pan>
            <Speaker><Manual Value="true" /></Speaker>
          </Mixer>
          <DeviceChain><Devices /></DeviceChain>
        </DeviceChain>
      </ReturnTrack>
    </Tracks>
    <MainTrack>
      <DeviceChain>
        <Mixer>
          <Volume><Manual Value="1.0" /></Volume>
          <Pan><Manual Value="0.0" /></Pan>
          <Speaker><Manual Value="true" /></Speaker>
        </Mixer>
        <DeviceChain><Devices /></DeviceChain>
      </DeviceChain>
    </MainTrack>
  </LiveSet>
</Ableton>"""

EMPTY_PROJECT = "<Ableton><LiveSet><Tracks /></LiveSet></Ableton>"


def _tree(xml: str) -> ET.ElementTree:
    return parse_als_from_string(xml)


def _track_elem(inner: str, tag: str = "MidiTrack") -> ET.Element:
    return ET.fromstring(f"<{tag}>{inner}</{tag}>")


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

class TestParseBool(unittest.TestCase):
    def test_true_values(self):
        for v in ("true", "1", "yes", "on"):
            self.assertTrue(_parse_bool(v), v)

    def test_false_values(self):
        for v in ("false", "0", "no", "off"):
            self.assertFalse(_parse_bool(v), v)

    def test_none_uses_default(self):
        self.assertFalse(_parse_bool(None))
        self.assertTrue(_parse_bool(None, default=True))


class TestToFloat(unittest.TestCase):
    def test_valid(self):
        self.assertAlmostEqual(_to_float("3.14"), 3.14)

    def test_none_returns_default(self):
        self.assertAlmostEqual(_to_float(None, default=5.0), 5.0)

    def test_invalid_returns_default(self):
        self.assertAlmostEqual(_to_float("bad"), 0.0)


class TestLinearGainToDb(unittest.TestCase):
    def test_unity_is_0db(self):
        self.assertAlmostEqual(_linear_gain_to_db(1.0), 0.0, places=5)

    def test_zero_is_neg_inf(self):
        self.assertEqual(_linear_gain_to_db(0.0), float("-inf"))

    def test_known_value(self):
        self.assertAlmostEqual(_linear_gain_to_db(0.5), 20 * math.log10(0.5), places=5)


# ---------------------------------------------------------------------------
# File opening
# ---------------------------------------------------------------------------

class TestOpenAlsXml(unittest.TestCase):
    def test_raw_xml_file(self):
        with tempfile.NamedTemporaryFile(suffix=".als", delete=False, mode="wb") as f:
            f.write(SIMPLE_PROJECT.encode())
            tmp = f.name
        try:
            tree = open_als_xml(Path(tmp))
            self.assertEqual(tree.getroot().tag, "Ableton")
        finally:
            os.unlink(tmp)

    def test_gzipped_file(self):
        with tempfile.NamedTemporaryFile(suffix=".als", delete=False) as f:
            tmp = f.name
        try:
            with gzip.open(tmp, "wb") as gz:
                gz.write(SIMPLE_PROJECT.encode())
            tree = open_als_xml(Path(tmp))
            self.assertEqual(tree.getroot().tag, "Ableton")
        finally:
            os.unlink(tmp)


# ---------------------------------------------------------------------------
# Tempo
# ---------------------------------------------------------------------------

class TestExtractTempo(unittest.TestCase):
    def test_reads_value(self):
        self.assertAlmostEqual(extract_tempo(_tree(SIMPLE_PROJECT)), 140.0)

    def test_missing_defaults_to_120(self):
        self.assertAlmostEqual(extract_tempo(_tree(EMPTY_PROJECT)), 120.0)


# ---------------------------------------------------------------------------
# Device info
# ---------------------------------------------------------------------------

class TestGetDeviceInfo(unittest.TestCase):
    def test_native_device(self):
        elem = ET.fromstring("<Operator><On><Manual Value='true'/></On></Operator>")
        info = get_device_info(elem)
        self.assertEqual(info["type"], "native")
        self.assertTrue(info["active"])

    def test_bypassed_device(self):
        elem = ET.fromstring("<Operator><On><Manual Value='false'/></On></Operator>")
        self.assertFalse(get_device_info(elem)["active"])

    def test_vst2_plugin(self):
        elem = ET.fromstring("""<PluginDevice>
          <PluginDesc><VstPluginInfo><PlugName Value="Serum"/></VstPluginInfo></PluginDesc>
          <On><Manual Value="true"/></On>
        </PluginDevice>""")
        info = get_device_info(elem)
        self.assertEqual(info["name"], "Serum")
        self.assertEqual(info["type"], "vst2")

    def test_vst3_plugin(self):
        elem = ET.fromstring("""<PluginDevice>
          <PluginDesc><Vst3PluginInfo><Name Value="Vital"/></Vst3PluginInfo></PluginDesc>
          <On><Manual Value="true"/></On>
        </PluginDevice>""")
        self.assertEqual(get_device_info(elem)["type"], "vst3")

    def test_au_plugin(self):
        elem = ET.fromstring("""<PluginDevice>
          <PluginDesc><AuPluginInfo><Name Value="SilverVerb"/></AuPluginInfo></PluginDesc>
          <On><Manual Value="true"/></On>
        </PluginDevice>""")
        self.assertEqual(get_device_info(elem)["type"], "au")


# ---------------------------------------------------------------------------
# Clip extraction
# ---------------------------------------------------------------------------

class TestGetClipNames(unittest.TestCase):
    def _midi_track(self, name="Beat", loop_end=4.0):
        return ET.fromstring(f"""<MidiTrack>
          <MidiClip>
            <Name Value="{name}"/>
            <Color Value="3"/>
            <Loop><LoopStart Value="0.0"/><LoopEnd Value="{loop_end}"/></Loop>
            <Notes><KeyTracks><KeyTrack>
              <MidiKey Value="60"/>
              <Notes><MidiNoteEvent Time="0.0" Duration="0.25" Velocity="100" IsDisabled="false"/></Notes>
            </KeyTrack></KeyTracks></Notes>
          </MidiClip>
        </MidiTrack>""")

    def test_name_and_length(self):
        clips = get_clip_names(self._midi_track("Beat", 4.0))
        self.assertEqual(clips[0]["name"], "Beat")
        self.assertAlmostEqual(clips[0]["length"], 4.0)

    def test_midi_notes_extracted(self):
        clips = get_clip_names(self._midi_track())
        self.assertEqual(len(clips[0]["notes"]), 1)
        self.assertEqual(clips[0]["notes"][0]["pitch"], 60)

    def test_audio_clip_has_no_notes(self):
        track = ET.fromstring("""<AudioTrack>
          <AudioClip>
            <Name Value="Sample"/>
            <Loop><LoopStart Value="0.0"/><LoopEnd Value="4.0"/></Loop>
          </AudioClip>
        </AudioTrack>""")
        self.assertEqual(get_clip_names(track)[0]["notes"], [])

    def test_no_clips_returns_empty(self):
        self.assertEqual(get_clip_names(ET.fromstring("<MidiTrack/>")), [])

    def test_fallback_label(self):
        track = ET.fromstring("""<MidiTrack>
          <MidiClip><Loop><LoopStart Value="0.0"/><LoopEnd Value="2.0"/></Loop></MidiClip>
        </MidiTrack>""")
        self.assertEqual(get_clip_names(track)[0]["name"], "Clip 1")


# ---------------------------------------------------------------------------
# Mixer parameters
# ---------------------------------------------------------------------------

class TestMixerParams(unittest.TestCase):
    def test_volume_unity_is_0db(self):
        t = _track_elem("<Mixer><Volume><Manual Value='1.0'/></Volume></Mixer>")
        self.assertAlmostEqual(extract_track_volume(t), 0.0, places=4)

    def test_volume_zero_clamps(self):
        t = _track_elem("<Mixer><Volume><Manual Value='0.0'/></Volume></Mixer>")
        self.assertEqual(extract_track_volume(t), -145.0)

    def test_pan_center(self):
        t = _track_elem("<Mixer><Pan><Manual Value='0.0'/></Pan></Mixer>")
        self.assertAlmostEqual(extract_track_pan(t), 0.0)

    def test_pan_full_left(self):
        t = _track_elem("<Mixer><Pan><Manual Value='-1.0'/></Pan></Mixer>")
        self.assertAlmostEqual(extract_track_pan(t), -50.0)

    def test_muted_when_speaker_off(self):
        t = _track_elem("<Mixer><Speaker><Manual Value='false'/></Speaker></Mixer>")
        self.assertTrue(extract_track_muted(t))

    def test_not_muted_when_speaker_on(self):
        t = _track_elem("<Mixer><Speaker><Manual Value='true'/></Speaker></Mixer>")
        self.assertFalse(extract_track_muted(t))

    def test_armed_via_recorder(self):
        t = _track_elem("<Recorder><IsArmed Value='true'/></Recorder>")
        self.assertTrue(extract_track_armed(t))

    def test_not_armed_by_default(self):
        self.assertFalse(extract_track_armed(ET.fromstring("<MidiTrack/>")))

    def test_solo_true(self):
        t = _track_elem("<Mixer><SoloSink><Manual Value='true'/></SoloSink></Mixer>")
        self.assertTrue(extract_track_solo(t))

    def test_solo_false_by_default(self):
        self.assertFalse(extract_track_solo(ET.fromstring("<MidiTrack/>")))


# ---------------------------------------------------------------------------
# Track info
# ---------------------------------------------------------------------------

class TestExtractTrackInfo(unittest.TestCase):
    def test_all_track_types_returned(self):
        tracks = extract_track_info(_tree(SIMPLE_PROJECT))
        types = {t["type"] for t in tracks}
        self.assertIn("MidiTrack", types)
        self.assertIn("AudioTrack", types)
        self.assertIn("ReturnTrack", types)

    def test_track_names(self):
        names = {t["name"] for t in extract_track_info(_tree(SIMPLE_PROJECT))}
        self.assertIn("Drums", names)
        self.assertIn("Guitar", names)

    def test_controls_keys_present(self):
        for track in extract_track_info(_tree(SIMPLE_PROJECT)):
            for key in ("volume", "pan", "muted", "armed", "solo"):
                self.assertIn(key, track["controls"])

    def test_midi_track_has_clips(self):
        tracks = extract_track_info(_tree(SIMPLE_PROJECT))
        drums = next(t for t in tracks if t["name"] == "Drums")
        self.assertEqual(drums["clips"][0]["name"], "Kick Loop")

    def test_empty_project_returns_empty(self):
        self.assertEqual(extract_track_info(_tree(EMPTY_PROJECT)), [])


# ---------------------------------------------------------------------------
# Master track
# ---------------------------------------------------------------------------

class TestExtractMasterTrackInfo(unittest.TestCase):
    def test_master_present(self):
        master = extract_master_track_info(_tree(SIMPLE_PROJECT))
        self.assertIsNotNone(master)
        self.assertEqual(master["type"], "Master")

    def test_missing_returns_none(self):
        self.assertIsNone(extract_master_track_info(_tree(EMPTY_PROJECT)))

    def test_legacy_master_track_tag(self):
        xml = """<Ableton><LiveSet>
          <MasterTrack>
            <DeviceChain>
              <Mixer>
                <Volume><Manual Value="1.0"/></Volume>
                <Pan><Manual Value="0.0"/></Pan>
                <Speaker><Manual Value="true"/></Speaker>
              </Mixer>
              <DeviceChain><Devices/></DeviceChain>
            </DeviceChain>
          </MasterTrack>
        </LiveSet></Ableton>"""
        self.assertIsNotNone(extract_master_track_info(_tree(xml)))


# ---------------------------------------------------------------------------
# Integration: parse_als_to_json
# ---------------------------------------------------------------------------

class TestParseAlsToJson(unittest.TestCase):
    def test_required_top_level_keys(self):
        result = parse_als_to_json(_tree(SIMPLE_PROJECT), "MyProject")
        for key in ("project_name", "tempo", "tracks", "third_party_vsts"):
            self.assertIn(key, result)

    def test_tempo_and_name(self):
        result = parse_als_to_json(_tree(SIMPLE_PROJECT), "Test")
        self.assertEqual(result["project_name"], "Test")
        self.assertAlmostEqual(result["tempo"], 140.0)

    def test_track_counts(self):
        result = parse_als_to_json(_tree(SIMPLE_PROJECT), "Test")
        self.assertEqual(len(result["tracks"]["midi_tracks"]), 1)
        self.assertEqual(len(result["tracks"]["audio_tracks"]), 1)
        self.assertEqual(len(result["tracks"]["return_tracks"]), 1)

    def test_empty_project(self):
        result = parse_als_to_json(_tree(EMPTY_PROJECT), "Empty")
        self.assertEqual(result["tracks"]["midi_tracks"], [])


if __name__ == "__main__":
    unittest.main()
