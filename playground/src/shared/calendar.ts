export type Slot = { day: number; start: number; length: number }
export type Placed = Slot & { index: number; end: number; lane: number; lanes: number }

/** Where the events go. Two pairs overlap on purpose, so the view shows what overlapping events look like. */
export const SLOTS: Slot[] = [
  { day: 0, start: 9, length: 1 },
  { day: 0, start: 9.5, length: 1.5 },
  { day: 1, start: 10, length: 1 },
  { day: 2, start: 9, length: 2 },
  { day: 2, start: 10, length: 1 },
  { day: 3, start: 11, length: 1.5 },
  { day: 4, start: 9.5, length: 1 },
  { day: 1, start: 13, length: 1.5 },
  { day: 3, start: 8.5, length: 1 },
  { day: 4, start: 14, length: 1.5 },
]

/** Events that overlap in time sit side by side in lanes, so none of them is covered and none is cut off. */
export function placeEvents(count: number): Placed[] {
  const slots = SLOTS.slice(0, count).map((slot, index) => ({ ...slot, index, end: slot.start + slot.length, lane: 0, lanes: 1 }))
  const days = [...new Set(slots.map(slot => slot.day))]
  return days.flatMap(day => {
    const events = slots.filter(slot => slot.day === day).sort((a, b) => a.start - b.start)
    const placed: Placed[] = []
    let cluster: Placed[] = []
    let clusterEnd = -1
    const close = () => {
      const lanes = Math.max(...cluster.map(event => event.lane)) + 1
      cluster.forEach(event => {
        event.lanes = lanes
      })
      placed.push(...cluster)
      cluster = []
      clusterEnd = -1
    }
    events.forEach(event => {
      if (cluster.length && event.start >= clusterEnd) close()
      const taken = new Set(cluster.filter(other => other.end > event.start).map(other => other.lane))
      let lane = 0
      while (taken.has(lane)) lane += 1
      event.lane = lane
      cluster.push(event)
      clusterEnd = Math.max(clusterEnd, event.end)
    })
    if (cluster.length) close()
    return placed
  })
}

export const clock = (hour: number): string => `${Math.floor(hour)}:${hour % 1 ? '30' : '00'}`
