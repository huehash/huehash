/** Colour maths: OKLCH <-> sRGB hex, gamut fitting and WCAG contrast. */

export type Rgb = [number, number, number]
export type Oklch = { l: number; c: number; h: number }

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Parse `#rgb` or `#rrggbb` into a normalised lowercase `#rrggbb`. Throws on anything else. */
export function parseHex(input: string): string {
  const match = HEX.exec(input.trim())
  if (!match) throw new TypeError(`Expected a #rgb or #rrggbb colour, got ${JSON.stringify(input)}`)
  const digits = match[1]!.toLowerCase()
  const full = digits.length === 3 ? [...digits].map(d => d + d).join('') : digits
  return `#${full}`
}

export function hexToRgb(hex: string): Rgb {
  const full = parseHex(hex)
  return [1, 3, 5].map(i => parseInt(full.slice(i, i + 2), 16)) as Rgb
}

const toLinear = (channel: number): number => {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}
const toGamma = (x: number): number => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.max(x, 0) ** (1 / 2.4) - 0.055)

type Linear = [number, number, number]

function oklchToLinear({ l, c, h }: Oklch): Linear {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const lc = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mc = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const sc = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
  ]
}

const inGamut = (rgb: Linear): boolean => rgb.every(channel => channel >= -0.0001 && channel <= 1.0001)

const linearToHex = (rgb: Linear): string =>
  `#${rgb.map(channel => Math.round(Math.min(1, Math.max(0, toGamma(channel))) * 255).toString(16).padStart(2, '0')).join('')}`

/** The colour at this lightness and hue with as much chroma as sRGB can show, up to `chroma`. */
export function oklchToHex(l: number, chroma: number, h: number): string {
  let c = chroma
  let rgb = oklchToLinear({ l, c, h })
  while (!inGamut(rgb) && c > 0) {
    c = Math.max(0, c - 0.004)
    rgb = oklchToLinear({ l, c, h })
  }
  return linearToHex(rgb)
}

/** Read a hex colour back as OKLCH (hue is 0 for greys). */
export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as Linear
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bAxis = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const chroma = Math.hypot(a, bAxis)
  return { l: lightness, c: chroma, h: chroma < 1e-4 ? 0 : ((Math.atan2(bAxis, a) * 180) / Math.PI + 360) % 360 }
}

/** The OKLCH hue (0 to 360) of a hex colour: the scale `avoid` arcs are measured in. */
export const oklchHue = (hex: string): number => hexToOklch(hex).h

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as Linear
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2 contrast ratio between two colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}
