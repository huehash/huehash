/**
 * How items are laid out: `columns` items to a row, `rows` rows to a layer, and as many layers as it takes.
 * `Infinity` means no limit, so `{ columns: Infinity, rows: Infinity }` is a single line, and
 * `{ columns: 8, rows: Infinity }` is a flat grid with rows of eight.
 */
export type Grid = { columns: number; rows: number }

/** Items in one line, the default. */
export const LINE: Grid = { columns: Infinity, rows: Infinity }

/** Where item number `index` sits: `x` along its row, `y` down the rows, `z` through the layers. */
export function position(index: number, { columns, rows }: Grid): { x: number; y: number; z: number } {
  const layer = columns * rows
  const z = Math.floor(index / layer)
  const rest = z === 0 ? index : index - z * layer
  return { x: rest % columns, y: Math.floor(rest / columns), z }
}

/** The number of steps between two items, moving along rows, down columns and through layers. */
export function gridDistance(a: number, b: number, grid: Grid): number {
  const from = position(a, grid)
  const to = position(b, grid)
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y) + Math.abs(from.z - to.z)
}

/**
 * The items before `index` that count as its neighbours: those within `steps` steps along rows, down columns
 * and through layers. In a line these are simply the `steps` items right before it.
 *
 * Only earlier items are listed. Placing items in order and checking each against its earlier neighbours
 * covers every neighbouring pair exactly once.
 */
export function earlierNeighbours(index: number, grid: Grid, steps: number): number[] {
  const { columns, rows } = grid
  const layerSize = columns * rows
  const { x, y, z } = position(index, grid)
  const found: number[] = []
  for (let back = 0; back <= Math.min(steps, z); back += 1) {
    const budget = steps - back
    const layerStart = z === back ? 0 : (z - back) * layerSize
    const firstRow = Math.max(0, y - budget)
    const lastRow = back === 0 ? y : Math.min(rows - 1, y + budget)
    for (let row = firstRow; row <= lastRow; row += 1) {
      const room = budget - Math.abs(row - y)
      const firstColumn = Math.max(0, x - room)
      const lastColumn = back === 0 && row === y ? x - 1 : Math.min(columns - 1, x + room)
      const rowStart = row === 0 ? 0 : row * columns
      for (let column = firstColumn; column <= lastColumn; column += 1) found.push(layerStart + rowStart + column)
    }
  }
  return found
}
