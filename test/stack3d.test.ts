import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gridDistance } from '../src/grid.js'
import { FLOATS_PER_TILE, fitDistance, layoutOf, pickTile, poseOf, rayThrough, tileData, TILE, type Rgb } from '../playground/src/shared/stack3d-math.js'

const STACK = { columns: 4, rows: 3 }

test('a stack of 36 sits as three layers of four by three, centred on the origin', () => {
  const { centres } = layoutOf(36, STACK)
  assert.equal(centres.length, 36)
  assert.equal(new Set(centres.map(c => c.join())).size, 36)
  const mean = (axis: 0 | 1 | 2) => centres.reduce((sum, c) => sum + c[axis], 0) / centres.length
  ;[0, 1, 2].forEach(axis => assert.ok(Math.abs(mean(axis as 0 | 1 | 2)) < 1e-9))
  assert.equal(new Set(centres.map(c => c[1])).size, 3)
  assert.equal(new Set(centres.map(c => c[0])).size, 4)
  assert.equal(new Set(centres.map(c => c[2])).size, 3)
})

test('a line and a flat grid lay out too, and nothing at all is fine', () => {
  assert.equal(new Set(layoutOf(12, { columns: Infinity, rows: Infinity }).centres.map(c => c[2])).size, 1)
  const flat = layoutOf(32, { columns: 8, rows: Infinity }).centres
  assert.equal(new Set(flat.map(c => c[1])).size, 1)
  assert.equal(new Set(flat.map(c => c[2])).size, 4)
  assert.deepEqual(layoutOf(0, STACK).centres, [])
})

test('the camera looks at the origin, and the middle of the canvas is a ray through it', () => {
  const pose = poseOf(0.6, 0.5, 12, 1.6)
  const [x, y, z, w] = [0, 1, 2, 3].map(row => [0, 4, 8, 12].reduce((sum, offset, i) => sum + pose.viewProj[offset + row]! * [0, 0, 0, 1][i]!, 0)) as [number, number, number, number]
  assert.ok(Math.abs(x / w) < 1e-6 && Math.abs(y / w) < 1e-6)
  assert.ok(z / w > 0 && z / w < 1)
  const ray = rayThrough(pose, 0, 0, 1.6)
  const toOrigin = pose.eye.map(value => -value / 12)
  ray.forEach((value, axis) => assert.ok(Math.abs(value - toOrigin[axis]!) < 1e-9))
})

test('picking returns the nearest tile on the ray, and nothing where there is none', () => {
  const centres = layoutOf(36, STACK).centres
  const top = centres.reduce((best, c, i) => (c[0] === centres[0]![0] && c[2] === centres[0]![2] && c[1] > centres[best]![1] ? i : best), 0)
  const column = centres[0]!
  assert.equal(pickTile([column[0], 20, column[2]], [0, -1, 0], centres), top)
  assert.equal(pickTile([column[0], -20, column[2]], [0, 1, 0], centres), 0)
  assert.equal(pickTile([50, 20, 50], [0, -1, 0], centres), null)
  assert.equal(pickTile([column[0] + TILE[0] * 1.2, 20, column[2]], [0, -1, 0], centres), null)
})

test('the stack fits the canvas, wide or narrow', () => {
  assert.ok(fitDistance(3, 1) > 3)
  assert.ok(fitDistance(3, 0.5) > fitDistance(3, 2))
})

test('hovering a tile grows it, keeps its neighbours as they are and fades the rest', () => {
  const layout = layoutOf(36, STACK)
  const colors: Rgb[] = layout.centres.map((_, i) => [i / 36, 0.5, 0.25])
  const alike = new Set([5])
  const at = (data: Float32Array, index: number) => ({ y: data[index * FLOATS_PER_TILE + 1]!, scale: data[index * FLOATS_PER_TILE + 3]!, dim: data[index * FLOATS_PER_TILE + 7]! })

  const rest = tileData(layout, colors, alike, STACK, 1, null)
  assert.equal(rest.length, 36 * FLOATS_PER_TILE)
  assert.ok(at(rest, 5).y > layout.centres[5]![1], 'a look-alike is lifted')
  assert.equal(at(rest, 6).y, Math.fround(layout.centres[6]![1]))
  for (let i = 0; i < 36; i += 1) assert.deepEqual([at(rest, i).scale, at(rest, i).dim], [1, 0])

  const hovered = tileData(layout, colors, alike, STACK, 1, 5)
  assert.ok(at(hovered, 5).scale > 1 && at(hovered, 5).dim < 0)
  for (let i = 0; i < 36; i += 1) {
    if (i === 5) continue
    const near = gridDistance(5, i, STACK) <= 1
    assert.equal(at(hovered, i).dim > 0.5, !near, `tile ${i}`)
  }
  assert.deepEqual([...hovered.slice(4 * 1 + 8 * 7, 7 + 8 * 7)], colors[7]!.map(Math.fround))
  const everyone = tileData(layout, colors, alike, STACK, Infinity, 5)
  for (let i = 0; i < 36; i += 1) if (i !== 5) assert.equal(at(everyone, i).dim, 0)
})
