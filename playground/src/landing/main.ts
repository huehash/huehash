import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/martian-mono'
import '../base.css'
import '../scenes.css'
import './landing.css'

import { watchNeighbours } from '../shared/highlight.js'
import { $ } from '../shared/util.js'
import { LAYOUTS } from '../shared/engine.js'
import { persist, state } from './ctx.js'
import { codeAt, renderCode, renderFacts, runBench } from './details.js'
import { paint, renderHero, renderTop } from './hero.js'
import { renderHow, renderWall } from './how.js'
import { chooseChange, chooseOwnColor, renderApart, renderEven, renderReadable, renderReserved, renderStable } from './promises.js'
import { renderViews } from './views.js'

function renderAll() {
  paint()
  renderTop()
  renderHero()
  renderHow()
  renderWall()
  renderStable()
  renderReadable()
  renderEven()
  renderApart()
  renderReserved()
  renderViews()
  renderFacts()
  renderCode()
  $('#foot-note').textContent = 'Every generated colour on this page was computed by huehash in your browser.'
  persist()
}

function setWord(value: string) {
  state.word = value.slice(0, 32)
  renderHero()
  renderHow()
  persist()
}

const actions: Record<string, (element: HTMLElement) => void> = {
  word: element => setWord(element.dataset.word ?? ''),
  change: element => {
    chooseChange(element.dataset.change)
    renderStable()
  },
  layout: element => {
    const chosen = LAYOUTS.find(layout => layout.id === element.dataset.layout)
    if (!chosen) return
    state.layout = chosen.id
    renderApart()
    persist()
  },
  copy: element => {
    void navigator.clipboard?.writeText(codeAt(Number(element.dataset.code)))
    element.textContent = 'Copied'
    setTimeout(() => (element.textContent = 'Copy'), 1200)
  },
}

/** In-page links scroll instead of changing the address, which holds the page's settings. */
function jump(anchor: HTMLAnchorElement, event: Event): boolean {
  const section = document.getElementById(anchor.getAttribute('href')!.slice(1))
  if (!section) return false
  event.preventDefault()
  section.scrollIntoView?.({ block: 'start' })
  section.setAttribute('tabindex', '-1')
  section.focus({ preventScroll: true })
  return true
}

document.addEventListener('click', event => {
  const target = event.target as HTMLElement
  const surface = target.closest<HTMLElement>('[data-surface]')
  if (surface) {
    state.surface = surface.dataset.surface as string
    renderAll()
    return
  }
  const action = target.closest<HTMLElement>('[data-action]')
  if (action) {
    actions[action.dataset.action ?? '']?.(action)
    return
  }
  if (target.id === 'bench') {
    runBench()
    return
  }
  const anchor = target.closest<HTMLAnchorElement>('a[href^="#"]')
  if (anchor && anchor.getAttribute('href')!.length > 1) jump(anchor, event)
})

document.addEventListener('input', event => {
  const target = event.target as HTMLInputElement
  if (target.id === 'try' || target.id === 'how-input') return setWord(target.value)
  if (target.id === 'custom-surface') {
    state.surface = target.value
    return renderAll()
  }
  if (target.id === 'own-color') {
    chooseOwnColor(target.value)
    return renderReadable()
  }
  if (target.id === 'contrast-slider') {
    state.minContrast = Number(target.value)
    renderReadable()
  } else if (target.id === 'distance-slider') {
    state.distance = Number(target.value)
    renderApart()
  } else if (target.id === 'steps-slider') {
    state.steps = Number(target.value)
    renderApart()
  } else if (target.id === 'width-slider') {
    state.width = Number(target.value)
    renderReserved()
  } else return undefined
  return persist()
})

/** Mark the part of the page being read in the top bar. Skipped where the browser cannot observe scrolling. */
function watchLevels() {
  if (!('IntersectionObserver' in window)) return
  const links = [...document.querySelectorAll<HTMLElement>('[data-level]')]
  const observer = new IntersectionObserver(
    entries =>
      entries
        .filter(entry => entry.isIntersecting)
        .forEach(entry => links.forEach(link => link.setAttribute('aria-current', String(link.dataset.level === entry.target.id)))),
    { rootMargin: '-45% 0px -54% 0px' },
  )
  links.forEach(link => {
    const section = document.getElementById(link.dataset.level ?? '')
    if (section) observer.observe(section)
  })
}

renderAll()
watchLevels()
watchNeighbours()
