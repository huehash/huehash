import assert from 'node:assert/strict'
import { test } from 'node:test'
import { contrastRatio, createHuehash, hueGap, oklchHue, readable } from '../src/index.js'

test('lifts a colour that is too dark for a dark surface until it reads', () => {
  const hex = readable('#7c2d12', { background: '#0d1117' })
  assert.notEqual(hex, '#7c2d12')
  assert.ok(contrastRatio(hex, '#0d1117') >= 7)
})

test('darkens a colour that is too pale for a light surface', () => {
  const hex = readable('#fde68a', { background: '#ffffff', minContrast: 4.5 })
  assert.ok(contrastRatio(hex, '#ffffff') >= 4.5)
  assert.ok(contrastRatio(hex, '#ffffff') > contrastRatio('#fde68a', '#ffffff'))
})

test('keeps the hue, and leaves a colour that already reads exactly as it was', () => {
  assert.ok(hueGap(oklchHue(readable('#c2410c', { background: '#0d1117' })), oklchHue('#c2410c')) < 6)
  assert.equal(readable('#FEA9A2', { background: '#0d1117' }), '#fea9a2')
  assert.equal(readable('#abc', { background: '#000000', minContrast: 3 }), '#aabbcc')
})

test('meets the contrast on every background passed', () => {
  const surfaces = ['#0b0e14', '#171c26', '#222b3a']
  const hex = readable('#4338ca', { background: surfaces })
  surfaces.forEach(surface => assert.ok(contrastRatio(hex, surface) >= 7, surface))
})

test('does its best when the surface cannot reach the contrast, and rejects a bad colour', () => {
  assert.match(readable('#808080', { background: '#808080', minContrast: 21 }), /^#[0-9a-f]{6}$/)
  assert.throws(() => readable('orange'), TypeError)
})

test('an instance uses its own defaults', () => {
  const light = createHuehash({ background: '#ffffff' })
  assert.ok(contrastRatio(light.readable('#fde68a'), '#ffffff') >= 7)
})
