import assert from 'node:assert/strict'
import { test } from 'node:test'
import { colorFor, describeColor, gradeFor, toCssVariables } from '../src/index.js'

test('describes a colour with its measurements', () => {
  const d = describeColor('  ORBIT2DB ')
  assert.equal(d.name, 'orbit2db')
  assert.equal(d.hex, colorFor('orbit2db'))
  assert.equal(d.rgb.length, 3)
  assert.match(d.css, /^oklch\(\d+\.\d% 0\.\d{3} \d+\.\d\)$/)
  assert.ok(d.contrast >= 7)
  assert.equal(d.grade, 'AAA')
  assert.equal(d.mode, 'dark')
  assert.ok(d.oklch.l > 0.7 && d.oklch.l < 0.95)
})

test('grades follow the WCAG thresholds', () => {
  assert.deepEqual([21, 7, 6.99, 4.5, 4.49, 3, 2.99, 1].map(gradeFor), ['AAA', 'AAA', 'AA', 'AA', 'AA large', 'AA large', 'fail', 'fail'])
  assert.equal(describeColor('orbit', { background: '#404040', minContrast: 1 }).grade, 'AA')
})

test('follows the background to choose dark or light', () => {
  assert.equal(describeColor('orbit').mode, 'dark')
  assert.equal(describeColor('orbit', { background: '#ffffff' }).mode, 'light')
  assert.equal(describeColor('orbit', { background: '#ffffff', mode: 'dark' }).mode, 'dark')
})

test('writes CSS custom properties with safe names', () => {
  const css = toCssVariables({ orbit: '#c3bb66', 'Orbit/PLATFORM': '#fea6b9', '': '#ffffff' })
  assert.equal(css, ':root {\n  --huehash-orbit: #c3bb66;\n  --huehash-orbit-platform: #fea6b9;\n  --huehash-unnamed: #ffffff;\n}')
  assert.match(toCssVariables({ a: '#000000' }, { prefix: '--c-', selector: '.theme' }), /^\.theme \{\n {2}--c-a: #000000;\n\}$/)
})
