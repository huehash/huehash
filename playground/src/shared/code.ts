import { colorsFor, readable } from '../../../src/index.js'
import { inkFor } from './surface.js'
import { esc } from './util.js'

/* Syntax highlighting for the code on the pages, coloured by huehash itself.
   Each kind of token is a name, so `colorsFor` gives it a colour that reads on the block's own background and keeps
   the kinds a safe distance apart. Nothing here is a fixed palette: change the surface and the colours are made again. */

type Kind = 'keyword' | 'string' | 'number' | 'function' | 'property' | 'comment'
export type Palette = Record<Kind, string>

const palettes = new Map<string, Palette>()

/** The colours for code on a page surface: the code block sits on the surface's field colour, and every colour reads on it. */
export function paletteFor(surface: string): Palette {
  const ink = inkFor(surface)
  let palette = palettes.get(ink.field)
  if (!palette) {
    const colors = colorsFor(['keyword', 'string', 'number', 'function', 'property'], { background: ink.field, distance: 50, neighbours: Infinity })
    const at = (index: number) => colors[index] ?? ink.ink
    palette = { keyword: at(0), string: at(1), number: at(2), function: at(3), property: at(4), comment: readable(ink.muted, { background: ink.field, minContrast: 4.5 }) }
    palettes.set(ink.field, palette)
  }
  return palette
}

/** One match for each kind of token, tried in this order at every position. */
const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|(\b\d[\d.]*(?:°|%)?)|(--[\w-]+)(?=\s*:)|(\b(?:import|from|const|let|var|export|function|return|new|true|false|null|undefined|Infinity|as|type|typeof)\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)(?=\s*:)/g

/** Code as HTML with each token in its colour. The text is escaped, and reads back as exactly the code that went in. */
export function highlight(code: string, surface: string): string {
  const palette = paletteFor(surface)
  const span = (kind: Kind, text: string) => `<span style="color:${palette[kind]}">${esc(text)}</span>`
  let html = ''
  let last = 0
  for (const match of code.matchAll(TOKEN)) {
    const [text, comment, string, number, variable, keyword, call, property] = match
    const start = match.index
    html += esc(code.slice(last, start))
    last = start + text.length
    if (comment) html += span('comment', comment)
    else if (string) html += span(/^\s*:/.test(code.slice(last)) ? 'property' : 'string', string)
    else if (number) html += span('number', number)
    else if (variable) html += span('property', variable)
    else if (keyword) html += span('keyword', keyword)
    else if (call) html += span('function', call)
    else if (property) html += span('property', property)
  }
  return html + esc(code.slice(last))
}
