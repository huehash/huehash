import assert from 'node:assert/strict'
import { test } from 'node:test'
import { avoidHuesOf, cacheStats, clearCache, colorFor, createHuehash, describeColor, distinctColors, type Options } from '../src/index.js'

const COMBOS: Options[] = [
  {},
  { background: '#ffffff' },
  { background: ['#0b0e14', '#171c26'], minContrast: 4.5 },
  { minContrast: 12 },
  { avoid: avoidHuesOf(['#ffb454', '#7ee787', '#ff5fb0'], 30) },
  { background: '#f4f4f5', mode: 'dark' },
]

test('a cached answer is always the answer the calculation would give', () => {
  const cached = createHuehash()
  const uncached = createHuehash({}, { cacheSize: 0 })
  for (let i = 0; i < 300; i += 1) {
    COMBOS.forEach(options => {
      const name = `name-${i % 60}`
      assert.equal(cached.colorFor(name, options), uncached.colorFor(name, options))
      assert.deepEqual(cached.describeColor(name, options), uncached.describeColor(name, options))
    })
  }
  const names = Array.from({ length: 12 }, (_, i) => `group/project-${i}`)
  COMBOS.forEach(options => {
    assert.deepEqual(cached.distinctColors(names, options), uncached.distinctColors(names, options))
    assert.deepEqual(cached.distinctColors(names, options), uncached.distinctColors(names, options))
  })
})

test('counts a repeat as a hit, including case and spacing variants', () => {
  const h = createHuehash()
  h.colorFor('orbits')
  assert.deepEqual([h.cacheStats().hits, h.cacheStats().misses], [0, 1])
  h.colorFor('orbits')
  h.colorFor(' ORBITS ')
  assert.deepEqual([h.cacheStats().hits, h.cacheStats().misses, h.cacheStats().size], [2, 1, 1])
})

test('never returns a stale colour when any option changes', () => {
  const h = createHuehash()
  const reference = createHuehash({}, { cacheSize: 0 })
  const seen = new Set<string>()
  COMBOS.forEach(options => {
    h.colorFor('orbit', options)
    assert.equal(h.colorFor('orbit', options), reference.colorFor('orbit', options))
    seen.add(h.colorFor('orbit', options))
  })
  assert.ok(seen.size >= 4, 'different options really do give different colours')
})

test('notices when the same options object is changed between calls', () => {
  const h = createHuehash()
  const options: Options = { background: '#161b22', minContrast: 7 }
  const before = h.colorFor('orbit', options)
  options.background = '#ffffff'
  const after = h.colorFor('orbit', options)
  assert.notEqual(before, after)
  assert.equal(after, createHuehash({}, { cacheSize: 0 }).colorFor('orbit', { background: '#ffffff', minContrast: 7 }))
})

test('drops the least recently used result when full', () => {
  const h = createHuehash({}, { cacheSize: 3 })
  ;['a', 'b', 'c'].forEach(name => h.colorFor(name))
  h.colorFor('a')
  h.colorFor('d')
  assert.equal(h.cacheStats().size, 3, 'never holds more than cacheSize results')
  const hitsBefore = h.cacheStats().hits
  h.colorFor('a')
  assert.equal(h.cacheStats().hits, hitsBefore + 1, 'a was used recently, so it is kept')
  const missesBefore = h.cacheStats().misses
  h.colorFor('b')
  assert.equal(h.cacheStats().misses, missesBefore + 1, 'b was the least recently used, so it was dropped')
})

test('a cache size of 0 turns caching off without changing results', () => {
  const h = createHuehash({}, { cacheSize: 0 })
  assert.equal(h.colorFor('orbit'), colorFor('orbit'))
  h.colorFor('orbit')
  assert.deepEqual([h.cacheStats().hits, h.cacheStats().size, h.cacheStats().maxSize], [0, 0, 0])
})

test('describeColor results are frozen so nobody can corrupt the cache', () => {
  const h = createHuehash()
  const first = h.describeColor('orbit2db')
  assert.equal(h.describeColor('orbit2db'), first)
  assert.throws(() => { (first as { hex: string }).hex = '#000000' }, TypeError)
  assert.throws(() => { (first.rgb as unknown as number[])[0] = 0 }, TypeError)
  assert.throws(() => { (first.oklch as { l: number }).l = 0 }, TypeError)
  assert.equal(h.describeColor('orbit2db').hex, h.colorFor('orbit2db'))
})

test('distinctColors reuses a set regardless of order, and hands out a fresh object each time', () => {
  const h = createHuehash()
  const names = ['orbit', 'orbits', 'orbit2db', 'nextjs']
  const first = h.distinctColors(names)
  const hitsBefore = h.cacheStats().hits
  const second = h.distinctColors([...names].reverse())
  assert.equal(h.cacheStats().hits, hitsBefore + 1)
  assert.deepEqual(first, second)
  assert.notEqual(first, second)
  second['orbit'] = '#000000'
  assert.notEqual(h.distinctColors(names)['orbit'], '#000000')
})

test('clearCache forgets everything and the colours stay the same', () => {
  const before = colorFor('orbit')
  distinctColors(['a', 'b'])
  describeColor('orbit')
  assert.ok(cacheStats().size > 0)
  clearCache()
  assert.deepEqual([cacheStats().hits, cacheStats().misses, cacheStats().size], [0, 0, 0])
  assert.equal(colorFor('orbit'), before)
})

test('very long names are calculated every time instead of filling the cache', () => {
  const h = createHuehash()
  const long = 'x'.repeat(1000)
  assert.equal(h.colorFor(long), h.colorFor(long))
  assert.equal(h.cacheStats().size, 0)
})

test('a failed call changes nothing and later calls still work', () => {
  const h = createHuehash()
  const good = h.colorFor('orbit')
  assert.throws(() => h.colorFor('orbit', { background: 'nope' }), TypeError)
  assert.equal(h.colorFor('orbit'), good)
})

test('instance defaults apply, and call options override them', () => {
  const light = createHuehash({ background: '#ffffff' })
  const plain = createHuehash({}, { cacheSize: 0 })
  assert.equal(light.colorFor('orbit'), plain.colorFor('orbit', { background: '#ffffff' }))
  assert.equal(light.colorFor('orbit', { background: '#000000' }), plain.colorFor('orbit', { background: '#000000' }))
})

test('rejects invalid defaults when the instance is created', () => {
  assert.throws(() => createHuehash({ background: 'nope' }), TypeError)
  assert.throws(() => createHuehash({ minContrast: Number.NaN }), TypeError)
})

test('changing the defaults object after creation changes nothing', () => {
  const defaults: Options = { background: '#ffffff', avoid: [{ hue: 90, width: 40 }] }
  const h = createHuehash(defaults)
  const before = h.colorFor('orbit')
  defaults.background = '#000000'
  defaults.avoid!.push({ hue: 200, width: 60 })
  assert.equal(h.colorFor('orbit'), before)
  assert.equal(before, createHuehash({ background: '#ffffff', avoid: [{ hue: 90, width: 40 }] }, { cacheSize: 0 }).colorFor('orbit'))
})
