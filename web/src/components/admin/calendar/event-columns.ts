import type { CalEvent } from "./EventBlock";

export type EventColumn = {index: number; total: number};
/** Lay out overlapping rendered cards, including cancelled history, without covering targets. */
export function eventColumns(events: readonly CalEvent[], hourPx = 56): Map<string, EventColumn> {
  const result = new Map<string, EventColumn>();
  const sorted = [...events].sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour || a.session.id.localeCompare(b.session.id));
  let group: {id: string; index: number}[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;
  const flush = () => {
    for (const item of group) result.set(item.id, {index: item.index, total: laneEnds.length});
    group = []; laneEnds = []; groupEnd = -Infinity;
  };
  for (const item of sorted) {
    if (item.startHour >= groupEnd) flush();
    const end = Math.max(item.endHour, item.startHour + 36 / hourPx);
    let index = laneEnds.findIndex((value) => value <= item.startHour);
    if (index === -1) index = laneEnds.length;
    laneEnds[index] = end;
    group.push({id: item.session.id, index});
    groupEnd = Math.max(groupEnd, end);
  }
  flush();
  return result;
}
