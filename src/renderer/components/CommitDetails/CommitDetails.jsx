import { useProject } from '../../context/ProjectContext';
import { abletonColor, textOnColor } from '../../utils/abletonColors';

function DeviceTag({ device }) {
  const typeClass = device.type === 'native' ? 'device-native' : 'device-plugin';
  return (
    <span className={`device-tag ${typeClass}`}>
      {device.name}
    </span>
  );
}

const TRACK_TYPE_LABEL = {
  MidiTrack: 'MIDI',
  AudioTrack: 'Audio',
  ReturnTrack: 'Return',
};

function TrackRow({ track }) {
  const typeLabel = TRACK_TYPE_LABEL[track.type] ?? 'Track';
  const color = abletonColor(track.color);
  const textStyle = textOnColor(color);
  const textColor = textStyle === 'dark' ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.88)';
  const subTextColor = textStyle === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)';

  return (
    <div className="track-row">
      <div className="track-row-main">
        <div className="track-row-content">
          {track.devices?.length > 0 && (
            <div className="track-devices">
              {track.devices.map((d, i) => (
                <DeviceTag key={i} device={d} />
              ))}
            </div>
          )}
          {track.clips?.length > 0 && (
            <div className="track-clips">
              {track.clips.map((clip, i) => (
                <span key={i} className="track-clip-block" style={{ background: color, borderColor: 'rgba(0,0,0,0.25)' }}>
                  <span className="track-clip-name" style={{ color: textColor }}>{clip}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="track-label-block" style={{ background: color }}>
          <span className="track-label-name" style={{ color: textColor }}>{track.name}</span>
          <span className="track-label-type" style={{ color: subTextColor }}>{typeLabel}</span>
        </div>
      </div>
    </div>
  );
}

export function CommitDetails() {
  const { selectedCommit, commits, parsedData, isLoading, restoreVersion } = useProject();

  const commit = commits.find((c) => c.hash === selectedCommit);

  if (!commit) {
    return (
      <div className="commit-details">
        <div className="commit-details-empty">
          <p>Select a commit to view details</p>
        </div>
      </div>
    );
  }

  const allTracks = parsedData
    ? [
        ...(parsedData.tracks?.midi_tracks || []),
        ...(parsedData.tracks?.audio_tracks || []),
        ...(parsedData.tracks?.return_tracks || []),
      ].filter((t) => t.clips?.length > 0)
    : [];

  const masterDevices = parsedData?.tracks?.master?.devices || [];

  return (
    <div className="commit-details">
      <div className="commit-details-header">
        <h2 className="commit-details-title">{commit.message}</h2>
        <div className="commit-details-info">
          <div className="commit-details-avatar">
            {commit.author?.charAt(0).toUpperCase()}
          </div>
          <span className="commit-details-author">{commit.author}</span>
          <span className="commit-details-hash">{commit.shortHash}</span>
        </div>
      </div>

      <div className="commit-details-diff">
        {isLoading ? (
          <div className="parsed-loading">Parsing project data...</div>
        ) : !parsedData ? (
          <div className="diff-placeholder">
            <p>No parsed data available for this commit</p>
          </div>
        ) : (
          <div className="parsed-data">
            <div className="parsed-section parsed-overview">
              <div className="parsed-overview-item">
                <span className="parsed-overview-label">Project</span>
                <span className="parsed-overview-value">{parsedData.project_name}</span>
              </div>
              <div className="parsed-overview-item">
                <span className="parsed-overview-label">Tempo</span>
                <span className="parsed-overview-value">{parsedData.tempo} BPM</span>
              </div>
              <div className="parsed-overview-item">
                <span className="parsed-overview-label">Tracks</span>
                <span className="parsed-overview-value">{allTracks.length}</span>
              </div>
              {parsedData.third_party_vsts?.length > 0 && (
                <div className="parsed-overview-item">
                  <span className="parsed-overview-label">Plugins</span>
                  <span className="parsed-overview-value">{parsedData.third_party_vsts.length}</span>
                </div>
              )}
              <div className="revert-button">
                <button onClick={() => restoreVersion(selectedCommit)} disabled={isLoading}>
                  Revert
                </button>
              </div>
            </div>

            {masterDevices.length > 0 && (
              <div className="parsed-section">
                <div className="parsed-section-title">Master</div>
                <div className="track-devices">
                  {masterDevices.map((d, i) => (
                    <DeviceTag key={i} device={d} />
                  ))}
                </div>
              </div>
            )}

            <div className="parsed-section">
              <div className="parsed-section-title">
                Tracks ({allTracks.length})
              </div>
              <div className="track-list">
                {allTracks.map((track, i) => (
                  <TrackRow key={i} track={track} />
                ))}
              </div>
            </div>

            {parsedData.third_party_vsts?.length > 0 && (
              <div className="parsed-section">
                <div className="parsed-section-title">
                  Third-Party Plugins ({parsedData.third_party_vsts.length})
                </div>
                <div className="plugin-list">
                  {parsedData.third_party_vsts.map((vst, i) => (
                    <div key={i} className="plugin-row">
                      <span className="plugin-name">{vst.name}</span>
                      <span className="plugin-format">{vst.format}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
