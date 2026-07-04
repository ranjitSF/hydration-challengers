import React from 'react';
import { getFlag } from '../lib/teams';

// Standard two-sided knockout bracket: both halves converge on a centered Final.
// Column order left→right: R32 R16 QF SF | Final | SF QF R16 R32.
const U = 40;         // px height of one R32 row
const CARD_W = 112;   // px card / column width
const GAP = 24;       // px gap between columns (connectors live here)
const LINE = '#334166';

// Slot order per half, top→bottom, matched to the feeder pairing so cards align.
const HALVES = {
  left: {
    R32: ['M74', 'M77', 'M73', 'M75', 'M83', 'M84', 'M81', 'M82'],
    R16: ['M89', 'M90', 'M93', 'M94'],
    QF: ['QF1', 'QF2'],
    SF: ['SF1'],
  },
  right: {
    R32: ['M76', 'M78', 'M79', 'M80', 'M86', 'M88', 'M85', 'M87'],
    R16: ['M91', 'M92', 'M95', 'M96'],
    QF: ['QF3', 'QF4'],
    SF: ['SF2'],
  },
};
const DEPTH = { R32: 0, R16: 1, QF: 2, SF: 3, F: 3 };
const ROUND_SHORT = { R32: 'R32', R16: 'R16', QF: 'QF', SF: 'SF', F: 'Final' };
const ROUND_PTS = { R32: 3, R16: 6, QF: 10, SF: 16, F: 30 };

const STATUS_STYLE = {
  won: 'bg-wc-accent/15 border-wc-accent/60 text-wc-accent',
  auto: 'bg-wc-accent/10 border-wc-accent/40 text-wc-accent/90',
  out: 'bg-red-500/10 border-red-500/40 text-red-400',
  dead: 'bg-red-500/5 border-red-500/25 text-red-400/60',
  alive: 'bg-wc-navyDarker border-gray-500/70 text-white',
  none: 'bg-wc-navyDarker border-gray-700 text-gray-600',
};

const Line = (style) => <span style={{ position: 'absolute', ...style }} />;

// Elbow joining a winner card to its two feeders (mirrored for the right half).
const Connectors = ({ side }) => {
  const near = side === 'left' ? { left: -GAP } : { right: -GAP };
  const mid = side === 'left' ? { left: -GAP / 2 } : { right: -GAP / 2 };
  return (
    <>
      {Line({ top: '25%', width: GAP / 2, borderTop: `2px solid ${LINE}`, ...near })}
      {Line({ top: '75%', width: GAP / 2, borderTop: `2px solid ${LINE}`, ...near })}
      {Line({ top: '25%', height: '50%', borderLeft: `2px solid ${LINE}`, ...mid })}
      {Line({ top: '50%', width: GAP / 2, borderTop: `2px solid ${LINE}`, ...mid })}
    </>
  );
};

const Card = ({ item, highlight, dim, isFinal }) => {
  const status = item?.status || 'none';
  const team = item?.picked;
  const champion = isFinal && (status === 'won' || status === 'alive');
  const indicator = highlight != null
    ? (highlight ? `+${item.points ?? ROUND_PTS.F}` : '')
    : status === 'won' ? '✓' : status === 'out' ? '✗' : '';
  return (
    <div className={`relative z-10 rounded border px-1.5 h-[26px] flex items-center gap-1 text-[11px] leading-none
      ${STATUS_STYLE[status]} ${champion ? 'ring-1 ring-wc-accent' : ''}
      ${highlight ? 'ring-2 ring-wc-accent shadow-glow !text-white !bg-wc-accent/20' : ''}
      ${dim ? 'opacity-25' : ''}`}>
      <span className="shrink-0">{team ? getFlag(team) : '·'}</span>
      <span className="font-medium truncate flex-1">{team || '—'}</span>
      {champion && <span className="shrink-0">🏆</span>}
      {indicator && <span className="shrink-0 text-[10px] opacity-90">{indicator}</span>}
    </div>
  );
};

const BracketTree = ({ data, mode = 'results' }) => {
  const r32 = Object.fromEntries((data.r32 || []).map((g) => [g.game, g]));
  const bySlot = Object.fromEntries((data.bracket || []).map((b) => [b.slot, b]));
  const pathSet = new Set((data.path || []).map((p) => p.slot));
  const get = (key) => r32[key] || bySlot[key] || null;

  const H = U * 8;
  const nodeProps = (key) => {
    if (mode !== 'path') return { highlight: null, dim: false };
    return { highlight: pathSet.has(key), dim: !pathSet.has(key) };
  };

  const Column = ({ side, round, keys }) => (
    <div className="flex flex-col shrink-0" style={{ width: CARD_W }}>
      {keys.map((key) => (
        <div key={key} className={`relative flex items-center ${side === 'right' ? 'justify-end' : 'justify-start'}`}
          style={{ height: U * Math.pow(2, DEPTH[round]) }}>
          {round !== 'R32' && <Connectors side={side} />}
          <div style={{ width: CARD_W }}><Card item={get(key)} isFinal={round === 'F'} {...nodeProps(key)} /></div>
        </div>
      ))}
    </div>
  );

  const label = (round) => (
    <div style={{ width: CARD_W }} className="text-center text-[9px] uppercase tracking-wide text-gray-500 shrink-0">
      {ROUND_SHORT[round]}<span className="text-gray-600"> {ROUND_PTS[round]}p</span>
    </div>
  );

  return (
    <div className="overflow-x-auto -mx-1 px-1 pb-1">
      <div className="min-w-max">
        {/* round labels */}
        <div className="flex mb-1" style={{ gap: GAP }}>
          {['R32', 'R16', 'QF', 'SF', 'F', 'SF', 'QF', 'R16', 'R32'].map((r, i) => <React.Fragment key={i}>{label(r)}</React.Fragment>)}
        </div>
        {/* bracket */}
        <div className="flex items-center" style={{ gap: GAP, height: H }}>
          <Column side="left" round="R32" keys={HALVES.left.R32} />
          <Column side="left" round="R16" keys={HALVES.left.R16} />
          <Column side="left" round="QF" keys={HALVES.left.QF} />
          <Column side="left" round="SF" keys={HALVES.left.SF} />
          {/* Final — feeders sit level on both sides, so just two horizontal joins */}
          <div className="flex flex-col shrink-0" style={{ width: CARD_W }}>
            <div className="relative flex items-center justify-center" style={{ height: H }}>
              {Line({ top: '50%', left: -GAP, width: GAP, borderTop: `2px solid ${LINE}` })}
              {Line({ top: '50%', right: -GAP, width: GAP, borderTop: `2px solid ${LINE}` })}
              <div style={{ width: CARD_W }}><Card item={get('F1')} isFinal {...nodeProps('F1')} /></div>
            </div>
          </div>
          <Column side="right" round="SF" keys={HALVES.right.SF} />
          <Column side="right" round="QF" keys={HALVES.right.QF} />
          <Column side="right" round="R16" keys={HALVES.right.R16} />
          <Column side="right" round="R32" keys={HALVES.right.R32} />
        </div>
      </div>
    </div>
  );
};

export default BracketTree;
