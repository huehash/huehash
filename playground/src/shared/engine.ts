import { earlierNeighbours, LINE, type Grid } from '../../../src/grid.js'
import { avoidHuesOf, contrastRatio, hueGap, oklchHue, type Huehash, type Options } from '../../../src/index.js'

/** The colours an interface usually spends on meaning. The playground can keep generated colours clear of them. */
export const STATUS = ['#ffb454', '#7ee787', '#ff7b72', '#56d4dd', '#ff5fb0']
export const STATUS_LABELS = ['warning', 'success', 'error', 'info', 'beta']

/** On the neighbours slider, this value means "every item is a neighbour of every other". */
export const EVERYONE = 6

export type Settings = {
  surface: string
  minContrast: number
  mode: 'auto' | 'dark' | 'light'
  avoid: boolean
  avoidWidth: number
  distance: number
  neighbours: number
}

export const DEFAULT_SETTINGS: Settings = {
  surface: '#0d1117',
  minContrast: 7,
  mode: 'auto',
  avoid: false,
  avoidWidth: 26,
  distance: 40,
  neighbours: 1,
}

export const colorOptions = (s: Settings): Options => ({
  background: s.surface,
  minContrast: s.minContrast,
  mode: s.mode === 'auto' ? undefined : s.mode,
  avoid: s.avoid ? avoidHuesOf(STATUS, s.avoidWidth) : [],
})

export const reach = (s: Settings) => (s.neighbours >= EVERYONE ? Infinity : s.neighbours)

export type Layout = 'line' | 'grid' | 'stack'

export const LAYOUTS: Array<{ id: Layout; label: string }> = [
  { id: 'line', label: 'A line' },
  { id: 'grid', label: 'A grid' },
  { id: 'stack', label: 'A stack of grids' },
]

/** The space the items sit in, for a layout and the size of its rows and layers. */
export function gridFor(layout: Layout, columns: number, rows: number): Grid {
  if (layout === 'grid') return { columns, rows: Infinity }
  if (layout === 'stack') return { columns, rows }
  return LINE
}

/** The same space, as the options `colorsFor` takes. */
export const gridOptions = (grid: Grid): { columns?: number; rows?: number } => ({
  ...(Number.isFinite(grid.columns) ? { columns: grid.columns } : {}),
  ...(Number.isFinite(grid.rows) ? { rows: grid.rows } : {}),
})

export type Sequence = { keys: string[]; colors: string[]; hues: number[]; grid: Grid; steps: number }

export function sequenceOf(engine: Huehash, keys: string[], s: Settings, grid: Grid = LINE): Sequence {
  const steps = reach(s)
  const colors = engine.colorsFor(keys, { ...colorOptions(s), ...gridOptions(grid), distance: s.distance, neighbours: steps })
  return { keys, colors, hues: colors.map(oklchHue), grid, steps }
}

/** Every pair of items within `steps` steps of each other, earlier item first. */
export const neighbourPairs = ({ keys, grid }: Pick<Sequence, 'keys' | 'grid'>, steps: number): Array<[number, number]> =>
  keys.flatMap((_, later) => earlierNeighbours(later, grid, steps).map((earlier): [number, number] => [earlier, later]))

/** The pair of neighbours, within `steps` steps of each other, whose hues are closest. */
export function closestPair(seq: Sequence, steps: number): { a: string; b: string; gap: number } | null {
  let best: { a: string; b: string; gap: number } | null = null
  neighbourPairs(seq, steps).forEach(([earlier, later]) => {
    if (seq.keys[earlier] === seq.keys[later]) return
    const gap = hueGap(seq.hues[earlier]!, seq.hues[later]!)
    if (!best || gap < best.gap) best = { a: seq.keys[earlier]!, b: seq.keys[later]!, gap }
  })
  return best
}

/** The first occurrence of each key, in order. */
export function uniqueEntries(seq: Sequence): Array<{ key: string; color: string; hue: number }> {
  const seen = new Set<string>()
  return seq.keys.flatMap((key, i) => (seen.has(key) ? [] : (seen.add(key), [{ key, color: seq.colors[i]!, hue: seq.hues[i]! }])))
}

/* ── the baseline most people start from: hash to a hue, fixed saturation and lightness ── */

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const channel = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return `#${[channel(0), channel(8), channel(4)].map(c => c.toString(16).padStart(2, '0')).join('')}`
}

/** `hsl(hash % 360, 70%, 60%)`: what you get without huehash. */
export function naiveColor(key: string): string {
  let hash = 5381
  for (const char of key.toLowerCase()) hash = (Math.imul(hash, 33) + char.charCodeAt(0)) >>> 0
  return hslToHex(hash % 360, 0.7, 0.6)
}

export const contrastOn = (hex: string, surface: string) => contrastRatio(hex, surface)

/* ── settings kept in the link ── */

/** A link can say anything, so every value read from it is checked before the page trusts it. */
export const validSurface = (value: unknown, fallback: string): string => (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback)

export const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const number = typeof value === 'number' ? value : Number.NaN
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

export const cleanText = (value: unknown, fallback: string, max = 32): string => (typeof value === 'string' ? value.slice(0, max) : fallback)

export function readHash<T extends object>(defaults: T): T {
  try {
    const raw = location.hash.slice(1)
    if (!raw) return { ...defaults }
    return { ...defaults, ...(JSON.parse(decodeURIComponent(escape(atob(raw.replace(/-/g, '+').replace(/_/g, '/'))))) as Partial<T>) }
  } catch {
    return { ...defaults }
  }
}

export function writeHash<T extends object>(state: T, defaults: T) {
  const changed = Object.fromEntries(Object.entries(state).filter(([key, value]) => value !== defaults[key as keyof T]))
  const encoded = Object.keys(changed).length ? btoa(unescape(encodeURIComponent(JSON.stringify(changed)))).replace(/\+/g, '-').replace(/\//g, '_') : ''
  history.replaceState(null, '', `${location.pathname}${location.search}${encoded ? `#${encoded}` : ''}`)
}

export function encodeHash(state: object): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state)))).replace(/\+/g, '-').replace(/\//g, '_')
}
