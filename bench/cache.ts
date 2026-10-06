import { createHuehash } from '../src/index.js'

const NAMES = Array.from({ length: 500 }, (_, i) => `item-${i}`)
const PASSES = 400
const options = { background: ['#0b0e14', '#171c26'] }

function run(label: string, cacheSize: number, withOptions = true): number {
  const h = createHuehash({}, { cacheSize })
  const o = withOptions ? options : undefined
  NAMES.forEach(name => h.colorFor(name, o))
  const start = performance.now()
  let sink = 0
  for (let pass = 0; pass < PASSES; pass += 1) {
    for (const name of NAMES) sink += h.colorFor(name, o).length
  }
  const ms = performance.now() - start
  const calls = NAMES.length * PASSES
  console.log(`${label.padEnd(18)} ${(calls / (ms / 1000) / 1e6).toFixed(2)}M calls/s   ${((ms * 1e6) / calls).toFixed(0).padStart(6)} ns/call   (${sink > 0 ? 'ok' : ''})`)
  return ms
}

console.log(`${NAMES.length} names x ${PASSES} passes\n`)
console.log('with options (2 backgrounds):')
const off = run('  cache off', 0)
const on = run('  cache on (warm)', 2000)
console.log(`  speedup on repeat lookups: ${(off / on).toFixed(1)}x\n`)
console.log('with no options (the common case):')
const offPlain = run('  cache off', 0, false)
const onPlain = run('  cache on (warm)', 2000, false)
console.log(`  speedup on repeat lookups: ${(offPlain / onPlain).toFixed(1)}x`)
