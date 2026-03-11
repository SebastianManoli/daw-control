// Ableton Live color palette — indices 0–70, ordered left-to-right, top-to-bottom
// as they appear in the Ableton track color picker.
// If colors look wrong, the index offset may need adjusting based on your Live version.
const PALETTE = [
  // Row 1 — bright
  '#fe9aaa', '#fea741', '#d19d3a', '#f7f58c', '#c1fc40', '#2dfe50',
  '#34feaf', '#65ffea', '#90c7fc', '#5c86e1', '#97abfb', '#d975e2',
  '#e55ca2', '#ffffff',
  // Row 2 — medium bright
  '#fe3e40', '#f76f23', '#9f7752', '#fff054', '#8dff79', '#42c52e',
  '#11c2b2', '#28e9fd', '#1aa6eb', '#5c86e1', '#8e74e2', '#ba81c7',
  '#fe41d1', '#d9d9d9',
  // Row 3 — pastel
  '#e26f64', '#fea67e', '#d6b27f', '#eeffb7', '#d6e6a6', '#bfd383',
  '#a4c99a', '#d9fde5', '#d2f3f9', '#c2c9e6', '#d3c4e5', '#b5a1e4',
  '#eae3e7', '#b3b3b3',
  // Row 4 — muted
  '#cb9b96', '#bb8862', '#9f8a75', '#c3be78', '#a9c12f', '#84b45d',
  '#93c7c0', '#a5bbc9', '#8facc5', '#8d9ccd', '#ae9fbb', '#c6a9c4',
  '#bf7a9c', '#838383',
  // Row 5 — dark
  '#b53637', '#ae5437', '#775345', '#dec633', '#899b31', '#57a53f',
  '#139f91', '#256686', '#1a3096', '#3155a4', '#6751ae', '#a752af',
  '#ce3571', '#3f3f3f',
  // Index 70 — darkest
  '#2a2a2a',
];

const DEFAULT_COLOR = '#5f7f92';

/**
 * Returns the hex color for an Ableton palette index.
 * @param {string|number|null} colorIndex - The raw Value from the ALS <Color> element
 */
export function abletonColor(colorIndex) {
  const index = parseInt(colorIndex, 10);
  if (isNaN(index) || index < 0) return DEFAULT_COLOR;
  return PALETTE[index] ?? DEFAULT_COLOR;
}

/**
 * Returns 'dark' or 'light' text class based on background luminance.
 * Use 'dark' for light backgrounds, 'light' for dark backgrounds.
 */
export function textOnColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.45 ? 'dark' : 'light';
}
