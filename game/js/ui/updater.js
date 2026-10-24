import { VERSION } from '../version.js';

// Checks whether a newer build has been published by fetching version.js
// straight from the server (bypassing caches) and comparing versions.
export async function latestVersion() {
  const res = await fetch(`game/js/version.js?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const m = (await res.text()).match(/VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('No version found');
  return m[1];
}

export async function checkForUpdate() {
  const latest = await latestVersion();
  return { current: VERSION, latest, available: latest !== VERSION };
}

// Re-downloads every file the page has loaded (refreshing the browser cache)
// and then reloads, so the new build starts with no stale files.
export async function applyUpdate() {
  const urls = new Set([location.href.split('#')[0]]);
  for (const e of performance.getEntriesByType('resource')) {
    if (new URL(e.name).origin === location.origin) urls.add(e.name);
  }
  try {
    if (window.caches) for (const key of await caches.keys()) await caches.delete(key);
  } catch { /* no cache storage */ }
  await Promise.allSettled([...urls].map((u) => fetch(u, { cache: 'reload' })));
  location.reload();
}

export { VERSION };
