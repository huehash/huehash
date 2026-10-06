import { hueGap, type HueArc } from '../../src/index.js'
import { oklchToHex } from '../../src/oklch.js'

export type WheelDot = { name: string; hue: number; hex: string }

const SIZE = 360
const CENTER = SIZE / 2
const OUTER = 150
const INNER = 118
const polar = (radius: number, hue: number): [number, number] => {
  const angle = ((hue - 90) * Math.PI) / 180
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)]
}

function arc(from: number, to: number, outer: number, inner: number): string {
  const [x1, y1] = polar(outer, from)
  const [x2, y2] = polar(outer, to)
  const [x3, y3] = polar(inner, to)
  const [x4, y4] = polar(inner, from)
  const large = to - from > 180 ? 1 : 0
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${outer} ${outer} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}L${x3.toFixed(2)} ${y3.toFixed(2)}A${inner} ${inner} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}Z`
}

export type WheelInput = {
  dots: WheelDot[]
  focus: WheelDot | null
  avoid: HueArc[]
  light: boolean
  ink: string
  surface: string
  marks: Array<{ hue: number; hex: string }>
}

/** The hue ring as an SVG string: the colour at every hue, the avoided arcs struck out, and where each name sits. */
export function wheelSvg({ dots, focus, avoid, light, ink, surface, marks }: WheelInput): string {
  const lightness = light ? 0.52 : 0.8
  const chroma = light ? 0.14 : 0.125
  const segments = Array.from({ length: 180 }, (_, i) => {
    const from = i * 2
    return `<path d="${arc(from, from + 2.4, OUTER, INNER)}" fill="${oklchToHex(lightness, chroma, from + 1)}"/>`
  }).join('')
  const blocked = avoid
    .map(({ hue, width }) => {
      const from = hue - width / 2
      return `<path d="${arc(from, from + width, OUTER + 3, INNER - 3)}" fill="url(#hatch)" stroke="${ink}" stroke-opacity=".45" stroke-width="1"/>`
    })
    .join('')
  const ticks = marks
    .map(({ hue, hex }) => {
      const [x1, y1] = polar(INNER - 8, hue)
      const [x2, y2] = polar(INNER - 24, hue)
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${hex}" stroke-width="3" stroke-linecap="round"/>`
    })
    .join('')
  const points = dots
    .filter(dot => dot !== focus)
    .map(dot => {
      const [x, y] = polar((OUTER + INNER) / 2, dot.hue)
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${dot.hex}" stroke="${surface}" stroke-width="2.5"><title>${dot.name}</title></circle>`
    })
    .join('')
  let focusMark = ''
  if (focus) {
    const [x, y] = polar((OUTER + INNER) / 2, focus.hue)
    const [lx, ly] = polar(OUTER + 20, focus.hue)
    focusMark = `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${lx.toFixed(1)}" y2="${ly.toFixed(1)}" stroke="${focus.hex}" stroke-width="2"/><circle class="focus-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="${focus.hex}" stroke="${surface}" stroke-width="3.5"/>`
  }
  return `<svg viewBox="-24 -24 ${SIZE + 48} ${SIZE + 48}" role="img" aria-label="Hue wheel showing where each name falls and which hues are kept clear">
  <defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="${surface}" fill-opacity=".72"/><line x1="0" y1="0" x2="0" y2="5" stroke="${ink}" stroke-opacity=".55" stroke-width="1.4"/></pattern></defs>
  <g>${segments}</g>${blocked}${ticks}${points}${focusMark}
</svg>`
}

/** The closest other name on the wheel, for the line under the hero. */
export function nearest(focus: WheelDot, others: WheelDot[]): { name: string; gap: number } | null {
  const pool = others.filter(dot => dot.name !== focus.name)
  if (!pool.length) return null
  const best = pool.reduce((a, b) => (hueGap(a.hue, focus.hue) <= hueGap(b.hue, focus.hue) ? a : b))
  return { name: best.name, gap: hueGap(best.hue, focus.hue) }
}
