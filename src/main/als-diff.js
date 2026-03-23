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

function clipName(clip) {
  if (typeof clip === 'object') return clip?.name || 'Unknown Clip';
  return clip || 'Unknown Clip';
}

function normalizeTrackType(trackType) {
  if (trackType === 'MidiTrack') return 'MidiTrack';
  if (trackType === 'AudioTrack') return 'AudioTrack';
  if (trackType === 'ReturnTrack') return 'ReturnTrack';
  return 'Track';
}

function buildTrackEntity(track) {
  return {
    name: track?.name || 'Untitled',
    type: normalizeTrackType(track?.type),
    color: track?.color,
  };
}

function buildDeviceEntity(device, fallbackName) {
  return {
    name: device?.name || fallbackName || 'Unknown Device',
    type: device?.type || 'plugin',
    active: device?.active !== false && device?.enabled !== false,
  };
}

function buildClipEntity(clip, fallbackName) {
  if (typeof clip === 'object') {
    return {
      name: clip?.name || fallbackName || 'Unknown Clip',
      color: clip?.color,
    };
  }

  return {
    name: clip || fallbackName || 'Unknown Clip',
  };
}

function formatVolumeValue(db) {
  if (db === -Infinity || db <= -145) return '-∞ dB';
  if (Math.abs(db) < 0.05) return '0 dB';
  return `${db.toFixed(1)} dB`;
}

function formatPanValue(pan) {
  if (Math.abs(pan) < 1) return 'C';
  const side = pan < 0 ? 'L' : 'R';
  return `${Math.abs(pan).toFixed(0)}${side}`;
}

function asBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
  }
  return false;
}

function buildTrackLifecycleSubItems(track, action) {
  const lifecycleSubItems = [];

  const deviceItems = toArray(track?.devices);
  if (deviceItems.length > 1) {
    const deviceEntities = deviceItems.map((device) => buildDeviceEntity(device, deviceName(device)));
    lifecycleSubItems.push({
      detail: `Devices ${action}: ${deviceEntities.map((device) => device.name).join(', ')}`,
      entityType: 'deviceList',
      action,
      entities: deviceEntities,
    });
  } else {
    deviceItems.forEach((device) => {
      const name = deviceName(device);
      lifecycleSubItems.push({
        detail: `Device ${action}: ${name}`,
        entityType: 'device',
        action,
        entity: buildDeviceEntity(device, name),
      });
    });
  }

  const clipItems = toArray(track?.clips);
  if (clipItems.length > 1) {
    const clipEntities = clipItems.map((clip) => buildClipEntity(clip, clipName(clip)));
    lifecycleSubItems.push({
      detail: `Clips ${action}: ${clipEntities.map((clip) => clip.name).join(', ')}`,
      entityType: 'clipList',
      action,
      entities: clipEntities,
    });
  } else {
    clipItems.forEach((clip) => {
      const name = clipName(clip);
      lifecycleSubItems.push({
        detail: `Clip ${action}: ${name}`,
        entityType: 'clip',
        action,
        entity: buildClipEntity(clip, name),
      });
    });
  }

  return lifecycleSubItems;
}

function createEntityPicker(items, getKey) {
  const buckets = new Map();

  toArray(items).forEach((item) => {
    const key = getKey(item);
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(item);
  });

  return {
    pick(key) {
      const bucket = buckets.get(key);
      if (!bucket || bucket.length === 0) return null;
      return bucket.shift();
    },
  };
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
      const trackEntity = buildTrackEntity(track);
      addItem(addedSection, {
        label: 'Track',
        detail: formatTrack(track),
        entityType: 'track',
        action: 'added',
        entity: trackEntity,
        subItems: buildTrackLifecycleSubItems(track, 'added'),
      });
    }
  }

  for (const [key, track] of beforeTracks.entries()) {
    if (!afterTracks.has(key)) {
      const trackEntity = buildTrackEntity(track);
      addItem(removedSection, {
        label: 'Track',
        detail: formatTrack(track),
        entityType: 'track',
        action: 'removed',
        entity: trackEntity,
        subItems: buildTrackLifecycleSubItems(track, 'removed'),
      });
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
      addTrackChange(key, label, {
        detail: 'Renamed',
        before: beforeTrack.name,
        after: afterTrack.name,
        entityType: 'trackProperty',
        action: 'changed',
        property: 'name',
      });
    }

    if (beforeTrack?.color != null && afterTrack?.color != null && beforeTrack.color !== afterTrack.color) {
      addTrackChange(key, label, {
        detail: 'Color changed',
        before: `Color ${beforeTrack.color}`,
        after: `Color ${afterTrack.color}`,
        entityType: 'trackProperty',
        action: 'changed',
        property: 'color',
        entity: {
          before: beforeTrack.color,
          after: afterTrack.color,
        },
      });
    }

    const beforeControls = beforeTrack?.controls || {};
    const afterControls = afterTrack?.controls || {};

    if (typeof beforeControls.volume === 'number' && typeof afterControls.volume === 'number' && Math.abs(beforeControls.volume - afterControls.volume) >= 0.05) {
      addTrackChange(key, label, {
        detail: 'Volume changed',
        before: formatVolumeValue(beforeControls.volume),
        after: formatVolumeValue(afterControls.volume),
        entityType: 'trackControl',
        action: 'changed',
        property: 'volume',
      });
    }

    if (typeof beforeControls.pan === 'number' && typeof afterControls.pan === 'number' && Math.abs(beforeControls.pan - afterControls.pan) >= 0.5) {
      addTrackChange(key, label, {
        detail: 'Pan changed',
        before: formatPanValue(beforeControls.pan),
        after: formatPanValue(afterControls.pan),
        entityType: 'trackControl',
        action: 'changed',
        property: 'pan',
      });
    }

    const beforeSolo = asBoolean(beforeControls.solo);
    const afterSolo = asBoolean(afterControls.solo);
    if (beforeSolo !== afterSolo) {
      addTrackChange(key, label, {
        detail: 'Solo changed',
        before: beforeSolo ? 'On' : 'Off',
        after: afterSolo ? 'On' : 'Off',
        entityType: 'trackControl',
        action: 'changed',
        property: 'solo',
      });
    }

    const beforeMuted = asBoolean(beforeControls.muted);
    const afterMuted = asBoolean(afterControls.muted);
    if (beforeMuted !== afterMuted) {
      addTrackChange(key, label, {
        detail: 'Mute changed',
        before: beforeMuted ? 'On' : 'Off',
        after: afterMuted ? 'On' : 'Off',
        entityType: 'trackControl',
        action: 'changed',
        property: 'mute',
      });
    }

    const beforeArmed = asBoolean(beforeControls.armed);
    const afterArmed = asBoolean(afterControls.armed);
    if (beforeArmed !== afterArmed) {
      addTrackChange(key, label, {
        detail: 'Arm changed',
        before: beforeArmed ? 'On' : 'Off',
        after: afterArmed ? 'On' : 'Off',
        entityType: 'trackControl',
        action: 'changed',
        property: 'arm',
      });
    }

    const beforeDeviceItems = toArray(beforeTrack?.devices);
    const afterDeviceItems = toArray(afterTrack?.devices);
    const beforeDevices = beforeDeviceItems.map(deviceName);
    const afterDevices = afterDeviceItems.map(deviceName);
    const devicesDiff = diffValueLists(beforeDevices, afterDevices);
    const pickBeforeDevice = createEntityPicker(beforeDeviceItems, deviceName);
    const pickAfterDevice = createEntityPicker(afterDeviceItems, deviceName);

    if (devicesDiff.added.length > 1) {
      const deviceEntities = devicesDiff.added.map((name) => {
        const device = pickAfterDevice.pick(name);
        return buildDeviceEntity(device, name);
      });

      addTrackChange(key, label, {
        detail: `Devices added: ${deviceEntities.map((device) => device.name).join(', ')}`,
        entityType: 'deviceList',
        action: 'added',
        entities: deviceEntities,
      });
    } else {
      devicesDiff.added.forEach((name) => {
        const device = pickAfterDevice.pick(name);
        addTrackChange(key, label, {
          detail: `Device added: ${name}`,
          entityType: 'device',
          action: 'added',
          entity: buildDeviceEntity(device, name),
        });
      });
    }

    if (devicesDiff.removed.length > 1) {
      const deviceEntities = devicesDiff.removed.map((name) => {
        const device = pickBeforeDevice.pick(name);
        return buildDeviceEntity(device, name);
      });

      addTrackChange(key, label, {
        detail: `Devices removed: ${deviceEntities.map((device) => device.name).join(', ')}`,
        entityType: 'deviceList',
        action: 'removed',
        entities: deviceEntities,
      });
    } else {
      devicesDiff.removed.forEach((name) => {
        const device = pickBeforeDevice.pick(name);
        addTrackChange(key, label, {
          detail: `Device removed: ${name}`,
          entityType: 'device',
          action: 'removed',
          entity: buildDeviceEntity(device, name),
        });
      });
    }

    const beforeClipItems = toArray(beforeTrack?.clips);
    const afterClipItems = toArray(afterTrack?.clips);
    const beforeClips = beforeClipItems.map(clipName);
    const afterClips = afterClipItems.map(clipName);
    const clipsDiff = diffValueLists(beforeClips, afterClips);
    const pickBeforeClip = createEntityPicker(beforeClipItems, clipName);
    const pickAfterClip = createEntityPicker(afterClipItems, clipName);

    if (clipsDiff.added.length > 1) {
      const clipEntities = clipsDiff.added.map((clipLabel) => {
        const clip = pickAfterClip.pick(clipLabel);
        return buildClipEntity(clip, clipLabel);
      });

      addTrackChange(key, label, {
        detail: `Clips added: ${clipEntities.map((clip) => clip.name).join(', ')}`,
        entityType: 'clipList',
        action: 'added',
        entities: clipEntities,
      });
    } else {
      clipsDiff.added.forEach((clipLabel) => {
        const clip = pickAfterClip.pick(clipLabel);
        addTrackChange(key, label, {
          detail: `Clip added: ${clipLabel}`,
          entityType: 'clip',
          action: 'added',
          entity: buildClipEntity(clip, clipLabel),
        });
      });
    }

    if (clipsDiff.removed.length > 1) {
      const clipEntities = clipsDiff.removed.map((clipLabel) => {
        const clip = pickBeforeClip.pick(clipLabel);
        return buildClipEntity(clip, clipLabel);
      });

      addTrackChange(key, label, {
        detail: `Clips removed: ${clipEntities.map((clip) => clip.name).join(', ')}`,
        entityType: 'clipList',
        action: 'removed',
        entities: clipEntities,
      });
    } else {
      clipsDiff.removed.forEach((clipLabel) => {
        const clip = pickBeforeClip.pick(clipLabel);
        addTrackChange(key, label, {
          detail: `Clip removed: ${clipLabel}`,
          entityType: 'clip',
          action: 'removed',
          entity: buildClipEntity(clip, clipLabel),
        });
      });
    }
  }

  // Master track — also grouped
  const beforeMasterDeviceItems = toArray(beforeData?.tracks?.master?.devices);
  const afterMasterDeviceItems = toArray(afterData?.tracks?.master?.devices);
  const beforeMasterDevices = beforeMasterDeviceItems.map(deviceName);
  const afterMasterDevices = afterMasterDeviceItems.map(deviceName);
  const masterDiff = diffValueLists(beforeMasterDevices, afterMasterDevices);
  const pickBeforeMasterDevice = createEntityPicker(beforeMasterDeviceItems, deviceName);
  const pickAfterMasterDevice = createEntityPicker(afterMasterDeviceItems, deviceName);

  if (masterDiff.added.length > 1) {
    const deviceEntities = masterDiff.added.map((name) => {
      const device = pickAfterMasterDevice.pick(name);
      return buildDeviceEntity(device, name);
    });
    addTrackChange('__master__', 'Master', {
      detail: `Devices added: ${deviceEntities.map((device) => device.name).join(', ')}`,
      entityType: 'deviceList',
      action: 'added',
      entities: deviceEntities,
    });
  } else {
    masterDiff.added.forEach((name) => {
      const device = pickAfterMasterDevice.pick(name);
      addTrackChange('__master__', 'Master', {
        detail: `Device added: ${name}`,
        entityType: 'device',
        action: 'added',
        entity: buildDeviceEntity(device, name),
      });
    });
  }

  if (masterDiff.removed.length > 1) {
    const deviceEntities = masterDiff.removed.map((name) => {
      const device = pickBeforeMasterDevice.pick(name);
      return buildDeviceEntity(device, name);
    });
    addTrackChange('__master__', 'Master', {
      detail: `Devices removed: ${deviceEntities.map((device) => device.name).join(', ')}`,
      entityType: 'deviceList',
      action: 'removed',
      entities: deviceEntities,
    });
  } else {
    masterDiff.removed.forEach((name) => {
      const device = pickBeforeMasterDevice.pick(name);
      addTrackChange('__master__', 'Master', {
        detail: `Device removed: ${name}`,
        entityType: 'device',
        action: 'removed',
        entity: buildDeviceEntity(device, name),
      });
    });
  }

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
