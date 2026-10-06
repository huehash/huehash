/** FNV-1a over the UTF-8 bytes, then murmur3's finaliser so near-identical names ("orbits", "orbit") land far apart. */
export function hash32(text: string): number {
  let h = 0x811c9dc5
  for (const byte of new TextEncoder().encode(text)) {
    h ^= byte
    h = Math.imul(h, 0x01000193)
  }
  return mix(h)
}

/** murmur3's 32-bit finaliser: spreads every input bit across the output. */
export function mix(value: number): number {
  let h = value >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** A 32-bit hash as a number in [0, 1). */
export const unit = (hash: number): number => hash / 2 ** 32

/** Names are compared case-insensitively and ignoring surrounding space. */
export const normalize = (name: string): string => name.normalize('NFKD').trim().toLowerCase()
