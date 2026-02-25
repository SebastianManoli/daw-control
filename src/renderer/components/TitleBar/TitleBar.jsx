import { useState, useEffect } from 'react';
import appIcon from '../../styles/Asset 8@4x.png';

export function TitleBar() {
  const [menuLabels, setMenuLabels] = useState([]);
  const api = window.electronAPI;

  useEffect(() => {
    if (api?.getMenuLabels) {
      api.getMenuLabels().then(setMenuLabels);
    }
  }, [api]);

  return (
    <div className="title-bar">
      <div className="title-bar-icon">
        <img src={appIcon} alt="DAW Control" />
      </div>

      <div className="title-bar-menus">
        {menuLabels.map((label) => (
          <button
            key={label}
            className="title-bar-menu-item"
            onClick={() => api?.popupMenu(label)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="title-bar-drag" />

      <div className="title-bar-controls">
        <button
          className="title-bar-control-btn"
          onClick={() => api?.windowMinimize()}
          aria-label="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          className="title-bar-control-btn"
          onClick={() => api?.windowMaximize()}
          aria-label="Maximize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        </button>
        <button
          className="title-bar-control-btn title-bar-close"
          onClick={() => api?.windowClose()}
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
            <line x1="0" y1="0" x2="10" y2="10" />
            <line x1="10" y1="0" x2="0" y2="10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
