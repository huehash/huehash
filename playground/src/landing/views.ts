import { encodeHash, sequenceOf } from '../shared/engine.js'
import { SCENES } from '../shared/scenes.js'
import { $ } from '../shared/util.js'
import { engine, settings, state } from './ctx.js'

const VIEWS = ['logs', 'people', 'chart', 'presence', 'calendar', 'labels']

export function renderViews() {
  $('#showcase').innerHTML = VIEWS.map(id => {
    const scene = SCENES.find(s => s.id === id)!
    const seq = sequenceOf(engine, scene.keys, settings())
    const link = `./try/#${encodeHash({ surface: state.surface, source: 'names', scene: id })}`
    return `<figure class="view view-${id}"><figcaption><h3>${scene.label}</h3><p>${scene.caption}</p></figcaption><div class="view-frame">${scene.render(seq)}</div><a class="open" href="${link}" aria-label="Try your own keys in the ${scene.label.toLowerCase()} view">Try your own keys</a></figure>`
  }).join('')
}
