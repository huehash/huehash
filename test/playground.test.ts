import { test } from 'node:test'

// The playground tests drive the page in jsdom, which needs Node 22 or newer. The library itself runs on Node 18+.
const major = Number(process.versions.node.split('.')[0])

if (major >= 22) await import('./playground.suite.js')
else test('playground', { skip: 'these tests use jsdom, which needs Node 22 or newer' }, () => {})
