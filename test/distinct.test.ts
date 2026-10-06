import assert from 'node:assert/strict'
import { test } from 'node:test'
import { avoidHuesOf, colorFor, contrastRatio, distinctColors, hueGap, oklchHue } from '../src/index.js'

const NAMES = ['orbit', 'orbits', 'orbit2db', 'nextjs', 'platform', 'flux', 'docs', 'agents', 'ledger', 'e2e']
const STATUS = ['#ffb454', '#7ee787', '#ff7b72', '#56d4dd', '#ff5fb0']

test('separates every pair by the requested gap, whatever the input order', () => {
  const a = distinctColors(NAMES, { minHueGap: 24 })
  assert.deepEqual(a, distinctColors([...NAMES].reverse(), { minHueGap: 24 }))
  const hues = NAMES.map(name => oklchHue(a[name]!))
  hues.forEach((hue, i) => hues.slice(i + 1).forEach(other => assert.ok(hueGap(hue, other) >= 23, `${hueGap(hue, other).toFixed(1)}° apart`)))
})

test('keeps readability for every colour in the set', () => {
  Object.values(distinctColors(NAMES)).forEach(hex => assert.ok(contrastRatio(hex, '#161b22') >= 7))
})

test('treats names case-insensitively and returns the keys you passed', () => {
  const colors = distinctColors(['Orbit', 'orbit', ' ORBITS '])
  assert.equal(colors['Orbit'], colors['orbit'])
  assert.deepEqual(Object.keys(colors), ['Orbit', 'orbit', ' ORBITS '])
})

test('keeps colours out of avoided hues, including arcs that cross 0 degrees', () => {
  const avoid = avoidHuesOf(STATUS, 30)
  for (let i = 0; i < 1500; i += 1) {
    const hue = oklchHue(colorFor(`repo-${i}`, { avoid }))
    STATUS.forEach(status => assert.ok(hueGap(hue, oklchHue(status)) >= 12, `${hue.toFixed(0)}° is within 15° of ${status}`))
  }
})

test('a crowded set still gets the best separation available and no identical colours', () => {
  const avoid = avoidHuesOf(STATUS, 26)
  const many = distinctColors(Array.from({ length: 40 }, (_, i) => `group/project-${i}`), { minHueGap: 16, avoid })
  assert.equal(new Set(Object.values(many)).size, 40)
  const crowded = distinctColors(NAMES.concat(['a', 'b', 'c']), { minHueGap: 16, avoid })
  const hues = Object.values(crowded).map(oklchHue)
  const closest = Math.min(...hues.flatMap((hue, i) => hues.slice(i + 1).map(other => hueGap(hue, other))))
  assert.ok(closest >= 8, `closest pair is ${closest.toFixed(1)}° apart`)
})

test('an empty list gives an empty result', () => {
  assert.deepEqual(distinctColors([]), {})
})
