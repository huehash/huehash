import { gridDistance, position, type Grid } from '../../../src/grid.js'

/* The parts of the 3D stack that need no GPU: where each tile sits, how the camera looks at them, what is under the
   pointer and how a hover dims the rest. Kept apart from stack3d.ts so they can be tested in Node. */

export type Vec3 = [number, number, number]

/** Half the size of a tile along x, y and z. Flat, so a layer reads as a plate of tiles. */
export const TILE: Vec3 = [0.44, 0.13, 0.44]
const LAYER_GAP = 1.8
const LIFT = 0.22
export const FOV = (35 * Math.PI) / 180

export type Layout3d = { centres: Vec3[]; radius: number }

/** Tile centres around the origin: a row along x, rows along z, layers up y. A line is one row. */
export function layoutOf(count: number, grid: Grid): Layout3d {
  if (!count) return { centres: [], radius: 1 }
  const columns = Number.isFinite(grid.columns) ? grid.columns : count
  const rows = Number.isFinite(grid.rows) ? grid.rows : Math.ceil(count / columns)
  const layers = Math.max(1, Math.ceil(count / (columns * rows)))
  const centres = Array.from({ length: count }, (_, index): Vec3 => {
    const { x, y, z } = position(index, { columns, rows })
    return [x - (columns - 1) / 2, (z - (layers - 1) / 2) * LAYER_GAP, y - (rows - 1) / 2]
  })
  return { centres, radius: 0.5 * Math.hypot(columns, (layers - 1) * LAYER_GAP + 2 * TILE[1], rows) }
}

export type Pose = { eye: Vec3; right: Vec3; up: Vec3; forward: Vec3; viewProj: Float32Array }

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a: Vec3): Vec3 => {
  const length = Math.hypot(...a) || 1
  return [a[0] / length, a[1] / length, a[2] / length]
}

/** Column-major a × b. */
function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row]! * b[column * 4 + k]!
      out[column * 4 + row] = sum
    }
  }
  return out
}

/** The distance at which a sphere of this radius fills the view, whatever the shape of the canvas. */
export function fitDistance(radius: number, aspect: number): number {
  const half = Math.min(FOV / 2, Math.atan(Math.tan(FOV / 2) * aspect))
  return (radius / Math.sin(half)) * 1.04
}

/** A camera orbiting the origin. Depth runs 0 to 1, as WebGPU expects. */
export function poseOf(yaw: number, pitch: number, distance: number, aspect: number): Pose {
  const eye: Vec3 = [distance * Math.cos(pitch) * Math.sin(yaw), distance * Math.sin(pitch), distance * Math.cos(pitch) * Math.cos(yaw)]
  const back = unit(eye)
  const right = unit(cross([0, 1, 0], back))
  const up = cross(back, right)
  const view = new Float32Array([right[0], up[0], back[0], 0, right[1], up[1], back[1], 0, right[2], up[2], back[2], 0, -dot(right, eye), -dot(up, eye), -dot(back, eye), 1])
  const near = 0.1
  const far = distance * 4
  const f = 1 / Math.tan(FOV / 2)
  const projection = new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, far / (near - far), -1, 0, 0, (far * near) / (near - far), 0])
  return { eye, right, up, forward: [-back[0], -back[1], -back[2]], viewProj: multiply(projection, view) }
}

/** The ray through a point on the canvas, as -1 to 1 across and -1 to 1 up. */
export function rayThrough(pose: Pose, x: number, y: number, aspect: number): Vec3 {
  const reach = Math.tan(FOV / 2)
  return unit([
    pose.forward[0] + pose.right[0] * x * reach * aspect + pose.up[0] * y * reach,
    pose.forward[1] + pose.right[1] * x * reach * aspect + pose.up[1] * y * reach,
    pose.forward[2] + pose.right[2] * x * reach * aspect + pose.up[2] * y * reach,
  ])
}

/** The nearest tile a ray passes through, or null. */
export function pickTile(origin: Vec3, direction: Vec3, centres: Vec3[]): number | null {
  let best: number | null = null
  let bestDistance = Infinity
  centres.forEach((centre, index) => {
    const low = sub(centre, TILE)
    const high: Vec3 = [centre[0] + TILE[0], centre[1] + TILE[1], centre[2] + TILE[2]]
    let near = -Infinity
    let far = Infinity
    for (let axis = 0; axis < 3; axis += 1) {
      if (Math.abs(direction[axis]!) < 1e-9) {
        if (origin[axis]! < low[axis]! || origin[axis]! > high[axis]!) return
        continue
      }
      const a = (low[axis]! - origin[axis]!) / direction[axis]!
      const b = (high[axis]! - origin[axis]!) / direction[axis]!
      near = Math.max(near, Math.min(a, b))
      far = Math.min(far, Math.max(a, b))
    }
    if (near <= far && far >= 0 && near < bestDistance) {
      best = index
      bestDistance = near
    }
  })
  return best
}

export type Rgb = [number, number, number]

/** What each tile looks like, as floats the shader reads: position, scale, colour and dim. */
export const FLOATS_PER_TILE = 8

/**
 * One row per tile. Tiles that look alike are lifted. Hover one and it grows and brightens, the tiles within `steps`
 * of it stay as they are, and every other tile fades toward the surface.
 */
export function tileData(layout: Layout3d, colors: Rgb[], alike: ReadonlySet<number>, grid: Grid, steps: number, hover: number | null): Float32Array {
  const data = new Float32Array(layout.centres.length * FLOATS_PER_TILE)
  layout.centres.forEach((centre, index) => {
    let scale = 1
    let dim = 0
    if (hover !== null) {
      if (index === hover) {
        scale = 1.1
        dim = -0.2
      } else if (gridDistance(hover, index, grid) > steps) {
        scale = 0.92
        dim = 0.72
      }
    }
    data.set([centre[0], centre[1] + (alike.has(index) ? LIFT : 0), centre[2], scale, ...colors[index]!, dim], index * FLOATS_PER_TILE)
  })
  return data
}
