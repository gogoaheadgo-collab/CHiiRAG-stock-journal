export const colors = {
  // Backgrounds
  bg:         '#0f0f0f',
  bgCard:     '#1a1a2e',
  bgInput:    '#111111',
  bgHover:    '#1e1e3a',

  // Borders
  border:     '#1e1e3a',
  borderFocus: '#0ea5e9',

  // Text
  textPrimary:   '#e2e8f0',
  textSecondary: '#94a3b8',
  textMuted:     '#64748b',

  // Brand
  accent:  '#0ea5e9',   // sky blue
  accentDim: '#0284c7',

  // Status
  green:  '#22c55e',
  red:    '#ef4444',
  yellow: '#eab308',
  orange: '#f97316',

  // Special
  white: '#ffffff',
  black: '#000000',
}

export const font = {
  mono: 'SpaceMono',   // loaded in _layout
  size: {
    xs:  10,
    sm:  11,
    md:  13,
    lg:  15,
    xl:  18,
    xxl: 22,
    h1:  28,
  },
  weight: {
    normal:  '400' as const,
    medium:  '500' as const,
    bold:    '700' as const,
    black:   '800' as const,
  },
}

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
}

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
}
