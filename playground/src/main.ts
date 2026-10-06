import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/martian-mono'
import './style.css'

import { avoidHuesOf, createHuehash, oklchHue, toCssVariables, type Huehash, type Options } from '../../src/index.js'
import { inkFor, SURFACES } from './surface.js'
import { nearest, wheelSvg, type WheelDot } from './wheel.js'

/** The colours an interface usually spends on meaning. The playground can keep generated colours clear of them. */
const STATUS = ['#ffb454', '#7ee787', '#ff7b72', '#56d4dd', '#ff5fb0']

type State = {
  word: string
  names: string
  surface: string
  minContrast: number
  minGap: number
  spread: boolean
  splitPaths: boolean
  avoid: boolean
  avoidWidth: number
  mode: 'auto' | 'dark' | 'light'
  cache: boolean
  tab: 'js' | 'css' | 'json'
}

const DEFAULTS: State = {
  word: 'orbit',
  names: 'acme/web\nacme/api\nacme/platform/billing\nacme/platform/ledger\nacme/docs\nacme/mobile/ios\nacme/mobile/android',
  surface: '#0d1117',
  minContrast: 7,
  minGap: 24,
  spread: true,
  splitPaths: true,
  avoid: false,
  avoidWidth: 26,
  mode: 'auto',
  cache: true,
  tab: 'js',
}

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing ${selector}`)
  return element
}

const esc = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

function load(): State {
  try {
    const raw = location.hash.slice(1)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(decodeURIComponent(escape(atob(raw.replace(/-/g, '+').replace(/_/g, '/'))))) as Partial<State>
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

function save(state: State) {
  const changed = Object.fromEntries(Object.entries(state).filter(([key, value]) => value !== DEFAULTS[key as keyof State]))
  const encoded = Object.keys(changed).length ? btoa(unescape(encodeURIComponent(JSON.stringify(changed)))).replace(/\+/g, '-').replace(/\//g, '_') : ''
  history.replaceState(null, '', `${location.pathname}${location.search}${encoded ? `#${encoded}` : ''}`)
}

const state = load()
let engine: Huehash = createHuehash({}, { cacheSize: state.cache ? 2000 : 0 })
let lastOutput = ''

const options = (): Options => ({
  background: state.surface,
  minContrast: state.minContrast,
  mode: state.mode === 'auto' ? undefined : state.mode,
  avoid: state.avoid ? avoidHuesOf(STATUS, state.avoidWidth) : [],
})

const lines = () => state.names.split('\n').map(line => line.trim()).filter(Boolean)
const segmentsOf = (path: string) => path.split('/').filter(Boolean)

function colorMap(): Record<string, string> {
  const keys = [...new Set(state.splitPaths ? lines().flatMap(segmentsOf) : lines())]
  if (state.spread) return engine.distinctColors(keys, { ...options(), minHueGap: state.minGap })
  return Object.fromEntries(keys.map(key => [key, engine.colorFor(key, options())]))
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
  return ink
}

function renderSurfaces() {
  const presets = SURFACES.map(
    surface => `<button type="button" class="swatch" data-surface="${surface.hex}" style="background:${surface.hex}" aria-label="${surface.name}" title="${surface.name}" aria-pressed="${state.surface === surface.hex}"></button>`,
  ).join('')
  $('#surfaces').innerHTML = `${presets}<label class="custom" title="Pick any colour"><span aria-hidden="true">+</span><input type="color" id="custom-surface" value="${state.surface}" aria-label="Custom surface colour" /></label>`
}

function renderHero(map: Record<string, string>) {
  const word = state.word
  const d = engine.describeColor(word || ' ', options())
  const input = $<HTMLInputElement>('#word')
  if (document.activeElement !== input) input.value = word
  input.placeholder = 'orbit'
  input.style.color = d.hex
  $('#mark').style.color = engine.colorFor('huehash', options())

  const dots: WheelDot[] = Object.entries(map).map(([name, hex]) => ({ name, hex, hue: engine.describeColor(name, options()).oklch.h }))
  const focus: WheelDot | null = word.trim() ? { name: word, hex: d.hex, hue: d.oklch.h } : null
  const close = focus ? nearest(focus, dots) : null
  $('#readout').innerHTML = word.trim()
    ? `<span><b>${d.hex}</b></span><span>${esc(d.css)}</span><span>contrast <b>${d.contrast.toFixed(1)}:1</b> ${esc(d.grade)}</span>${close ? `<span>nearest in the set: ${esc(close.name)}, ${close.gap.toFixed(0)}° away</span>` : ''}`
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

function pathMarkup(path: string, map: Record<string, string>): string {
  return segmentsOf(path)
    .map((segment, index) => `${index ? '<span class="sep">/</span>' : ''}<span style="color:${state.splitPaths ? map[segment] : map[path]}">${esc(segment)}</span>`)
    .join('')
}

function renderChips(map: Record<string, string>) {
  const keys = Object.keys(map)
  $('#chips').innerHTML = keys.length
    ? keys
        .map(key => {
          const d = engine.describeColor(key, options())
          const hex = map[key]!
          return `<li><button type="button" class="chip" data-copy="${hex}" title="Copy ${hex}"><span class="chip-band" style="background:${hex}"></span><span class="chip-body"><span class="chip-name" style="color:${hex}">${esc(key)}</span><span class="chip-meta"><span class="chip-hex">${hex}</span><span>${d.contrast.toFixed(1)}:1</span></span></span></button></li>`
        })
        .join('')
    : '<li class="empty">Add a name on the left.</li>'
}

function range(id: string, label: string, min: number, max: number, step: number, value: number, display: string, marks: string[]) {
  return `<div class="control"><label for="${id}">${label}<span class="value" id="${id}-value">${display}</span></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" /><div class="marks">${marks.map(m => `<span>${m}</span>`).join('')}</div></div>`
}

function renderControls() {
  const seg = (name: string, choices: Array<[string, string]>, current: string) =>
    `<div class="segmented" role="group" aria-label="${name}">${choices.map(([value, label]) => `<button type="button" data-${name}="${value}" aria-pressed="${current === value}">${label}</button>`).join('')}</div>`
  const toggle = (id: string, label: string, on: boolean, hint: string) =>
    `<div class="control"><label class="toggle" for="${id}"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} />${label}</label><p class="hint">${hint}</p></div>`
  $('#controls').innerHTML = [
    range('contrast', 'Minimum contrast', 3, 12, 0.5, state.minContrast, `${state.minContrast}:1`, ['3', '4.5 AA', '7 AAA', '12']),
    range('gap', 'Minimum hue gap', 0, 40, 1, state.minGap, `${state.minGap}°`, ['0', '20', '40']),
    toggle('spread', 'Spread hues apart', state.spread, 'No two names land on nearly the same hue. Off gives each name its own plain colour.'),
    toggle('split', 'Colour each part of a path', state.splitPaths, 'acme/platform/billing gets three colours: a group, a subgroup and a project.'),
    `<div class="control"><span class="label">Surface style</span>${seg('mode', [['auto', 'Follow surface'], ['dark', 'Dark'], ['light', 'Light']], state.mode)}<p class="hint">Dark colours are lifted until they read on the surface; light ones are darkened.</p></div>`,
    toggle('avoid', 'Keep clear of status colours', state.avoid, 'Steers clear of amber, green, red, cyan and magenta, so a project never looks like a state.'),
    state.avoid ? range('avoid-width', 'Width kept clear', 10, 60, 2, state.avoidWidth, `${state.avoidWidth}°`, ['10', '35', '60']) : '',
  ].join('')
}

function renderContext(map: Record<string, string>) {
  const paths = lines()
  if (!paths.length) {
    $('#context').innerHTML = '<p class="empty">Add names to see them in context.</p>'
    return
  }
  const text = (path: string) => pathMarkup(path, map)
  const sample = paths.slice(0, 5)
  const count = (path: string) => 8 + ((path.length * 37 + path.charCodeAt(0)) % 90)
  const times = ['09:41:07', '09:41:19', '09:42:02', '09:42:48', '09:43:30']
  const messages = ['pipeline passed', 'deployed to staging', 'review requested', 'merged into main', 'release tagged']
  $('#context').innerHTML = `
    <div class="sample"><h3>Paths</h3><ul class="paths">${sample.map((p, i) => `<li>${text(p)}<span class="iid">!${240 + i * 13}</span></li>`).join('')}</ul></div>
    <div class="sample"><h3>Tags</h3><div class="tags">${paths.map(p => { const last = segmentsOf(p).at(-1) ?? p; const c = map[state.splitPaths ? last : p]; return `<span class="tag" style="color:${c}">${esc(last)}</span>` }).join('')}</div></div>
    <div class="sample"><h3>Logs</h3><ul class="logs">${sample.map((p, i) => `<li><span class="time">${times[i]}</span><span>${text(p)}</span><span class="msg">${messages[i]}</span></li>`).join('')}</ul></div>
    <div class="sample"><h3>Bars</h3><div class="bars">${sample.map(p => { const last = segmentsOf(p).at(-1) ?? p; const c = map[state.splitPaths ? last : p]; return `<div class="bar"><span class="bar-name" style="color:${c}">${esc(last)}</span><span class="bar-track"><span class="bar-fill" style="width:${count(p)}%;background:${c}"></span></span><span class="bar-n">${count(p)}</span></div>` }).join('')}</div></div>`
}

function optionsLiteral(): string {
  const parts = [`background: '${state.surface}'`]
  if (state.minContrast !== 7) parts.push(`minContrast: ${state.minContrast}`)
  if (state.mode !== 'auto') parts.push(`mode: '${state.mode}'`)
  if (state.avoid) parts.push(`avoid: avoidHuesOf(${JSON.stringify(STATUS)}, ${state.avoidWidth})`)
  return parts.join(', ')
}

function renderCode(map: Record<string, string>) {
  const keys = Object.keys(map)
  const list = `[${keys.map(k => `'${k.replace(/'/g, "\\'")}'`).join(', ')}]`
  let code = ''
  if (state.tab === 'js') {
    const imports = ['colorFor', 'distinctColors', ...(state.avoid ? ['avoidHuesOf'] : [])].filter(name => (name === 'colorFor' ? !state.spread : name === 'distinctColors' ? state.spread : true))
    const call = state.spread
      ? `distinctColors(${list}, { ${optionsLiteral()}, minHueGap: ${state.minGap} })`
      : `Object.fromEntries(${list}.map(name => [name, colorFor(name, { ${optionsLiteral()} })]))`
    const result = `{\n${keys.map(k => `  '${k}': '${map[k]}',`).join('\n')}\n}`
    code = `import { ${imports.join(', ')} } from 'huehash'\n\nconst colors = ${call}\n\n// ${result.replace(/\n/g, '\n// ')}`
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
}

let timing = ''

function renderCache() {
  const stats = engine.cacheStats()
  const rate = stats.hits + stats.misses ? Math.round((stats.hits / (stats.hits + stats.misses)) * 100) : 0
  $('#cache').innerHTML = `
    <div class="stat"><b>${stats.hits}</b><span>answered from memory</span></div>
    <div class="stat"><b>${stats.misses}</b><span>calculated</span></div>
    <div class="stat"><b>${rate}%</b><span>hit rate</span></div>
    <div class="outcome">
      <label class="toggle" for="cache-on"><input type="checkbox" id="cache-on" ${state.cache ? 'checked' : ''} />Remember results</label>
      <p class="hint">Edit the names or move a slider and watch the counters: only what changed is calculated again.</p>
      <button type="button" class="run" id="bench">Time 100,000 lookups</button>
      <p class="timing" id="timing" aria-live="polite">${esc(timing)}</p>
    </div>`
}

function render() {
  const map = colorMap()
  paint()
  renderSurfaces()
  renderHero(map)
  renderChips(map)
  renderContext(map)
  renderCode(map)
  renderCache()
  $('#foot-note').textContent = `${Object.keys(map).length} colours on ${state.surface}`
  save(state)
}

/* ── events ────────────────────────────────────────────────────────────── */

function refresh(rerenderControls = false) {
  if (rerenderControls) renderControls()
  render()
}

$<HTMLInputElement>('#word').addEventListener('input', event => {
  state.word = (event.target as HTMLInputElement).value
  render()
})

$<HTMLTextAreaElement>('#names').addEventListener('input', event => {
  state.names = (event.target as HTMLTextAreaElement).value
  render()
})

document.addEventListener('click', event => {
  const target = event.target as HTMLElement
  const surface = target.closest<HTMLElement>('[data-surface]')
  if (surface) {
    state.surface = surface.dataset.surface as string
    return refresh()
  }
  const mode = target.closest<HTMLElement>('[data-mode]')
  if (mode) {
    state.mode = mode.dataset.mode as State['mode']
    return refresh(true)
  }
  const tab = target.closest<HTMLElement>('[data-tab]')
  if (tab) {
    state.tab = tab.dataset.tab as State['tab']
    return render()
  }
  const copy = target.closest<HTMLElement>('[data-copy]')
  if (copy) {
    void navigator.clipboard?.writeText(copy.dataset.copy as string)
    const meta = copy.querySelector('.chip-hex')
    if (meta) {
      const previous = meta.textContent
      meta.textContent = 'copied'
      setTimeout(() => (meta.textContent = previous), 900)
    }
    return undefined
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
    const run = target as HTMLButtonElement
    run.disabled = true
    timing = 'Running…'
    renderCache()
    setTimeout(() => {
      const names = Array.from({ length: 200 }, (_, i) => `group-${i % 20}/project-${i}`)
      const measure = (cacheSize: number) => {
        const h = createHuehash({}, { cacheSize })
        names.forEach(name => h.colorFor(name, options()))
        const start = performance.now()
        for (let pass = 0; pass < 500; pass += 1) names.forEach(name => h.colorFor(name, options()))
        return performance.now() - start
      }
      const off = measure(0)
      const on = measure(2000)
      timing = `100,000 lookups: ${off.toFixed(0)} ms calculating each time, ${on.toFixed(0)} ms with the cache, ${(off / Math.max(on, 0.01)).toFixed(1)} times faster.`
      renderCache()
    }, 30)
  }
  return undefined
})

document.addEventListener('input', event => {
  const target = event.target as HTMLInputElement
  if (target.id === 'custom-surface') {
    state.surface = target.value
    return refresh()
  }
  if (target.id === 'contrast') {
    state.minContrast = Number(target.value)
    $('#contrast-value').textContent = `${state.minContrast}:1`
    return render()
  }
  if (target.id === 'gap') {
    state.minGap = Number(target.value)
    $('#gap-value').textContent = `${state.minGap}°`
    return render()
  }
  if (target.id === 'avoid-width') {
    state.avoidWidth = Number(target.value)
    $('#avoid-width-value').textContent = `${state.avoidWidth}°`
    return render()
  }
  return undefined
})

document.addEventListener('change', event => {
  const target = event.target as HTMLInputElement
  if (target.id === 'spread') state.spread = target.checked
  else if (target.id === 'split') state.splitPaths = target.checked
  else if (target.id === 'avoid') state.avoid = target.checked
  else if (target.id === 'cache-on') {
    state.cache = target.checked
    engine = createHuehash({}, { cacheSize: state.cache ? 2000 : 0 })
  } else return
  refresh(target.id === 'avoid')
})

$<HTMLTextAreaElement>('#names').value = state.names
renderControls()
render()
