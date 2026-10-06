import { createHuehash, type CacheStats, type ColorDescription, type Options, type SetOptions } from './engine.js'

export { createHuehash, gradeFor } from './engine.js'
export type { CacheStats, ColorDescription, Grade, Huehash, HuehashOptions, Mode, Options, SetOptions } from './engine.js'
export { avoidHuesOf, hueGap } from './hue.js'
export type { HueArc } from './hue.js'
export { contrastRatio, oklchHue } from './oklch.js'
export type { Oklch, Rgb } from './oklch.js'

/** The shared instance behind the top-level functions, with the default options and a default-size cache. */
const shared = createHuehash()

/** A stable `#rrggbb` for a name. The same name always gives the same colour, whatever the case or surrounding spaces. */
export const colorFor = (name: string, options?: Options): string => shared.colorFor(name, options)

/** The colour for a name together with how it was measured: OKLCH, CSS, contrast and its WCAG grade. */
export const describeColor = (name: string, options?: Options): ColorDescription => shared.describeColor(name, options)

/**
 * Colours for a set of names where no two hues are closer than `minHueGap` degrees (OKLCH).
 * Names are placed in alphabetical order, so the result does not depend on the order you pass them in,
 * and each name keeps its own colour unless it collides with an earlier one. When the wheel is too
 * crowded for the gap, each name takes the free hue furthest from the others.
 */
export const distinctColors = (names: string[], options?: SetOptions): Record<string, string> => shared.distinctColors(names, options)

/** Forget the shared cache. Colours do not change; they are just calculated again on next use. */
export const clearCache = (): void => shared.clearCache()

/** How the shared cache is doing. */
export const cacheStats = (): CacheStats => shared.cacheStats()

/** CSS custom properties for a set of colours, ready to paste: `--huehash-orbit: #c3bb66;`. */
export function toCssVariables(colors: Record<string, string>, { prefix = '--huehash-', selector = ':root' }: { prefix?: string; selector?: string } = {}): string {
  const slug = (name: string) => name.normalize('NFKD').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed'
  const lines = Object.entries(colors).map(([name, hex]) => `  ${prefix}${slug(name)}: ${hex};`)
  return `${selector} {\n${lines.join('\n')}\n}`
}
