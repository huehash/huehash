import { contrastRatio } from '../../../src/index.js'

export const $ = <T extends HTMLElement>(selector: string, root: ParentNode = document): T => {
  const element = root.querySelector<T>(selector)
  if (!element) throw new Error(`Missing ${selector}`)
  return element
}

export const esc = (text: string) =>
  text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

/** Black or white, whichever reads better on a colour. */
export const readableOn = (hex: string) => (contrastRatio(hex, '#000000') >= contrastRatio(hex, '#ffffff') ? '#000000' : '#ffffff')

/** A small deterministic number from a string, for fake data that stays the same between renders. */
export function seeded(text: string): () => number {
  let seed = 2166136261
  for (const char of text) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

export const initials = (key: string) => key.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join('') || key.slice(0, 1).toUpperCase()
