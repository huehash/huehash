import assert from 'node:assert/strict'
import { test } from 'node:test'
import { avoidHuesOf, colorFor, colorsFor, contrastRatio, hueGap, oklchHue } from '../src/index.js'

const STATUS = ['#ffb454', '#7ee787', '#ff7b72', '#56d4dd', '#ff5fb0']
const sequential = (count: number) => Array.from({ length: count }, (_, i) => `item-${i + 1}`)
const hues = (colors: string[]) => colors.map(oklchHue)
/** The smallest hue gap between any two items that are within `reach` positions of each other. */
const closest = (colors: string[], reach: number) => {
  const h = hues(colors)
  let smallest = 360
  h.forEach((hue, i) => h.slice(i + 1, i + 1 + reach).forEach(other => (smallest = Math.min(smallest, hueGap(hue, other)))))
  return smallest
}
// The hue is measured from the rounded hex, which can differ from the one asked for by a few degrees.
const TOLERANCE = 4

test('returns one colour per key, in the order given', () => {
  const keys = sequential(8)
  const colors = colorsFor(keys)
  assert.equal(colors.length, 8)
  colors.forEach(hex => assert.match(hex, /^#[0-9a-f]{6}$/))
  assert.deepEqual(colorsFor([]), [])
})

test('keeps neighbours apart by the distance, even for sequential keys', () => {
  for (const distance of [20, 30, 60, 90]) {
    const colors = colorsFor(sequential(300), { distance })
    assert.ok(closest(colors, 1) >= distance - TOLERANCE, `distance ${distance}: closest neighbours are ${closest(colors, 1).toFixed(1)}° apart`)
  }
})

test('without the check, sequential keys can land on near-identical neighbours', () => {
  assert.ok(closest(colorsFor(sequential(300), { distance: 0 }), 1) < 10)
})

test('looks further than the next item when asked to', () => {
  const colors = colorsFor(sequential(200), { distance: 60, neighbours: 3 })
  assert.ok(closest(colors, 3) >= 60 - TOLERANCE, `${closest(colors, 3).toFixed(1)}°`)
})

test('adding keys to the end never changes the colours before them', () => {
  const keys = sequential(120)
  const all = colorsFor(keys, { distance: 45 })
  for (const length of [1, 2, 10, 57, 119]) {
    assert.deepEqual(colorsFor(keys.slice(0, length), { distance: 45 }), all.slice(0, length), `first ${length}`)
  }
})

test('a repeated key keeps its first colour', () => {
  const colors = colorsFor(['a', 'b', 'c', 'a', 'd', 'a'])
  assert.equal(colors[0], colors[3])
  assert.equal(colors[0], colors[5])
})

test('a distance of 0 is exactly each key on its own', () => {
  const keys = ['alpha', 'beta', 'gamma', 'delta', 'epsilon']
  assert.deepEqual(colorsFor(keys, { distance: 0 }), keys.map(key => colorFor(key)))
})

test('a key that does not need to move keeps its own colour', () => {
  const keys = sequential(40)
  const plain = keys.map(key => colorFor(key))
  const spread = colorsFor(keys, { distance: 30 })
  assert.ok(spread.filter((hex, i) => hex === plain[i]).length >= 15, 'most keys are untouched')
  assert.equal(spread[0], plain[0], 'the first key never has a neighbour before it')
})

test('with everyone as a neighbour, the order you pass keys in does not matter', () => {
  const keys = ['api', 'web', 'docs', 'billing', 'search', 'auth', 'mail', 'jobs']
  const forward = colorsFor(keys, { distance: 24, neighbours: Infinity })
  const reversed = colorsFor([...keys].reverse(), { distance: 24, neighbours: Infinity }).reverse()
  assert.deepEqual(forward, reversed)
  assert.ok(closest(forward, keys.length) >= 24 - TOLERANCE)
})

test('treats keys case-insensitively and gives empty keys a neutral colour', () => {
  const [a, b, empty] = colorsFor(['Orbit', ' orbit ', ''])
  assert.equal(a, b)
  assert.match(empty!, /^#[0-9a-f]{6}$/)
  assert.equal(empty, colorFor(''))
})

test('keeps every colour readable and out of avoided hues while spreading', () => {
  const avoid = avoidHuesOf(STATUS, 26)
  const colors = colorsFor(sequential(150), { distance: 40, avoid })
  colors.forEach(hex => {
    assert.ok(contrastRatio(hex, '#161b22') >= 7)
    STATUS.forEach(status => assert.ok(hueGap(oklchHue(hex), oklchHue(status)) >= 13 - TOLERANCE))
  })
  assert.ok(closest(colors, 1) >= 40 - TOLERANCE)
})

test('does its best when the distance cannot be met, without failing', () => {
  const colors = colorsFor(sequential(100), { distance: 90, neighbours: 10 })
  assert.equal(colors.length, 100)
  assert.ok(closest(colors, 10) >= 20, `${closest(colors, 10).toFixed(1)}° is the best 11 hues can do`)
})

test('rejects options that are not numbers and limits the distance to the wheel', () => {
  assert.throws(() => colorsFor(['a', 'b'], { distance: Number.NaN }), /distance/)
  assert.throws(() => colorsFor(['a', 'b'], { neighbours: Number.NaN }), /neighbours/)
  assert.deepEqual(colorsFor(['a', 'b', 'c'], { distance: 999 }), colorsFor(['a', 'b', 'c'], { distance: 180 }))
  assert.deepEqual(colorsFor(['a', 'b', 'c'], { neighbours: 0 }), colorsFor(['a', 'b', 'c'], { neighbours: 1 }))
})
