import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import { colorFor, contrastRatio } from '../src/index.js'

let bundle = ''
const html = readFileSync(new URL('../playground/index.html', import.meta.url), 'utf8').replace(/<script type="module"[^>]*><\/script>/, '')
const doms: JSDOM[] = []

before(async () => {
  const result = await build({
    entryPoints: [new URL('../playground/src/main.ts', import.meta.url).pathname],
    bundle: true,
    write: false,
    format: 'iife',
    loader: { '.css': 'empty', '.woff': 'empty', '.woff2': 'empty' },
    logLevel: 'silent',
  })
  bundle = result.outputFiles[0]!.text
})

after(() => doms.forEach(dom => dom.window.close()))

function open(hash = ''): JSDOM {
  const dom = new JSDOM(html, { url: `http://localhost/${hash}`, runScripts: 'outside-only', pretendToBeVisual: true })
  doms.push(dom)
  const copied: string[] = []
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async (text: string) => void copied.push(text) } })
  Object.assign(dom.window, { copied })
  dom.window.eval(bundle)
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
const rgb = (css: string) => '#' + (css.match(/\d+/g) ?? []).slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('')

test('renders the hero, a chip for every name part, and the wheel', () => {
  const dom = open()
  assert.equal((q(dom, '#word') as HTMLInputElement).value, 'orbit')
  assert.equal(rgb(q(dom, '#word').style.color), colorFor('orbit', { background: '#0d1117' }))
  assert.match(q(dom, '#readout').textContent ?? '', /contrast\s*\d+\.\d:1\s*AAA/)
  assert.equal(all(dom, '.chip').length, 10)
  assert.ok(q(dom, '#wheel svg'))
  assert.equal(all(dom, '#wheel circle').length, 10 + 1)
})

test('typing a name recolours the hero with the real library result', () => {
  const dom = open()
  type(dom, '#word', 'nebula')
  assert.equal(rgb(q(dom, '#word').style.color), colorFor('nebula', { background: '#0d1117' }))
  assert.match(q(dom, '#readout').textContent ?? '', new RegExp(colorFor('nebula', { background: '#0d1117' })))
  type(dom, '#word', '')
  assert.match(q(dom, '#readout').textContent ?? '', /Type a name/)
})

test('switching the surface repaints the page and keeps every colour readable on it', () => {
  const dom = open()
  click(dom, '[data-surface="#ffffff"]')
  const root = dom.window.document.documentElement
  assert.equal(root.style.getPropertyValue('--surface'), '#ffffff')
  assert.ok(root.hasAttribute('data-light'))
  const chipColors = all(dom, '.chip').map(chip => chip.getAttribute('data-copy')!)
  chipColors.forEach(hex => assert.ok(contrastRatio(hex, '#ffffff') >= 7, `${hex} on white`))
  click(dom, '[data-surface="#0d1117"]')
  assert.ok(!root.hasAttribute('data-light'))
})

test('the sliders change the result and show their value', () => {
  const dom = open()
  type(dom, '#contrast', '10')
  assert.equal(q(dom, '#contrast-value').textContent, '10:1')
  all(dom, '.chip').forEach(chip => assert.ok(contrastRatio(chip.getAttribute('data-copy')!, '#0d1117') >= 10))
  type(dom, '#gap', '0')
  assert.equal(q(dom, '#gap-value').textContent, '0°')
})

test('turning spreading off gives each name its own plain colour, and the code follows', () => {
  const dom = open()
  const spread = all(dom, '.chip').map(chip => chip.getAttribute('data-copy'))
  const box = q(dom, '#spread') as HTMLInputElement
  box.checked = false
  box.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  const plain = all(dom, '.chip').map(chip => chip.getAttribute('data-copy'))
  assert.notDeepEqual(plain, spread)
  assert.match(q(dom, '#code').textContent ?? '', /colorFor/)
  assert.doesNotMatch(q(dom, '#code').textContent ?? '', /distinctColors/)
})

test('the output tabs show JavaScript, CSS variables and valid JSON', () => {
  const dom = open()
  assert.match(q(dom, '#code').textContent ?? '', /import \{ distinctColors \} from 'huehash'/)
  click(dom, '[data-tab="css"]')
  assert.match(q(dom, '#code').textContent ?? '', /^:root \{\n {2}--huehash-acme: #[0-9a-f]{6};/)
  click(dom, '[data-tab="json"]')
  const parsed = JSON.parse(q(dom, '#code').textContent ?? '') as Record<string, string>
  assert.equal(Object.keys(parsed).length, 10)
  Object.values(parsed).forEach(hex => assert.match(hex, /^#[0-9a-f]{6}$/))
})

test('copying a chip or the output uses the clipboard', async () => {
  const dom = open()
  const chip = all(dom, '.chip')[0]!
  chip.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  click(dom, '#copy')
  const copied = (dom.window as unknown as { copied: string[] }).copied
  assert.equal(copied[0], chip.getAttribute('data-copy'))
  assert.match(copied[1] ?? '', /huehash/)
})

test('shows the cache working, and turning it off stops it', () => {
  const dom = open()
  const hits = () => Number(q(dom, '#cache .stat b').textContent)
  assert.ok(hits() > 0, 'the first render already reuses results')
  const toggle = q(dom, '#cache-on') as HTMLInputElement
  toggle.checked = false
  toggle.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.equal(hits(), 0)
})

test('times 100,000 lookups with and without the cache', async () => {
  const dom = open()
  click(dom, '#bench')
  for (let i = 0; i < 100 && !/times faster/.test(q(dom, '#timing').textContent ?? ''); i += 1) await new Promise(resolve => setTimeout(resolve, 50))
  assert.match(q(dom, '#timing').textContent ?? '', /100,000 lookups: \d+ ms calculating each time, \d+ ms with the cache, [\d.]+ times faster/)
})

test('keeps the settings in the link, so a link restores them', () => {
  const dom = open()
  type(dom, '#word', 'zeta')
  click(dom, '[data-surface="#160f19"]')
  const link = dom.window.location.hash
  assert.ok(link.length > 1)
  const restored = open(link)
  assert.equal((q(restored, '#word') as HTMLInputElement).value, 'zeta')
  assert.equal(restored.window.document.documentElement.style.getPropertyValue('--surface'), '#160f19')
})

test('treats names as text, never as markup', () => {
  const dom = open()
  type(dom, '#names', '<img src=x onerror=alert(1)>\nok/<b>bold</b>')
  assert.equal(all(dom, '#chips img, #context img, #chips b, #context b').length, 0)
  assert.ok(all(dom, '.chip-name').some(el => el.textContent === '<img src=x onerror=alert(1)>'))
})

test('handles an empty set without breaking', () => {
  const dom = open()
  type(dom, '#names', '')
  assert.match(q(dom, '#chips').textContent ?? '', /Add a name/)
  assert.match(q(dom, '#context').textContent ?? '', /Add names/)
})
