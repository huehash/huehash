import { encodeHash } from '../shared/engine.js'
import { inkFor, SURFACES } from '../shared/surface.js'
import { renderLogo } from '../shared/logo.js'
import { $, esc } from '../shared/util.js'
import { engine, jsString, options, state } from './ctx.js'

const HEADLINE = ['Colours', 'that', 'read', 'on', 'any', 'background.']
const EXAMPLES = ['api', 'ada', 'billing', 'bug', 'docs']

export const PROMISES = [
  { id: 'readable', name: 'Readable', gloss: 'Every colour meets the contrast you ask for, on every background you pass.' },
  { id: 'stable', name: 'Stable', gloss: 'The same name gets the same colour, wherever it shows up.' },
  { id: 'apart', name: 'Apart', gloss: 'Look-alike colours keep a safe distance.' },
  { id: 'even', name: 'Even', gloss: 'No name is brighter than another.' },
  { id: 'reserved', name: 'Reserved', gloss: 'Nothing looks like a warning unless it is one.' },
]

export function paint() {
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

export function renderTop() {
  $('#surface-presets').innerHTML = SURFACES.map(
    s => `<button type="button" class="swatch" data-surface="${s.hex}" style="background:${s.hex}" aria-label="${s.name}" title="${s.name}" aria-pressed="${state.surface === s.hex}"></button>`,
  ).join('')
  const custom = $<HTMLInputElement>('#custom-surface')
  if (document.activeElement !== custom) custom.value = state.surface
  renderLogo($('#mark'), engine, options())
  const link = `./try/#${encodeHash({ surface: state.surface })}`
  ;['#nav-try', '#cta-try', '#cta-try-2'].forEach(selector => ($<HTMLAnchorElement>(selector).href = link))
}

export function renderHero() {
  $('#headline').innerHTML = HEADLINE.map(word => `<span style="color:${engine.colorFor(word.replace('.', ''), options())}">${esc(word)}</span>`).join(' ')

  const input = $<HTMLInputElement>('#try')
  if (document.activeElement !== input) input.value = state.word
  const described = engine.describeColor(state.word || ' ', options())
  input.style.color = state.word.trim() ? described.hex : ''
  $('#try-code').innerHTML = state.word.trim()
    ? `<span class="call">colorFor(${esc(jsString(state.word))})</span><span class="out"><i class="dot" style="background:${described.hex}"></i>${esc(jsString(described.hex))}<span class="fine">${described.contrast.toFixed(1)}:1 contrast on ${esc(state.surface)}, ${esc(described.grade)}</span></span>`
    : '<span class="call">Type any text above.</span>'

  $('#try-surfaces').innerHTML = state.word.trim()
    ? SURFACES.map(surface => {
        const there = engine.describeColor(state.word, { ...options(), background: surface.hex })
        const ink = inkFor(surface.hex)
        return `<li style="background:${surface.hex};color:${ink.muted}"><b style="color:${there.hex}">${esc(state.word)}</b><span>${there.contrast.toFixed(1)}:1 on ${surface.name}</span></li>`
      }).join('')
    : ''

  $('#try-examples').innerHTML = `<span class="fine">Try</span>${EXAMPLES.map(word => `<button type="button" class="chip" data-action="word" data-word="${word}" style="color:${engine.colorFor(word, options())}">${word}</button>`).join('')}`

  PROMISES.forEach(p => document.getElementById(p.id)?.style.setProperty('--promise', engine.colorFor(p.id, options())))
  $('#promise-index').innerHTML = PROMISES.map(
    p => `<li><a href="#${p.id}"><b style="color:${engine.colorFor(p.id, options())}">${p.name}</b><span>${p.gloss}</span></a></li>`,
  ).join('')
}
