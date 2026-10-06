import { oklchHue } from './oklch.js'

/** A range of hues to keep free, in OKLCH degrees: the centre and the total width. */
export type HueArc = { hue: number; width: number }

/** Avoided arcs as sorted, merged [start, end] intervals inside 0..360, split where an arc crosses 0 degrees. */
function blockedIntervals(avoid: HueArc[]): Array<[number, number]> {
  const raw: Array<[number, number]> = []
  avoid.forEach(({ hue, width }) => {
    const start = (((hue - width / 2) % 360) + 360) % 360
    const end = start + width
    if (end > 360) raw.push([start, 360], [0, end - 360])
    else raw.push([start, end])
  })
  raw.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  raw.forEach(([start, end]) => {
    const last = merged.at(-1)
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  })
  return merged
}

/** Map a position in [0, 1) onto the hues that are left once the avoided arcs are removed. */
export function hueFrom(position: number, avoid: HueArc[]): number {
  if (!avoid.length) return position * 360
  const blocked = blockedIntervals(avoid)
  const free = 360 - blocked.reduce((sum, [start, end]) => sum + (end - start), 0)
  if (free <= 0) return position * 360
  let remaining = position * free
  let cursor = 0
  for (const [start, end] of blocked) {
    const room = start - cursor
    if (remaining < room) return cursor + remaining
    remaining -= room
    cursor = end
  }
  return (cursor + remaining) % 360
}

/** Hue arcs around existing colours (a status palette, say), so generated colours never read as one of them. */
export const avoidHuesOf = (hexes: string[], width = 30): HueArc[] => hexes.map(hex => ({ hue: oklchHue(hex), width }))

/** Distance between two hues on the colour wheel, 0 to 180. */
export const hueGap = (a: number, b: number): number => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
