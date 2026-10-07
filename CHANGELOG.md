# Changelog

All notable changes are listed here. The project follows [semantic versioning](https://semver.org/).
A change to the colour a key produces counts as a breaking change.

## 0.1.0

First release.

- `readable` makes a colour you already have readable on the backgrounds you give: the hue stays, the lightness moves as little as the contrast needs.
- `colorFor`, `describeColor` and `colorsFor` turn any string into a colour that meets the contrast you ask for on every background you give, and is the same colour every time.
- `colorsFor` keeps look-alike colours at a safe distance, in a line, a grid or a stack of grids. `distance` is the least gap on the colour wheel, `neighbours` is how many steps away still counts as near, and `columns` and `rows` say how the items are laid out.
- Dark and light surfaces, several backgrounds at once, and hue ranges to keep free.
- A bounded LRU cache, with `createHuehash` for instances that have their own defaults and cache.
- `toCssVariables`, `avoidHuesOf`, `contrastRatio`, `oklchHue` and `gradeFor`.
- A landing page and a playground. The playground shows your keys in seven real views (logs, chart, calendar, presence, people, labels, swatches) with contrast, distance, neighbour, reserved-hue and cache options, and exports JavaScript, CSS variables or JSON.
