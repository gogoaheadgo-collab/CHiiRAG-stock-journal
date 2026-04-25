// ── Exact match of globals.css CSS variables ──────────────────────────────────
export const colors = {
  // Backgrounds
  bg:       '#ffffff',
  surface:  '#f8f9fc',
  surface2: '#eef1f7',

  // Borders
  border:  '#dde2ee',
  border2: '#c5cde0',

  // Text
  text:    '#1a1f36',
  muted:   '#6b7a9e',

  // Accent — sky blue
  accent:    '#0ea5e9',
  accent2:   '#0284c7',
  accentDim: '#e0f2fe',

  // P&L
  bull:    '#0ea5e9',   // profit = sky blue (same as accent)
  bullDim: '#e0f2fe',
  bear:    '#ef4444',   // loss = red
  bearDim: '#fee2e2',

  // Special
  gold:        '#f59e0b',
  green:       '#16a34a',
  red:         '#dc2626',
  saffron:     '#FF9933',
  indiaGreen:  '#138808',
  navy:        '#000080',

  white: '#ffffff',
  black: '#000000',
}

// ── Fonts (loaded via Google Fonts in _layout) ────────────────────────────────
export const font = {
  serif: 'LibreBaskerville',        // headings + values (Bookman substitute)
  mono:  'DMmono',                  // labels + numbers
  size: {
    xs:  10,
    sm:  11,
    md:  12,
    lg:  13,
    xl:  16,
    xxl: 20,
    h1:  22,
    h2:  18,
  },
  weight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold:   '700' as const,
    black:  '800' as const,
  },
}

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
}

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 28,
}

export const shadow = {
  sm: {
    shadowColor: '#1a1f36',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1a1f36',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
}
