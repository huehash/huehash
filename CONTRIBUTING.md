# Contributing

Thanks for helping. The library is small and has no runtime dependencies; please keep it that way.

```bash
npm install
npm test            # unit tests, and the playground tests on Node 22 or newer
npm run typecheck
npm run build       # the published library, into dist/
npm run playground  # the playground, with live reload
```

## The colours are a contract

`test/golden.test.ts` pins the exact colour for a set of names. People store, compare and screenshot these values, so **the same name must keep the same colour from one release to the next**.

If a golden test fails, the algorithm changed. That is a breaking change: it needs a major version bump and a note in `CHANGELOG.md`. Do not simply update the expected values.

Changes that do not alter any output (speed, caching, types, docs, the playground) are welcome at any time.

## Guidelines

- Keep a change focused, and add or update a test with it.
- Prefer clear names and short functions to comments that explain what the code does.
- The playground imports the library source directly, so it always shows the code in the same checkout.
