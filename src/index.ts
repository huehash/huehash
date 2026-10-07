import { createHuehash, type CacheStats, type ColorDescription, type Options, type SequenceOptions } from './engine.js'

export { createHuehash, gradeFor } from './engine.js'
export type { CacheStats, ColorDescription, Grade, Huehash, HuehashOptions, Mode, Options, SequenceOptions } from './engine.js'
export { avoidHuesOf, hueGap } from './hue.js'
export type { HueArc } from './hue.js'
export { contrastRatio, oklchHue } from './oklch.js'
export type { Oklch, Rgb } from './oklch.js'

/** The shared instance behind the top-level functions, with the default options and a default-size cache. */
const shared = createHuehash()

/** A `#rrggbb` for a key (an id, a label, a username) that meets `minContrast` on every `background` you pass. The same key and options always give the same colour, whatever the case or surrounding spaces. */
export const colorFor = (key: string, options?: Options): string => shared.colorFor(key, options)

/** The colour for a name together with how it was measured: OKLCH, CSS, contrast and its WCAG grade. */
export const describeColor = (key: string, options?: Options): ColorDescription => shared.describeColor(key, options)

/**
 * Colours for keys in order, each meeting the same contrast as `colorFor`, and no two neighbours closer than
 * `distance` degrees on the colour wheel. Returns an array in the same order as `keys`.
 *
 * Each key starts from its own hashed colour and only moves when it would sit too close to a neighbour.
 * Adding keys to the end never changes the colours before them. Use `colorFor` when a colour must never
 * depend on anything but its own key.
 */
export const colorsFor = (keys: string[], options?: SequenceOptions): string[] => shared.colorsFor(keys, options)

/** Forget the shared cache. Colours do not change; they are just calculated again on next use. */
export const clearCache = (): void => shared.clearCache()

/** How the shared cache is doing. */
export const cacheStats = (): CacheStats => shared.cacheStats()

/** CSS custom properties for a set of colours, ready to paste: `--huehash-orbit: #c3bb66;`. */
export function toCssVariables(colors: Record<string, string>, { prefix = '--huehash-', selector = ':root' }: { prefix?: string; selector?: string } = {}): string {
  const slug = (key: string) => key.normalize('NFKD').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed'
  const lines = Object.entries(colors).map(([key, hex]) => `  ${prefix}${slug(key)}: ${hex};`)
  return `${selector} {\n${lines.join('\n')}\n}`
}
