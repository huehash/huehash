import { contrastRatio } from '../../src/index.js'
import { hexToRgb, luminance, parseHex } from '../../src/oklch.js'

const toHex = (channels: number[]) => `#${channels.map(c => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`

/** Blend `a` toward `b` by `amount` (0 to 1). */
export function mix(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return toHex([ar + (br - ar) * amount, ag + (bg - ag) * amount, ab + (bb - ab) * amount])
}

export type Ink = { surface: string; ink: string; muted: string; faint: string; rule: string; field: string; light: boolean }

/** The page's own text and line colours for a surface, each checked for contrast so the playground stays readable on any background. */
export function inkFor(surface: string): Ink {
  const base = parseHex(surface)
  const light = luminance(base) >= 0.18
  const pole = light ? '#000000' : '#ffffff'
  const reach = (target: number, from: number) => {
    let amount = from
    let hex = mix(base, pole, amount)
    while (contrastRatio(hex, base) < target && amount < 1) {
      amount = Math.min(1, amount + 0.02)
      hex = mix(base, pole, amount)
    }
    return hex
  }
  return {
    surface: base,
    ink: reach(12, 0.9),
    muted: reach(5, 0.55),
    faint: reach(3, 0.36),
    rule: mix(base, pole, 0.16),
    field: mix(base, pole, 0.06),
    light,
  }
}

export const SURFACES = [
  { name: 'carbon', hex: '#0d1117' },
  { name: 'midnight', hex: '#0a0f1f' },
  { name: 'forest', hex: '#0c1411' },
  { name: 'aubergine', hex: '#160f19' },
  { name: 'graphite', hex: '#1c1d21' },
  { name: 'daylight', hex: '#ffffff' },
  { name: 'fog', hex: '#eef0f3' },
] as const
