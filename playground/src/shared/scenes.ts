import { hueGap } from '../../../src/index.js'
import { clock, placeEvents, SLOTS } from './calendar.js'
import { neighbourPairs, uniqueEntries, type Sequence } from './engine.js'
import { esc, initials, readableOn, seeded } from './util.js'

type Entry = { key: string; color: string; hue: number }

const pick = <T>(list: T[], index: number): T => list[index % list.length]!
const entriesOf = (seq: Sequence, max: number): Entry[] => uniqueEntries(seq).slice(0, max)
const empty = '<p class="scene-empty">Add some keys to see them here.</p>'
const mix = (color: string, amount: number) => `color-mix(in srgb, ${color} ${amount}%, transparent)`

function logs(seq: Sequence): string {
  const services = entriesOf(seq, 8)
  if (!services.length) return empty
  const messages = ['accepted connection', 'cache miss, loading from disk', 'request completed in 42 ms', 'retrying (2 of 5)', 'flushed 128 rows', 'token refreshed', 'health check ok', 'queue depth 14', 'rolled back transaction', 'listening on :8080']
  const levels = ['info', 'info', 'info', 'warn', 'info', 'debug', 'info']
  const rand = seeded(services.map(s => s.key).join())
  let seconds = 9 * 3600 + 41 * 60 + 7
  const rows = Array.from({ length: 16 }, (_, i) => {
    seconds += 1 + Math.floor(rand() * 4)
    const t = `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    const service = pick(services, Math.floor(rand() * 97) + i)
    return `<div class="log"><span class="log-time">${t}</span><span class="log-svc" style="color:${service.color}">${esc(service.key)}</span><span class="log-lvl">${pick(levels, i * 3)}</span><span class="log-msg">${pick(messages, Math.floor(rand() * 31))}</span></div>`
  })
  return `<div class="scene-logs">${rows.join('')}</div>`
}

function chart(seq: Sequence): string {
  const series = entriesOf(seq, 8)
  if (!series.length) return empty
  const width = 640
  const height = 280
  const lines = series.map(entry => {
    const rand = seeded(entry.key)
    let value = 0.3 + rand() * 0.5
    const points = Array.from({ length: 24 }, (_, i) => {
      value = Math.min(0.95, Math.max(0.08, value + (rand() - 0.5) * 0.22))
      return `${(i / 23) * (width - 24) + 12},${(1 - value) * (height - 40) + 20}`
    })
    const last = points.at(-1)!.split(',')
    return `<polyline points="${points.join(' ')}" fill="none" stroke="${entry.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${entry.color}"/>`
  })
  const grid = [0.2, 0.4, 0.6, 0.8].map(f => `<line x1="12" x2="${width - 12}" y1="${f * (height - 40) + 20}" y2="${f * (height - 40) + 20}" class="grid"/>`).join('')
  const legend = series.map(entry => `<span class="legend-item"><i style="background:${entry.color}"></i>${esc(entry.key)}</span>`).join('')
  return `<div class="scene-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Line chart with one line per key">${grid}${lines.join('')}</svg><div class="legend">${legend}</div></div>`
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const FIRST_HOUR = 8
const HOURS = 8

function calendar(seq: Sequence): string {
  const calendars = entriesOf(seq, SLOTS.length)
  if (!calendars.length) return empty
  const columns: string[][] = DAYS.map(() => [])
  placeEvents(calendars.length).forEach(slot => {
    const entry = calendars[slot.index]!
    const width = 100 / slot.lanes
    const placement = `top:calc(var(--row) * ${slot.start - FIRST_HOUR});height:calc(var(--row) * ${slot.length} - 3px);left:calc(${slot.lane * width}% + 2px);width:calc(${width}% - 4px)`
    columns[slot.day]!.push(
      `<div class="event" style="${placement};border-color:${entry.color};background:${mix(entry.color, 16)}" title="${esc(entry.key)}, ${clock(slot.start)} to ${clock(slot.end)}"><b style="color:${entry.color}">${esc(entry.key)}</b><span>${clock(slot.start)}</span></div>`,
    )
  })
  const hours = Array.from({ length: HOURS }, (_, i) => `<div class="hour">${FIRST_HOUR + i}:00</div>`).join('')
  return `<div class="scene-calendar"><div class="cal-head"><span></span>${DAYS.map(d => `<span>${d}</span>`).join('')}</div><div class="cal-body"><div class="cal-hours">${hours}</div>${columns.map(events => `<div class="cal-day">${events.join('')}</div>`).join('')}</div></div>`
}

function presence(seq: Sequence): string {
  const people = entriesOf(seq, 6)
  if (!people.length) return empty
  const lines = [
    'export function colorFor(key, options) {',
    '  const id = normalize(key)',
    '  const cached = cache.get(id)',
    '  if (cached) return cached',
    '',
    '  const hue = hueFrom(hash(id), options.avoid)',
    '  const color = shade(hue, options.background)',
    '  cache.set(id, color)',
    '  return color',
    '}',
    '',
    '// the same key always lands on the same colour',
  ]
  const placed = people.map((person, i) => {
    const rand = seeded(person.key)
    const line = (Math.floor(rand() * lines.length) + i * 2) % lines.length
    const from = Math.floor(rand() * 12)
    return { person, line, from, to: from + 3 + Math.floor(rand() * 9) }
  })
  const body = lines
    .map((text, index) => {
      const here = placed.filter(p => p.line === index)
      const marks = here
        .map(p => `<span class="sel" style="left:${p.from}ch;width:${Math.min(p.to - p.from, Math.max(text.length - p.from, 2))}ch;background:${mix(p.person.color, 22)}"></span><span class="cursor" style="left:${p.to}ch;border-color:${p.person.color}"><i style="background:${p.person.color};color:${readableOn(p.person.color)}">${esc(p.person.key)}</i></span>`)
        .join('')
      return `<div class="ed-line"><span class="ed-no">${index + 1}</span><span class="ed-text">${marks}${esc(text) || '&nbsp;'}</span></div>`
    })
    .join('')
  const stack = people.map(p => `<span class="av small" style="background:${p.color};color:${readableOn(p.color)}" title="${esc(p.key)}">${esc(initials(p.key))}</span>`).join('')
  return `<div class="scene-editor"><div class="ed-bar"><span>colors.ts</span><span class="av-stack">${stack}</span></div><div class="ed-body">${body}</div></div>`
}

function people(seq: Sequence): string {
  const list = entriesOf(seq, 8)
  if (!list.length) return empty
  const roles = ['Engineering', 'Design', 'Support', 'Finance', 'Product', 'Data', 'Security', 'Operations']
  const active = ['now', '2 min ago', '14 min ago', 'yesterday', '3 days ago']
  return `<ul class="scene-people">${list.map((p, i) => `<li><span class="av" style="background:${p.color};color:${readableOn(p.color)}">${esc(initials(p.key))}</span><span class="who"><b>${esc(p.key)}</b><span>${pick(roles, i * 3 + 1)}</span></span><span class="when">${pick(active, i * 2)}</span></li>`).join('')}</ul>`
}

function labels(seq: Sequence): string {
  const list = entriesOf(seq, 10)
  if (!list.length) return empty
  const titles = ['Checkout fails when the cart is empty', 'Add keyboard shortcuts to the editor', 'Upgrade the build to the latest toolchain', 'Rate limit the public endpoint', 'Docs: explain the caching rules', 'Flaky test in the nightly run', 'Export a report as CSV']
  return `<ul class="scene-issues">${titles
    .map((title, i) => {
      const rand = seeded(title)
      const count = 1 + Math.floor(rand() * 3)
      const chosen = Array.from({ length: count }, (_, j) => pick(list, Math.floor(rand() * 13) + i + j))
      const unique = [...new Map(chosen.map(c => [c.key, c])).values()]
      return `<li><span class="issue-title">${title}</span><span class="issue-labels">${unique.map(l => `<span class="pill" style="color:${l.color}">${esc(l.key)}</span>`).join('')}</span></li>`
    })
    .join('')}</ul>`
}

/** Two neighbours closer than this many degrees of hue are flagged as looking alike. */
const LOOKS_ALIKE = 15

function swatches(seq: Sequence): string {
  if (!seq.keys.length) return empty
  const { grid, steps } = seq
  const alike = new Set<number>()
  neighbourPairs(seq, Math.min(steps, 5)).forEach(([earlier, later]) => {
    if (seq.keys[earlier] !== seq.keys[later] && hueGap(seq.hues[earlier]!, seq.hues[later]!) < LOOKS_ALIKE) {
      alike.add(earlier)
      alike.add(later)
    }
  })
  const tile = (index: number) =>
    `<div class="tile${alike.has(index) ? ' near' : ''}" data-index="${index}" style="background:${seq.colors[index]};color:${readableOn(seq.colors[index]!)}" title="${esc(seq.keys[index]!)}, ${seq.colors[index]}">${esc(seq.keys[index]!)}</div>`
  const everyIndex = seq.keys.map((_, index) => index)

  let body: string
  const layerSize = grid.columns * grid.rows
  if (Number.isFinite(layerSize)) {
    const layers = Array.from({ length: Math.ceil(seq.keys.length / layerSize) }, (_, z) => everyIndex.slice(z * layerSize, (z + 1) * layerSize))
    body = `<div class="layers">${layers.map((indexes, z) => `<div class="layer"><p class="layer-label">Layer ${z + 1}</p><div class="strip" style="--cols:${grid.columns}">${indexes.map(tile).join('')}</div></div>`).join('')}</div>`
  } else if (Number.isFinite(grid.columns)) {
    body = `<div class="strip" style="--cols:${grid.columns}">${everyIndex.map(tile).join('')}</div>`
  } else {
    body = `<div class="strip line" style="--cols:${seq.keys.length}">${everyIndex.map(tile).join('')}</div>`
  }
  const size = (value: number) => (Number.isFinite(value) ? String(value) : '')
  return `<div class="scene-swatches" data-columns="${size(grid.columns)}" data-rows="${size(grid.rows)}" data-steps="${size(steps) || 'all'}">${body}</div>`
}

export type Scene = { id: string; label: string; caption: string; keys: string[]; render: (seq: Sequence) => string }

const sequential = (count: number) => Array.from({ length: count }, (_, i) => `item-${i + 1}`)

export const SCENES: Scene[] = [
  { id: 'logs', label: 'Logs', caption: 'Follow one service down a wall of text.', keys: ['api', 'auth', 'billing', 'search', 'worker', 'gateway', 'mailer', 'cron'], render: logs },
  { id: 'chart', label: 'Chart', caption: 'One line per series, even when the series are user-defined.', keys: ['north', 'south', 'east', 'west', 'central', 'online'], render: chart },
  { id: 'calendar', label: 'Calendar', caption: 'Overlapping events stay distinguishable.', keys: ['design', 'standup', 'planning', 'one-to-one', 'review', 'demo', 'retro'], render: calendar },
  { id: 'presence', label: 'Presence', caption: 'Every collaborator gets a colour on every screen, with no server handing them out.', keys: ['ada', 'grace', 'linus', 'margaret', 'alan'], render: presence },
  { id: 'people', label: 'People', caption: 'Initials on a coloured disc, the same everywhere a person shows up.', keys: ['ada', 'grace', 'linus', 'margaret', 'alan', 'barbara', 'dennis', 'ken'], render: people },
  { id: 'labels', label: 'Labels', caption: 'Anyone can invent a label and it still reads.', keys: ['bug', 'feature', 'docs', 'chore', 'security', 'perf', 'test'], render: labels },
  { id: 'swatches', label: 'Swatches', caption: 'The stress test: sequential keys in a line, a grid or a stack of grids. Hover a tile to see its neighbours.', keys: sequential(24), render: swatches },
]
