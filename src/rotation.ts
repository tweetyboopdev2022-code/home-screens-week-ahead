// Bedtime rotation — shared by the Bedtime Turn block and the Week Ahead block.
// Everything is keyed by the *evening's* date (YYYY-MM-DD).

export interface Rotation {
  people: string[];          // in rotation order, e.g. ["Tanya", "Vince"]
  nightsEach: number;        // nights in a row per person
  anchorDate: string;        // a known evening…
  anchorPerson: string;      // …who was on that evening…
  anchorNight: number;       // …and which of their nights it was (1-based)
  swaps: Record<string, string>; // date → who's doing it instead (tonight-only swaps)
}

const dayNum = (d: string) => Math.round(Date.parse(`${d}T12:00:00Z`) / 86400000);
export const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export function parseRotation(s: Record<string, unknown> | null | undefined): Rotation | null {
  if (!s) return null;
  const people = String(s.people ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const anchorDate = String(s.anchorDate ?? '');
  if (people.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) return null;
  let swaps: Record<string, string> = {};
  try { const j = JSON.parse(String(s.swaps || '{}')); if (j && typeof j === 'object') swaps = j; } catch { /* ignore */ }
  const anchorPerson = people.find((p) => p.toLowerCase() === String(s.anchorPerson ?? '').trim().toLowerCase()) ?? people[0];
  return {
    people, anchorDate, anchorPerson,
    nightsEach: Math.max(1, Math.round(Number(s.nightsEach ?? 2)) || 2),
    anchorNight: Math.max(1, Math.round(Number(s.anchorNight ?? 1)) || 1),
    swaps,
  };
}

/** Who the rotation says (ignoring swaps), and which of their nights it is. */
export function scheduled(r: Rotation, date: string): { person: string; night: number } {
  const cycle = r.nightsEach * r.people.length;
  const start = r.people.indexOf(r.anchorPerson) * r.nightsEach + (Math.min(r.anchorNight, r.nightsEach) - 1);
  const pos = (((dayNum(date) - dayNum(r.anchorDate) + start) % cycle) + cycle) % cycle;
  return { person: r.people[Math.floor(pos / r.nightsEach)], night: (pos % r.nightsEach) + 1 };
}

/** Who's actually on (swaps win). */
export function whoOn(r: Rotation, date: string): { person: string; night: number; swapped: boolean; scheduled: string } {
  const s = scheduled(r, date);
  const sw = r.swaps[date];
  return sw && r.people.includes(sw) && sw !== s.person
    ? { person: sw, night: s.night, swapped: true, scheduled: s.person }
    : { ...s, swapped: false, scheduled: s.person };
}

/** Toggle a tonight-only swap: to the next person in the list, and back again. Old swaps are pruned. */
export function toggleSwap(r: Rotation, date: string, today: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [d, p] of Object.entries(r.swaps)) if (d >= addDays(today, -7)) out[d] = p;
  const cur = whoOn(r, date);
  const next = r.people[(r.people.indexOf(cur.person) + 1) % r.people.length];
  if (next === cur.scheduled) delete out[date]; else out[date] = next;
  return out;
}

/** The evening a moment belongs to: before `morningHour`, it's still last night. */
export function eveningOf(todayKey: string, minutesNow: number, morningHour = 5): string {
  return minutesNow < morningHour * 60 ? addDays(todayKey, -1) : todayKey;
}

/** When this person's next turn starts (for "Vince: Thu & Fri"). */
export function nextTurns(r: Rotation, from: string, days = 10) {
  const out: { date: string; person: string; swapped: boolean }[] = [];
  for (let i = 0; i < days; i++) { const d = addDays(from, i); const w = whoOn(r, d); out.push({ date: d, person: w.person, swapped: w.swapped }); }
  return out;
}
