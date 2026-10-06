import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/martian-mono'
import '../base.css'
import '../scenes.css'
import './try.css'

import { avoidHuesOf, contrastRatio, createHuehash, oklchHue, toCssVariables, type Huehash } from '../../../src/index.js'
import { LINE } from '../../../src/grid.js'
import { cleanText, clampNumber, closestPair, colorOptions, DEFAULT_SETTINGS, EVERYONE, encodeHash, gridFor, gridOptions, LAYOUTS, readHash, reach, sequenceOf, STATUS, uniqueEntries, validSurface, writeHash, type Layout, type Settings } from '../shared/engine.js'
import { watchNeighbours } from '../shared/highlight.js'
import { SCENES } from '../shared/scenes.js'
import { inkFor, SURFACES } from '../shared/surface.js'
import { $, esc } from '../shared/util.js'
import { nearest, wheelSvg } from '../shared/wheel.js'

type State = Settings & {
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

const DEFAULTS: State = {
  ...DEFAULT_SETTINGS,
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

const read = readHash(DEFAULTS)
const state: State = {
  surface: validSurface(read.surface, DEFAULTS.surface),
  minContrast: clampNumber(read.minContrast, 3, 12, DEFAULTS.minContrast),
  mode: read.mode === 'dark' || read.mode === 'light' ? read.mode : 'auto',
  avoid: read.avoid === true,
  avoidWidth: clampNumber(read.avoidWidth, 10, 60, DEFAULTS.avoidWidth),
  distance: clampNumber(read.distance, 0, 120, DEFAULTS.distance),
  neighbours: clampNumber(read.neighbours, 1, EVERYONE, DEFAULTS.neighbours),
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

const scene = () => SCENES.find(s => s.id === state.scene) ?? SCENES[0]!
const keyList = () => {
  const text = state.custom ? state.keys : scene().keys.join('\n')
  return text.split('\n').map(line => line.trim()).filter(Boolean)
}
const neighboursLabel = (n: number) => (n >= EVERYONE ? 'all' : n === 1 ? '1 step' : `${n} steps`)
const gridNow = () => (scene().id === 'swatches' ? gridFor(state.layout, state.columns, state.rows) : LINE)

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
  $('#surface-presets').innerHTML = SURFACES.map(
    s => `<button type="button" class="swatch" data-surface="${s.hex}" style="background:${s.hex}" aria-label="${s.name}" title="${s.name}" aria-pressed="${state.surface === s.hex}"></button>`,
  ).join('')
  const custom = $<HTMLInputElement>('#custom-surface')
  if (document.activeElement !== custom) custom.value = state.surface
  $('#mark').style.color = engine.colorFor('huehash', colorOptions(state))
  $<HTMLAnchorElement>('#nav-home').href = `../#${encodeHash({ surface: state.surface })}`
}

function setValue(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement | null
  if (el && document.activeElement !== el) el.value = value
}

/** Make every control in the rail show the current state, without rebuilding it. */
function syncRail() {
  const keys = $<HTMLTextAreaElement>('#keys')
  if (document.activeElement !== keys) keys.value = keyList().join('\n')
  $('#keys-hint').textContent = state.custom ? 'Your keys, one per line, in the order you draw them. Neighbours sit next to each other, and in a grid above and below too.' : `Example keys for the ${scene().label.toLowerCase()} view. Edit them to use your own.`
  setValue('word', state.word)
  setValue('contrast', String(state.minContrast))
  $('#contrast-value').textContent = `${state.minContrast}:1`
  setValue('distance', String(state.distance))
  $('#distance-value').textContent = state.distance === 0 ? 'off' : `${state.distance}°`
  setValue('neighbours', String(state.neighbours))
  $('#neighbours-value').textContent = neighboursLabel(state.neighbours)
  const swatches = scene().id === 'swatches'
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
    [['auto', 'Follow surface'], ['dark', 'Dark'], ['light', 'Light']] as const
  )
    .map(([value, label]) => `<button type="button" data-mode="${value}" aria-pressed="${state.mode === value}">${label}</button>`)
    .join('')
  $('#presets').innerHTML = [
    ...PRESETS.map(p => `<button type="button" class="quiet" data-preset="${p.id}">${p.label}</button>`),
    state.custom ? `<button type="button" class="quiet" data-preset="example">This view's example</button>` : '',
  ].join('')
}

function renderStage() {
  $('#scenes').innerHTML = SCENES.map(s => `<button type="button" role="tab" data-scene="${s.id}" aria-selected="${state.scene === s.id}">${s.label}</button>`).join('')
  $('#caption').textContent = scene().caption
  const seq = sequenceOf(engine, keyList(), state, gridNow())
  $('#frame').innerHTML = scene().render(seq)
  return seq
}

function renderStats(seq: ReturnType<typeof sequenceOf>) {
  const pair = closestPair(seq, Math.min(reach(state), 5))
  const lowest = seq.colors.length ? Math.min(...seq.colors.map(hex => contrastRatio(hex, state.surface))) : null
  const mode = engine.describeColor('x', colorOptions(state)).mode
  const short = pair && state.distance > 0 && pair.gap < state.distance - 4
  $('#stats').innerHTML = [
    ['Keys', String(new Set(seq.keys).size)],
    ['Closest neighbours', pair ? `${pair.gap.toFixed(0)}°` : 'none'],
    ['Lowest contrast', lowest === null ? 'none' : `${lowest.toFixed(1)}:1`],
    ['Style', mode],
  ]
    .map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`)
    .join('')
  $('#metric').innerHTML = !pair
    ? 'Add at least two keys to see how far apart neighbours are.'
    : `Closest neighbours right now: <b>${pair.gap.toFixed(0)}°</b> apart (${esc(pair.a)} and ${esc(pair.b)}).${short ? ` Short of ${state.distance}°: the wheel is too crowded for that distance.` : ''}`
}

function renderOne(seq: ReturnType<typeof sequenceOf>) {
  const d = engine.describeColor(state.word || ' ', colorOptions(state))
  const input = $<HTMLInputElement>('#word')
  input.placeholder = 'orbit'
  input.style.color = d.hex
  const dots = uniqueEntries(seq).map(e => ({ name: e.key, hex: e.color, hue: e.hue }))
  const focus = state.word.trim() ? { name: state.word, hex: d.hex, hue: d.oklch.h } : null
  const close = focus ? nearest(focus, dots) : null
  $('#readout').innerHTML = state.word.trim()
    ? `<span><b>${d.hex}</b></span><span>${esc(d.css)}</span><span>contrast <b>${d.contrast.toFixed(1)}:1</b> ${esc(d.grade)}</span>${close ? `<span>nearest key: ${esc(close.name)}, ${close.gap.toFixed(0)}° away</span>` : ''}`
    : '<span>Type a key to see its colour.</span>'
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

function optionsLiteral(grid: ReturnType<typeof sequenceOf>['grid']): string {
  const parts = [`background: '${state.surface}'`, `distance: ${state.distance}`]
  if (state.neighbours !== 1) parts.push(`neighbours: ${state.neighbours >= EVERYONE ? 'Infinity' : state.neighbours}`)
  Object.entries(gridOptions(grid)).forEach(([name, value]) => parts.push(`${name}: ${value}`))
  if (state.minContrast !== 7) parts.push(`minContrast: ${state.minContrast}`)
  if (state.mode !== 'auto') parts.push(`mode: '${state.mode}'`)
  if (state.avoid) parts.push(`avoid: avoidHuesOf(${JSON.stringify(STATUS)}, ${state.avoidWidth})`)
  return parts.join(', ')
}

function renderCode(seq: ReturnType<typeof sequenceOf>) {
  const map: Record<string, string> = {}
  seq.keys.forEach((key, i) => {
    if (!(key in map)) map[key] = seq.colors[i]!
  })
  let code = ''
  if (state.tab === 'js') {
    const shown = seq.keys.slice(0, 6).map(key => `'${key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`)
    const more = seq.keys.length > 6 ? `, /* ${seq.keys.length - 6} more */` : ''
    const colors = seq.colors.slice(0, 6).map(hex => `'${hex}'`).join(', ')
    const imports = ['colorsFor', ...(state.avoid ? ['avoidHuesOf'] : [])].join(', ')
    code = `import { ${imports} } from 'huehash'\n\nconst keys = [${shown.join(', ')}${more}]\nconst colors = colorsFor(keys, { ${optionsLiteral(seq.grid)} })\n\n// colors[i] is the colour for keys[i]\n// [${colors}${seq.keys.length > 6 ? ', …' : ''}]`
  } else if (state.tab === 'css') {
    code = toCssVariables(map)
  } else {
    code = JSON.stringify(map, null, 2)
  }
  lastOutput = code
  $('#code').textContent = code
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
  paint()
  renderTop()
  syncRail()
  const seq = renderStage()
  renderStats(seq)
  renderOne(seq)
  renderCode(seq)
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

document.addEventListener('click', event => {
  const target = event.target as HTMLElement
  const surface = target.closest<HTMLElement>('[data-surface]')
  if (surface) {
    state.surface = surface.dataset.surface as string
    return render()
  }
  const sceneTab = target.closest<HTMLElement>('[data-scene]')
  if (sceneTab) {
    state.scene = sceneTab.dataset.scene as string
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
  if (target.id === 'share') {
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
  else if (target.id === 'cache-on') {
    state.cache = target.checked
    engine = createHuehash({}, { cacheSize: state.cache ? 2000 : 0 })
  } else return
  render()
})

render()
watchNeighbours()
