/** Calendar: events that overlap in time sit side by side (like Google Calendar) instead of on top of each other. */
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function layoutLanes(items: { id: string; start: string; end: string | null }[]): Map<string, { lane: number; lanes: number }> {
  const evs = items.map((x) => ({ id: x.id, s: mins(x.start), e: x.end ? Math.max(mins(x.end), mins(x.start) + 1) : mins(x.start) + 30 }))
    .sort((a, b) => a.s - b.s || b.e - a.e);
  const out = new Map<string, { lane: number; lanes: number }>();
  let group: { id: string; lane: number }[] = [], laneEnds: number[] = [], groupEnd = -1;
  const close = () => { for (const g of group) out.set(g.id, { lane: g.lane, lanes: laneEnds.length }); group = []; laneEnds = []; };
  for (const ev of evs) {
    if (ev.s >= groupEnd) close();                       // nothing still running: a new group starts
    let lane = laneEnds.findIndex((end) => end <= ev.s); // reuse a lane that is free again
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(ev.e); } else laneEnds[lane] = ev.e;
    group.push({ id: ev.id, lane });
    groupEnd = Math.max(groupEnd, ev.e);
  }
  close();
  return out;
}
