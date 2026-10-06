import { createHuehash } from '../../../src/index.js'
import { clampNumber, cleanText, colorOptions, DEFAULT_SETTINGS, LAYOUTS, readHash, validSurface, writeHash, type Layout, type Settings } from '../shared/engine.js'

export type LandingState = { surface: string; word: string; minContrast: number; distance: number; steps: number; layout: Layout; width: number }

export const DEFAULTS: LandingState = { surface: '#0d1117', word: 'orbit', minContrast: 7, distance: 40, steps: 1, layout: 'grid', width: 26 }

const read = readHash(DEFAULTS)

export const state: LandingState = {
  surface: validSurface(read.surface, DEFAULTS.surface),
  word: cleanText(read.word, DEFAULTS.word),
  minContrast: clampNumber(read.minContrast, 3, 12, DEFAULTS.minContrast),
  distance: clampNumber(read.distance, 0, 90, DEFAULTS.distance),
  steps: Math.round(clampNumber(read.steps, 1, 3, DEFAULTS.steps)),
  layout: LAYOUTS.find(layout => layout.id === read.layout)?.id ?? DEFAULTS.layout,
  width: clampNumber(read.width, 10, 60, DEFAULTS.width),
}

export const engine = createHuehash()

export const settings = (): Settings => ({ ...DEFAULT_SETTINGS, surface: state.surface })
export const options = () => colorOptions(settings())
export const persist = () => writeHash(state, DEFAULTS)

/** A string as it would be written in code, so the examples on the page can be pasted as they are. */
export const jsString = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`

/** The names the page uses wherever it needs a crowd. */
export const NAMES = ['api', 'auth', 'billing', 'search', 'worker', 'gateway', 'mailer', 'cron', 'ada', 'grace', 'linus', 'margaret', 'alan', 'barbara', 'bug', 'feature', 'docs', 'chore', 'security', 'perf', 'north', 'south', 'east', 'west']
export const PEOPLE = ['ada', 'grace', 'linus', 'margaret', 'alan', 'barbara', 'dennis', 'ken']
