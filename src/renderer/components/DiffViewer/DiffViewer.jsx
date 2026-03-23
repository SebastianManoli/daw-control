import { useProject } from '../../context/ProjectContext';
import { abletonColor, textOnColor } from '../../utils/abletonColors';
import { DeviceTag } from '../DeviceTag';

const TRACK_TYPE_LABEL = {
  MidiTrack: 'MIDI',
  AudioTrack: 'Audio',
  ReturnTrack: 'Return',
  Track: 'Track',
};

function actionLabel(action, entityType) {
  const verb = action === 'removed' ? 'removed' : action === 'changed' ? 'changed' : 'added';
  const noun = entityType === 'device'
    ? 'Device'
    : entityType === 'clip'
      ? 'Clip'
      : entityType === 'track'
        ? 'Track'
        : entityType === 'trackControl'
          ? 'Control'
          : entityType === 'trackProperty'
            ? 'Track'
        : 'Item';
  return `${noun} ${verb}:`;
}

function DiffTrackChip({ track }) {
  const color = abletonColor(track?.color);
  const textStyle = textOnColor(color);
  const textColor = textStyle === 'dark' ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.88)';
  const subTextColor = textStyle === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)';
  const typeLabel = TRACK_TYPE_LABEL[track?.type] ?? 'Track';

  return (
    <div className="diff-track-chip" style={{ background: color }}>
      <span className="diff-track-chip-name" style={{ color: textColor }}>
        {track?.name || 'Untitled'}
      </span>
      <span className="diff-track-chip-type" style={{ color: subTextColor }}>
        {typeLabel}
      </span>
    </div>
  );
}

function DiffClipChip({ clip }) {
  const clipColor = clip?.color != null ? abletonColor(clip.color) : 'var(--abl-bg-elev)';
  const clipTextStyle = textOnColor(clipColor);
  const clipTextColor = clipTextStyle === 'dark' ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.88)';

  return (
    <span className="diff-clip-chip" style={{ background: clipColor, color: clipTextColor }}>
      {clip?.name || 'Untitled Clip'}
    </span>
  );
}

function renderVisualSubItem(sub) {
  if (sub?.entityType === 'device' && sub?.entity) {
    return (
      <div className="diff-subitem-visual">
        <span className="diff-subitem-action">{actionLabel(sub.action, sub.entityType)}</span>
        <DeviceTag device={sub.entity} />
      </div>
    );
  }

  if (sub?.entityType === 'deviceList' && Array.isArray(sub.entities) && sub.entities.length > 0) {
    const actionText = sub.action === 'removed' ? 'Devices removed:' : 'Devices added:';

    return (
      <div className="diff-subitem-visual diff-subitem-visual--device-list">
        <span className="diff-subitem-action">{actionText}</span>
        <div className="diff-device-list" title={sub.entities.map((device) => device?.name || 'Unknown Device').join(', ')}>
          {sub.entities.map((device, index) => (
            <DeviceTag key={`${device?.name || 'device'}-${index}`} device={device} />
          ))}
        </div>
      </div>
    );
  }

  if (sub?.entityType === 'clip' && sub?.entity) {
    return (
      <div className="diff-subitem-visual">
        <span className="diff-subitem-action">{actionLabel(sub.action, sub.entityType)}</span>
        <DiffClipChip clip={sub.entity} />
      </div>
    );
  }

  if (sub?.entityType === 'clipList' && Array.isArray(sub.entities) && sub.entities.length > 0) {
    const actionText = sub.action === 'removed' ? 'Clips removed:' : 'Clips added:';

    return (
      <div className="diff-subitem-visual diff-subitem-visual--clip-list">
        <span className="diff-subitem-action">{actionText}</span>
        <div className="diff-clip-list" title={sub.entities.map((clip) => clip?.name || 'Untitled Clip').join(', ')}>
          {sub.entities.map((clip, index) => (
            <DiffClipChip key={`${clip?.name || 'clip'}-${index}`} clip={clip} />
          ))}
        </div>
      </div>
    );
  }

  if (sub?.entityType === 'trackProperty' && sub?.property === 'color' && sub?.entity) {
    const beforeColor = abletonColor(sub.entity.before);
    const afterColor = abletonColor(sub.entity.after);

    return (
      <div className="diff-subitem-visual">
        <span className="diff-subitem-action">Color changed:</span>
        <span className="diff-color-chip" style={{ background: beforeColor }} title={`Before: ${sub.before || 'Color'}`} />
        <span className="diff-arrow">→</span>
        <span className="diff-color-chip" style={{ background: afterColor }} title={`After: ${sub.after || 'Color'}`} />
      </div>
    );
  }

  return null;
}

export function DiffViewer() {
  const {
    selectedChangedFilePath,
    workingFileDiff,
    workingFileDiffLoading,
    workingFileDiffError,
  } = useProject();

  if (!selectedChangedFilePath) {
    return (
      <div className="diff-viewer">
        <div className="diff-placeholder">
          <span className="diff-placeholder-icon">&#128196;</span>
          <p>Select a file to view changes</p>
        </div>
      </div>
    );
  }

  if (workingFileDiffLoading) {
    return (
      <div className="diff-viewer">
        <div className="diff-placeholder">
          <p>Loading file diff...</p>
        </div>
      </div>
    );
  }

  if (workingFileDiffError) {
    return (
      <div className="diff-viewer">
        <div className="diff-placeholder">
          <p>{workingFileDiffError}</p>
        </div>
      </div>
    );
  }

  if (!workingFileDiff?.isAlsFile) {
    return (
      <div className="diff-viewer">
        <div className="diff-placeholder">
          <p>Diff preview is currently available for .als files only</p>
        </div>
      </div>
    );
  }

  const sections = workingFileDiff?.diff?.sections || [];
  const summary = workingFileDiff?.diff?.summary;

  if (sections.length === 0) {
    return (
      <div className="diff-viewer">
        <div className="diff-placeholder">
          <p>No semantic changes detected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="diff-viewer">
      <div className="diff-content">
        <div className="diff-header">
          <div className="diff-file-name">{workingFileDiff.filePath}</div>
          {summary && (
            <div className="diff-summary">
              <span className="diff-summary-added">+{summary.added}</span>
              <span className="diff-summary-removed">-{summary.removed}</span>
              <span className="diff-summary-modified">~{summary.modified}</span>
            </div>
          )}
        </div>

        {sections.map((section) => (
          <div key={section.kind} className={`diff-section diff-section--${section.kind}`}>
            <div className="diff-section-title">{section.title}</div>
            <div className="diff-section-list">
              {section.items.map((item, index) => (
                item.subItems ? (
                  <div key={`${section.kind}-${index}`} className="diff-item diff-item--group">
                    {item.entityType === 'track' && item.entity ? (
                      <div className="diff-item-visual diff-item-visual--track">
                        <span className="diff-subitem-action">{actionLabel(item.action, item.entityType)}</span>
                        <DiffTrackChip track={item.entity} />
                      </div>
                    ) : (
                      <div className="diff-item-label">{item.label}</div>
                    )}
                    <div className="diff-subitem-list">
                      {item.subItems.map((sub, subIndex) => (
                        <div key={subIndex} className="diff-subitem">
                          {renderVisualSubItem(sub) || (sub.detail && <span className="diff-subitem-detail">{sub.detail}</span>)}
                          {(sub.before || sub.after) && (
                            <div className="diff-item-values">
                              {sub.before && <span className="diff-before">{sub.before}</span>}
                              {sub.before && sub.after && <span className="diff-arrow">→</span>}
                              {sub.after && <span className="diff-after">{sub.after}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div key={`${section.kind}-${index}`} className="diff-item">
                    <div className="diff-item-label">{item.label}</div>
                    {item.entityType === 'track' && item.entity ? (
                      <div className="diff-item-visual diff-item-visual--track">
                        <span className="diff-subitem-action">{actionLabel(item.action, item.entityType)}</span>
                        <DiffTrackChip track={item.entity} />
                      </div>
                    ) : (
                      item.detail && <div className="diff-item-detail">{item.detail}</div>
                    )}
                    {(item.before || item.after) && (
                      <div className="diff-item-values">
                        {item.before && <span className="diff-before">{item.before}</span>}
                        {item.before && item.after && <span className="diff-arrow">→</span>}
                        {item.after && <span className="diff-after">{item.after}</span>}
                      </div>
                    )}
                  </div>
                )
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
