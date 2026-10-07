import { hash32, normalize, unit } from '../../../src/hash.js'
import { hueFrom } from '../../../src/hue.js'
import { inkFor } from '../shared/surface.js'
import { $, esc } from '../shared/util.js'
import { ringSvg } from '../shared/wheel.js'
import { engine, options, state } from './ctx.js'

const WALL = ['api', 'ada', 'billing', 'bug', 'checkout', 'grace', 'search', 'feature', 'worker', 'linus', 'gateway', 'docs', 'margaret', 'mailer', 'perf', 'alan', 'cron', 'security', 'barbara', 'inbox', 'north', 'chore', 'dennis', 'auth', 'ken', 'east', 'review', 'radia', 'cache', 'tim', 'south', 'queue', 'demo', 'edsger', 'metrics', 'west', 'sam', 'login', 'retro', 'katherine', 'storage', 'central', 'mobile', 'hedy', 'staging', 'planning', 'jean', 'webhooks', 'online', 'frances', 'search-index', 'standup', 'annie', 'exports', 'betty', 'release', 'tony', 'alerts', 'lynn', 'payments', 'mary', 'onboarding', 'evelyn', 'analytics', 'bjarne', 'invoices', 'carol', 'status', 'guido', 'notifications', 'shafi', 'uploads', 'vint', 'reports', 'whitfield', 'sync', 'donald', 'profile', 'leslie']

export function renderHow() {
  const input = $<HTMLInputElement>('#how-input')
  if (document.activeElement !== input) input.value = state.word

  if (!state.word.trim()) {
    $('#stages').innerHTML = '<li class="stage-empty">Type a name above to follow it through the steps.</li>'
    return
  }

  const ink = inkFor(state.surface)
  const key = normalize(state.word)
  const bits = hash32(key)
  const position = unit(bits)
  const hue = hueFrom(position, [])
  const plain = engine.describeColor(state.word, { ...options(), minContrast: 1 })
  const final = engine.describeColor(state.word, options())
  const target = options().minContrast ?? 7
  const lightness = (l: number) => `${(l * 100).toFixed(0)}%`
  const shift = final.oklch.l - plain.oklch.l

  let readable = 'Already readable on this surface, so nothing changes.'
  if (final.contrast < target) readable = `This surface cannot reach ${target}:1 with a colour, so this is the best it can do.`
  else if (Math.abs(shift) >= 0.004) readable = `${shift > 0 ? 'Lightened' : 'Darkened'} from ${lightness(plain.oklch.l)} to ${lightness(final.oklch.l)} lightness until it reaches ${target}:1 on your surface.`

  const stage = (title: string, value: string, why: string) => `<li class="stage"><h4>${title}</h4><div class="stage-value">${value}</div><p class="why">${why}</p></li>`

  $('#stages').innerHTML = [
    stage('Start with the text', `<p class="word">${esc(key)}</p>`, 'Tidied first: lowercase, no surrounding spaces. Orbit and orbit are one name.'),
    stage('Turn it into a number', `<p class="digits">${bits.toLocaleString('en-US')}</p>`, 'A fixed recipe gives the same number every time, and a very different one for a similar name. Orbit and orbits land far apart.'),
    stage('Pick a spot on the wheel', `<div class="ring">${ringSvg({ hue, hex: final.hex, light: ink.light, surface: ink.surface })}<p class="word">${hue.toFixed(0)}°</p></div>`, `The number is ${(position * 100).toFixed(0)}% of the way round, so the hue is ${hue.toFixed(0)}°.`),
    stage('Give it a shade', `<p class="word" style="color:${plain.hex}">${esc(key)}</p><p class="fine">lightness ${lightness(plain.oklch.l)}, chroma ${plain.oklch.c.toFixed(2)}</p>`, 'Every hue gets about the same lightness and chroma, so none looks brighter than another.'),
    stage('Make it readable', `<p class="word" style="color:${final.hex}">${esc(key)}</p><p class="fine">${esc(final.hex)}, ${final.contrast.toFixed(1)}:1, ${esc(final.grade)}</p>`, readable),
  ].join('')
}

export function renderWall() {
  $('#wall-lede').textContent = `That was one name. Here are ${WALL.length} more, and nobody picked a colour for any of them. Every one reads on the surface you chose.`
  $('#wall').innerHTML = WALL.map(word => `<span style="color:${engine.colorFor(word, options())}" title="${esc(word)}, ${engine.colorFor(word, options())}">${word}</span>`).join(' ')
}
