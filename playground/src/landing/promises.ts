import { avoidHuesOf, contrastRatio, gradeFor, hueGap, oklchHue } from '../../../src/index.js'
import { closestPair, gridFor, gridOptions, LAYOUTS, naiveColor, sequenceOf, STATUS, STATUS_LABELS, type Layout } from '../shared/engine.js'
import { LINE, type Grid } from '../../../src/grid.js'
import { SCENES } from '../shared/scenes.js'
import { inkFor, SURFACES } from '../shared/surface.js'
import { $, esc } from '../shared/util.js'
import { wheelSvg } from '../shared/wheel.js'
import { engine, jsString, NAMES, options, PEOPLE, settings, state } from './ctx.js'

const syncSlider = (selector: string, value: number) => {
  const slider = $<HTMLInputElement>(selector)
  if (document.activeElement !== slider) slider.value = String(value)
}

/* ── Stable ────────────────────────────────────────────────────────────── */

const START = ['api', 'auth', 'billing', 'cron', 'search', 'worker']

const CHANGES = {
  remove: { label: 'Remove the first name', after: 'After removing api', names: START.slice(1) },
  add: { label: 'Add a name at the front', after: 'After adding mailer at the front', names: ['mailer', ...START] },
  reverse: { label: 'Reverse the order', after: 'After reversing the order', names: [...START].reverse() },
}
type Change = keyof typeof CHANGES
let change: Change = 'remove'

export function chooseChange(value: string | undefined) {
  if (value && value in CHANGES) change = value as Change
}

export function renderStable() {
  const slots = engine.colorsFor(Array.from({ length: 8 }, (_, i) => `slot ${i + 1}`), { ...options(), distance: 40, neighbours: Infinity })
  const byPosition = (list: string[], name: string) => slots[list.indexOf(name) % slots.length]!
  const byName = (_list: string[], name: string) => engine.colorFor(name, options())
  const { names: after, after: afterLabel } = CHANGES[change]
  const kept = START.filter(name => after.includes(name))

  const approach = (title: string, rule: string, colorOf: (list: string[], name: string) => string) => {
    const moved = kept.filter(name => colorOf(START, name) !== colorOf(after, name))
    const column = (label: string, list: string[], marks: string[]) =>
      `<div><p class="col-label">${label}</p><ul class="names">${list.map(name => `<li class="${marks.includes(name) ? 'moved' : ''}" style="color:${colorOf(list, name)}">${esc(name)}</li>`).join('')}</ul></div>`
    return `<section class="approach"><header><h4>${title}</h4><p class="rule mono">${rule}</p></header><div class="before-after">${column('Before', START, [])}${column(afterLabel, after, moved)}</div><p class="tally ${moved.length ? 'bad' : 'good'}">${moved.length} of ${kept.length} colours changed</p></section>`
  }

  const buttons = (Object.keys(CHANGES) as Change[]).map(id => `<button type="button" data-action="change" data-change="${id}" aria-pressed="${change === id}">${CHANGES[id].label}</button>`).join('')
  $('#stable-body').innerHTML = `<div class="segmented" role="group" aria-label="Change the list">${buttons}</div><div class="approaches">${approach('A palette, by position', 'colour = palette[position]', byPosition)}${approach('huehash, by name', 'colour = colorFor(name)', byName)}</div>`
  $('#stable-code').textContent = `colorFor('billing')\n// ${engine.colorFor('billing', options())}, whatever else is in the list`
}

/* ── Readable ──────────────────────────────────────────────────────────── */

export function renderReadable() {
  syncSlider('#contrast-slider', state.minContrast)
  $('#contrast-value').textContent = `${state.minContrast}:1 ${gradeFor(state.minContrast)}`
  $('#readable-code').textContent = `colorFor('billing', {\n  background: ${jsString(state.surface)},\n  minContrast: ${state.minContrast},\n})\n// ${engine.colorFor('billing', { ...options(), minContrast: state.minContrast })}`

  $('#readable-body').innerHTML = ['carbon', 'midnight', 'aubergine', 'daylight', 'fog']
    .map(name => {
      const surface = SURFACES.find(s => s.name === name)!
      const ink = inkFor(surface.hex)
      const colors = engine.colorsFor(PEOPLE, { background: surface.hex, minContrast: state.minContrast, distance: 30 })
      const worst = Math.min(...colors.map(hex => contrastRatio(hex, surface.hex)))
      const mode = engine.describeColor('ada', { background: surface.hex }).mode
      const vars = `--surface:${ink.surface};--ink:${ink.ink};--muted:${ink.muted};--faint:${ink.faint};--rule:${ink.rule}`
      return `<article class="panel" style="${vars};background:${surface.hex};color:${ink.ink}"><h4>${surface.name}</h4><p class="mono tone">${esc(surface.hex)}, ${mode}</p><ul>${PEOPLE.map((key, i) => `<li style="color:${colors[i]}">${key}</li>`).join('')}</ul><p class="mono worst">Lowest contrast <b>${worst.toFixed(1)}:1</b></p></article>`
    })
    .join('')
}

/* ── Even ──────────────────────────────────────────────────────────────── */

function measure(colors: string[]) {
  const ratios = colors.map(hex => contrastRatio(hex, state.surface))
  return { below: ratios.filter(r => r < 4.5).length, lowest: Math.min(...ratios), spread: Math.max(...ratios) / Math.min(...ratios), ratios }
}

export function renderEven() {
  $('#even-code').textContent = `colorFor('billing')\n// no option for this: every colour is made this way`
  const column = (title: string, note: string, colors: string[], goal: string) => {
    const m = measure(colors)
    const items = NAMES.map((key, i) => `<li><span class="word" style="color:${colors[i]}">${key}</span><span class="num${m.ratios[i]! < 4.5 ? ' low' : ''}" ${m.ratios[i]! < 4.5 ? 'title="Below 4.5:1, the AA minimum for text"' : ''}>${m.ratios[i]!.toFixed(1)}:1</span></li>`).join('')
    return `<div class="column"><h4><code>${title}</code></h4><p class="note">${note}</p><ul class="compare-list">${items}</ul><dl class="measures"><div><dt>Under 4.5:1</dt><dd class="${m.below ? 'bad' : 'good'}">${m.below} of ${NAMES.length}</dd></div><div><dt>Faintest</dt><dd>${m.lowest.toFixed(1)}:1</dd></div><div><dt>Brightest to faintest</dt><dd>${m.spread.toFixed(1)} times</dd></div></dl><p class="goal">${goal}</p></div>`
  }
  $('#even-body').innerHTML =
    column('hsl(hash % 360, 70%, 60%)', 'The same saturation and lightness for every hue.', NAMES.map(naiveColor), 'Some names glow and some fade, and nothing stops the faint ones.') +
    column('huehash', 'The same perceived lightness, lifted until it reads.', NAMES.map(name => engine.colorFor(name, options())), 'Every name reads, and they all look equally bright.')
}

/* ── Apart ─────────────────────────────────────────────────────────────── */

const SPACES: Record<Layout, { count: number; grid: Grid }> = {
  line: { count: 12, grid: LINE },
  grid: { count: 32, grid: gridFor('grid', 8, Infinity) },
  stack: { count: 36, grid: gridFor('stack', 4, 3) },
}

const stepsLabel = (steps: number) => (steps === 1 ? '1 step' : `${steps} steps`)

function strip(distance: number) {
  const { count, grid } = SPACES[state.layout]
  const names = Array.from({ length: count }, (_, i) => `item-${i + 1}`)
  const seq = sequenceOf(engine, names, { ...settings(), distance, neighbours: state.steps }, grid)
  const pair = closestPair(seq, state.steps)
  const tiles = SCENES.find(s => s.id === 'swatches')!.render(seq)
  return `${tiles}<p class="metric">Closest neighbours within ${stepsLabel(state.steps)}: <b>${pair ? pair.gap.toFixed(0) : 0}°</b> apart${pair ? ` (${esc(pair.a)} and ${esc(pair.b)})` : ''}.</p>`
}

export function renderApart() {
  syncSlider('#distance-slider', state.distance)
  syncSlider('#steps-slider', state.steps)
  const label = state.distance === 0 ? 'off' : `${state.distance}°`
  $('#distance-value').textContent = label
  $('#steps-value').textContent = stepsLabel(state.steps)
  const { grid } = SPACES[state.layout]
  const layout = Object.entries(gridOptions(grid)).map(([name, value]) => `\n  ${name}: ${value},`).join('')
  $('#apart-code').textContent = `colorsFor(names, {\n  distance: ${state.distance},\n  neighbours: ${state.steps},${layout}\n})`
  const buttons = LAYOUTS.map(({ id, label: text }) => `<button type="button" data-action="layout" data-layout="${id}" aria-pressed="${state.layout === id}">${text}</button>`).join('')
  $('#apart-body').innerHTML = `<div class="segmented" role="group" aria-label="How the items are laid out">${buttons}</div><p class="exhibit-note">Hover a tile to see which tiles count as its neighbours. Dashed tiles look alike. Drag the distance to off to see what happens without it.</p><div class="nb-row"><h4>Distance ${label}</h4>${strip(state.distance)}</div>`
}

/* ── Reserved ──────────────────────────────────────────────────────────── */

export function renderReserved() {
  syncSlider('#width-slider', state.width)
  $('#width-value').textContent = `${state.width}°`
  $('#reserved-code').textContent = `const status = avoidHuesOf(\n  ${JSON.stringify(STATUS).replace(/"/g, "'").replace(/,/g, ', ')},\n  ${state.width},\n)\ncolorFor('billing', { avoid: status })`

  const ink = inkFor(state.surface)
  const arcs = avoidHuesOf(STATUS, state.width)
  const tolerance = state.width / 2 - 1
  const statusHues = STATUS.map(oklchHue)
  const closest = (hex: string) =>
    statusHues.reduce((best, hue, i) => {
      const gap = hueGap(oklchHue(hex), hue)
      return gap < best.gap ? { gap, label: STATUS_LABELS[i]! } : best
    }, { gap: 360, label: '' })

  const plain = NAMES.map(name => engine.colorFor(name, options()))
  const clear = NAMES.map(name => engine.colorFor(name, { ...options(), avoid: arcs }))
  const words = (colors: string[]) =>
    NAMES.map((name, i) => {
      const near = closest(colors[i]!)
      const flagged = near.gap < tolerance
      return `<li class="${flagged ? 'near' : ''}" style="color:${colors[i]}"${flagged ? ` title="${esc(name)} sits ${near.gap.toFixed(0)}° from ${near.label}"` : ''}>${esc(name)}</li>`
    }).join('')
  const count = (colors: string[]) => colors.filter(hex => closest(hex).gap < tolerance).length
  const tally = (colors: string[]) => `<p class="tally ${count(colors) ? 'bad' : 'good'}">${count(colors)} of ${NAMES.length} names sit on a status colour</p>`

  const status = STATUS.map((hex, i) => `<li><i class="dot" style="background:${hex}"></i>${STATUS_LABELS[i]}</li>`).join('')
  const wheel = wheelSvg({
    dots: NAMES.map((name, i) => ({ name, hue: oklchHue(clear[i]!), hex: clear[i]! })),
    focus: null,
    avoid: arcs,
    light: ink.light,
    ink: ink.ink,
    surface: ink.surface,
    marks: STATUS.map(hex => ({ hue: oklchHue(hex), hex })),
  })
  $('#reserved-body').innerHTML = `<ul class="status" aria-label="Your status colours">${status}</ul><div class="reserved-grid"><div class="reserved-lists"><div><h4>Without</h4><ul class="names flow">${words(plain)}</ul>${tally(plain)}</div><div><h4>With</h4><ul class="names flow">${words(clear)}</ul>${tally(clear)}</div></div><figure class="wheel">${wheel}</figure></div>`
}
