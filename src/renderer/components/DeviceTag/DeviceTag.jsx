export function DeviceTag({ device }) {
  const typeClass = device?.type === 'native' ? 'device-native' : 'device-plugin';
  const isActive = device?.active !== false && device?.enabled !== false;
  const name = device?.name || 'Unknown Device';

  return (
    <span className={`device-tag ${typeClass}`} title={isActive ? name : `${name} (bypassed)`}>
      <span className={`device-status-dot ${isActive ? 'device-status-active' : 'device-status-inactive'}`} />
      {name}
    </span>
  );
}
