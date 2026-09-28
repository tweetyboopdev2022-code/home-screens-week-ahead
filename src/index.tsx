import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { frame, ink, caps, Icon, wxIcon, sdk, useNow, dayKey, localHM, fmtTime } from './ui';

type Ev = { id: string; title: string; start: string; end?: string; allDay: boolean; sourceId?: string; calendarColor?: string; location?: string };
type Person = { name: string; sourceIds?: string[] };
type Fc = { date: string; high: number; low: number; icon: string; description?: string; precipProbability?: number };
type Meals = { savedMeals?: { id: string; name: string; emoji?: string }[]; plan?: { date: string; slot: string; mealId?: string; customText?: string }[] };

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const dow = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();

export default function WeekAhead(props: PluginComponentProps & { events?: Ev[]; people?: Person[]; forecast?: Fc[]; timeFormat?: string; units?: string }) {
  const { config, style } = props; const tz = props.timezone;
  const now = useNow(300000);
  const accent = String(config.accentColor || '#b45309');
  const slot = String(config.slot || 'dinner');
  let hide: RegExp; try { hide = new RegExp(String(config.hideTitles || '^Day \\d|lunch|d[îi]ner'), 'i'); } catch { hide = /^Day \d/i; }
  const today = dayKey(now, tz);
  // Sunday afternoon/evening → next Mon..Sun; otherwise today + 6 days
  const start = dow(today) === 0 && localHM(now, tz) >= Number(config.startSundayHour ?? 12) * 60 ? addDays(today, 1) : today;
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const useFetchData = sdk()?.useFetchData;
  const [meals] = useFetchData ? useFetchData('/api/meals/data', 300000) as [Meals | null, string | null] : [null];
  const mealFor = (d: string) => {
    const p = (meals?.plan ?? []).find((x) => x.date === d && x.slot === slot);
    if (!p) return null;
    const m = p.mealId ? (meals?.savedMeals ?? []).find((s) => s.id === p.mealId) : null;
    return m ? `${m.emoji ? m.emoji + ' ' : ''}${m.name}` : p.customText || null;
  };

  const personOf = (e: Ev) => ((props.people ?? []) as Person[]).find((p) => e.sourceId && (p.sourceIds ?? []).includes(e.sourceId))?.name;
  const evDay = (e: Ev) => dayKey(new Date(e.allDay ? e.start.slice(0, 10) + 'T12:00:00' : e.start), tz);
  const byDay = new Map<string, Ev[]>();
  ((props.events ?? []) as Ev[]).forEach((e) => { const d = evDay(e); if (d >= start && d <= days[6]) byDay.set(d, [...(byDay.get(d) ?? []), e]); });
  const fc = new Map<string, Fc>(((props.forecast ?? []) as Fc[]).map((f) => [f.date, f]));
  const imperial = props.units === 'imperial';
  const deg = (c: number) => `${Math.round(imperial ? c * 9 / 5 + 32 : c)}°`;
  const planned = days.filter((d) => mealFor(d)).length;
  const label = (d: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
  const num = (d: string) => Number(d.slice(8));
  const monthOf = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(start + 'T12:00:00Z'));

  return (
    <div style={frame(style, { gap: '0.5em' })}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6em' }}>
        <h2 style={{ margin: 0, fontSize: '1.3em', fontWeight: 600 }}>Week ahead</h2>
        <span style={{ fontSize: '0.75em', opacity: 0.45 }}>from {monthOf}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.7em', fontWeight: 500, color: planned < 7 ? accent : undefined, opacity: planned < 7 ? 1 : 0.5 }}>{planned}/7 {slot}s planned</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.45em' }}>
        {days.map((d) => {
          const evs = (byDay.get(d) ?? []).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
          const badges = evs.filter((e) => /^Day \d/i.test(e.title)).map((e) => e.title.match(/^Day (\d)/i)![1]);
          const noSchool = evs.find((e) => /^No school/i.test(e.title));
          const shown = evs.filter((e) => !hide.test(e.title) && !/^No school/i.test(e.title));
          const f = fc.get(d); const meal = mealFor(d); const weekend = [0, 6].includes(dow(d));
          return (
            <div key={d} style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '4.6em 4.6em minmax(0, 1fr) 11em', alignItems: 'center', gap: '0.8em', padding: '0.4em 0.8em', borderRadius: '0.8em', background: d === today ? `color-mix(in srgb, ${accent} 10%, transparent)` : ink(style, weekend ? 0.03 : 0.05) }}>
              <div style={{ lineHeight: 1.05 }}>
                <div style={{ ...caps, opacity: 0.55 }}>{label(d)}</div>
                <div style={{ fontSize: '1.7em', fontWeight: 300 }}>{num(d)}</div>
                {badges[0] && !noSchool && <div style={{ fontSize: '0.55em', fontWeight: 600, color: '#db2777' }}>DAY {badges[0]}</div>}
                {noSchool && <div style={{ fontSize: '0.55em', fontWeight: 600, color: '#d97706' }}>NO SCHOOL</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3em', fontSize: '0.8em' }}>
                {f ? (<><Icon d={wxIcon(f.icon || f.description || '')} size="1.6em" stroke={1.6} /><div style={{ lineHeight: 1.15 }}><div style={{ fontWeight: 600 }}>{deg(f.high)}</div><div style={{ opacity: 0.5 }}>{deg(f.low)}</div></div></>) : <span style={{ opacity: 0.25 }}>—</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3em', alignContent: 'center', overflow: 'hidden', maxHeight: '100%' }}>
                {shown.length === 0 && <span style={{ fontSize: '0.75em', opacity: 0.3 }}>{noSchool ? noSchool.title.replace(/^No school\s*[—-]\s*/i, '') : 'Nothing planned'}</span>}
                {shown.slice(0, 5).map((e) => {
                  const who = personOf(e); const col = e.calendarColor || accent;
                  return (
                    <span key={e.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35em', maxWidth: '100%', padding: '0.22em 0.6em', borderRadius: '0.45em', fontSize: '0.72em', fontWeight: 500, background: `color-mix(in srgb, ${col} 14%, transparent)`, borderLeft: `0.25em solid ${col}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {!e.allDay && <span style={{ opacity: 0.6 }}>{fmtTime(new Date(e.start), tz, props.timeFormat).replace(':00', '')}</span>}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>
                      {who && <span style={{ opacity: 0.5, fontSize: '0.85em' }}>· {who}</span>}
                    </span>
                  );
                })}
                {shown.length > 5 && <span style={{ fontSize: '0.7em', opacity: 0.5 }}>+{shown.length - 5} more</span>}
              </div>
              <div style={{ fontSize: '0.75em', fontWeight: 500, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: meal ? 1 : 0.35, color: meal ? undefined : accent }}>
                {meal ?? `No ${slot} yet`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
