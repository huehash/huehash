import assert from 'node:assert/strict'
import { test } from 'node:test'
import { colorFor, colorsFor } from '../src/index.js'

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

test('a sequence with a distance between neighbours', () => {
  const keys = ['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'item-6']
  assert.deepEqual(colorsFor(keys, { distance: 0 }), ['#a1cbfe', '#efa76d', '#e79dd0', '#f29ce7', '#c4d277', '#7ed180'])
  assert.deepEqual(colorsFor(keys, { distance: 40 }), ['#a1cbfe', '#efa76d', '#e79dd0', '#c6c650', '#a4ccfd', '#7ed180'])
})

test('a sequence laid out in a grid, and in a stack of grids', () => {
  const keys = Array.from({ length: 12 }, (_, i) => `item-${i + 1}`)
  assert.deepEqual(colorsFor(keys, { distance: 40, columns: 4 }), [
    '#a1cbfe', '#efa76d', '#e79dd0', '#c6c650', '#c4d277', '#afb2fd', '#feb979', '#fe94b4', '#4dcffe', '#7adfa8', '#46d0f9', '#6fd49c',
  ])
  assert.deepEqual(colorsFor(keys, { distance: 40, columns: 2, rows: 3 }), [
    '#a1cbfe', '#efa76d', '#e79dd0', '#c6c650', '#c4d277', '#afb2fd', '#feb979', '#fe94b4', '#4dcffe', '#7adfa8', '#fd9cbb', '#edae59',
  ])
})

test('a sequence where every item is a neighbour of every other', () => {
  assert.deepEqual(colorsFor(['orbit', 'orbits', 'orbit2db', 'nextjs', 'platform', 'packages'], { distance: 30, neighbours: Infinity }), [
    '#d99ff1', '#52c5ef', '#c0c968', '#8adf9f', '#fdabb3', '#05cec6',
  ])
})
