import assert from 'node:assert/strict'
import { test } from 'node:test'
import { earlierNeighbours, gridDistance, LINE, position, type Grid } from '../src/grid.js'
import { colorFor, createHuehash, colorsFor, hueGap, oklchHue } from '../src/index.js'

const sequential = (count: number) => Array.from({ length: count }, (_, i) => `item-${i + 1}`)
// The hue is measured from the rounded hex, which can differ from the one asked for by a few degrees.
const TOLERANCE = 4

type Shape = { columns?: number; rows?: number }

/** Where an item sits, worked out without any infinite arithmetic, so it can check the library's own. */
function at(index: number, { columns, rows }: Shape) {
  if (columns === undefined) return { x: index, y: 0, z: 0 }
  if (rows === undefined) return { x: index % columns, y: Math.floor(index / columns), z: 0 }
  const layer = columns * rows
  const z = Math.floor(index / layer)
  const inLayer = index - z * layer
  return { x: inLayer % columns, y: Math.floor(inLayer / columns), z }
}

const steps = (a: number, b: number, shape: Shape) => {
  const from = at(a, shape)
  const to = at(b, shape)
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y) + Math.abs(from.z - to.z)
}

/** The smallest hue gap between any two items that are within `reach` steps of each other. */
function closest(colors: string[], shape: Shape, reach: number) {
  const hues = colors.map(oklchHue)
  let smallest = 360
  hues.forEach((hue, i) =>
    hues.slice(i + 1).forEach((other, offset) => {
      if (steps(i, i + 1 + offset, shape) <= reach) smallest = Math.min(smallest, hueGap(hue, other))
    }),
  )
  return smallest
}

const gridOf = ({ columns = Infinity, rows = Infinity }: Shape): Grid => ({ columns, rows })

const SHAPES: Shape[] = [{}, { columns: 5 }, { columns: 1 }, { columns: 4, rows: 3 }, { columns: 1, rows: 1 }, { columns: 3, rows: 1 }, { columns: 1, rows: 3 }, { columns: 7, rows: 2 }]

test('finds exactly the earlier items within the steps, in a line, a grid and a stack', () => {
  SHAPES.forEach(shape => {
    for (const reach of [1, 2, 3, 4]) {
      for (let index = 0; index < 90; index += 1) {
        const expected = Array.from({ length: index }, (_, other) => other).filter(other => steps(index, other, shape) <= reach)
        const found = earlierNeighbours(index, gridOf(shape), reach)
        assert.deepEqual([...found].sort((a, b) => a - b), expected, `${JSON.stringify(shape)}, ${reach} steps, item ${index}`)
        assert.equal(new Set(found).size, found.length, 'no item is listed twice')
      }
    }
  })
})

test('places items by row, column and layer', () => {
  const stack: Grid = { columns: 4, rows: 3 }
  assert.deepEqual(position(0, stack), { x: 0, y: 0, z: 0 })
  assert.deepEqual(position(5, stack), { x: 1, y: 1, z: 0 })
  assert.deepEqual(position(12, stack), { x: 0, y: 0, z: 1 })
  assert.deepEqual(position(23, stack), { x: 3, y: 2, z: 1 })
  assert.deepEqual(position(7, LINE), { x: 7, y: 0, z: 0 })
  assert.equal(gridDistance(0, 23, stack), 3 + 2 + 1)
  assert.equal(gridDistance(4, 16, stack), 1)
})

test('an item in the middle of a stack has a neighbour behind it as well as beside and above', () => {
  assert.deepEqual(earlierNeighbours(17, { columns: 4, rows: 3 }, 1).sort((a, b) => a - b), [5, 13, 16])
  assert.deepEqual(earlierNeighbours(17, { columns: 4, rows: 3 }, 1).length, 3)
  assert.deepEqual(earlierNeighbours(5, { columns: 4, rows: Infinity }, 1).sort((a, b) => a - b), [1, 4])
  assert.deepEqual(earlierNeighbours(5, LINE, 1), [4])
})

test('a grid keeps the items above and below apart, not only the ones beside', () => {
  const shape = { columns: 8 }
  const colors = colorsFor(sequential(60), { distance: 40, ...shape })
  assert.ok(closest(colors, shape, 1) >= 40 - TOLERANCE, `${closest(colors, shape, 1).toFixed(1)}°`)
})

test('without the columns, the items above and below can look alike', () => {
  const colors = colorsFor(sequential(60), { distance: 40 })
  assert.ok(closest(colors, { columns: 8 }, 1) < 15, `${closest(colors, { columns: 8 }, 1).toFixed(1)}°`)
})

test('a stack of grids keeps the items in front and behind apart too', () => {
  const shape = { columns: 4, rows: 3 }
  const colors = colorsFor(sequential(72), { distance: 40, ...shape })
  assert.ok(closest(colors, shape, 1) >= 40 - TOLERANCE, `${closest(colors, shape, 1).toFixed(1)}°`)
})

test('without the rows, the layers can look alike', () => {
  const colors = colorsFor(sequential(72), { distance: 40, columns: 4 })
  assert.ok(closest(colors, { columns: 4, rows: 3 }, 1) < 15, `${closest(colors, { columns: 4, rows: 3 }, 1).toFixed(1)}°`)
})

test('the safe distance counts steps along every axis', () => {
  const shape = { columns: 6, rows: 3 }
  const colors = colorsFor(sequential(72), { distance: 20, neighbours: 2, ...shape })
  assert.ok(closest(colors, shape, 2) >= 20 - TOLERANCE, `${closest(colors, shape, 2).toFixed(1)}°`)
  const one = colorsFor(sequential(72), { distance: 20, neighbours: 1, ...shape })
  assert.ok(closest(one, shape, 2) < closest(colors, shape, 2), 'a diagonal is two steps, so one step does not cover it')
})

test('does its best when the layout is too crowded for the distance', () => {
  const shape = { columns: 5, rows: 4 }
  const colors = colorsFor(sequential(100), { distance: 120, neighbours: 3, ...shape })
  assert.equal(colors.length, 100)
  colors.forEach(hex => assert.match(hex, /^#[0-9a-f]{6}$/))
})

test('one column, one row or one layer is the same as a line', () => {
  const keys = sequential(40)
  const line = colorsFor(keys, { distance: 45 })
  assert.deepEqual(colorsFor(keys, { distance: 45, columns: 1 }), line)
  assert.deepEqual(colorsFor(keys, { distance: 45, columns: keys.length }), line)
  assert.deepEqual(colorsFor(keys, { distance: 45, columns: 1, rows: 1 }), line)
  assert.deepEqual(colorsFor(keys, { distance: 45, columns: Infinity }), line)
  assert.deepEqual(colorsFor(keys, { distance: 45, columns: 5, rows: Infinity }), colorsFor(keys, { distance: 45, columns: 5 }))
})

test('adding keys to the end never changes the colours before them, in a grid or a stack', () => {
  const keys = sequential(90)
  ;[{ columns: 7 }, { columns: 4, rows: 3 }].forEach(shape => {
    const all = colorsFor(keys, { distance: 40, ...shape })
    for (const length of [1, 6, 7, 8, 12, 13, 50, 89]) {
      assert.deepEqual(colorsFor(keys.slice(0, length), { distance: 40, ...shape }), all.slice(0, length), `${JSON.stringify(shape)}, first ${length}`)
    }
  })
})

test('with everyone as a neighbour the layout does not matter', () => {
  const keys = ['api', 'web', 'docs', 'billing', 'search', 'auth', 'mail', 'jobs']
  const plain = colorsFor(keys, { distance: 24, neighbours: Infinity })
  assert.deepEqual(colorsFor(keys, { distance: 24, neighbours: Infinity, columns: 3 }), plain)
  assert.deepEqual(colorsFor(keys, { distance: 24, neighbours: Infinity, columns: 2, rows: 2 }), plain)
})

/** Two keys whose own colours are almost the same, so a neighbour check has to move one of them. */
function lookAlikes(): [string, string] {
  const names = Array.from({ length: 400 }, (_, i) => `x${i}`)
  const hues = names.map(name => oklchHue(colorFor(name)))
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) if (hueGap(hues[i]!, hues[j]!) < 2) return [names[i]!, names[j]!]
  }
  throw new Error('no look-alike pair among 400 keys')
}

test('an empty key still takes up a place in the grid, so the items after it keep their neighbours', () => {
  const [left, right] = lookAlikes()
  const colors = colorsFor(['a', 'b', '', left, right, 'f', 'g', 'h', 'i'], { distance: 40, columns: 3 })
  assert.equal(colors[2], colorsFor([''])[0], 'the empty key is neutral')
  assert.ok(hueGap(oklchHue(colors[3]!), oklchHue(colors[4]!)) >= 40 - TOLERANCE, 'the two look-alikes sit side by side in the second row')
})

test('a repeated key keeps its first colour in a grid too', () => {
  const colors = colorsFor(['a', 'b', 'c', 'd', 'a', 'b'], { distance: 40, columns: 2 })
  assert.equal(colors[4], colors[0])
  assert.equal(colors[5], colors[1])
})

test('the layout is part of what is remembered', () => {
  const huehash = createHuehash()
  const keys = sequential(48)
  const line = huehash.colorsFor(keys, { distance: 40 })
  const grid = huehash.colorsFor(keys, { distance: 40, columns: 8 })
  const stack = huehash.colorsFor(keys, { distance: 40, columns: 4, rows: 3 })
  assert.notDeepEqual(grid, line)
  assert.notDeepEqual(stack, grid)
  assert.deepEqual(huehash.colorsFor(keys, { distance: 40, columns: 8 }), grid)
  assert.deepEqual(huehash.colorsFor(keys, { distance: 40, columns: 4, rows: 3 }), stack)
  assert.deepEqual(huehash.colorsFor(keys, { distance: 40 }), line)
  assert.ok(huehash.cacheStats().hits >= 3)
})

test('rejects a layout that is not numbers, and rows without columns', () => {
  assert.throws(() => colorsFor(['a', 'b'], { columns: Number.NaN }), /columns/)
  assert.throws(() => colorsFor(['a', 'b'], { columns: 4, rows: Number.NaN }), /rows/)
  assert.throws(() => colorsFor(['a', 'b'], { rows: 3 }), /rows.*columns/)
  assert.deepEqual(colorsFor(sequential(20), { columns: 2.9 }), colorsFor(sequential(20), { columns: 2 }))
  assert.deepEqual(colorsFor(sequential(20), { columns: 0 }), colorsFor(sequential(20), { columns: 1 }))
  assert.deepEqual(colorsFor(sequential(20), { columns: 3, rows: 0.4 }), colorsFor(sequential(20), { columns: 3, rows: 1 }))
})
