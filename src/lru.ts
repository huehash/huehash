/** A small least-recently-used cache. A `max` of 0 disables it. */
export class Lru<V> {
  private readonly map = new Map<string, V>()
  hits = 0
  misses = 0

  constructor(readonly max: number) {}

  get(key: string): V | undefined {
    const value = this.map.get(key)
    if (value === undefined) {
      this.misses += 1
      return undefined
    }
    this.map.delete(key)
    this.map.set(key, value)
    this.hits += 1
    return value
  }

  set(key: string, value: V): void {
    if (this.max <= 0) return
    this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string)
  }

  clear(): void {
    this.map.clear()
    this.hits = 0
    this.misses = 0
  }

  get size(): number {
    return this.map.size
  }
}
