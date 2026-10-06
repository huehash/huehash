# Changelog

All notable changes are listed here. The project follows [semantic versioning](https://semver.org/).
A change to the colour a name produces counts as a breaking change.

## 0.1.0

First release.

- `colorFor`, `describeColor` and `distinctColors` turn names into colours that hold their contrast on the backgrounds you give.
- Dark and light surfaces, several backgrounds at once, and hue ranges to keep free.
- A bounded LRU cache, with `createHuehash` for instances that have their own defaults and cache.
- `toCssVariables`, `avoidHuesOf`, `contrastRatio`, `oklchHue` and `gradeFor`.
- A playground for trying names and settings.
