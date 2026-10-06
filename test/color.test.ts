import assert from 'node:assert/strict'
import { test } from 'node:test'
import { colorFor, contrastRatio, oklchHue } from '../src/index.js'

const DARK = ['#0b0e14', '#11151c', '#171c26', '#161b22']

test('is deterministic and ignores case and surrounding spaces', () => {
  assert.equal(colorFor('orbit2db'), colorFor('orbit2db'))
  assert.equal(colorFor('ORBIT2DB'), colorFor('orbit2db'))
  assert.equal(colorFor('  Orbit '), colorFor('orbit'))
})

test('always returns a #rrggbb colour', () => {
  for (const name of ['orbit', 'orbits', 'orbit2db', '', ' ', 'ünïcödé', '日本語', '😀', 'a'.repeat(500), 'orbit/platform/orbit2db']) {
    assert.match(colorFor(name), /^#[0-9a-f]{6}$/, JSON.stringify(name))
  }
})

test('similar names get clearly different colours', () => {
  const [orbit, orbits, orbit2db] = ['orbit', 'orbits', 'orbit2db'].map(name => colorFor(name))
  assert.notEqual(orbit, orbits)
  assert.notEqual(orbits, orbit2db)
  assert.notEqual(orbit, orbit2db)
})

test('is readable on dark surfaces for any input (AAA by default)', () => {
  for (let i = 0; i < 4000; i += 1) {
    const hex = colorFor(`name-${i}-${(i * 7919).toString(36)}`, { background: DARK })
    DARK.forEach(surface => assert.ok(contrastRatio(hex, surface) >= 7, `${hex} on ${surface}: ${contrastRatio(hex, surface).toFixed(2)}`))
  }
})

test('honours a custom minimum contrast', () => {
  for (let i = 0; i < 500; i += 1) {
    assert.ok(contrastRatio(colorFor(`n${i}`, { minContrast: 4.5 }), '#161b22') >= 4.5)
    assert.ok(contrastRatio(colorFor(`n${i}`, { minContrast: 10 }), '#161b22') >= 10)
  }
})

test('guarantees contrast on every background you pass', () => {
  const backgrounds = ['#000000', '#1e1e2e', '#2b2b3d']
  for (let i = 0; i < 500; i += 1) {
    const hex = colorFor(`n${i}`, { background: backgrounds })
    backgrounds.forEach(background => assert.ok(contrastRatio(hex, background) >= 7))
  }
})

test('works for light backgrounds too, and follows them automatically', () => {
  for (let i = 0; i < 1000; i += 1) {
    const hex = colorFor(`light-${i}`, { background: ['#ffffff', '#f4f4f5'] })
    ;['#ffffff', '#f4f4f5'].forEach(background => assert.ok(contrastRatio(hex, background) >= 7, `${hex} on ${background}`))
  }
  assert.notEqual(colorFor('orbit', { background: '#ffffff' }), colorFor('orbit', { background: '#000000' }))
})

test('keeps brightness uniform so no name looks dimmer than another', () => {
  const ratios = Array.from({ length: 400 }, (_, i) => contrastRatio(colorFor(`n${i}`), '#0b0e14'))
  assert.ok(Math.max(...ratios) / Math.min(...ratios) < 1.9)
})

test('spreads hues across the whole wheel', () => {
  const buckets = new Set(Array.from({ length: 600 }, (_, i) => Math.floor(oklchHue(colorFor(`repo-${i}`)) / 30)))
  assert.equal(buckets.size, 12)
})

test('rejects bad input with a clear error', () => {
  assert.throws(() => colorFor('x', { background: 'not-a-colour' }), /Expected a #rgb or #rrggbb colour/)
  assert.throws(() => colorFor('x', { background: [] }), /at least one colour/)
  assert.throws(() => colorFor('x', { minContrast: Number.NaN }), /minContrast/)
})

test('clamps an impossible contrast to the maximum instead of looping forever', () => {
  assert.equal(colorFor('orbit', { minContrast: 99, background: '#444444' }), colorFor('orbit', { minContrast: 21, background: '#444444' }))
  assert.equal(colorFor('orbit', { minContrast: -5 }), colorFor('orbit', { minContrast: 1 }))
})
