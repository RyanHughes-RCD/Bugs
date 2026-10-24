export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function fmtNum(n) {
  n = Math.floor(n);
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString('en-US');
}

export function pct(x, digits = 0) {
  const v = x * 100;
  if (v > 0 && v < 1 && digits === 0) return `${v.toFixed(1)}%`;
  return `${v.toFixed(digits)}%`;
}

// Log timestamp relative to the expedition start: 10:00, 1:20:00.
export function fmtClock(ms) {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${String(m).padStart(2, '0')}:${sec}`;
}

// Compact duration for planned lengths: 30m, 1h 10m, 4h.
export function fmtDur(ms) {
  const m = Math.round(ms / 60e3);
  if (m < 60) return m >= 1 ? `${m}m` : fmtTime(ms);
  return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`;
}
