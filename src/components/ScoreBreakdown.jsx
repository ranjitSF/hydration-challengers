import React from 'react';

// Transparent, itemised score calculation. Each round shows correct × points = subtotal,
// with a stacked bar visualising how the total is composed. Reads straight from the
// projection payload (r32 + bracket arrays), so it always matches the leaderboard.
const ROUNDS = [
  { key: 'R32', label: 'Round of 32', sub: 'carried in', per: 3, color: '#2dd4bf' },
  { key: 'R16', label: 'Round of 16', per: 6, color: '#34d399' },
  { key: 'QF', label: 'Quarter-finals', per: 10, color: '#22d3ee' },
  { key: 'SF', label: 'Semi-finals', per: 16, color: '#60a5fa' },
  { key: 'F', label: 'Final', per: 30, color: '#fbbf24' },
];

const compute = (r32 = [], bracket = []) => {
  const gradeable = r32.filter((g) => !g.auto);
  const rows = {
    R32: { correct: gradeable.filter((g) => g.correct).length, total: gradeable.length, points: r32.reduce((s, g) => s + (g.points || 0), 0), played: true },
  };
  for (const key of ['R16', 'QF', 'SF', 'F']) {
    const slots = bracket.filter((b) => b.round === key);
    rows[key] = {
      correct: slots.filter((b) => b.correct).length,
      total: slots.length,
      points: slots.reduce((s, b) => s + (b.points || 0), 0),
      played: slots.some((b) => b.decided),
    };
  }
  return rows;
};

const ScoreBreakdown = ({ r32, bracket, total }) => {
  const rows = compute(r32, bracket);
  const sum = ROUNDS.reduce((s, m) => s + rows[m.key].points, 0);
  const adjustment = (total ?? sum) - sum; // any manual starting-points tweak
  const denom = Math.max(total || sum || 1, 1);

  return (
    <div className="bg-wc-navyDarker rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wide font-semibold accent-text">How this score adds up</h3>
        <span className="text-sm font-bold accent-text tabular-nums">{total} pts</span>
      </div>

      {sum > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden bg-wc-border/40" role="img" aria-label="Points by round">
          {ROUNDS.map((m) => rows[m.key].points > 0 && (
            <div key={m.key} title={`${m.label}: ${rows[m.key].points}`}
              style={{ width: `${(rows[m.key].points / denom) * 100}%`, background: m.color }} />
          ))}
        </div>
      )}

      <div className="space-y-1 text-sm">
        {ROUNDS.map((m) => {
          const r = rows[m.key];
          return (
            <div key={m.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-gray-300 min-w-0">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: m.color }} />
                <span className="truncate">{m.label}{m.sub && <span className="text-gray-500 text-xs"> · {m.sub}</span>}</span>
              </span>
              <span className="flex items-center gap-2 sm:gap-3 shrink-0">
                <span className="text-gray-500 tabular-nums text-xs whitespace-nowrap">
                  {r.played ? `${r.correct} correct × ${m.per}` : `× ${m.per} · to come`}
                </span>
                <span className={`tabular-nums font-semibold w-7 text-right ${r.points > 0 ? 'text-white' : 'text-gray-600'}`}>{r.points}</span>
              </span>
            </div>
          );
        })}
        {adjustment !== 0 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Adjustment</span>
            <span className="tabular-nums font-semibold w-7 text-right text-white">{adjustment > 0 ? `+${adjustment}` : adjustment}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-wc-border pt-1.5 mt-1">
          <span className="font-semibold text-white">Total</span>
          <span className="font-bold accent-text tabular-nums text-base">{total}</span>
        </div>
      </div>
    </div>
  );
};

export default ScoreBreakdown;
