import { gridDistance, type Grid } from '../../../src/grid.js'

const sizeOf = (text: string | undefined): number => (text ? Number(text) : Infinity)

/**
 * Hover a tile and see who its neighbours are: the tiles the safe distance keeps apart from it, beside it,
 * above it, below it or in the layers in front and behind. The rest dim.
 */
export function watchNeighbours(root: Document = document) {
  let active = false
  const clear = () => {
    active = false
    root.querySelectorAll('.scene-swatches.hovering').forEach(scope => scope.classList.remove('hovering'))
    root.querySelectorAll('.tile.focus, .tile.neighbour').forEach(tile => tile.classList.remove('focus', 'neighbour'))
  }
  root.addEventListener('mouseover', event => {
    const tile = (event.target as HTMLElement).closest<HTMLElement>('.tile[data-index]')
    const scope = tile?.closest<HTMLElement>('.scene-swatches')
    if (!tile && !active) return
    clear()
    if (!tile || !scope) return
    const grid: Grid = { columns: sizeOf(scope.dataset.columns), rows: sizeOf(scope.dataset.rows) }
    const steps = scope.dataset.steps === 'all' ? Infinity : Number(scope.dataset.steps)
    const index = Number(tile.dataset.index)
    active = true
    scope.classList.add('hovering')
    tile.classList.add('focus')
    scope.querySelectorAll<HTMLElement>('.tile[data-index]').forEach(other => {
      const otherIndex = Number(other.dataset.index)
      if (otherIndex !== index && gridDistance(index, otherIndex, grid) <= steps) other.classList.add('neighbour')
    })
  })
}
