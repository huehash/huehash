import type { Huehash, Options } from '../../../src/index.js'

/** The name, one letter at a time, each with its own colour kept apart from the letters beside it. */
export function renderLogo(element: HTMLElement, engine: Huehash, options: Options) {
  const letters = [...'#huehash']
  const colors = engine.colorsFor(letters, { ...options, distance: 50, neighbours: 2 })
  element.setAttribute('aria-label', 'huehash')
  element.innerHTML = letters.map((letter, i) => `<span aria-hidden="true" style="color:${colors[i]}">${letter}</span>`).join('')
}
