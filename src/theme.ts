/**
 * "Midnight Academy" — every colour here is lifted from the Hat:
 * night-sky fabric, glowing cyan eyes, leather band, brass buckle, autumn feathers and oak leaves.
 */
export const colors = {
  // Night sky
  bg: '#0C0A18',
  bgTop: '#1C1438',
  surface: '#1A1530',
  surfaceAlt: '#151127',
  surfaceRaised: '#231C3E',
  border: '#2E2652',
  borderStrong: '#40356E',
  track: '#262046',
  tickOff: '#3A3263',

  // Type
  text: '#F5F1FF',
  muted: '#A79FC7',
  dim: '#7A72A0',
  ink: '#120E22',

  // The Hat
  fabric: '#2A2442',
  fabricDeep: '#14111F',
  magic: '#5CE1FF', // eye glow — the app's signature accent
  magicDeep: '#1A9FD6',
  aura: '#8C6CFF',
  gold: '#F4C15D', // buckle & stars
  goldDeep: '#C48A2C',
  leather: '#8A5A35',
  leatherDeep: '#5C3920',
  leaf: '#9ACD5E',
  leafDeep: '#5E8A33',

  // Parchment (the question scroll)
  parchment: '#F4E7C8',
  parchmentDeep: '#E2CC98',
  parchmentEdge: '#C4A46A',
  parchmentInk: '#2B1D12',

  // Calls
  higher: '#5CB8FF',
  higherInk: '#08203A',
  lower: '#FF9447',
  lowerInk: '#3A1A06',
  okBg: '#22351F',
  okText: '#B6EC8E',
  danger: '#FF6B86',
  dangerBg: '#3E1A2C',

  // Legacy alias used by the dial & a few highlights
  yellow: '#F4C15D',
};

export const fonts = {
  display: 'Fraunces_800ExtraBold',
  serif: 'Fraunces_700Bold',
  serifItalic: 'Fraunces_600SemiBold_Italic',
  number: 'BricolageGrotesque_800ExtraBold',
  body: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
};

export const radii = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 };

type RGB = [number, number, number];
const HEAT_STOPS: [number, RGB][] = [
  [0, [92, 184, 255]], // frost blue
  [25, [92, 225, 255]], // magic cyan
  [45, [70, 227, 166]], // oak-leaf mint
  [60, [244, 193, 93]], // buckle gold
  [80, [255, 148, 71]], // feather orange
  [100, [255, 90, 90]], // ember
];

const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
const parse = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
};

/** Lighten (amt > 0) or darken (amt < 0) a hex colour by a 0–1 fraction. */
export function shade(hex: string, amt: number): string {
  const rgb = parse(hex);
  const target = amt < 0 ? 0 : 255;
  return '#' + rgb.map((c) => toHex(c + (target - c) * Math.abs(amt))).join('');
}

/** Hex colour with alpha, e.g. alpha('#5CE1FF', 0.3). */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Color for a 0–100 value: frost blue → magic cyan → gold → ember. */
export function heatColor(value: number): string {
  const g = Math.max(0, Math.min(100, value));
  let a = HEAT_STOPS[0];
  let b = HEAT_STOPS[HEAT_STOPS.length - 1];
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    if (g >= HEAT_STOPS[i][0] && g <= HEAT_STOPS[i + 1][0]) {
      a = HEAT_STOPS[i];
      b = HEAT_STOPS[i + 1];
      break;
    }
  }
  const t = (g - a[0]) / (b[0] - a[0] || 1);
  return '#' + [0, 1, 2].map((k) => toHex(a[1][k] + (b[1][k] - a[1][k]) * t)).join('');
}

export function heatLabel(value: number): string {
  if (value < 20) return 'Frostbitten';
  if (value < 40) return 'Cool';
  if (value < 60) return 'Middle ground';
  if (value < 80) return 'Warm';
  return 'Red hot';
}
