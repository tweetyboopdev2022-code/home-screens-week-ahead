// Shared rotation settings: one copy for every Bedtime block on the page, kept in the
// plugin's settings on the hub so a swap made on one screen shows everywhere.
import React from 'react';

export const PID = 'bedtime-turn';
type S = Record<string, unknown>;
let cache: S | null = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
const sdkSettings = (): S | null => { try { return (window as any).__HS_SDK__?.getPluginSettings?.(PID) ?? null; } catch { return null; } };

async function fetchSettings(): Promise<S | null> {
  try { const r = await fetch(`/api/plugins/settings/${PID}`, { cache: 'no-store' }); if (r.ok) return (await r.json()).settings ?? null; } catch { /* offline */ }
  return null;
}
async function refresh() { const s = await fetchSettings(); if (s && JSON.stringify(s) !== JSON.stringify(cache)) { cache = s; notify(); } }

export function useRotationSettings(pollMs = 60000): S | null {
  const [, force] = React.useState(0);
  React.useEffect(() => {
    const f = () => force((x) => x + 1); subs.add(f);
    if (!cache) { cache = sdkSettings(); refresh(); }
    const t = window.setInterval(refresh, pollMs);
    return () => { subs.delete(f); clearInterval(t); };
  }, [pollMs]);
  return cache ?? sdkSettings();
}

export async function saveSwaps(swaps: Record<string, string>): Promise<boolean> {
  const cur = (await fetchSettings()) ?? cache ?? {};
  const next = { ...cur, swaps: JSON.stringify(swaps) };
  cache = next; notify();                        // instant on this display
  try {
    const r = await fetch(`/api/plugins/settings/${PID}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: next }) });
    return r.ok;
  } catch { return false; }
}
