import { hash32, mix, normalize, unit } from './hash.js'
import { hueFrom, hueGap, type HueArc } from './hue.js'
import { Lru } from './lru.js'
import { contrastRatio, hexToOklch, hexToRgb, luminance, oklchToHex, parseHex, type Oklch, type Rgb } from './oklch.js'

export type Mode = 'dark' | 'light'

export type Options = {
  /**
   * The background(s) the colour will sit on, as `#rgb` or `#rrggbb`. Contrast is guaranteed against every one.
   * Pass all the surfaces you use (page, panel, raised card). Default: a dark grey, `#161b22`.
   */
  background?: string | string[]
  /** WCAG contrast ratio to guarantee, 1 to 21. 7 is AAA for normal text, 4.5 is AA. Default 7. */
  minContrast?: number
  /** Hue ranges to keep free, for example the colours you use to mean something. See `avoidHuesOf`. */
  avoid?: HueArc[]
  /** Force dark or light styling. By default it follows the backgrounds. */
  mode?: Mode
}

export type Grade = 'AAA' | 'AA' | 'AA large' | 'fail'

export type ColorDescription = {
  /** The name as it was hashed: lowercase, trimmed. */
  readonly name: string
  readonly hex: string
  readonly rgb: Readonly<Rgb>
  readonly oklch: Readonly<Oklch>
  /** A CSS `oklch()` value for the same colour. */
  readonly css: string
  /** The lowest WCAG contrast ratio across the backgrounds. */
  readonly contrast: number
  readonly grade: Grade
  readonly mode: Mode
}

export type CacheStats = {
  /** Lookups answered from the cache. */
  hits: number
  /** Lookups that had to be calculated. */
  misses: number
  /** Entries held right now. */
  size: number
  /** The most entries held; the least recently used is dropped beyond this. */
  maxSize: number
}

export type HuehashOptions = {
  /** How many results to keep per kind. 0 turns caching off. Default 2000. */
  cacheSize?: number
}

export type SetOptions = Options & {
  /** The smallest distance between any two hues, in OKLCH degrees. Default 24. */
  minHueGap?: number
}

export type Huehash = {
  colorFor(name: string, options?: Options): string
  describeColor(name: string, options?: Options): ColorDescription
  distinctColors(names: string[], options?: SetOptions): Record<string, string>
  /** Forget every cached result and reset the counters. */
  clearCache(): void
  cacheStats(): CacheStats
}

const DEFAULT_BACKGROUND = '#161b22'
const DEFAULT_CONTRAST = 7
const GOLDEN = 0.381966
const LIGHT_THRESHOLD = 0.18
const MAX_CACHED_NAME = 256
const MAX_CACHED_SET_KEY = 10_000
const MAX_SETTINGS = 64

const TONE = {
  dark: { lightness: 0.8, chroma: 0.125, step: 0.01, limit: 0.98 },
  light: { lightness: 0.52, chroma: 0.14, step: -0.01, limit: 0.1 },
} as const

type Resolved = { backgrounds: string[]; minContrast: number; avoid: HueArc[]; mode: Mode }

/** A string that changes whenever anything affecting the colour changes: the cache key for the options. */
function signatureOf(options: Options): string {
  const background = [options.background ?? DEFAULT_BACKGROUND].flat().join(',')
  const avoid = (options.avoid ?? []).map(arc => `${arc.hue}:${arc.width}`).join(';')
  return `${options.mode ?? ''}|${options.minContrast ?? ''}|${background}|${avoid}`
}

function resolve(options: Options): Resolved {
  const backgrounds = [options.background ?? DEFAULT_BACKGROUND].flat().map(parseHex)
  if (!backgrounds.length) throw new TypeError('`background` needs at least one colour')
  const minContrast = options.minContrast ?? DEFAULT_CONTRAST
  if (!Number.isFinite(minContrast)) throw new TypeError('`minContrast` must be a number')
  const mean = backgrounds.reduce((sum, hex) => sum + luminance(hex), 0) / backgrounds.length
  return {
    backgrounds,
    minContrast: Math.min(21, Math.max(1, minContrast)),
    avoid: options.avoid ?? [],
    mode: options.mode ?? (mean < LIGHT_THRESHOLD ? 'dark' : 'light'),
  }
}

const worstContrast = (hex: string, backgrounds: string[]): number => Math.min(...backgrounds.map(background => contrastRatio(hex, background)))

/** The colour for a hue and a little hash-driven variation, moved toward readability until the contrast is met. */
function shade(position: number, bits: number, chromaScale: number, settings: Resolved): string {
  const tone = TONE[settings.mode]
  const hue = hueFrom(position, settings.avoid)
  let lightness = tone.lightness + (unit(mix(bits ^ 0x9e3779b9)) - 0.5) * 0.08
  const chroma = (tone.chroma + (unit(mix(bits ^ 0x85ebca6b)) - 0.5) * 0.04) * chromaScale
  let hex = oklchToHex(lightness, chroma, hue)
  while (worstContrast(hex, settings.backgrounds) < settings.minContrast && (tone.step > 0 ? lightness < tone.limit : lightness > tone.limit)) {
    lightness += tone.step
    hex = oklchToHex(lightness, chroma, hue)
  }
  return hex
}

function colorFromKey(key: string, settings: Resolved): string {
  if (!key) return shade(0, 0, 0, settings)
  const bits = hash32(key)
  return shade(unit(bits), bits, 1, settings)
}

/** The WCAG grade for normal text at a contrast ratio: AAA from 7, AA from 4.5, AA large from 3. */
export const gradeFor = (ratio: number): Grade => (ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'fail')

function describe(key: string, settings: Resolved): ColorDescription {
  const hex = colorFromKey(key, settings)
  const oklch = hexToOklch(hex)
  const contrast = worstContrast(hex, settings.backgrounds)
  return Object.freeze({
    name: key,
    hex,
    rgb: Object.freeze(hexToRgb(hex)) as Readonly<Rgb>,
    oklch: Object.freeze(oklch),
    css: `oklch(${(oklch.l * 100).toFixed(1)}% ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)})`,
    contrast,
    grade: gradeFor(contrast),
    mode: settings.mode,
  })
}

function distinct(keys: string[], minHueGap: number, settings: Resolved): Record<string, string> {
  const taken: number[] = []
  const byKey: Record<string, string> = {}
  const clearance = (hue: number) => Math.min(360, ...taken.map(other => hueGap(hue, other)))
  keys.forEach(key => {
    const bits = hash32(key)
    const preferred = unit(bits)
    let position = preferred
    for (let attempt = 0; attempt < 8 && clearance(hueFrom(position, settings.avoid)) < minHueGap; attempt += 1) {
      position = (position + GOLDEN) % 1
    }
    if (clearance(hueFrom(position, settings.avoid)) < minHueGap) {
      let bestClearance = -1
      for (let i = 0; i < 720; i += 1) {
        const candidate = (preferred + i / 720) % 1
        const room = clearance(hueFrom(candidate, settings.avoid))
        if (room > bestClearance + 1e-9) {
          bestClearance = room
          position = candidate
        }
      }
    }
    taken.push(hueFrom(position, settings.avoid))
    byKey[key] = shade(position, bits, 1, settings)
  })
  return byKey
}

/**
 * Create a colouriser with its own default options and its own cache.
 *
 * Results depend only on the name and the options, so they are cached: the same name with the same
 * options is calculated once, whatever the case or surrounding spaces. The cache holds at most
 * `cacheSize` results per kind and drops the least recently used first. Names longer than 256
 * characters are calculated each time rather than cached.
 */
export function createHuehash(defaults: Options = {}, { cacheSize = 2000 }: HuehashOptions = {}): Huehash {
  const size = Math.max(0, Math.floor(cacheSize))
  const colors = new Lru<string>(size)
  const descriptions = new Lru<ColorDescription>(size)
  const sets = new Lru<Record<string, string>>(size === 0 ? 0 : Math.max(1, Math.floor(size / 20)))
  const settingsBySignature = new Map<string, Resolved>()

  const fixedDefaults: Options = Object.freeze({
    ...defaults,
    background: Array.isArray(defaults.background) ? [...defaults.background] : defaults.background,
    avoid: defaults.avoid?.map(arc => ({ ...arc })),
  })
  const merge = (options?: Options): Options => (options ? { ...fixedDefaults, ...options } : fixedDefaults)
  const base = { signature: signatureOf(fixedDefaults), settings: resolve(fixedDefaults) }

  function settingsFor(options?: Options): { signature: string; settings: Resolved } {
    if (!options) return base
    const merged = merge(options)
    const signature = signatureOf(merged)
    let settings = settingsBySignature.get(signature)
    if (!settings) {
      settings = resolve(merged)
      if (settingsBySignature.size >= MAX_SETTINGS) settingsBySignature.clear()
      settingsBySignature.set(signature, settings)
    }
    return { signature, settings }
  }

  return {
    colorFor(name, options) {
      const { signature, settings } = settingsFor(options)
      const key = normalize(name)
      if (key.length > MAX_CACHED_NAME) return colorFromKey(key, settings)
      const cacheKey = `${signature}\u0000${key}`
      const cached = colors.get(cacheKey)
      if (cached !== undefined) return cached
      const hex = colorFromKey(key, settings)
      colors.set(cacheKey, hex)
      return hex
    },

    describeColor(name, options) {
      const { signature, settings } = settingsFor(options)
      const key = normalize(name)
      if (key.length > MAX_CACHED_NAME) return describe(key, settings)
      const cacheKey = `${signature}\u0000${key}`
      const cached = descriptions.get(cacheKey)
      if (cached) return cached
      const description = describe(key, settings)
      descriptions.set(cacheKey, description)
      return description
    },

    distinctColors(names, options) {
      const { minHueGap = 24, ...colorOptions } = options ?? {}
      const { signature, settings } = settingsFor(options ? colorOptions : undefined)
      const keys = [...new Set(names.map(normalize))].filter(Boolean).sort()
      const setKey = `${signature}\u0001${minHueGap}\u0001${keys.join('\u0000')}`
      let byKey = setKey.length <= MAX_CACHED_SET_KEY ? sets.get(setKey) : undefined
      if (!byKey) {
        byKey = distinct(keys, minHueGap, settings)
        if (setKey.length <= MAX_CACHED_SET_KEY) sets.set(setKey, byKey)
      }
      const neutral = colorFromKey('', settings)
      return Object.fromEntries(names.map(name => [name, byKey[normalize(name)] ?? neutral]))
    },

    clearCache() {
      colors.clear()
      descriptions.clear()
      sets.clear()
      settingsBySignature.clear()
    },

    cacheStats() {
      return {
        hits: colors.hits + descriptions.hits + sets.hits,
        misses: colors.misses + descriptions.misses + sets.misses,
        size: colors.size + descriptions.size + sets.size,
        maxSize: colors.max + descriptions.max + sets.max,
      }
    },
  }
}
