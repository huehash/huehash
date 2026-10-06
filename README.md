# huehash

A stable, readable colour for any name.

Hash a string like `orbit` or `acme/platform/billing` and get a hex that fits your dark (or light) interface, with the contrast you ask for guaranteed. The same name always gets the same colour, so a repo, tag or service looks the same everywhere it appears.

**[Try the playground](https://huehash.github.io/huehash/)**: type a name, change the surface, and copy the result.

```bash
npm install huehash
```

```ts
import { colorFor, distinctColors } from 'huehash'

colorFor('orbit')   // '#3dd4b9'
colorFor('orbits')  // '#d5b155'  (a similar name, a clearly different colour)

// For a list: no two hues end up nearly the same
distinctColors(['web', 'api', 'docs'], { minHueGap: 24 })
```

## Why not just hash to a hue?

A plain `hsl(hash % 360, 70%, 60%)` has three problems that show up the moment you put it on a dark surface.

- **Unequal brightness.** In HSL a yellow and a blue of the same lightness look nothing alike, so some names glow and others disappear. huehash works in [OKLCH](https://oklch.com), where equal lightness looks equal.
- **No contrast guarantee.** huehash checks every colour against your background(s) and lifts it until the WCAG contrast you asked for (AAA by default) is met.
- **Neighbours collide.** Hashes cluster by chance. `distinctColors` keeps hues apart, and the result does not depend on the order you pass the names.

| name | hex | OKLCH | contrast on `#161b22` |
|---|---|---|---|
| `orbit` | `#3dd4b9` | `oklch(78.6% 0.130 177.9)` | 9.3:1 AAA |
| `orbits` | `#d5b155` | `oklch(77.4% 0.118 88.0)` | 8.4:1 AAA |
| `orbit2db` | `#c0c968` | `oklch(80.8% 0.122 113.5)` | 9.7:1 AAA |
| `nextjs` | `#8adf9f` | `oklch(83.3% 0.122 150.9)` | 10.8:1 AAA |
| `docs` | `#c5c0ff` | `oklch(83.4% 0.088 288.0)` | 10.2:1 AAA |
| `flux` | `#fea9d7` | `oklch(83.1% 0.114 346.2)` | 9.8:1 AAA |

## API

### `colorFor(name, options?)` → `'#rrggbb'`

One stable colour. Case and surrounding spaces do not matter: `'Orbit '` and `'orbit'` are the same.

### `describeColor(name, options?)`

The colour plus how it was measured: `hex`, `rgb`, `oklch`, a CSS `oklch()` string, the worst-case `contrast`, its WCAG `grade` and the `mode` (dark or light) that was used. The result is frozen.

### `distinctColors(names, options?)` → `Record<string, string>`

Colours for a set, with no two hues closer than `minHueGap` degrees (default 24). Names are placed alphabetically, so the same set always gives the same result. If the wheel is too crowded for the gap, each name takes the free hue furthest from the others.

### Options

| option | default | meaning |
|---|---|---|
| `background` | `'#161b22'` | The surface(s) the colour will sit on, `#rgb` or `#rrggbb`. Pass an array to guarantee contrast on all of them. |
| `minContrast` | `7` | WCAG contrast ratio to guarantee, 1 to 21. 7 is AAA, 4.5 is AA. |
| `avoid` | `[]` | Hue ranges to keep free, so a generated colour never looks like one you use to mean something. |
| `mode` | follows the background | Force `'dark'` or `'light'`. |
| `minHueGap` | `24` | `distinctColors` only. The smallest distance between two hues. |

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

- `toCssVariables(colors, { prefix, selector })` writes `--huehash-orbit: #3dd4b9;` custom properties.
- `contrastRatio(a, b)`, `gradeFor(ratio)`, `oklchHue(hex)`, `hueGap(a, b)`.

## How it works

1. The name is normalised (lowercase, trimmed) and hashed: FNV-1a, then murmur3's finaliser, so `orbit` and `orbits` land far apart.
2. The hash picks a hue. Avoided ranges are removed from the wheel first.
3. Lightness and chroma stay in a narrow band in OKLCH, with a little hash-driven variation, so every name looks equally bright and saturated.
4. The colour is fitted into the sRGB gamut, then lightened (on dark surfaces) or darkened (on light ones) until the contrast against every background is met.

## Caching

The result depends only on the name and the options, so it is remembered. The same name with the same options is calculated once, whatever the case or spacing. Repeat lookups are about 5 to 7 times faster (run `npm run bench`).

```ts
import { cacheStats, clearCache, createHuehash } from 'huehash'

cacheStats()   // { hits, misses, size, maxSize }
clearCache()

// An instance with its own defaults and its own cache
const dark = createHuehash({ background: ['#0b0e14', '#171c26'] }, { cacheSize: 5000 })
dark.colorFor('orbit')
```

The cache is bounded (2,000 results per kind by default) and drops the least recently used first, so a stream of unique names cannot grow memory. `cacheSize: 0` turns it off. Results from `describeColor` are frozen so they cannot be changed under the cache. Names longer than 256 characters are calculated each time rather than cached.

## Stability

The colours are a contract. `test/golden.test.ts` pins the exact output for a set of names, and any change to it is a major version. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Requirements

An ES module for Node 18 or newer and any modern browser. No dependencies, about 6 kB gzipped.

## Development

```bash
npm install
npm test
npm run playground   # http://localhost:5173
```

## License

[MIT](LICENSE)
