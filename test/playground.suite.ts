import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import { hash32, normalize, unit } from '../src/hash.js'
import { colorFor, colorsFor, contrastRatio, hueGap, oklchHue } from '../src/index.js'
import { placeEvents, SLOTS } from '../playground/src/shared/calendar.js'

type Page = 'landing' | 'try'
const sources: Record<Page, { html: string; entry: string }> = {
  landing: { html: '../playground/index.html', entry: '../playground/src/landing/main.ts' },
  try: { html: '../playground/try/index.html', entry: '../playground/src/try/main.ts' },
}
const bundles = {} as Record<Page, string>
const htmls = {} as Record<Page, string>
const doms: JSDOM[] = []

before(async () => {
  for (const page of Object.keys(sources) as Page[]) {
    const { html, entry } = sources[page]
    htmls[page] = readFileSync(new URL(html, import.meta.url), 'utf8').replace(/<script type="module"[^>]*><\/script>/, '')
    const result = await build({
      entryPoints: [new URL(entry, import.meta.url).pathname],
      bundle: true,
      write: false,
      format: 'iife',
      loader: { '.css': 'empty', '.woff': 'empty', '.woff2': 'empty' },
      logLevel: 'silent',
    })
    bundles[page] = result.outputFiles[0]!.text
  }
})

after(() => doms.forEach(dom => dom.window.close()))

function open(page: Page, hash = ''): JSDOM {
  const dom = new JSDOM(htmls[page], { url: `http://localhost/${hash}`, runScripts: 'outside-only', pretendToBeVisual: true })
  doms.push(dom)
  const copied: string[] = []
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async (text: string) => void copied.push(text) } })
  Object.assign(dom.window, { copied })
  dom.window.eval(bundles[page])
  return dom
}

const q = (dom: JSDOM, selector: string) => dom.window.document.querySelector(selector) as HTMLElement
const all = (dom: JSDOM, selector: string) => [...dom.window.document.querySelectorAll(selector)] as HTMLElement[]
const type = (dom: JSDOM, selector: string, value: string, event = 'input') => {
  const el = q(dom, selector) as HTMLInputElement
  el.value = value
  el.dispatchEvent(new dom.window.Event(event, { bubbles: true }))
}
const click = (dom: JSDOM, selector: string) => q(dom, selector).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
const check = (dom: JSDOM, selector: string, checked: boolean) => {
  ;(q(dom, selector) as HTMLInputElement).checked = checked
  q(dom, selector).dispatchEvent(new dom.window.Event('change', { bubbles: true }))
}
const rgb = (css: string) => '#' + (css.match(/\d+/g) ?? []).slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('')
const tileColors = (dom: JSDOM) => all(dom, '#frame .tile').map(tile => rgb(tile.style.background))
const goToSwatches = (dom: JSDOM) => click(dom, '[data-scene="swatches"]')

type Shape = { columns?: number; rows?: number }
/** Where an item sits, worked out here so it can check what the page shows. */
function at(index: number, { columns, rows }: Shape) {
  if (columns === undefined) return { x: index, y: 0, z: 0 }
  if (rows === undefined) return { x: index % columns, y: Math.floor(index / columns), z: 0 }
  const layer = columns * rows
  const z = Math.floor(index / layer)
  const inLayer = index - z * layer
  return { x: inLayer % columns, y: Math.floor(inLayer / columns), z }
}
const stepsBetween = (a: number, b: number, shape: Shape) => {
  const from = at(a, shape)
  const to = at(b, shape)
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y) + Math.abs(from.z - to.z)
}
/** The smallest hue gap between any two items within `reach` steps of each other in this layout. */
const closestInSpace = (colors: string[], shape: Shape, reach: number) => {
  const hues = colors.map(oklchHue)
  let smallest = 360
  hues.forEach((hue, i) => hues.slice(i + 1).forEach((other, offset) => stepsBetween(i, i + 1 + offset, shape) <= reach && (smallest = Math.min(smallest, hueGap(hue, other)))))
  return smallest
}
const hover = (dom: JSDOM, selector: string) => q(dom, selector).dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true }))

/* ── landing ───────────────────────────────────────────────────────────── */

const decodeHash = (hash: string): Record<string, unknown> => JSON.parse(Buffer.from(hash.slice(1), 'base64url').toString('utf8')) as Record<string, unknown>
const texts = (dom: JSDOM, selector: string) => all(dom, selector).map(el => el.textContent ?? '')

test('landing: the headline is real output, one colour per word, and all of it reads', () => {
  const dom = open('landing')
  assert.equal(q(dom, '#headline').textContent, 'Colours that read on any background.')
  const words = all(dom, '#headline span')
  assert.equal(words.length, 6)
  words.forEach(word => {
    const key = word.textContent!.replace('.', '')
    assert.equal(rgb(word.style.color), colorFor(key, { background: '#0d1117' }), key)
    assert.ok(contrastRatio(rgb(word.style.color), '#0d1117') >= 7, key)
  })
})

test('landing: the hero input shows the call, the colour and its contrast for what you type', () => {
  const dom = open('landing')
  assert.equal((q(dom, '#try') as HTMLInputElement).value, 'orbit')
  assert.match(q(dom, '#try-code').textContent ?? '', /colorFor\('orbit'\)/)
  type(dom, '#try', 'nebula')
  const hex = colorFor('nebula', { background: '#0d1117' })
  assert.equal(rgb(q(dom, '#try').style.color), hex)
  assert.match(q(dom, '#try-code').textContent ?? '', new RegExp(`'${hex}'\\d+\\.\\d:1 contrast on #0d1117, AAA`))
  all(dom, '#try-surfaces li').forEach((li, i) => {
    const surface = ['#0d1117', '#0f3552', '#3b1a3f', '#ffffff'][i]!
    assert.equal(rgb(li.querySelector('b')!.style.color), colorFor('nebula', { background: surface }), surface)
  })
  assert.equal(all(dom, '#try-surfaces li').length, 4)
  type(dom, '#try', "it's")
  assert.match(q(dom, '#try-code').textContent ?? '', /colorFor\('it\\'s'\)/)
  type(dom, '#try', '')
  assert.match(q(dom, '#try-code').textContent ?? '', /Type any text/)
})

test('landing: the example names fill the input, in their own colours', () => {
  const dom = open('landing')
  const chips = all(dom, '#try-examples .chip')
  assert.equal(chips.length, 5)
  chips.forEach(chip => assert.equal(rgb(chip.style.color), colorFor(chip.dataset.word!, { background: '#0d1117' })))
  click(dom, '[data-word="billing"]')
  assert.equal((q(dom, '#try') as HTMLInputElement).value, 'billing')
  assert.equal((q(dom, '#how-input') as HTMLInputElement).value, 'billing')
})

test('landing: the five promises are links to chapters that exist, in their own colours', () => {
  const dom = open('landing')
  const links = all(dom, '#promise-index a')
  assert.deepEqual(links.map(a => a.getAttribute('href')), ['#readable', '#stable', '#apart', '#even', '#reserved'])
  links.forEach(link => {
    const id = link.getAttribute('href')!.slice(1)
    assert.ok(dom.window.document.getElementById(id), `chapter ${id} exists`)
    assert.equal(rgb(link.querySelector('b')!.style.color), colorFor(id, { background: '#0d1117' }))
  })
})

test('landing: the page is ordered from the idea to the details, and the top bar links to every part', () => {
  const dom = open('landing')
  const levels = all(dom, '[data-level]').map(a => a.dataset.level!)
  assert.deepEqual(levels, ['idea', 'promises', 'views', 'details'])
  levels.forEach(id => assert.ok(dom.window.document.getElementById(id), id))
  const order = [...dom.window.document.querySelectorAll('main > section')].map(section => section.id)
  assert.deepEqual(order.slice(0, 4), ['idea', 'promises', 'views', 'details'])
  const chapters = all(dom, '#promises .chapter').map(chapter => chapter.id)
  assert.deepEqual(chapters, ['readable', 'stable', 'apart', 'even', 'reserved'])
})

test('landing: the step by step shows the real hash, hue and colours for the name', () => {
  const dom = open('landing')
  const stages = all(dom, '#stages .stage')
  assert.equal(stages.length, 5)
  const key = normalize('orbit')
  assert.equal(Number(q(dom, '#stages .digits').textContent!.replace(/,/g, '')), hash32(key))
  assert.match(q(dom, '#stages .ring .word').textContent!, new RegExp(`^${Math.round(unit(hash32(key)) * 360)}°$`))
  assert.equal(rgb(stages[4]!.querySelector<HTMLElement>('.word')!.style.color), colorFor('orbit', { background: '#0d1117' }))
  assert.match(stages[4]!.querySelector('.why')!.textContent!, /Already readable/)
  assert.match(stages[4]!.querySelector('.fine')!.textContent!, /\d+\.\d:1, AAA/)
})

test('landing: the step by step tidies the name, and shows the lift when the surface needs one', () => {
  const dom = open('landing')
  type(dom, '#how-input', '  Orbit ')
  assert.equal(q(dom, '#stages .stage .word').textContent, 'orbit')
  click(dom, '[data-surface="#ffffff"]')
  const last = all(dom, '#stages .stage')[4]!
  assert.match(last.querySelector('.why')!.textContent!, /Darkened from \d+% to \d+% lightness until it reaches 7:1/)
  assert.ok(contrastRatio(rgb(last.querySelector<HTMLElement>('.word')!.style.color), '#ffffff') >= 7)
  type(dom, '#how-input', '')
  assert.match(q(dom, '#stages').textContent ?? '', /Type a name above/)
})

test('landing: the wall of names is real colours that all read, and the count in the text is true', () => {
  const dom = open('landing')
  const words = all(dom, '#wall span')
  assert.ok(words.length >= 60)
  assert.match(q(dom, '#wall-lede').textContent ?? '', new RegExp(`Here are ${words.length} more`))
  words.forEach(word => assert.equal(rgb(word.style.color), colorFor(word.textContent!, { background: '#0d1117' })))
})

test('landing: stable: a palette by position reshuffles when the list changes, and names keep their colours', () => {
  const dom = open('landing')
  const tallies = () => texts(dom, '#stable-body .tally')
  assert.deepEqual(tallies(), ['5 of 5 colours changed', '0 of 5 colours changed'])
  click(dom, '[data-change="add"]')
  assert.deepEqual(tallies(), ['6 of 6 colours changed', '0 of 6 colours changed'])
  click(dom, '[data-change="reverse"]')
  assert.deepEqual(tallies(), ['6 of 6 colours changed', '0 of 6 colours changed'])
  assert.equal(q(dom, '[data-change="reverse"]').getAttribute('aria-pressed'), 'true')
  const huehash = all(dom, '#stable-body .approach')[1]!
  const [before, after] = [...huehash.querySelectorAll('.before-after > div')]
  const byName = (column: Element) => Object.fromEntries([...column.querySelectorAll('li')].map(li => [li.textContent, rgb((li as HTMLElement).style.color)]))
  const was = byName(before!)
  Object.entries(byName(after!)).forEach(([name, color]) => assert.equal(color, was[name], name))
  assert.equal(all(dom, '#stable-body .approach')[0]!.querySelectorAll('li.moved').length, 6)
  assert.equal(huehash.querySelectorAll('li.moved').length, 0)
})

test('landing: readable: the contrast you ask for holds on every surface', () => {
  const dom = open('landing')
  assert.equal(all(dom, '#readable-body .panel').length, 4)
  type(dom, '#contrast-slider', '10')
  assert.equal(q(dom, '#contrast-value').textContent, '10:1 AAA')
  assert.match(q(dom, '#readable-code').textContent ?? '', /minContrast: 10,/)
  all(dom, '#readable-body .panel').forEach(panel => {
    const lowest = Number(panel.querySelector('.worst b')!.textContent!.replace(':1', ''))
    assert.ok(lowest >= 10, `${panel.querySelector('h4')!.textContent} reached ${lowest}`)
    const surface = rgb((panel as HTMLElement).style.background)
    ;[...panel.querySelectorAll('li')].forEach(li => assert.ok(contrastRatio(rgb((li as HTMLElement).style.color), surface) >= 9.95))
  })
  type(dom, '#contrast-slider', '4.5')
  assert.equal(q(dom, '#contrast-value').textContent, '4.5:1 AA')
})

test('landing: even: the plain hash fails where huehash does not', () => {
  const dom = open('landing')
  const [naive, ours] = all(dom, '#even-body .column')
  assert.match(naive!.querySelector('.measures dd')!.textContent!, /^[1-9]\d* of 24$/)
  assert.equal(ours!.querySelector('.measures dd')!.textContent, '0 of 24')
  assert.ok(naive!.querySelectorAll('.num.low').length > 0)
  assert.equal(ours!.querySelectorAll('.num.low').length, 0)
})

const apartTiles = (dom: JSDOM) => all(dom, '#apart-body .nb-row .tile').map(tile => rgb(tile.style.background))
const gaps = (dom: JSDOM) => all(dom, '#apart-body .metric b').map(b => Number(b.textContent!.replace('°', '')))

test('landing: apart: the safe distance spreads look-alikes, and turning it off brings them back', () => {
  const dom = open('landing')
  assert.equal(all(dom, '#apart-body .nb-row').length, 1, 'one adjustable exhibit')
  type(dom, '#distance-slider', '0')
  assert.equal(q(dom, '#distance-value').textContent, 'off')
  assert.ok(gaps(dom)[0]! < 15, `${gaps(dom)[0]}° with the distance off`)
  type(dom, '#distance-slider', '60')
  assert.equal(q(dom, '#distance-value').textContent, '60°')
  assert.match(q(dom, '#apart-code').textContent ?? '', /distance: 60,\n  neighbours: 1,\n  columns: 8,/)
  assert.ok(gaps(dom)[0]! >= 55, `closest neighbours at distance 60 were ${gaps(dom)[0]}°`)
})

test('landing: apart: in a grid the tile above and below count, not just the ones beside', () => {
  const dom = open('landing')
  const shape = { columns: 8 }
  type(dom, '#distance-slider', '0')
  const without = apartTiles(dom)
  type(dom, '#distance-slider', '54')
  const withDistance = apartTiles(dom)
  assert.equal(withDistance.length, 32)
  assert.ok(closestInSpace(withDistance, shape, 1) >= 54 - 4, `${closestInSpace(withDistance, shape, 1)}°`)
  assert.ok(closestInSpace(without, shape, 1) < 15, 'without it there are look-alikes')
  const above = withDistance.map((hex, i) => (i >= 8 ? hueGap(oklchHue(hex), oklchHue(withDistance[i - 8]!)) : 360))
  assert.ok(Math.min(...above) >= 54 - 4, 'every tile differs from the one above it')
})

test('landing: apart: a line, a grid and a stack each draw their own space, and keep it apart', () => {
  const dom = open('landing')
  const spaces: Array<[string, number, number, Shape]> = [['line', 12, 0, {}], ['grid', 32, 0, { columns: 8 }], ['stack', 36, 3, { columns: 4, rows: 3 }]]
  spaces.forEach(([layout, tiles, layers, shape]) => {
    click(dom, `[data-layout="${layout}"]`)
    assert.equal(q(dom, `[data-layout="${layout}"]`).getAttribute('aria-pressed'), 'true')
    type(dom, '#distance-slider', '0')
    assert.ok(closestInSpace(apartTiles(dom), shape, 1) < 25, `${layout}: look-alikes without a distance`)
    type(dom, '#distance-slider', '50')
    assert.equal(apartTiles(dom).length, tiles, layout)
    assert.equal(all(dom, '#apart-body .layer').length, layers, layout)
    assert.ok(closestInSpace(apartTiles(dom), shape, 1) >= 50 - 4, `${layout}: ${closestInSpace(apartTiles(dom), shape, 1)}°`)
  })
  assert.match(q(dom, '#apart-code').textContent ?? '', /columns: 4,\n  rows: 3,/)
})

test('landing: apart: how near counts as near widens the neighbourhood', () => {
  const dom = open('landing')
  type(dom, '#distance-slider', '40')
  type(dom, '#steps-slider', '2')
  assert.equal(q(dom, '#steps-value').textContent, '2 steps')
  assert.match(q(dom, '#apart-code').textContent ?? '', /neighbours: 2,/)
  assert.match(q(dom, '#apart-body .metric').textContent ?? '', /within 2 steps/)
  assert.ok(closestInSpace(apartTiles(dom), { columns: 8 }, 2) >= 40 - 4)
  type(dom, '#steps-slider', '1')
  assert.equal(q(dom, '#steps-value').textContent, '1 step')
})

test('landing: apart: hovering a tile shows its neighbours, in three dimensions for the stack', () => {
  const dom = open('landing')
  const marked = () => all(dom, '#apart-body .tile.neighbour').map(tile => Number(tile.dataset.index)).sort((a, b) => a - b)
  hover(dom, '#apart-body .tile[data-index="9"]')
  assert.deepEqual(marked(), [1, 8, 10, 17])
  click(dom, '[data-layout="stack"]')
  hover(dom, '#apart-body .tile[data-index="13"]')
  assert.deepEqual(marked(), [1, 12, 14, 17, 25], 'beside, below, in front and behind')
})

test('landing: reserved: no name sits on a status colour once they are kept clear', () => {
  const dom = open('landing')
  const [without, withClear] = texts(dom, '#reserved-body .tally')
  assert.match(without!, /^[1-9]\d* of 24 names sit on a status colour$/)
  assert.equal(withClear, '0 of 24 names sit on a status colour')
  const [plain, clear] = all(dom, '#reserved-body .reserved-lists > div')
  assert.equal(plain!.querySelectorAll('li.near').length, Number(without!.split(' ')[0]))
  assert.equal(clear!.querySelectorAll('li.near').length, 0)
  type(dom, '#width-slider', '60')
  assert.equal(q(dom, '#width-value').textContent, '60°')
  assert.equal(texts(dom, '#reserved-body .tally')[1], '0 of 24 names sit on a status colour')
  assert.equal(all(dom, '#reserved-body .status li').length, 5)
  assert.ok(q(dom, '#reserved-body .wheel svg'))
})

test('landing: the real views are drawn from output, each with a link that opens it in the playground', () => {
  const dom = open('landing')
  const views = all(dom, '#showcase .view')
  assert.deepEqual(views.map(view => view.className.replace('view view-', '')), ['logs', 'people', 'chart', 'presence', 'calendar', 'labels'])
  views.forEach(view => assert.ok(view.querySelector('.view-frame')!.innerHTML.length > 100, view.className))
  const link = views[4]!.querySelector('a.open') as HTMLAnchorElement
  assert.match(link.getAttribute('href')!, /^\.\/try\/#/)
  assert.deepEqual(decodeHash(link.getAttribute('href')!.slice('./try/'.length)), { surface: '#0d1117', scene: 'calendar' })
})

test('landing: no view shares a class with the scene inside it, so the view styles cannot leak onto its caption', () => {
  const dom = open('landing')
  all(dom, '#showcase .view').forEach(view => {
    const outer = [...view.classList]
    const inner = new Set([...view.querySelectorAll('.view-frame *')].flatMap(el => [...el.classList]))
    assert.deepEqual(outer.filter(name => inner.has(name)), [], view.className)
    assert.ok(!outer.some(name => name.startsWith('scene-')), 'the figure must not wear a scene class')
  })
})

test('landing: the calendar shows every event whole, side by side where they overlap', () => {
  const dom = open('landing')
  const events = all(dom, '#showcase .view-calendar .event')
  assert.equal(events.length, 7)
  assert.deepEqual(events.map(event => event.querySelector('b')!.textContent), ['design', 'standup', 'planning', 'one-to-one', 'review', 'demo', 'retro'])
  events.forEach(event => assert.ok(event.title.length > 0 && event.querySelector('span')!.textContent!.length > 0))
  const widths = events.map(event => event.style.width)
  assert.ok(widths.some(width => width.includes('50%')), 'overlapping events share the column')
  assert.ok(widths.some(width => width.includes('100%')), 'the others take it whole')
})

test('landing: a surface switch repaints the whole page, and every colour on it still reads', () => {
  const dom = open('landing')
  click(dom, '[data-surface="#ffffff"]')
  const root = dom.window.document.documentElement
  assert.equal(root.style.getPropertyValue('--surface'), '#ffffff')
  assert.ok(root.hasAttribute('data-light'))
  all(dom, '#headline span, #wall span, #promise-index b').forEach(word => assert.ok(contrastRatio(rgb(word.style.color), '#ffffff') >= 7, word.textContent!))
  assert.equal(q(dom, '[data-surface="#ffffff"]').getAttribute('aria-pressed'), 'true')
  click(dom, '[data-surface="#0d1117"]')
  assert.ok(!root.hasAttribute('data-light'))
})

test('landing: the colour picker survives a repaint, so it does not close while you drag', () => {
  const dom = open('landing')
  const picker = q(dom, '#custom-surface')
  type(dom, '#custom-surface', '#223344')
  click(dom, '[data-surface="#0d1117"]')
  assert.equal(q(dom, '#custom-surface'), picker)
  assert.equal(dom.window.document.documentElement.style.getPropertyValue('--surface'), '#0d1117')
  assert.equal((picker as HTMLInputElement).value, '#0d1117')
})

test('landing: the playground links carry the chosen surface', () => {
  const dom = open('landing')
  click(dom, '[data-surface="#0f3552"]')
  ;['#nav-try', '#cta-try', '#cta-try-2'].forEach(selector => {
    const href = (q(dom, selector) as HTMLAnchorElement).getAttribute('href')!
    assert.deepEqual(decodeHash(href.slice('./try/'.length)), { surface: '#0f3552' })
  })
})

test('landing: the facts time the cache, and the code samples copy', async () => {
  const dom = open('landing')
  click(dom, '#bench')
  await new Promise(resolve => setTimeout(resolve, 3000))
  assert.match(q(dom, '#speed').textContent ?? '', /\d+ ms calculating each time, \d+ ms cached/)
  assert.equal(all(dom, '#code-blocks pre').length, 2)
  click(dom, '[data-code="1"]')
  assert.match((dom.window as unknown as { copied: string[] }).copied.at(-1)!, /colorsFor\(names, \{ distance: 40 \}\)/)
})

test('landing: the settings live in the link, so a link restores them', () => {
  const dom = open('landing')
  type(dom, '#try', 'nebula')
  type(dom, '#contrast-slider', '9')
  type(dom, '#distance-slider', '60')
  type(dom, '#width-slider', '40')
  click(dom, '[data-surface="#3b1a3f"]')
  const again = open('landing', dom.window.location.hash)
  assert.equal((q(again, '#try') as HTMLInputElement).value, 'nebula')
  assert.equal((q(again, '#contrast-slider') as HTMLInputElement).value, '9')
  assert.equal((q(again, '#distance-slider') as HTMLInputElement).value, '60')
  assert.equal((q(again, '#width-slider') as HTMLInputElement).value, '40')
  assert.equal(again.window.document.documentElement.style.getPropertyValue('--surface'), '#3b1a3f')
})

test('landing and playground: a link with nonsense in it opens on the defaults', () => {
  const hashes = [
    '#!!!not-base64',
    `#${Buffer.from(JSON.stringify({ surface: 'red', word: 5, distance: 'far', minContrast: null, width: {}, scene: 7, tab: 'x', neighbours: 'many', mode: 'neon', avoid: 'yes' })).toString('base64url')}`,
  ]
  hashes.forEach(hash => {
    const landing = open('landing', hash)
    assert.equal(landing.window.document.documentElement.style.getPropertyValue('--surface'), '#0d1117')
    assert.equal((q(landing, '#try') as HTMLInputElement).value, 'orbit')
    assert.equal((q(landing, '#distance-slider') as HTMLInputElement).value, '40')
    const playground = open('try', hash)
    assert.equal(playground.window.document.documentElement.style.getPropertyValue('--surface'), '#0d1117')
    assert.equal(q(playground, '[data-scene="logs"]').getAttribute('aria-selected'), 'true')
    assert.equal((q(playground, '#neighbours') as HTMLInputElement).value, '1')
  })
})

test('landing and playground: numbers in a link are held to what the sliders allow', () => {
  const hash = `#${Buffer.from(JSON.stringify({ distance: 5000, neighbours: 99, minContrast: -4, width: 1 })).toString('base64url')}`
  const landing = open('landing', hash)
  assert.equal((q(landing, '#distance-slider') as HTMLInputElement).value, '90')
  assert.equal((q(landing, '#contrast-slider') as HTMLInputElement).value, '3')
  assert.equal((q(landing, '#width-slider') as HTMLInputElement).value, '10')
  const playground = open('try', hash)
  assert.equal((q(playground, '#distance') as HTMLInputElement).value, '120')
  assert.equal((q(playground, '#neighbours') as HTMLInputElement).value, '6')
})

test('landing: an in-page link scrolls without replacing the settings held in the address', () => {
  const dom = open('landing')
  type(dom, '#distance-slider', '60')
  const before = dom.window.location.hash
  const scrolled: string[] = []
  dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(this: HTMLElement) {
    scrolled.push(this.id)
  }
  click(dom, '#promise-index a[href="#readable"]')
  assert.deepEqual(scrolled, ['readable'])
  assert.equal(dom.window.location.hash, before)
})

test('landing: the top bar marks the part you are reading', () => {
  const callbacks: Array<(entries: Array<{ isIntersecting: boolean; target: Element }>) => void> = []
  const observed: string[] = []
  const dom = new JSDOM(htmls.landing, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true })
  doms.push(dom)
  class FakeObserver {
    constructor(callback: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void) {
      callbacks.push(callback)
    }
    observe(target: Element) {
      observed.push(target.id)
    }
    disconnect() {}
  }
  Object.assign(dom.window, { IntersectionObserver: FakeObserver })
  dom.window.eval(bundles.landing)
  assert.deepEqual(observed, ['idea', 'promises', 'views', 'details'])
  callbacks[0]!([{ isIntersecting: true, target: dom.window.document.getElementById('views')! }])
  const current = all(dom, '[data-level]').map(a => `${a.dataset.level}:${a.getAttribute('aria-current')}`)
  assert.deepEqual(current, ['idea:false', 'promises:false', 'views:true', 'details:false'])
})

test('every control on both pages has a name, and every button says what it does', () => {
  ;(['landing', 'try'] as const).forEach(page => {
    const dom = open(page)
    all(dom, 'input, textarea, select').forEach(control => {
      const labelled = control.getAttribute('aria-label') || (control.id && dom.window.document.querySelector(`label[for="${control.id}"]`)) || control.closest('label')
      assert.ok(labelled, `${page}: ${control.id || control.outerHTML.slice(0, 60)} has no label`)
    })
    all(dom, 'button').forEach(button => {
      assert.equal(button.getAttribute('type'), 'button', `${page}: ${button.outerHTML.slice(0, 60)}`)
      assert.ok((button.textContent ?? '').trim() || button.getAttribute('aria-label'), `${page}: a button has no name`)
    })
  })
})

test('the calendar never lays two events over each other, and never makes one too short to read', () => {
  const placed = placeEvents(SLOTS.length)
  assert.equal(placed.length, SLOTS.length)
  placed.forEach((a, i) =>
    placed.slice(i + 1).forEach(b => {
      if (a.day !== b.day || a.end <= b.start || b.end <= a.start) return
      assert.notEqual(a.lane, b.lane, `slots ${a.index} and ${b.index} overlap in time, so they need their own lanes`)
    }),
  )
  placed.forEach(event => {
    assert.ok(event.lane < event.lanes && event.lanes <= 3)
    assert.ok(event.length >= 1, 'an hour is tall enough for a name and a time')
    assert.ok(event.start >= 8 && event.end <= 16, 'inside the hours shown')
  })
  assert.ok(placed.some(event => event.lanes === 2), 'the view shows what overlapping events look like')
})

/* ── playground ────────────────────────────────────────────────────────── */

test('playground: opens on the logs view with the example keys coloured for the surface', () => {
  const dom = open('try')
  assert.equal(q(dom, '[data-scene="logs"]').getAttribute('aria-selected'), 'true')
  assert.equal(all(dom, '#scenes [role="tab"]').length, 7)
  assert.match((q(dom, '#keys') as HTMLTextAreaElement).value, /^api\n/)
  assert.ok(q(dom, '#frame').innerHTML.length > 100)
})

test('playground: each view renders its own example keys, and your keys carry across views', () => {
  const dom = open('try')
  goToSwatches(dom)
  assert.equal(tileColors(dom).length, 24)
  click(dom, '[data-scene="people"]')
  assert.match((q(dom, '#keys') as HTMLTextAreaElement).value, /^ada\n/)
  type(dom, '#keys', 'one\ntwo\nthree')
  click(dom, '[data-scene="labels"]')
  assert.equal((q(dom, '#keys') as HTMLTextAreaElement).value, 'one\ntwo\nthree')
  click(dom, '[data-preset="example"]')
  assert.match((q(dom, '#keys') as HTMLTextAreaElement).value, /^bug\n/)
})

test('playground: the tiles are the library output for the keys, the options and the layout', () => {
  const dom = open('try')
  goToSwatches(dom)
  const keys = Array.from({ length: 24 }, (_, i) => `item-${i + 1}`)
  const base = { background: '#0d1117', minContrast: 7, distance: 40, neighbours: 1 }
  assert.deepEqual(tileColors(dom), colorsFor(keys, { ...base, columns: 8 }))
  click(dom, '[data-layout="stack"]')
  assert.deepEqual(tileColors(dom), colorsFor(keys, { ...base, columns: 8, rows: 2 }))
  click(dom, '[data-layout="line"]')
  assert.deepEqual(tileColors(dom), colorsFor(keys, base))
})

test('playground: the distance slider keeps neighbours that far apart, in a line, a grid and a stack', () => {
  const dom = open('try')
  goToSwatches(dom)
  const shapes: Array<[string, Shape]> = [['line', {}], ['grid', { columns: 8 }], ['stack', { columns: 8, rows: 2 }]]
  shapes.forEach(([layout, shape]) => {
    click(dom, `[data-layout="${layout}"]`)
    type(dom, '#distance', '0')
    const off = closestInSpace(tileColors(dom), shape, 1)
    type(dom, '#distance', '70')
    const on = closestInSpace(tileColors(dom), shape, 1)
    assert.ok(on >= 65, `${layout}: closest neighbours at distance 70 were ${on}°`)
    assert.ok(off < on, `${layout}: ${off}° with the distance off, ${on}° with it on`)
    assert.match(q(dom, '#metric').textContent ?? '', /\d+° apart/)
  })
})

test('playground: the layout controls show only where they apply, and only the ones the layout needs', () => {
  const dom = open('try')
  assert.ok(q(dom, '#layout-section').hidden, 'hidden on the logs view')
  assert.ok(!q(dom, '#layout-hint').hidden, 'the logs view points to the swatches')
  goToSwatches(dom)
  assert.ok(!q(dom, '#layout-section').hidden)
  assert.ok(q(dom, '#layout-hint').hidden)
  assert.ok(!q(dom, '#columns-control').hidden && q(dom, '#rows-control').hidden, 'a grid needs columns')
  click(dom, '[data-layout="stack"]')
  assert.ok(!q(dom, '#columns-control').hidden && !q(dom, '#rows-control').hidden, 'a stack needs columns and rows')
  click(dom, '[data-layout="line"]')
  assert.ok(q(dom, '#columns-control').hidden && q(dom, '#rows-control').hidden, 'a line needs neither')
  assert.equal(q(dom, '[data-layout="line"]').getAttribute('aria-pressed'), 'true')
})

test('playground: a grid draws rows of the width asked for, and a stack draws layers', () => {
  const dom = open('try')
  goToSwatches(dom)
  assert.equal(q(dom, '#frame .strip').style.getPropertyValue('--cols'), '8')
  assert.equal(all(dom, '#frame .layer').length, 0)
  type(dom, '#columns', '6')
  assert.equal(q(dom, '#frame .strip').style.getPropertyValue('--cols'), '6')
  click(dom, '[data-layout="stack"]')
  type(dom, '#columns', '4')
  type(dom, '#rows', '3')
  const layers = all(dom, '#frame .layer')
  assert.equal(layers.length, 2)
  assert.deepEqual(layers.map(layer => layer.querySelectorAll('.tile').length), [12, 12])
  assert.deepEqual(layers.map(layer => layer.querySelector('.layer-label')!.textContent), ['Layer 1', 'Layer 2'])
  const shape = { columns: 4, rows: 3 }
  assert.ok(closestInSpace(tileColors(dom), shape, 1) >= 40 - 4, 'the layers are kept apart too')
  click(dom, '[data-layout="line"]')
  assert.equal(q(dom, '#frame .strip').style.getPropertyValue('--cols'), '24')
  assert.ok(q(dom, '#frame .strip').classList.contains('line'))
})

test('playground: hovering a tile shows its neighbours in the grid and in the stack, and dims the rest', () => {
  const dom = open('try')
  goToSwatches(dom)
  const marked = () => all(dom, '#frame .tile.neighbour').map(tile => Number(tile.dataset.index)).sort((a, b) => a - b)
  hover(dom, '#frame .tile[data-index="9"]')
  assert.ok(q(dom, '#frame .scene-swatches').classList.contains('hovering'))
  assert.equal(q(dom, '#frame .tile.focus').dataset.index, '9')
  assert.deepEqual(marked(), [1, 8, 10, 17], 'above, left, right and below in the grid')
  click(dom, '[data-layout="stack"]')
  hover(dom, '#frame .tile[data-index="1"]')
  assert.deepEqual(marked(), [0, 2, 9, 17], 'beside, below and behind in the stack')
  type(dom, '#neighbours', '2')
  hover(dom, '#frame .tile[data-index="1"]')
  assert.ok(marked().length > 4 && marked().includes(18), 'two steps reaches further, through the layers')
  hover(dom, '#mark')
  assert.equal(all(dom, '#frame .tile.focus, #frame .tile.neighbour').length, 0)
  assert.ok(!q(dom, '#frame .scene-swatches').classList.contains('hovering'))
})

test('playground: the code shows the layout, and only for the view that has one', () => {
  const dom = open('try')
  click(dom, '#drawer-toggle')
  assert.doesNotMatch(q(dom, '#code').textContent ?? '', /columns/)
  goToSwatches(dom)
  assert.match(q(dom, '#code').textContent ?? '', /distance: 40, columns: 8\b/)
  click(dom, '[data-layout="stack"]')
  assert.match(q(dom, '#code').textContent ?? '', /columns: 8, rows: 2 \}/)
  click(dom, '[data-layout="line"]')
  assert.doesNotMatch(q(dom, '#code').textContent ?? '', /columns/)
})

test('playground: the neighbours slider reaches up to everyone', () => {
  const dom = open('try')
  goToSwatches(dom)
  type(dom, '#distance', '10')
  type(dom, '#neighbours', '6')
  assert.equal(q(dom, '#neighbours-value').textContent, 'all')
  const colors = tileColors(dom)
  const everyone = Math.min(...colors.flatMap((a, i) => colors.slice(i + 1).map(b => hueGap(oklchHue(a), oklchHue(b)))))
  assert.ok(everyone >= 10 - 0.5, `closest pair of all keys was ${everyone}°`)
})

test('playground: minimum contrast is honoured on every surface', () => {
  const dom = open('try')
  goToSwatches(dom)
  type(dom, '#contrast', '10')
  tileColors(dom).forEach(hex => assert.ok(contrastRatio(hex, '#0d1117') >= 10, hex))
  click(dom, '[data-surface="#ffffff"]')
  tileColors(dom).forEach(hex => assert.ok(contrastRatio(hex, '#ffffff') >= 10, `${hex} on white`))
  assert.ok(dom.window.document.documentElement.hasAttribute('data-light'))
})

test('playground: reserved hues keep generated colours clear of the status colours', () => {
  const dom = open('try')
  goToSwatches(dom)
  const statuses = ['#ffb454', '#7ee787', '#ff7b72', '#56d4dd', '#ff5fb0']
  const near = (colors: string[]) => colors.filter(hex => statuses.some(s => hueGap(oklchHue(hex), oklchHue(s)) < 13)).length
  const without = near(tileColors(dom))
  check(dom, '#avoid', true)
  assert.equal(near(tileColors(dom)), 0)
  assert.ok(without > 0, 'without the option some keys land near a status colour')
})

test('playground: the code drawer opens and shows JavaScript, CSS variables and valid JSON', () => {
  const dom = open('try')
  assert.ok(q(dom, '#drawer-body').hidden)
  click(dom, '#drawer-toggle')
  assert.ok(!q(dom, '#drawer-body').hidden)
  assert.match(q(dom, '#code').textContent!, /import \{ colorsFor \} from 'huehash'/)
  click(dom, '[data-tab="css"]')
  assert.match(q(dom, '#code').textContent!, /--[\w-]+:\s*#[0-9a-f]{6}/i)
  click(dom, '[data-tab="json"]')
  const parsed = JSON.parse(q(dom, '#code').textContent!) as Record<string, string>
  assert.deepEqual(Object.keys(parsed).slice(0, 2), ['api', 'auth'])
  click(dom, '#copy')
  assert.equal((dom.window as unknown as { copied: string[] }).copied.at(-1), q(dom, '#code').textContent)
})

test('playground: the cache counts hits, and turning it off stops them', () => {
  const dom = open('try')
  const hits = () => Number(q(dom, '#cache .stat b').textContent)
  type(dom, '#word', 'abc')
  type(dom, '#word', 'abd')
  type(dom, '#word', 'abc')
  assert.ok(hits() > 0)
  check(dom, '#cache-on', false)
  type(dom, '#word', 'abc')
  type(dom, '#word', 'abc')
  assert.equal(hits(), 0)
})

test('playground: times 100,000 lookups with and without the cache', async () => {
  const dom = open('try')
  click(dom, '#bench')
  await new Promise(resolve => setTimeout(resolve, 3000))
  assert.match(q(dom, '#timing').textContent ?? '', /100,000 lookups: \d+ ms calculating each time, \d+ ms cached/)
})

test('playground: the settings live in the link, so a link restores them', () => {
  const dom = open('try')
  type(dom, '#distance', '84')
  click(dom, '[data-surface="#3b1a3f"]')
  click(dom, '[data-scene="chart"]')
  const hash = dom.window.location.hash
  assert.ok(hash.length > 1)
  const again = open('try', hash)
  assert.equal((q(again, '#distance') as HTMLInputElement).value, '84')
  assert.equal(again.window.document.documentElement.style.getPropertyValue('--surface'), '#3b1a3f')
  assert.equal(q(again, '[data-scene="chart"]').getAttribute('aria-selected'), 'true')
})

test('playground: keys are treated as text, never as markup', () => {
  const dom = open('try')
  type(dom, '#keys', '<img src=x onerror=alert(1)>\n"quoted"\n<script>1</script>')
  assert.equal(all(dom, '#frame img, #frame script').length, 0)
  click(dom, '#drawer-toggle')
  assert.equal(all(dom, '#code img, #code script').length, 0)
})

test('playground: an empty list and a single key do not break any view', () => {
  const dom = open('try')
  const scenes = all(dom, '#scenes [role="tab"]').map(tab => tab.dataset.scene!)
  type(dom, '#keys', '')
  scenes.forEach(id => {
    click(dom, `[data-scene="${id}"]`)
    assert.ok(q(dom, '#frame').textContent!.length > 0, `${id} shows a message when empty`)
  })
  type(dom, '#keys', 'solo')
  scenes.forEach(id => {
    click(dom, `[data-scene="${id}"]`)
    assert.ok(q(dom, '#frame').innerHTML.length > 50, `${id} renders one key`)
  })
  assert.match(q(dom, '#metric').textContent ?? '', /at least two keys/)
})

test('the logo gives every letter its own colour, kept apart from its neighbours, on both pages', () => {
  ;(['landing', 'try'] as const).forEach(page => {
    const dom = open(page)
    const letters = all(dom, '#mark span')
    assert.equal(letters.map(letter => letter.textContent).join(''), '#huehash')
    assert.equal(q(dom, '#mark').getAttribute('aria-label'), 'huehash')
    const colors = letters.map(letter => rgb(letter.style.color))
    colors.forEach(hex => assert.ok(contrastRatio(hex, '#0d1117') >= 7))
    assert.equal(colors[1], colors[4], 'the same letter keeps its colour')
    assert.deepEqual(colors, colorsFor([...'#huehash'], { background: '#0d1117', distance: 50, neighbours: 2 }))
    click(dom, '[data-surface="#ffffff"]')
    all(dom, '#mark span').forEach(letter => assert.ok(contrastRatio(rgb(letter.style.color), '#ffffff') >= 7))
  })
})
