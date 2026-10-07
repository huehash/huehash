import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/martian-mono'
import '../base.css'
import '../scenes.css'
import './try.css'

import { avoidHuesOf, contrastRatio, createHuehash, gradeFor, hueGap, oklchHue, toCssVariables, type Huehash } from '../../../src/index.js'
import { LINE } from '../../../src/grid.js'
import { hexToOklch, parseHex } from '../../../src/oklch.js'
import { backgroundsOf, cleanText, clampNumber, closestPair, colorOptions, DEFAULT_SETTINGS, EVERYONE, encodeHash, gridFor, gridOptions, LAYOUTS, readHash, reach, sequenceOf, STATUS, uniqueEntries, validSurface, writeHash, type Layout, type Sequence, type Settings } from '../shared/engine.js'
import { watchNeighbours } from '../shared/highlight.js'
import { SCENES } from '../shared/scenes.js'
import { highlight } from '../shared/code.js'
import { createStackView } from '../shared/stack3d-view.js'
import { inkFor, SURFACES } from '../shared/surface.js'
import { renderLogo } from '../shared/logo.js'
import { $, esc } from '../shared/util.js'
import { nearest, wheelSvg } from '../shared/wheel.js'

type Source = 'color' | 'names'

type State = Settings & {
  source: Source
  color: string
  word: string
  keys: string
  custom: boolean
  scene: string
  cache: boolean
  tab: 'js' | 'css' | 'json'
  drawer: boolean
  layout: Layout
  columns: number
  rows: number
}

const sequential = (count: number) => Array.from({ length: count }, (_, i) => `item-${i + 1}`)

/** A fixed pseudo-random sequence, so the "random ids" preset is the same every time. */
function randomIds(count: number): string[] {
  let seed = 20260610
  return Array.from({ length: count }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed.toString(16).padStart(8, '0')
  })
}

const PRESETS: Array<{ id: string; label: string; keys: string[] }> = [
  { id: 'sequential', label: 'Sequential', keys: sequential(24) },
  { id: 'random', label: 'Random ids', keys: randomIds(16) },
  { id: 'labels', label: 'Labels', keys: ['bug', 'feature', 'docs', 'chore', 'refactor', 'security', 'perf', 'test', 'build', 'release'] },
  { id: 'people', label: 'People', keys: ['ada', 'grace', 'linus', 'margaret', 'alan', 'barbara', 'dennis', 'ken', 'radia', 'tim'] },
]

/** Colours a team might already have, each too dull or too dim on at least one of the backgrounds. */
const COLORS = [
  { label: 'Orange', hex: '#c2410c' },
  { label: 'Indigo', hex: '#4338ca' },
  { label: 'Forest', hex: '#166534' },
  { label: 'Gold', hex: '#ca8a04' },
  { label: 'Rose', hex: '#be123c' },
]

const MAX_ALSO = 3
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

const DEFAULTS: State = {
  ...DEFAULT_SETTINGS,
  source: 'color',
  color: COLORS[0]!.hex,
  word: 'orbit',
  keys: '',
  custom: false,
  scene: 'logs',
  cache: true,
  tab: 'js',
  drawer: false,
  layout: 'grid',
  columns: 8,
  rows: 2,
}

/** The extra backgrounds from a link: real colours only, none repeated, none the one already drawn on. */
function validBackgrounds(value: unknown, primary: string): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set([primary])
  return value.flatMap(item => {
    const hex = validSurface(item, '')
    return hex && !seen.has(hex) && seen.size <= MAX_ALSO ? (seen.add(hex), [hex]) : []
  })
}

const read = readHash(DEFAULTS)
const surface = validSurface(read.surface, DEFAULTS.surface)
const state: State = {
  surface,
  also: validBackgrounds(read.also, surface),
  share: read.share === true,
  minContrast: clampNumber(read.minContrast, 3, 12, DEFAULTS.minContrast),
  mode: read.mode === 'dark' || read.mode === 'light' ? read.mode : 'auto',
  avoid: read.avoid === true,
  avoidWidth: clampNumber(read.avoidWidth, 10, 60, DEFAULTS.avoidWidth),
  distance: clampNumber(read.distance, 0, 120, DEFAULTS.distance),
  neighbours: clampNumber(read.neighbours, 1, EVERYONE, DEFAULTS.neighbours),
  source: read.source === 'names' ? 'names' : 'color',
  color: validSurface(read.color, DEFAULTS.color),
  word: cleanText(read.word, DEFAULTS.word, 40),
  keys: cleanText(read.keys, DEFAULTS.keys, 20000),
  custom: read.custom === true,
  scene: SCENES.some(s => s.id === read.scene) ? read.scene : DEFAULTS.scene,
  cache: read.cache !== false,
  tab: read.tab === 'css' || read.tab === 'json' ? read.tab : 'js',
  drawer: read.drawer === true,
  layout: LAYOUTS.find(layout => layout.id === read.layout)?.id ?? DEFAULTS.layout,
  columns: Math.round(clampNumber(read.columns, 2, 16, DEFAULTS.columns)),
  rows: Math.round(clampNumber(read.rows, 1, 8, DEFAULTS.rows)),
}
let engine: Huehash = createHuehash({}, { cacheSize: state.cache ? 2000 : 0 })
let lastOutput = ''
let timing = ''
const stackView = createStackView(() => render())

const scene = () => SCENES.find(s => s.id === state.scene) ?? SCENES[0]!
const keyList = () => {
  const text = state.custom ? state.keys : scene().keys.join('\n')
  return text.split('\n').map(line => line.trim()).filter(Boolean)
}
const neighboursLabel = (n: number) => (n >= EVERYONE ? 'all' : n === 1 ? '1 step' : `${n} steps`)
const gridNow = () => (scene().id === 'swatches' ? gridFor(state.layout, state.columns, state.rows) : LINE)
const backgrounds = () => backgroundsOf(state)
const nameOf = (hex: string) => SURFACES.find(s => s.hex === hex)?.name ?? hex
const asLiteral = (hexes: string[]) => (hexes.length === 1 ? `'${hexes[0]}'` : `[${hexes.map(hex => `'${hex}'`).join(', ')}]`)
const lowestContrast = (colors: string[], on: string[]) => Math.min(...colors.flatMap(hex => on.map(background => contrastRatio(hex, background))))
const fraction = (value: number) => `${(value * 100).toFixed(0)}%`
const mixedKinds = () => new Set(backgrounds().map(hex => inkFor(hex).light)).size > 1

/** Make the extra backgrounds consistent after any change: none repeated, none the one drawn on, no more than three. */
function tidyBackgrounds() {
  state.also = validBackgrounds(state.also, state.surface)
}

/* ── what the library makes ────────────────────────────────────────────── */

type Panel = { background: string; colors: string[]; seq: Sequence }

/**
 * The names coloured for every background. Each background gets colours made for it, unless one set is asked for,
 * and then a single sequence is measured against all of them.
 */
function namesOnEach(keys: string[], main: Sequence): Panel[] {
  if (state.share || backgrounds().length === 1) return backgrounds().map(background => ({ background, colors: main.colors, seq: main }))
  return backgrounds().map(background => {
    const seq = background === state.surface ? main : sequenceOf(engine, keys, { ...state, surface: background, also: [], share: false }, gridNow())
    return { background, colors: seq.colors, seq }
  })
}

type Made = { background: string; was: number; now: number; result: string }

/** Your colour made readable on every background: one result for each, or one shared result. */
function colourOnEach(): Made[] {
  const shared = state.share ? engine.readable(state.color, colorOptions(state)) : null
  return backgrounds().map(background => {
    const result = shared ?? engine.readable(state.color, colorOptions(state, background))
    return { background, was: contrastRatio(state.color, background), now: contrastRatio(result, background), result }
  })
}

/* ── rendering ─────────────────────────────────────────────────────────── */

function paint() {
  const ink = inkFor(state.surface)
  const root = document.documentElement
  root.style.setProperty('--surface', ink.surface)
  root.style.setProperty('--ink', ink.ink)
  root.style.setProperty('--muted', ink.muted)
  root.style.setProperty('--faint', ink.faint)
  root.style.setProperty('--rule', ink.rule)
  root.style.setProperty('--field', ink.field)
  root.toggleAttribute('data-light', ink.light)
}

function renderTop() {
  renderLogo($('#mark'), engine, colorOptions(state))
  $<HTMLAnchorElement>('#nav-home').href = `../#${encodeHash({ surface: state.surface })}`
}

function setValue(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement | null
  if (el && document.activeElement !== el) el.value = value
}

const swatch = (attribute: string, hex: string, pressed: boolean) =>
  `<button type="button" class="swatch" ${attribute}="${hex}" style="background:${hex}" aria-label="${nameOf(hex)}" title="${nameOf(hex)}" aria-pressed="${pressed}"></button>`

function renderBackgroundControls() {
  $('#surface-presets').innerHTML = SURFACES.map(s => swatch('data-surface', s.hex, state.surface === s.hex)).join('') + (SURFACES.some(s => s.hex === state.surface) ? '' : swatch('data-surface', state.surface, true))
  const options = [...SURFACES.map(s => s.hex as string), ...state.also.filter(hex => !SURFACES.some(s => s.hex === hex))].filter(hex => hex !== state.surface)
  $('#also').innerHTML = options.map(hex => swatch('data-also', hex, state.also.includes(hex))).join('')
  setValue('custom-surface', state.surface)
  ;($('#share') as HTMLInputElement).checked = state.share
  const many = backgrounds().length > 1
  ;($('#share') as HTMLInputElement).disabled = !many
  $('#share-hint').textContent = !many
    ? 'Add a second background to make one colour that reads on both.'
    : state.share
      ? mixedKinds()
        ? 'A dark and a light background cannot share one colour at this contrast, so you get the best both allow. Ask for each separately to get a colour that fully reads on each.'
        : 'One colour for every name, checked against all of the backgrounds at once.'
      : 'Each background gets colours made for it.'
}

/** Make every control in the rail show the current state, without rebuilding it. */
function syncRail() {
  const names = state.source === 'names'
  $('#source').innerHTML = (
    [['color', 'A colour'], ['names', 'Names']] as const
  )
    .map(([value, label]) => `<button type="button" data-source="${value}" aria-pressed="${state.source === value}">${label}</button>`)
    .join('')
  $('#source-color').hidden = names
  $('#source-names').hidden = !names
  setValue('color-picker', state.color)
  setValue('color-hex', state.color)
  ;($('#color-hex') as HTMLInputElement).removeAttribute('aria-invalid')
  $('#color-presets').innerHTML = COLORS.map(c => `<button type="button" class="quiet" data-color="${c.hex}" style="color:${c.hex}">${c.label}</button>`).join('')

  const keys = $<HTMLTextAreaElement>('#keys')
  if (document.activeElement !== keys) keys.value = keyList().join('\n')
  $('#keys-hint').textContent = state.custom ? 'Your names, one per line, in the order you draw them. Neighbours sit next to each other, and in a grid above and below too.' : `Example names for the ${scene().label.toLowerCase()} view. Edit them to use your own.`
  setValue('word', state.word)
  renderBackgroundControls()
  setValue('contrast', String(state.minContrast))
  $('#contrast-value').textContent = `${state.minContrast}:1 ${gradeFor(state.minContrast)}`
  setValue('distance', String(state.distance))
  $('#distance-value').textContent = state.distance === 0 ? 'off' : `${state.distance}°`
  setValue('neighbours', String(state.neighbours))
  $('#neighbours-value').textContent = neighboursLabel(state.neighbours)
  const swatches = names && scene().id === 'swatches'
  $('#distance-section').hidden = !names
  $('#avoid-section').hidden = !names
  $('#layout-section').hidden = !swatches
  $('#layout-hint').hidden = swatches
  $('#layout').innerHTML = LAYOUTS.map(({ id, label }) => `<button type="button" data-layout="${id}" aria-pressed="${state.layout === id}">${label}</button>`).join('')
  $('#columns-control').hidden = state.layout === 'line'
  $('#rows-control').hidden = state.layout !== 'stack'
  setValue('columns', String(state.columns))
  $('#columns-value').textContent = String(state.columns)
  setValue('rows', String(state.rows))
  $('#rows-value').textContent = String(state.rows)
  ;($('#avoid') as HTMLInputElement).checked = state.avoid
  setValue('avoid-width', String(state.avoidWidth))
  ;($('#avoid-width') as HTMLInputElement).disabled = !state.avoid
  $('#avoid-width-value').textContent = `${state.avoidWidth}°`
  $('#mode').innerHTML = (
    [['auto', 'Follow background'], ['dark', 'Dark'], ['light', 'Light']] as const
  )
    .map(([value, label]) => `<button type="button" data-mode="${value}" aria-pressed="${state.mode === value}">${label}</button>`)
    .join('')
  $('#presets').innerHTML = [
    ...PRESETS.map(p => `<button type="button" class="quiet" data-preset="${p.id}">${p.label}</button>`),
    state.custom ? `<button type="button" class="quiet" data-preset="example">This view's example</button>` : '',
  ].join('')
}

/** Your colour, and what it became, on each background. */
function renderColourStage(made: Made[]) {
  const before = hexToOklch(state.color)
  $('#scenes').innerHTML = ''
  $('#caption').textContent = 'Your colour keeps its hue. Only its lightness moves, as little as the contrast needs, and a colour that already reads is left alone.'
  $('#frame').innerHTML = `<div class="color-panels">${made
    .map(({ background, was, now, result }) => {
      const ink = inkFor(background)
      const after = hexToOklch(result)
      const unchanged = result === parseHex(state.color)
      const change = unchanged ? 'Already reads, so it is left as it is.' : `Lightness ${fraction(before.l)} to ${fraction(after.l)}. The hue stays at ${before.h.toFixed(0)}°.`
      return `<article class="color-panel" style="background:${background};color:${ink.ink};--ink:${ink.ink};--muted:${ink.muted}"><h4>${esc(nameOf(background))}</h4><p class="mono tone">${esc(background)}, ${ink.light ? 'light' : 'dark'}</p>
        <p class="sample was" style="color:${state.color}">Your colour</p><p class="mono">${was.toFixed(1)}:1 ${esc(gradeFor(was))}</p>
        <p class="sample now" style="color:${result}">${unchanged ? 'Unchanged' : 'Made readable'}</p><p class="mono">${now.toFixed(1)}:1 ${esc(gradeFor(now))}, ${esc(result)}</p>
        <p class="mono change">${esc(change)}</p></article>`
    })
    .join('')}</div>`
}

/** The names, on the background the page is drawn on, in the chosen view. */
function renderNamesStage(): Sequence {
  $('#scenes').innerHTML = SCENES.map(s => `<button type="button" role="tab" data-scene="${s.id}" aria-selected="${state.scene === s.id}">${s.label}</button>`).join('')
  $('#caption').textContent = scene().caption
  const seq = sequenceOf(engine, keyList(), state, gridNow())
  const stack = scene().id === 'swatches' && state.layout === 'stack'
  if (stack) stackView.start()
  if (stack && stackView.ready()) {
    $('#frame').innerHTML = '<div id="stack3d-slot"></div>'
    stackView.show($('#stack3d-slot'), seq, state.surface)
  } else {
    $('#frame').innerHTML = scene().render(seq)
  }
  return seq
}

/** The same names on every background, each with the lowest contrast it reached there. */
function renderBackdrops(panels: Panel[]) {
  const shown = panels.length > 1 && panels[0]!.colors.length > 0
  $('#backdrops').hidden = !shown
  if (!shown) return
  $('#backdrop-row').innerHTML = panels
    .map(({ background, colors, seq }) => {
      const ink = inkFor(background)
      const words = uniqueEntries({ ...seq, colors }).slice(0, 8).map(entry => `<li style="color:${entry.color}">${esc(entry.key)}</li>`).join('')
      return `<article class="backdrop" style="background:${background};color:${ink.ink};--ink:${ink.ink};--muted:${ink.muted}"><h4>${esc(nameOf(background))}</h4><ul>${words}</ul><p class="mono worst">Lowest contrast <b>${lowestContrast(colors, [background]).toFixed(1)}:1</b></p></article>`
    })
    .join('')
}

function renderStats(seq: Sequence | null, made: Made[]) {
  let rows: string[][]
  if (seq) {
    const pair = closestPair(seq, Math.min(reach(state), 5))
    const on = state.share ? backgrounds() : [state.surface]
    const lowest = seq.colors.length ? lowestContrast(seq.colors, on) : null
    const mode = engine.describeColor('x', colorOptions(state)).mode
    rows = [
      ['Names', String(new Set(seq.keys).size)],
      ['Lowest contrast', lowest === null ? 'none' : `${lowest.toFixed(1)}:1`],
      ['Closest neighbours', pair ? `${pair.gap.toFixed(0)}°` : 'none'],
      ['Style', mode],
    ]
    const short = pair && state.distance > 0 && pair.gap < state.distance - 4
    $('#metric').innerHTML = !pair
      ? 'Add at least two names to see how far apart neighbours are.'
      : `Closest neighbours right now: <b>${pair.gap.toFixed(0)}°</b> apart (${esc(pair.a)} and ${esc(pair.b)}).${short ? ` Short of ${state.distance}°: the wheel is too crowded for that distance.` : ''}`
  } else {
    const hue = hexToOklch(state.color).h
    const drift = Math.max(...made.map(m => hueGap(hexToOklch(m.result).h, hue)))
    rows = [
      ['Backgrounds', String(made.length)],
      ['Lowest contrast now', `${Math.min(...made.map(m => m.now)).toFixed(1)}:1`],
      ['Left unchanged', `${made.filter(m => m.result === parseHex(state.color)).length} of ${made.length}`],
      ['Hue moved by', `${drift.toFixed(1)}°`],
    ]
  }
  $('#stats').innerHTML = rows.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('')
}

function renderOne(seq: Sequence | null) {
  const d = engine.describeColor(state.word || ' ', colorOptions(state))
  const input = $<HTMLInputElement>('#word')
  input.placeholder = 'orbit'
  input.style.color = d.hex
  const dots = seq ? uniqueEntries(seq).map(e => ({ name: e.key, hex: e.color, hue: e.hue })) : []
  const focus = state.word.trim() ? { name: state.word, hex: d.hex, hue: d.oklch.h } : null
  const close = focus && dots.length ? nearest(focus, dots) : null
  $('#readout').innerHTML = state.word.trim()
    ? `<span><b>${d.hex}</b></span><span>${esc(d.css)}</span><span>contrast <b>${d.contrast.toFixed(1)}:1</b> ${esc(d.grade)}</span>${close ? `<span>nearest name: ${esc(close.name)}, ${close.gap.toFixed(0)}° away</span>` : ''}`
    : '<span>Type a name to see its colour.</span>'
  const ink = inkFor(state.surface)
  $('#wheel').innerHTML = wheelSvg({
    dots,
    focus,
    avoid: state.avoid ? avoidHuesOf(STATUS, state.avoidWidth) : [],
    light: d.mode === 'light',
    ink: ink.ink,
    surface: ink.surface,
    marks: state.avoid ? STATUS.map(hex => ({ hue: oklchHue(hex), hex })) : [],
  })
}

/** The library options as they would be written, for the background(s) asked for. */
function optionsLiteral(background: string[], grid: Sequence['grid'] | null): string {
  const parts = [`background: ${asLiteral(background)}`]
  if (grid) {
    parts.push(`distance: ${state.distance}`)
    if (state.neighbours !== 1) parts.push(`neighbours: ${state.neighbours >= EVERYONE ? 'Infinity' : state.neighbours}`)
    Object.entries(gridOptions(grid)).forEach(([name, value]) => parts.push(`${name}: ${value}`))
  }
  if (state.minContrast !== 7) parts.push(`minContrast: ${state.minContrast}`)
  if (state.mode !== 'auto') parts.push(`mode: '${state.mode}'`)
  if (grid && state.avoid) parts.push(`avoid: avoidHuesOf(${JSON.stringify(STATUS)}, ${state.avoidWidth})`)
  return parts.join(', ')
}

const identifier = (hex: string, index: number) => (SURFACES.some(s => s.hex === hex) ? nameOf(hex) : `background${index + 1}`)

function renderCode(seq: Sequence | null, made: Made[], panels: Panel[]) {
  let code = ''
  let map: Record<string, unknown> = {}
  const separate = !state.share && backgrounds().length > 1
  if (!seq) {
    const calls = state.share ? [{ background: backgrounds(), result: made[0]!.result }] : made.map(m => ({ background: [m.background], result: m.result }))
    map = Object.fromEntries(made.map(m => [nameOf(m.background), m.result]))
    if (state.tab === 'js') {
      const lines = calls.map(call => `readable('${state.color}', { ${optionsLiteral(call.background, null)} })  // '${call.result}'`)
      code = `import { readable } from 'huehash'\n\n${lines.join('\n')}`
    } else if (state.tab === 'css') {
      code = toCssVariables(map as Record<string, string>)
    } else {
      code = JSON.stringify(map, null, 2)
    }
  } else {
    const flat: Record<string, string> = {}
    seq.keys.forEach((key, i) => {
      if (!(key in flat)) flat[key] = seq.colors[i]!
    })
    const byName = (panel: Panel) => {
      const colors: Record<string, string> = {}
      panel.seq.keys.forEach((key, i) => {
        if (!(key in colors)) colors[key] = panel.colors[i]!
      })
      return colors
    }
    map = separate ? Object.fromEntries(panels.map(p => [nameOf(p.background), byName(p)])) : flat
    if (state.tab === 'js') {
      const shown = seq.keys.slice(0, 6).map(key => `'${key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`)
      const more = seq.keys.length > 6 ? `, /* ${seq.keys.length - 6} more */` : ''
      const imports = ['colorsFor', ...(state.avoid ? ['avoidHuesOf'] : [])].join(', ')
      const preview = (colors: string[]) => `[${colors.slice(0, 6).map(hex => `'${hex}'`).join(', ')}${seq.keys.length > 6 ? ', …' : ''}]`
      const calls = separate
        ? panels.map((p, i) => `const ${identifier(p.background, i)} = colorsFor(keys, { ${optionsLiteral([p.background], seq.grid)} })\n// ${preview(p.colors)}`).join('\n\n')
        : `const colors = colorsFor(keys, { ${optionsLiteral(state.share ? backgrounds() : [state.surface], seq.grid)} })\n\n// colors[i] is the colour for keys[i]\n// ${preview(seq.colors)}`
      code = `import { ${imports} } from 'huehash'\n\nconst keys = [${shown.join(', ')}${more}]\n${separate ? '\n// one set of colours for each background, each index matching keys' : ''}${calls}`.replace(/\n\n\n/g, '\n\n')
      if (separate) code = code.replace(/\]\n\/\/ one set/, ']\n\n// one set')
    } else if (state.tab === 'css') {
      code = separate ? panels.map(p => toCssVariables(byName(p), { selector: `[data-background='${nameOf(p.background)}']` })).join('\n\n') : toCssVariables(flat)
    } else {
      code = JSON.stringify(map, null, 2)
    }
  }
  lastOutput = code
  $('#code').innerHTML = highlight(code, state.surface)
  $('#tabs').innerHTML = (['js', 'css', 'json'] as const)
    .map(tab => `<button type="button" role="tab" data-tab="${tab}" aria-selected="${state.tab === tab}">${{ js: 'JavaScript', css: 'CSS variables', json: 'JSON' }[tab]}</button>`)
    .join('')
  const open = state.drawer
  $('#drawer-body').hidden = !open
  $('#drawer-toggle').setAttribute('aria-expanded', String(open))
  $('#drawer-toggle').textContent = open ? 'Hide code' : 'Show code'
}

function renderCache() {
  const stats = engine.cacheStats()
  const rate = stats.hits + stats.misses ? Math.round((stats.hits / (stats.hits + stats.misses)) * 100) : 0
  $('#cache').innerHTML = `
    <div class="counters"><div class="stat"><b>${stats.hits}</b><span>from memory</span></div><div class="stat"><b>${stats.misses}</b><span>calculated</span></div><div class="stat"><b>${rate}%</b><span>hit rate</span></div></div>
    <label class="toggle" for="cache-on"><input type="checkbox" id="cache-on" ${state.cache ? 'checked' : ''} />Remember results</label>
    <button type="button" class="run" id="bench">Time 100,000 lookups</button>
    <p class="timing mono" id="timing" aria-live="polite">${esc(timing)}</p>`
}

function render() {
  tidyBackgrounds()
  paint()
  renderTop()
  syncRail()
  const names = state.source === 'names'
  const made = names ? [] : colourOnEach()
  let seq: Sequence | null = null
  let panels: Panel[] = []
  if (names) {
    seq = renderNamesStage()
    panels = namesOnEach(seq.keys, seq)
  } else {
    renderColourStage(made)
  }
  renderBackdrops(panels)
  renderStats(seq, made)
  renderOne(seq)
  renderCode(seq, made, panels)
  renderCache()
  writeHash(state, DEFAULTS)
}

/* ── events ────────────────────────────────────────────────────────────── */

$<HTMLInputElement>('#word').addEventListener('input', event => {
  state.word = (event.target as HTMLInputElement).value
  render()
})

$<HTMLTextAreaElement>('#keys').addEventListener('input', event => {
  state.keys = (event.target as HTMLTextAreaElement).value
  state.custom = true
  render()
})

/** Accept a hex typed by hand once it is a whole colour: `#abc` or `#aabbcc`. */
$<HTMLInputElement>('#color-hex').addEventListener('input', event => {
  const field = event.target as HTMLInputElement
  const text = field.value.trim().startsWith('#') ? field.value.trim() : `#${field.value.trim()}`
  if (!HEX.test(text)) return field.setAttribute('aria-invalid', 'true')
  state.color = parseHex(text)
  render()
  return field.removeAttribute('aria-invalid')
})

document.addEventListener('click', event => {
  const target = event.target as HTMLElement
  const source = target.closest<HTMLElement>('[data-source]')
  if (source) {
    state.source = source.dataset.source === 'names' ? 'names' : 'color'
    return render()
  }
  const surface = target.closest<HTMLElement>('[data-surface]')
  if (surface) {
    state.surface = surface.dataset.surface as string
    return render()
  }
  const also = target.closest<HTMLElement>('[data-also]')
  if (also) {
    const hex = also.dataset.also as string
    state.also = state.also.includes(hex) ? state.also.filter(other => other !== hex) : [...state.also, hex]
    return render()
  }
  const color = target.closest<HTMLElement>('[data-color]')
  if (color) {
    state.color = color.dataset.color as string
    return render()
  }
  const sceneTab = target.closest<HTMLElement>('[data-scene]')
  if (sceneTab) {
    state.scene = sceneTab.dataset.scene as string
    state.source = 'names'
    return render()
  }
  const preset = target.closest<HTMLElement>('[data-preset]')
  if (preset) {
    const id = preset.dataset.preset
    if (id === 'example') {
      state.custom = false
      state.keys = ''
    } else {
      const chosen = PRESETS.find(p => p.id === id)
      if (chosen) {
        state.keys = chosen.keys.join('\n')
        state.custom = true
        $<HTMLTextAreaElement>('#keys').value = state.keys
      }
    }
    return render()
  }
  const layout = target.closest<HTMLElement>('[data-layout]')
  if (layout) {
    state.layout = LAYOUTS.find(candidate => candidate.id === layout.dataset.layout)?.id ?? state.layout
    return render()
  }
  const mode = target.closest<HTMLElement>('[data-mode]')
  if (mode) {
    state.mode = mode.dataset.mode as State['mode']
    return render()
  }
  const tab = target.closest<HTMLElement>('[data-tab]')
  if (tab) {
    state.tab = tab.dataset.tab as State['tab']
    return render()
  }
  if (target.id === 'drawer-toggle') {
    state.drawer = !state.drawer
    return render()
  }
  if (target.id === 'copy') {
    void navigator.clipboard?.writeText(lastOutput)
    target.textContent = 'Copied'
    setTimeout(() => (target.textContent = 'Copy'), 1200)
  }
  if (target.id === 'share-link') {
    void navigator.clipboard?.writeText(location.href)
    target.textContent = 'Link copied'
    setTimeout(() => (target.textContent = 'Copy link'), 1400)
  }
  if (target.id === 'bench') {
    ;(target as HTMLButtonElement).disabled = true
    timing = 'Running…'
    renderCache()
    setTimeout(() => {
      const keys = Array.from({ length: 200 }, (_, i) => `item-${i}`)
      const measure = (cacheSize: number) => {
        const h = createHuehash({}, { cacheSize })
        keys.forEach(key => h.colorFor(key, colorOptions(state)))
        const start = performance.now()
        for (let pass = 0; pass < 500; pass += 1) keys.forEach(key => h.colorFor(key, colorOptions(state)))
        return performance.now() - start
      }
      const off = measure(0)
      const on = measure(2000)
      timing = `100,000 lookups: ${off.toFixed(0)} ms calculating each time, ${on.toFixed(0)} ms cached, ${(off / Math.max(on, 0.01)).toFixed(1)} times faster.`
      renderCache()
    }, 30)
  }
  return undefined
})

const numeric: Record<string, 'minContrast' | 'distance' | 'neighbours' | 'avoidWidth' | 'columns' | 'rows'> = { contrast: 'minContrast', distance: 'distance', neighbours: 'neighbours', 'avoid-width': 'avoidWidth', columns: 'columns', rows: 'rows' }

document.addEventListener('input', event => {
  const target = event.target as HTMLInputElement
  if (target.id === 'custom-surface') {
    state.surface = target.value
    return render()
  }
  if (target.id === 'color-picker') {
    state.color = parseHex(target.value)
    return render()
  }
  const field = numeric[target.id]
  if (field) {
    state[field] = Number(target.value)
    return render()
  }
  return undefined
})

document.addEventListener('change', event => {
  const target = event.target as HTMLInputElement
  if (target.id === 'avoid') state.avoid = target.checked
  else if (target.id === 'share') state.share = target.checked
  else if (target.id === 'also-custom') {
    if (!validSurface(target.value, '')) return
    state.also = [...state.also, target.value.toLowerCase()]
  } else if (target.id === 'cache-on') {
    state.cache = target.checked
    engine = createHuehash({}, { cacheSize: state.cache ? 2000 : 0 })
  } else return
  render()
})

render()
watchNeighbours()
