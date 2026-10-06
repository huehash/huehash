# #huehash

**A stable, readable colour for any string, with a safe distance between look-alikes.**

[![CI](https://github.com/huehash/huehash/actions/workflows/ci.yml/badge.svg)](https://github.com/huehash/huehash/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Dependencies: none](https://img.shields.io/badge/dependencies-none-brightgreen.svg)

Give it an id, a label, a username, a chart series, a graph node or a log source, and get a hex that fits your dark (or light) interface, with the contrast you ask for guaranteed. The same key always gets the same colour, so a thing looks the same everywhere it appears, with nothing to store and nothing to assign.

**[Read the guided tour and try it live](https://huehash.github.io/huehash/)** · **[Open the playground](https://huehash.github.io/huehash/try/)**

```bash
npm install huehash
```

```ts
import { colorFor, colorsFor } from 'huehash'

colorFor('orbit')   // '#3dd4b9'
colorFor('orbits')  // '#d5b155'  (a similar key, a clearly different colour)

// Things that sit near each other: look-alikes keep a safe distance apart
colorsFor(['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'item-6'], { distance: 40 })
```

## Contents

- [Why huehash](#why-huehash)
- [Quick start](#quick-start)
- [Five promises](#five-promises)
- [A safe distance](#a-safe-distance)
- [Recipes](#recipes)
- [API reference](#api-reference)
- [How it works](#how-it-works)
- [Caching](#caching)
- [FAQ](#faq)
- [Stability](#stability)
- [Requirements](#requirements)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Why huehash

A plain `hsl(hash % 360, 70%, 60%)` has three problems that show up the moment you put it on a dark surface.

- **Unequal brightness.** In HSL a yellow and a blue of the same lightness look nothing alike, so some keys glow and others disappear. huehash works in [OKLCH](https://oklch.com), where equal lightness looks equal.
- **No contrast guarantee.** huehash checks every colour against your background(s) and lifts it until the WCAG contrast you asked for (AAA by default) is met.
- **Neighbours collide.** Hashes cluster by chance, so two keys side by side, above or below each other can land on nearly the same hue. With `colorsFor` and a safe distance, they never do.

|  | `hsl(hash % 360, 70%, 60%)` | huehash |
|---|---|---|
| Same key, same colour everywhere | yes | yes |
| Equal perceived brightness | no | yes, in OKLCH |
| Contrast you can rely on | no | the ratio you ask for, on every background you pass |
| Light and dark surfaces | one look | lightened or darkened until it reads |
| Neighbours kept apart | no | in a line, a grid or a stack |
| Keep clear of status colours | no | `avoid` |
| Dependencies | none | none |

| key | hex | OKLCH | contrast on `#161b22` |
|---|---|---|---|
| `orbit` | `#3dd4b9` | `oklch(78.6% 0.130 177.9)` | 9.3:1 AAA |
| `orbits` | `#d5b155` | `oklch(77.4% 0.118 88.0)` | 8.4:1 AAA |
| `user-42` | `#43e5c2` | `oklch(83.1% 0.141 174.8)` | 10.9:1 AAA |
| `nextjs` | `#8adf9f` | `oklch(83.3% 0.122 150.9)` | 10.8:1 AAA |
| `docs` | `#c5c0ff` | `oklch(83.4% 0.088 288.0)` | 10.2:1 AAA |
| `flux` | `#fea9d7` | `oklch(83.1% 0.114 346.2)` | 9.8:1 AAA |

## Quick start

```ts
import { colorFor } from 'huehash'

// One stable colour, tuned for a dark surface by default
colorFor('billing')                           // '#fea9a2'

// Tell it where the colour will sit
colorFor('billing', { background: '#ffffff' })

// Ask for a different contrast
colorFor('billing', { minContrast: 4.5 })     // WCAG AA instead of AAA

// Several surfaces at once: contrast is guaranteed on all of them
colorFor('billing', { background: ['#0b0e14', '#171c26'] })
```

Use the colour wherever a thing shows up:

```tsx
function Tag({ name }: { name: string }) {
  return <span style={{ color: colorFor(name) }}>{name}</span>
}
```

Or write the colours out as CSS custom properties:

```ts
import { colorFor, toCssVariables } from 'huehash'

const colors = Object.fromEntries(['api', 'billing', 'search'].map(name => [name, colorFor(name)]))
toCssVariables(colors)
// :root {
//   --huehash-api: #aeabfa;
//   --huehash-billing: #fea9a2;
//   --huehash-search: #d698e5;
// }
```

## Five promises

1. **Stable.** The colour is worked out from the text and nothing else. There is no table to keep, nothing to sync between services, and nothing that shifts when someone adds a name. Case and surrounding spaces do not matter: `'Orbit '` and `'orbit'` are the same key.
2. **Readable.** Ask for a contrast ratio and every colour meets it, checked against each background you pass. The default is 7 to 1, WCAG AAA.
3. **Even.** Lightness and chroma stay in a narrow band in OKLCH, so no name shouts and no name fades.
4. **Apart.** With `colorsFor`, look-alike colours keep a safe distance from each other in a line, a grid or a stack of grids.
5. **Reserved.** `avoid` keeps generated colours clear of the hues you use to mean something, so a service never looks like a warning.

## A safe distance

Colours cannot all be different, because the wheel is finite. So huehash keeps look-alikes at a **safe distance** from each other, in whatever space your items sit in: a line, a grid, or a stack of grids. Within the safe distance no two items get the same or a similar colour. Beyond it, colours may repeat.

`colorFor` gives every key its own colour, and that is all it knows. For things that sit near each other that is not always enough: hash six sequential keys and two of them can land side by side on almost the same pink.

```ts
const keys = ['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'item-6']

colorsFor(keys, { distance: 0 })   // ['#a1cbfe', '#efa76d', '#e79dd0', '#f29ce7', '#c4d277', '#7ed180']
colorsFor(keys, { distance: 40 })  // ['#a1cbfe', '#efa76d', '#e79dd0', '#c6c650', '#a4ccfd', '#7ed180']
```

With `distance: 0` the fourth key sits next to a near-identical pink. With `distance: 40` it moves to a different hue and the rest stay as they were.

You choose two numbers, and say what the space looks like:

- **`distance`: how different counts as different.** The least gap between two colours on the colour wheel, in OKLCH degrees (0 to 180, default 30). 0 turns the check off.
- **`neighbours`: how near counts as near.** The safe distance, in steps (default 1). A step moves one item along a row, down a column or through a layer, so a diagonal is two steps. `Infinity` makes every key a neighbour of every other, which is what you want for a small set like tags.
- **`columns` and `rows`: the space.** By default the items sit in a line. Say how they are laid out and the items above, below, in front and behind count as neighbours too.

```ts
const names = Array.from({ length: 24 }, (_, i) => `item-${i + 1}`)

// A line (1D): each name differs from the one before it.
colorsFor(names, { distance: 40 })

// A grid (2D), four to a row: each name also differs from the one above it.
colorsFor(names, { distance: 40, columns: 4 })

// A stack of grids (3D), four to a row and three rows to a layer:
// each name also differs from the one in the layer behind it.
colorsFor(names, { distance: 40, columns: 4, rows: 3 })
```

```
A line           1  2  3  4  5  6          neighbours: before and after

A grid           1  2  3  4                columns: 4
                 5  6  7  8                neighbours: beside, above and below
                 9 10 11 12

A stack          layer 1       layer 2     columns: 4, rows: 3
                 1  2  3  4    13 14 15 16 neighbours: beside, above, below,
                 5  6  7  8    17 18 19 20 and the same place in the next layer
                 9 10 11 12    21 22 23 24
```

If the grid is as wide as the layout you draw (a CSS grid with four columns, say), pass that number as `columns`. Without it, two items drawn one above the other can look alike even though they are far apart in the list.

A key keeps its own colour unless it would sit too close to a neighbour that is already placed. Then it moves, first by a few steps, then to the free hue furthest from its neighbours. If the wheel is too crowded for the distance you asked for (twelve neighbours cannot all be 90° apart), you get the best spacing available rather than an error.

Things to know:

- **A colour can depend on the keys before it**, because that is how neighbours are kept apart. Adding keys to the end never changes the colours before them, but inserting one in the middle can, and so can changing `columns` or `rows`. When a colour must never depend on anything but its own key, use `colorFor`.
- A repeated key keeps its first colour. With `neighbours: Infinity` the order you pass keys in, and the layout, do not matter at all.
- An empty key is a neutral grey that still takes up its place in the grid.
- `rows` needs `columns`.

## Recipes

### Avatars, chips and labels

```ts
const chip = (name: string) => ({ color: colorFor(name), borderColor: colorFor(name) })
```

### A legend or a chart with many series

Series sit in the order you list them, so use `colorsFor` and keep neighbours apart. If they are few, make them all neighbours of each other:

```ts
const series = ['north', 'south', 'east', 'west', 'central']
const colors = colorsFor(series, { distance: 50, neighbours: Infinity })
// colors[i] belongs to series[i], whatever order you list them in
```

### A grid of cards, tiles or avatars

```ts
const colors = colorsFor(items.map(item => item.id), { distance: 40, columns: 6 })
```

### Light mode

Pass the light surface and colours are darkened until they read:

```ts
colorFor('orbit', { background: '#ffffff' })                      // '#046254'
colorFor('orbit', { background: '#ffffff', minContrast: 4.5 })    // '#017665'
```

Whether a colour is styled for a dark or a light surface follows the background you pass. `mode: 'dark' | 'light'` forces it.

### Keeping clear of your status colours

```ts
import { avoidHuesOf, colorFor } from 'huehash'

const avoid = avoidHuesOf(['#ffb454', '#7ee787', '#ff7b72'], 30)
colorFor('orbit', { avoid })  // stays out of those hue ranges
```

`avoidHuesOf(hexes, width)` makes an arc of `width` degrees around each colour's hue.

### An instance with your own defaults

```ts
import { createHuehash } from 'huehash'

const huehash = createHuehash({ background: ['#0b0e14', '#171c26'], minContrast: 4.5 })
huehash.colorFor('orbit')
huehash.colorsFor(names, { distance: 40, columns: 4 })
```

### Everything about a colour

```ts
import { describeColor } from 'huehash'

describeColor('orbit')
// {
//   key: 'orbit',
//   hex: '#3dd4b9',
//   rgb: [61, 212, 185],
//   oklch: { l: 0.7856, c: 0.1300, h: 177.93 },
//   css: 'oklch(78.6% 0.130 177.9)',
//   contrast: 9.32,
//   grade: 'AAA',
//   mode: 'dark'
// }
```

## API reference

### `colorFor(key, options?)` → `'#rrggbb'`

One stable colour. Case and surrounding spaces do not matter.

### `describeColor(key, options?)` → `ColorDescription`

The colour plus how it was measured. The result is frozen.

| field | meaning |
|---|---|
| `key` | The key as it was hashed: lowercase and trimmed. |
| `hex` | The colour as `#rrggbb`. |
| `rgb` | `[r, g, b]`, 0 to 255. |
| `oklch` | `{ l, c, h }`: lightness 0 to 1, chroma, hue in degrees. |
| `css` | A CSS `oklch()` value for the same colour. |
| `contrast` | The lowest WCAG contrast ratio across your backgrounds. |
| `grade` | `'AAA'` (7 and up), `'AA'` (4.5), `'AA large'` (3) or `'fail'`. |
| `mode` | `'dark'` or `'light'`: the styling that was used. |

### `colorsFor(keys, options?)` → `string[]`

Colours for keys in order, with look-alikes kept a safe distance apart. Returns an array in the same order as `keys`. See [A safe distance](#a-safe-distance).

### `createHuehash(defaults?, { cacheSize? })`

Returns an object with `colorFor`, `describeColor`, `colorsFor`, `clearCache` and `cacheStats`, with its own default options and its own cache. The top-level functions use a shared instance with the default options.

### Options

| option | default | meaning |
|---|---|---|
| `background` | `'#161b22'` | The surface(s) the colour will sit on, `#rgb` or `#rrggbb`. Pass an array to guarantee contrast on all of them. |
| `minContrast` | `7` | WCAG contrast ratio to guarantee, 1 to 21. 7 is AAA, 4.5 is AA. |
| `avoid` | `[]` | Hue ranges to keep free, so a generated colour never looks like one you use to mean something. |
| `mode` | follows the background | Force `'dark'` or `'light'`. |
| `distance` | `30` | `colorsFor` only. The least gap between look-alikes, in degrees. |
| `neighbours` | `1` | `colorsFor` only. The safe distance in steps: how far away an item still counts as a neighbour. |
| `columns` | one line | `colorsFor` only. Items to a row, so the items above and below count as neighbours too. |
| `rows` | no layers | `colorsFor` only. Rows to a layer, so the items in the layers in front and behind count as well. Needs `columns`. |

Invalid options throw a `TypeError` with a clear message: a `distance`, `neighbours`, `columns` or `rows` that is not a number, `rows` without `columns`, or a colour that is not `#rgb` or `#rrggbb`. `distance` is limited to 0 to 180, and `columns`, `rows` and `neighbours` are rounded down to whole numbers of at least 1.

### Helpers

| function | does |
|---|---|
| `avoidHuesOf(hexes, width = 30)` | Hue arcs around existing colours, for `avoid`. |
| `toCssVariables(colors, { prefix, selector })` | Writes `--huehash-orbit: #3dd4b9;` custom properties from a `{ key: hex }` object. Defaults: `prefix` `'--huehash-'`, `selector` `':root'`. |
| `contrastRatio(a, b)` | The WCAG contrast ratio of two hex colours, 1 to 21. |
| `gradeFor(ratio)` | `'AAA'`, `'AA'`, `'AA large'` or `'fail'`. |
| `oklchHue(hex)` | The OKLCH hue of a colour, 0 to 360. |
| `hueGap(a, b)` | The distance between two hues on the wheel, 0 to 180. |
| `clearCache()` and `cacheStats()` | Empty the shared cache, or see how it is doing. |

TypeScript types are included: `Options`, `SequenceOptions`, `ColorDescription`, `Grade`, `Mode`, `HueArc`, `Huehash`, `HuehashOptions`, `CacheStats`, `Oklch` and `Rgb`.

## How it works

1. The key is normalised (lowercase, trimmed) and hashed: FNV-1a, then murmur3's finaliser, so `orbit` and `orbits` land far apart.
2. The hash picks a hue. Avoided ranges are removed from the wheel first.
3. For `colorsFor`, a hue that is too close to a neighbour (before it, beside it, above it or behind it, depending on the layout) is moved until it is far enough away.
4. Lightness and chroma stay in a narrow band in OKLCH, with a little hash-driven variation, so every key looks equally bright and saturated.
5. The colour is fitted into the sRGB gamut, then lightened (on dark surfaces) or darkened (on light ones) until the contrast against every background is met.

The [guided tour](https://huehash.github.io/huehash/) walks through these steps with your own text.

## Caching

The result depends only on the key and the options, so it is remembered. The same key with the same options is calculated once, whatever the case or spacing. Repeat lookups are about 5 to 7 times faster (run `npm run bench`).

```ts
import { cacheStats, clearCache, createHuehash } from 'huehash'

cacheStats()   // { hits, misses, size, maxSize }
clearCache()

// An instance with its own defaults and its own cache
const dark = createHuehash({ background: ['#0b0e14', '#171c26'] }, { cacheSize: 5000 })
dark.colorFor('orbit')
```

The cache is bounded (2,000 results per kind by default) and drops the least recently used first, so a stream of unique keys cannot grow memory. `cacheSize: 0` turns it off. Whole sequences from `colorsFor` are remembered too, by their exact order, layout and settings. Results from `describeColor` are frozen so they cannot be changed under the cache. Keys longer than 256 characters are calculated each time rather than cached.

## FAQ

**Will a key always get the same colour?**
Yes, for the same options and the same major version. Golden tests pin the exact output. A change to them is a breaking change.

**Does it work on the server and in the browser?**
Yes. It is pure computation with no DOM, no Node-only APIs and no randomness, so server-rendered and client-rendered colours match.

**Can two different keys get the same colour?**
Hashes can collide, and the wheel is finite, so yes, rarely, for keys that are far apart. `colorsFor` makes sure look-alikes are not near each other. If a colour must be unique per key, you need a palette, not a hash.

**Why 7:1 by default?**
It is WCAG AAA for normal text, and it keeps small coloured text readable on a dark surface. Pass `minContrast: 4.5` for AA.

**What if a surface cannot reach the contrast I asked for?**
A mid-grey background cannot reach 7:1 with any colour. You get the best the surface allows, and `describeColor(...).contrast` tells you what that is.

**Does it handle non-Latin text and emoji?**
Yes. Keys are normalised and hashed as UTF-8.

**Why is the same letter the same colour in the logo?**
Because the same key always gets the same colour. A repeated key keeps its first colour even in `colorsFor`.

## Stability

The colours are a contract. `test/golden.test.ts` pins the exact output for a set of keys and for a grid and a stack, and any change to it is a major version. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Requirements

An ES module for Node 18 or newer and any modern browser. No dependencies, about 4 kB minified and gzipped.

## Development

```bash
npm install
npm test                 # unit tests, and the playground tests on Node 22 or newer
npm run typecheck
npm run build            # the published library, into dist/
npm run playground       # the guided tour and the playground, with live reload
npm run playground:build
npm run bench            # the cache, measured
```

| path | what is in it |
|---|---|
| `src/` | The library: hashing, hues, OKLCH, the neighbour search and the cache. |
| `test/` | Unit tests, golden tests and the playground tests. |
| `playground/` | The guided tour (`index.html`) and the playground (`try/`), which import the library source directly. |

## Contributing

Issues and pull requests are welcome. The library is small and has no runtime dependencies; please keep it that way. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, especially the part about the colours being a contract.

## License

[MIT](LICENSE)
