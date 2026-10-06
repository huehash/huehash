import assert from 'node:assert/strict'
import { test } from 'node:test'
import { contrastRatio, oklchHue } from '../src/index.js'
import { hexToOklch, oklchToHex, parseHex } from '../src/oklch.js'

test('parses short and long hex, with or without #', () => {
  assert.equal(parseHex('#ABC'), '#aabbcc')
  assert.equal(parseHex('123456'), '#123456')
  assert.throws(() => parseHex('#12345'), TypeError)
  assert.throws(() => parseHex('rgb(0,0,0)'), TypeError)
})

test('contrast ratio matches the WCAG reference values', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 0.001)
  assert.ok(Math.abs(contrastRatio('#777777', '#777777') - 1) < 0.001)
  assert.ok(Math.abs(contrastRatio('#767676', '#ffffff') - 4.54) < 0.01)
})

test('reads known colours back to their OKLCH hue', () => {
  assert.ok(Math.abs(oklchHue('#ff0000') - 29.2) < 0.5)
  assert.ok(Math.abs(oklchHue('#00ff00') - 142.5) < 0.5)
  assert.ok(Math.abs(oklchHue('#0000ff') - 264.1) < 0.5)
  assert.equal(oklchHue('#808080'), 0)
})

test('round-trips through hex within a rounding step', () => {
  for (const hue of [10, 80, 150, 200, 260, 320]) {
    const hex = oklchToHex(0.78, 0.1, hue)
    const back = hexToOklch(hex)
    assert.ok(Math.abs(back.l - 0.78) < 0.01, `lightness ${back.l}`)
    assert.ok(Math.abs(back.h - hue) < 2, `hue ${back.h} vs ${hue}`)
  }
})
