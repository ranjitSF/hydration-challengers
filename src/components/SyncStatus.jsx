import React, { useEffect, useState } from 'react';
import { getConfig } from '../services';

const rel = (iso, now) => {
  if (!iso) return null;
  const s = Math.floor((now - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// Subtle heartbeat: "Scores auto-update · synced X ago". Reads the poller's
// lastPollAt; a teal pulse means healthy, amber if it's been quiet for a while.
const SyncStatus = () => {
  const [lastPollAt, setLastPollAt] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = () => getConfig().then((c) => { if (!cancelled) setLastPollAt(c.lastPollAt || null); }).catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(id);
  }, []);

  const label = rel(lastPollAt, now);
  if (!label) return null;
  const stale = now - Date.parse(lastPollAt) > 15 * 60 * 1000;

  return (
    <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
      <span className={`w-1.5 h-1.5 rounded-full ${stale ? 'bg-yellow-500' : 'bg-wc-accent animate-pulse'}`} />
      <span>Scores auto-update · synced {label}</span>
    </div>
  );
};

export default SyncStatus;
