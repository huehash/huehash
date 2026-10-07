import assert from 'node:assert/strict'
import { test } from 'node:test'
import { contrastRatio, hueGap, oklchHue } from '../src/index.js'
import { highlight, paletteFor } from '../playground/src/shared/code.js'
import { inkFor, SURFACES } from '../playground/src/shared/surface.js'

const SOURCE = `import { colorFor } from 'huehash'

// '#3dd4b9', reads on the default dark surface
colorFor('orbit', { background: '#ffffff', minContrast: 4.5 })
const colors = colorsFor(names, { distance: 40 })
:root {
  --huehash-api: #aeabfa;
}
{ "api": "#aeabfa" }`

const textOf = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

test('highlighting changes how the code looks and never what it says', () => {
  SURFACES.forEach(({ hex }) => assert.equal(textOf(highlight(SOURCE, hex)), SOURCE, hex))
  assert.equal(textOf(highlight('', '#0d1117')), '')
  assert.equal(highlight('plain words', '#0d1117'), 'plain words')
})

test('every token colour is made by huehash for the block it sits on, and reads there at AAA', () => {
  const surfaces = [...SURFACES.map(s => s.hex as string), '#1f2937', '#fde68a']
  surfaces.forEach(surface => {
    const field = inkFor(surface).field
    const palette = paletteFor(surface)
    ;(['keyword', 'string', 'number', 'function', 'property'] as const).forEach(kind => assert.ok(contrastRatio(palette[kind], field) >= 7, `${kind} on ${surface}: ${contrastRatio(palette[kind], field).toFixed(2)}`))
    assert.ok(contrastRatio(palette.comment, field) >= 4.5, `comments on ${surface}`)
  })
})

test('the kinds of token look different from each other on every surface', () => {
  SURFACES.forEach(({ hex }) => {
    const palette = paletteFor(hex)
    const hues = (['keyword', 'string', 'number', 'function', 'property'] as const).map(kind => oklchHue(palette[kind]))
    hues.forEach((hue, i) => hues.slice(i + 1).forEach(other => assert.ok(hueGap(hue, other) >= 30, `${hex}: ${hue.toFixed(0)}° and ${other.toFixed(0)}°`)))
  })
})

test('the palette is made again for a new surface, and is the same each time for the same one', () => {
  assert.deepEqual(paletteFor('#0d1117'), paletteFor('#0d1117'))
  assert.notDeepEqual(paletteFor('#0d1117').keyword, paletteFor('#ffffff').keyword)
})

test('each kind of token gets its own colour', () => {
  const palette = paletteFor('#0d1117')
  const span = (kind: keyof typeof palette, text: string) => `<span style="color:${palette[kind]}">${text}</span>`
  const html = highlight(SOURCE, '#0d1117')
  assert.ok(html.includes(span('keyword', 'import')))
  assert.ok(html.includes(span('string', '&#39;huehash&#39;')))
  assert.ok(html.includes(span('function', 'colorFor')))
  assert.ok(html.includes(span('property', 'background')))
  assert.ok(html.includes(span('number', '4.5')))
  assert.ok(html.includes(span('number', '40')))
  assert.ok(html.includes(span('comment', '// &#39;#3dd4b9&#39;, reads on the default dark surface')))
  assert.ok(html.includes(span('property', '--huehash-api')))
  assert.ok(html.includes(span('property', '&quot;api&quot;')), 'a JSON key is a property, not a string')
  assert.ok(html.includes(span('string', '&quot;#aeabfa&quot;')))
})

test('code is escaped, so markup in a name stays text', () => {
  const html = highlight(`colorFor('<img src=x onerror=alert(1)>') // <script>1</script>`, '#0d1117')
  assert.doesNotMatch(html, /<img|<script/)
  assert.equal(textOf(html), `colorFor('<img src=x onerror=alert(1)>') // <script>1</script>`)
})
