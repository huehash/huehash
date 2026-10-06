import assert from 'node:assert/strict'
import { test } from 'node:test'
import { colorFor, distinctColors } from '../src/index.js'

/**
 * These values are part of the public contract: the same name must keep the same colour from one
 * release to the next, because people store, compare and screenshot them. If one of these tests
 * fails, the algorithm changed. That is a breaking change: bump the major version and say so in
 * the changelog. Never just update the expected values.
 */

test('single names on the default dark background', () => {
  const expected: Record<string, string> = {
    orbit: '#3dd4b9',
    orbits: '#d5b155',
    orbit2db: '#c0c968',
    nextjs: '#8adf9f',
    platform: '#28e2ce',
    packages: '#05cec6',
    docs: '#c5c0ff',
    flux: '#fea9d7',
    agents: '#ec99cf',
    '': '#bfbfbf',
  }
  Object.entries(expected).forEach(([name, hex]) => assert.equal(colorFor(name), hex, JSON.stringify(name)))
})

test('single names on a white background', () => {
  const expected: Record<string, string> = { orbit: '#046254', orbits: '#6b5308', orbit2db: '#585d04' }
  Object.entries(expected).forEach(([name, hex]) => assert.equal(colorFor(name, { background: '#ffffff' }), hex, name))
})

test('a distinct set', () => {
  assert.deepEqual(distinctColors(['orbit', 'orbits', 'orbit2db', 'nextjs', 'platform', 'packages']), {
    orbit: '#3dd4b9',
    orbits: '#d5b155',
    orbit2db: '#c0c968',
    nextjs: '#8adf9f',
    platform: '#81d0fe',
    packages: '#e095df',
  })
})
