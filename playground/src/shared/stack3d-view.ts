import { createStack3d, webgpuAvailable, type Stack3d } from './stack3d.js'
import { lookAlikes } from './scenes.js'
import type { Sequence } from './engine.js'

/* The stack of grids is drawn in 3D with WebGPU where the browser has it, and as flat layers everywhere else.
   Both pages share this: it starts the GPU on first use, owns the canvas, and moves it into whichever page slot asks. */

const HINT = 'Hover a tile. Drag to turn the stack.'

export type StackView = {
  /** True once WebGPU is running, so the 3D view can replace the flat layers. */
  ready(): boolean
  /** Start WebGPU if it has not been started. Calls `onChange` when it becomes ready or turns out not to be available. */
  start(): void
  /** Put the canvas in `slot` and draw the sequence on it. Only call when `ready()`. */
  show(slot: HTMLElement, seq: Sequence, surface: string): void
}

export function createStackView(onChange: () => void): StackView {
  let gpu: 'idle' | 'loading' | 'ready' | 'none' = webgpuAvailable() ? 'idle' : 'none'
  let stack: Stack3d | null = null
  let holder: HTMLElement | null = null
  let drawn: Sequence | null = null

  /** The canvas and its caption, made once and moved into the page each time the exhibit is redrawn. */
  const element = (): HTMLElement => {
    if (!holder) {
      holder = document.createElement('div')
      holder.className = 'stack3d'
      holder.innerHTML = `<canvas class="stack3d-canvas" role="img" aria-label="A stack of grids of tiles, drawn in 3D. Drag to turn it, hover a tile to see its neighbours."></canvas><p class="stack3d-readout mono" aria-live="polite">${HINT}</p>`
    }
    return holder
  }

  const readout = (index: number | null) => {
    const line = holder?.querySelector('.stack3d-readout')
    if (line) line.textContent = index === null || !drawn ? HINT : `${drawn.keys[index]}, ${drawn.colors[index]}`
  }

  const fallBack = () => {
    gpu = 'none'
    stack?.destroy()
    stack = null
    onChange()
  }

  return {
    ready: () => gpu === 'ready',
    start() {
      if (gpu !== 'idle') return
      gpu = 'loading'
      createStack3d(element().querySelector('canvas')!, { onHover: readout, onLost: fallBack }).then(
        created => {
          stack = created
          if (!created) return fallBack()
          gpu = 'ready'
          onChange()
        },
        (error: unknown) => {
          console.warn('huehash: WebGPU could not start, showing the flat view.', error)
          fallBack()
        },
      )
    },
    show(slot, seq, surface) {
      if (!stack) return
      drawn = seq
      slot.append(element())
      readout(null)
      stack.update({ colors: seq.colors, alike: lookAlikes(seq), grid: seq.grid, steps: seq.steps, surface })
    },
  }
}
