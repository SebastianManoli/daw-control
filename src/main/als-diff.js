function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function countValues(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function subtractCounts(nextCounts, prevCounts) {
  const result = [];
  Object.entries(nextCounts).forEach(([value, count]) => {
    const prevCount = prevCounts[value] || 0;
    const diff = count - prevCount;
    for (let index = 0; index < diff; index += 1) {
      result.push(value);
    }
  });
  return result;
}

function diffValueLists(beforeValues, afterValues) {
  const beforeCounts = countValues(beforeValues);
  const afterCounts = countValues(afterValues);

  return {
    added: subtractCounts(afterCounts, beforeCounts),
    removed: subtractCounts(beforeCounts, afterCounts),
  };
}

function buildTrackMap(projectData) {
  const allTracks = [
    ...toArray(projectData?.tracks?.midi_tracks),
    ...toArray(projectData?.tracks?.audio_tracks),
    ...toArray(projectData?.tracks?.return_tracks),
  ];

  const map = new Map();
  const seen = {};

  allTracks.forEach((track) => {
    const id = track?.id;
    if (id != null) {
      // Use stable Ableton track ID as key
      map.set(String(id), track);
    } else {
      // Fallback for tracks without IDs
      const type = track?.type || 'Track';
      const name = track?.name || 'Untitled';
      const baseKey = `${type}::${name}`;
      seen[baseKey] = (seen[baseKey] || 0) + 1;
      map.set(`${baseKey}#${seen[baseKey]}`, track);
    }
  });

  return map;
}

function formatTrack(track) {
  const trackType = track?.type === 'MidiTrack'
    ? 'MIDI'
    : track?.type === 'AudioTrack'
      ? 'Audio'
      : track?.type === 'ReturnTrack'
        ? 'Return'
        : 'Track';
  const name = track?.name || 'Untitled';
  return `${trackType} track "${name}"`;
}

function deviceName(device) {
  return device?.name || 'Unknown Device';
}

function pluginName(plugin) {
  const name = plugin?.name || 'Unknown Plugin';
  const format = plugin?.format ? ` (${plugin.format})` : '';
  return `${name}${format}`;
}

function createSection(kind, title) {
  return { kind, title, items: [] };
}

function addItem(section, item) {
  section.items.push(item);
}

function buildAlsDiff(beforeData, afterData) {
  const addedSection = createSection('added', 'Added');
  const removedSection = createSection('removed', 'Removed');
  const modifiedSection = createSection('modified', 'Modified');

  // Non-track flat items go directly into modifiedSection
  const beforeTempo = beforeData?.tempo;
  const afterTempo = afterData?.tempo;
  if (typeof beforeTempo === 'number' && typeof afterTempo === 'number' && beforeTempo !== afterTempo) {
    addItem(modifiedSection, {
      label: 'Tempo',
      before: `${beforeTempo} BPM`,
      after: `${afterTempo} BPM`,
    });
  }

  const beforeTracks = buildTrackMap(beforeData);
  const afterTracks = buildTrackMap(afterData);

  for (const [key, track] of afterTracks.entries()) {
    if (!beforeTracks.has(key)) {
      addItem(addedSection, { label: 'Track', detail: formatTrack(track) });
    }
  }

  for (const [key, track] of beforeTracks.entries()) {
    if (!afterTracks.has(key)) {
      addItem(removedSection, { label: 'Track', detail: formatTrack(track) });
    }
  }

  // Accumulate per-track changes into a grouped map: key -> { label, subItems[] }
  const trackChanges = new Map();

  function addTrackChange(key, label, subItem) {
    if (!trackChanges.has(key)) {
      trackChanges.set(key, { label, subItems: [] });
    }
    trackChanges.get(key).subItems.push(subItem);
  }

  for (const [key, beforeTrack] of beforeTracks.entries()) {
    const afterTrack = afterTracks.get(key);
    if (!afterTrack) continue;

    const label = formatTrack(afterTrack);

    if (beforeTrack?.name && afterTrack?.name && beforeTrack.name !== afterTrack.name) {
      addTrackChange(key, label, { detail: 'Renamed', before: beforeTrack.name, after: afterTrack.name });
    }

    if (beforeTrack?.color && afterTrack?.color && beforeTrack.color !== afterTrack.color) {
      addTrackChange(key, label, { detail: 'Color changed' });
    }

    const beforeDevices = toArray(beforeTrack?.devices).map(deviceName);
    const afterDevices = toArray(afterTrack?.devices).map(deviceName);
    const devicesDiff = diffValueLists(beforeDevices, afterDevices);

    devicesDiff.added.forEach((name) => addTrackChange(key, label, { detail: `Device added: ${name}` }));
    devicesDiff.removed.forEach((name) => addTrackChange(key, label, { detail: `Device removed: ${name}` }));

    const beforeClips = toArray(beforeTrack?.clips);
    const afterClips = toArray(afterTrack?.clips);
    const clipsDiff = diffValueLists(beforeClips, afterClips);

    clipsDiff.added.forEach((clipName) => addTrackChange(key, label, { detail: `Clip added: ${clipName}` }));
    clipsDiff.removed.forEach((clipName) => addTrackChange(key, label, { detail: `Clip removed: ${clipName}` }));
  }

  // Master track — also grouped
  const beforeMasterDevices = toArray(beforeData?.tracks?.master?.devices).map(deviceName);
  const afterMasterDevices = toArray(afterData?.tracks?.master?.devices).map(deviceName);
  const masterDiff = diffValueLists(beforeMasterDevices, afterMasterDevices);

  masterDiff.added.forEach((name) => addTrackChange('__master__', 'Master', { detail: `Device added: ${name}` }));
  masterDiff.removed.forEach((name) => addTrackChange('__master__', 'Master', { detail: `Device removed: ${name}` }));

  // Flush grouped track changes into modifiedSection
  for (const group of trackChanges.values()) {
    addItem(modifiedSection, group);
  }

  const beforePlugins = toArray(beforeData?.third_party_vsts).map(pluginName);
  const afterPlugins = toArray(afterData?.third_party_vsts).map(pluginName);
  const pluginsDiff = diffValueLists(beforePlugins, afterPlugins);

  pluginsDiff.added.forEach((plugin) => addItem(addedSection, { label: 'Plugin', detail: plugin }));
  pluginsDiff.removed.forEach((plugin) => addItem(removedSection, { label: 'Plugin', detail: plugin }));

  const sections = [addedSection, removedSection, modifiedSection].filter((section) => section.items.length > 0);

  return {
    summary: {
      added: addedSection.items.length,
      removed: removedSection.items.length,
      modified: modifiedSection.items.length,
      total: addedSection.items.length + removedSection.items.length + modifiedSection.items.length,
    },
    sections,
  };
}

module.exports = { buildAlsDiff };
