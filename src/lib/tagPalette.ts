import { sol } from './solarized'

// Persisted tag colors — tag definitions store these values on disk, so the
// palette is data, not theme: changing an entry re-colors existing tags.
// The last two are legacy non-Solarized values kept for stored tags.
export const TAG_PALETTE = [
  sol.red,
  sol.orange,
  sol.yellow,
  sol.green,
  sol.cyan,
  sol.blue,
  sol.violet,
  sol.magenta,
  '#c97a2c',
  '#5e8c61',
]
