export const COLORS = {
  background: '#1a1a1a',
  surface: '#252525',
  surfaceHover: '#2d2d2d',
  border: '#333333',
  text: '#E0E0E0',
  textMuted: '#A3A3A3',
  textDim: '#8C8C8C',
  accent: '#39FF14',
  amber: '#F5A623',
  red: '#FF5252',
} as const;

// Light theme fails contrast with the neon accents; hidden until per-theme
// accent tokens land. A stored 'light' preference is kept, just not applied.
export const LIGHT_THEME_ENABLED = false;

export const ACCENT_COLORS = [
  '#F5A623', '#39FF14', '#00FFFF', '#FF4F8B',
  '#BF5FFF', '#FF5252', '#7EC8E3', '#FF8C00', '#AAFF00', '#FFFFFF',
];

export const DEFAULT_CATEGORIES = [
  { name: 'Work',       color: '#F5A623' },
  { name: 'School',     color: '#39FF14' },
  { name: 'Personal',   color: '#00FFFF' },
  { name: 'Friends',    color: '#FF4F8B' },
  { name: 'Date Ideas', color: '#BF5FFF' },
  { name: 'Creative',   color: '#FF5252' },
];
