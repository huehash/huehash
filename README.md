# huehash

A stable, readable colour for any string.

Give it an id, a label, a username, a chart series, a graph node, a log source, anything, and get a hex that fits your dark (or light) interface, with the contrast you ask for guaranteed. The same key always gets the same colour, so a thing looks the same everywhere it appears. And when things sit near each other, in a list, a grid or a stack of grids, a safe distance keeps look-alike colours apart.

**[Try the playground](https://huehash.github.io/huehash/)**: set the contrast and the safe distance, see your keys in a line, a grid or a stack, in real views, and copy the result.

```bash
npm install huehash
```

```ts
import { colorFor, colorsFor } from 'huehash'

colorFor('orbit')   // '#3dd4b9'
colorFor('orbits')  // '#d5b155'  (a similar key, a clearly different colour)

// Things in order: neighbours are kept at least 40° apart on the colour wheel
colorsFor(['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'item-6'], { distance: 40 })
```

## Why not just hash to a hue?

A plain `hsl(hash % 360, 70%, 60%)` has three problems that show up the moment you put it on a dark surface.

- **Unequal brightness.** In HSL a yellow and a blue of the same lightness look nothing alike, so some keys glow and others disappear. huehash works in [OKLCH](https://oklch.com), where equal lightness looks equal.
- **No contrast guarantee.** huehash checks every colour against your background(s) and lifts it until the WCAG contrast you asked for (AAA by default) is met.
- **Neighbours collide.** Hashes cluster by chance, so two keys side by side, above or below each other can land on nearly the same hue. With `colorsFor` and a safe distance, they never do.

| key | hex | OKLCH | contrast on `#161b22` |
|---|---|---|---|
| `orbit` | `#3dd4b9` | `oklch(78.6% 0.130 177.9)` | 9.3:1 AAA |
| `orbits` | `#d5b155` | `oklch(77.4% 0.118 88.0)` | 8.4:1 AAA |
| `user-42` | `#43e5c2` | `oklch(83.1% 0.141 174.8)` | 10.9:1 AAA |
| `nextjs` | `#8adf9f` | `oklch(83.3% 0.122 150.9)` | 10.8:1 AAA |
| `docs` | `#c5c0ff` | `oklch(83.4% 0.088 288.0)` | 10.2:1 AAA |
| `flux` | `#fea9d7` | `oklch(83.1% 0.114 346.2)` | 9.8:1 AAA |

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

## API

### `colorFor(key, options?)` → `'#rrggbb'`

One stable colour. Case and surrounding spaces do not matter: `'Orbit '` and `'orbit'` are the same.

### `describeColor(key, options?)`

The colour plus how it was measured: `hex`, `rgb`, `oklch`, a CSS `oklch()` string, the worst-case `contrast`, its WCAG `grade` and the `mode` (dark or light) that was used. The result is frozen.

### `colorsFor(keys, options?)` → `string[]`

Colours for keys in order, with neighbours kept apart in a line, a grid or a stack. See above.

### Options

| option | default | meaning |
|---|---|---|
| `background` | `'#161b22'` | The surface(s) the colour will sit on, `#rgb` or `#rrggbb`. Pass an array to guarantee contrast on all of them. |
| `minContrast` | `7` | WCAG contrast ratio to guarantee, 1 to 21. 7 is AAA, 4.5 is AA. |
| `avoid` | `[]` | Hue ranges to keep free, so a generated colour never looks like one you use to mean something. |
| `mode` | follows the background | Force `'dark'` or `'light'`. |
| `distance` | `30` | `colorsFor` only. The least gap between neighbours, in degrees. |
| `neighbours` | `1` | `colorsFor` only. The safe distance in steps: how far away an item still counts as a neighbour. |
| `columns` | one line | `colorsFor` only. Items to a row, so the items above and below count as neighbours too. |
| `rows` | no layers | `colorsFor` only. Rows to a layer, so the items in the layers in front and behind count as well. Needs `columns`. |

Light backgrounds work too: colours are darkened until they read.

```ts
colorFor('orbit', { background: '#ffffff' })  // '#046254'
```

### Keeping clear of your status colours

```ts
import { avoidHuesOf, colorFor } from 'huehash'

const avoid = avoidHuesOf(['#ffb454', '#7ee787', '#ff7b72'], 30)
colorFor('orbit', { avoid })  // stays out of those hue ranges
```

### Helpers

- `toCssVariables(colors, { prefix, selector })` writes `--huehash-orbit: #3dd4b9;` custom properties from a `{ key: hex }` object.
- `contrastRatio(a, b)`, `gradeFor(ratio)`, `oklchHue(hex)`, `hueGap(a, b)`.

## How it works

1. The key is normalised (lowercase, trimmed) and hashed: FNV-1a, then murmur3's finaliser, so `orbit` and `orbits` land far apart.
2. The hash picks a hue. Avoided ranges are removed from the wheel first.
3. For `colorsFor`, a hue that is too close to a neighbour (before it, beside it, above it or behind it, depending on the layout) is moved until it is far enough away.
4. Lightness and chroma stay in a narrow band in OKLCH, with a little hash-driven variation, so every key looks equally bright and saturated.
5. The colour is fitted into the sRGB gamut, then lightened (on dark surfaces) or darkened (on light ones) until the contrast against every background is met.

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

The cache is bounded (2,000 results per kind by default) and drops the least recently used first, so a stream of unique keys cannot grow memory. `cacheSize: 0` turns it off. Whole sequences from `colorsFor` are remembered too, by their exact order and settings. Results from `describeColor` are frozen so they cannot be changed under the cache. Keys longer than 256 characters are calculated each time rather than cached.

## Stability

The colours are a contract. `test/golden.test.ts` pins the exact output for a set of keys, and any change to it is a major version. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Requirements

An ES module for Node 18 or newer and any modern browser. No dependencies, about 4 kB minified and gzipped.

## Development

```bash
npm install
npm test
npm run playground   # http://localhost:5173
```

## License

[MIT](LICENSE)
