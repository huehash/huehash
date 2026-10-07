import { colorFor, colorsFor, createHuehash } from '../../../src/index.js'
import { $, esc } from '../shared/util.js'

let speed = ''
let codes: string[] = []

export function renderFacts() {
  $('#facts-body').innerHTML = `
    <div class="fact"><b>AAA</b><p>The contrast you ask for is the contrast you get, checked against every background you pass. 7 to 1 by default.</p></div>
    <div class="fact"><b>4 kB</b><p>Minified and gzipped, with no dependencies. It runs in Node 18 and any modern browser.</p></div>
    <div class="fact"><b>Cached</b><p>The same name with the same options is calculated once. Repeat lookups are several times faster.</p>
      <button type="button" class="quiet" id="bench">Run 100,000 lookups</button><p class="speed mono" id="speed" aria-live="polite">${esc(speed)}</p></div>
    <div class="fact"><b>Pinned</b><p>Golden tests fix the exact colours, so a name keeps its colour from one release to the next.</p></div>`
}

export function renderCode() {
  const orbit = colorFor('orbit')
  const orbits = colorFor('orbits')
  const onWhite = colorFor('orbit', { background: '#ffffff' })
  const spread = colorsFor(['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'item-6'], { distance: 40 })
  const one = `import { colorFor } from 'huehash'\n\ncolorFor('orbit')                              // '${orbit}'  reads on the default dark surface\ncolorFor('orbit', { background: '#ffffff' })   // '${onWhite}'  darkened to read on white\ncolorFor('orbits')                             // '${orbits}'  a similar name, a clearly different colour`
  const two = `import { colorsFor } from 'huehash'\n\nconst names = ['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'item-6']\nconst colors = colorsFor(names, { distance: 40 })\n\n// colors[i] belongs to names[i]; neighbours are at least 40° apart\n// [${spread.map(hex => `'${hex}'`).join(', ')}]`
  codes = [one, two]
  $('#code-blocks').innerHTML = codes.map((code, i) => `<div class="code-wrap"><button type="button" class="quiet copy" data-action="copy" data-code="${i}">Copy</button><pre tabindex="0">${esc(code)}</pre></div>`).join('')
}

export function codeAt(index: number): string {
  return codes[index] ?? ''
}

export function runBench() {
  speed = 'Running…'
  renderFacts()
  setTimeout(() => {
    const names = Array.from({ length: 200 }, (_, i) => `item-${i}`)
    const time = (cacheSize: number) => {
      const huehash = createHuehash({}, { cacheSize })
      names.forEach(name => huehash.colorFor(name))
      const start = performance.now()
      for (let pass = 0; pass < 500; pass += 1) names.forEach(name => huehash.colorFor(name))
      return performance.now() - start
    }
    const off = time(0)
    const on = time(2000)
    speed = `${off.toFixed(0)} ms calculating each time, ${on.toFixed(0)} ms cached, ${(off / Math.max(on, 0.01)).toFixed(1)} times faster.`
    renderFacts()
  }, 30)
}
