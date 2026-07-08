// Canonical Solarized palette — single source of truth for TS code.
// Tailwind utilities get the same values via the @theme block in src/index.css;
// keep the two in sync when editing.
export const sol = {
  base03: '#002b36',
  base02: '#073642',
  base01: '#586e75',
  base00: '#657b83',
  base0: '#839496',
  base1: '#93a1a1',
  base2: '#eee8d5',
  base3: '#fdf6e3',
  yellow: '#b58900',
  orange: '#cb4b16',
  red: '#dc322f',
  magenta: '#d33682',
  violet: '#6c71c4',
  blue: '#268bd2',
  cyan: '#2aa198',
  green: '#859900',
} as const

export type SolColor = keyof typeof sol
