/**
 * TrackControls Component
 * Displays compact Ableton-style track controls block.
 */

function formatVolumeValue(db) {
  if (db === -Infinity || db <= -145) return '-∞';
  if (Math.abs(db) < 0.05) return '0';
  return db.toFixed(1);
}

function formatPanValue(pan) {
  // pan ranges from -100 (left) to 100 (right)
  if (Math.abs(pan) < 1) return 'C';
  const side = pan < 0 ? 'L' : 'R';
  const amount = Math.abs(pan).toFixed(0);
  return `${amount}${side}`;
}

function asBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
  }
  if (typeof value === 'number') return value !== 0;
  return false;
}

function ControlButton({ active, label, title, variant, disabled = false }) {
  const buttonClass = `control-button control-button-${variant} ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`;
  return (
    <button 
      className={buttonClass} 
      title={title}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

function ControlValue({ value, unit = '' }) {
  return (
    <div className="control-value">
      <span className="control-value-display">{value}{unit}</span>
    </div>
  );
}

export function TrackControls({ track, trackNumber = 1 }) {
  if (!track || !track.controls) {
    return <div className="track-controls empty">No controls data</div>;
  }

  const {
    volume = 0,
    pan = 0,
    solo = false,
    muted = false,
    armed = false
  } = track.controls;

  const soloActive = asBoolean(solo);
  const mutedActive = asBoolean(muted);
  const armedActive = asBoolean(armed);

  return (
    <div className="track-controls">
      <div className="track-controls-top-row">
        <ControlButton
          active={!mutedActive}
          label={trackNumber}
          variant="activator"
          title={mutedActive ? 'Track Muted' : 'Track Active'}
        />
        <ControlButton
          active={soloActive}
          label="s"
          variant="solo"
          title={soloActive ? 'Solo Active' : 'Solo Inactive'}
        />
        <ControlButton
          active={armedActive}
          label="a"
          variant="arm"
          title={armedActive ? 'Recording Armed' : 'Not Armed'}
          disabled={false}
        />
      </div>

      <div className="track-controls-bottom-row">
        <ControlValue
          value={formatVolumeValue(volume)}
          unit="dB"
        />
        <ControlValue
          value={formatPanValue(pan)}
          unit=""
        />
      </div>
    </div>
  );
}

export default TrackControls;
