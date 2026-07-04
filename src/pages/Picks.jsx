import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMatches, getMyPicks, saveDraft, submitPicks, getConfig } from '../services';
import MatchCard from '../components/MatchCard';
import BracketConnector from '../components/BracketConnector';
import LoadingSpinner from '../components/LoadingSpinner';
import LiveBanner from '../components/LiveBanner';
import { R16_SLOTS, QF_SLOTS, SF_SLOTS, FINAL_SLOT, deriveMatchup } from '../lib/bracket';
import { resolveBracket } from '../lib/board';

const ROUND_LABEL = { R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', F: 'Final' };

const Picks = () => {
  const { authToken } = useAuth();
  const [matches, setMatches] = useState(null);
  const [board, setBoard] = useState(null);
  const [picks, setPicks] = useState({});
  const [finalGoals, setFinalGoals] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [lockAt, setLockAt] = useState(null);
  const [m87Resolved, setM87Resolved] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());
  const [status, setStatus] = useState({ loading: true, error: '', saving: false, draftSaved: false });

  const draftTimer = useRef(null);
  const didInit = useRef(false);

  const loadServerState = async () => {
    const [matchList, mine, config] = await Promise.all([getMatches(), getMyPicks(authToken), getConfig()]);
    setMatches(matchList);
    setBoard(mine.board);
    setLockAt(config.lockAt ? new Date(config.lockAt) : null);
    setM87Resolved(!!config.m87Resolved);
    return mine;
  };

  useEffect(() => {
    (async () => {
      try {
        const mine = await loadServerState();
        setPicks(mine.picksBySlot || {});
        setFinalGoals(Number.isInteger(mine.finalGoals) ? String(mine.finalGoals) : '');
        setSubmitted(!!mine.submitted);
        didInit.current = true;
        setStatus((s) => ({ ...s, loading: false }));
      } catch (err) {
        setStatus((s) => ({ ...s, loading: false, error: err.message }));
      }
    })();
  }, [authToken]);

  // Clock (flips to read-only at lock) + live board/config refresh so M96 opens and
  // Submit unlocks the moment the Colombia–Ghana result lands, without a refresh.
  useEffect(() => {
    const clock = setInterval(() => setNowTs(Date.now()), 10000);
    const refresh = setInterval(() => {
      loadServerState().catch(() => {});
    }, 30000);
    return () => { clearInterval(clock); clearInterval(refresh); };
  }, [authToken]);

  const isLocked = lockAt ? nowTs >= lockAt.getTime() : false;
  const matchBySlot = useMemo(() => (matches ? Object.fromEntries(matches.map((m) => [m.slot, m])) : {}), [matches]);

  const { resolved, optionsBySlot, openSlots, complete } = useMemo(
    () => resolveBracket(board?.options || {}, picks),
    [board, picks]
  );
  const pickedCount = openSlots.filter((s) => resolved[s]).length;
  const goalsNum = finalGoals === '' ? null : Number(finalGoals);
  const goalsValid = Number.isInteger(goalsNum) && goalsNum >= 0 && goalsNum <= 20;

  // Auto-save the draft (debounced) whenever picks or the goals guess change.
  useEffect(() => {
    if (!didInit.current || isLocked) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      saveDraft(resolved, goalsValid ? goalsNum : null, authToken)
        .then(() => setStatus((s) => ({ ...s, draftSaved: true })))
        .catch(() => {});
    }, 1200);
    return () => clearTimeout(draftTimer.current);
  }, [resolved, finalGoals, isLocked, authToken]);

  const handlePick = (slot, team) => {
    if (isLocked) return;
    setPicks((prev) => ({ ...prev, [slot]: team }));
    setStatus((s) => ({ ...s, draftSaved: false, error: '' }));
  };

  const handleSubmit = async () => {
    setStatus((s) => ({ ...s, saving: true, error: '' }));
    try {
      await submitPicks(resolved, goalsNum, authToken);
      setSubmitted(true);
      setStatus((s) => ({ ...s, saving: false }));
    } catch (err) {
      const locked = /lock/i.test(err.message || '');
      setStatus((s) => ({ ...s, saving: false, error: locked ? 'Picks just locked — your bracket is now read-only.' : err.message }));
      if (locked) setNowTs(lockAt ? lockAt.getTime() : Date.now());
    }
  };

  if (status.loading) return <LoadingSpinner />;
  if (status.error && !matches) return <p className="text-red-400 text-center">{status.error}</p>;

  const cardFor = (slot) => {
    const isR16 = R16_SLOTS.includes(slot);
    const opts = optionsBySlot[slot] || [];
    const [teamA, teamB] = isR16 ? board.realTeams[slot] || [null, null] : deriveMatchup(slot, resolved);
    let cardStatus;
    if (isR16 && board.pending[slot]) cardStatus = 'pending';
    else if (opts.length === 0) {
      // A downstream slot with no options is only truly "dead" once the bracket is
      // otherwise complete; until then it's just waiting on your earlier-round picks.
      cardStatus = isR16 || complete ? 'dead' : 'awaiting';
    } else if (opts.length === 1) cardStatus = 'forced';
    else cardStatus = 'choice';
    const match = matchBySlot[slot];
    return (
      <MatchCard key={slot} label={slot} teamA={teamA} teamB={teamB} options={opts}
        picked={resolved[slot]} onPick={(team) => handlePick(slot, team)} disabled={isLocked}
        status={cardStatus} kickoff={match?.kickoff_at} venue={match?.venue} />
    );
  };

  const renderRound = (round, slots) => (
    <div className="space-y-3">
      <h2 className="text-lg font-bold accent-text">{ROUND_LABEL[round]}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{slots.map(cardFor)}</div>
    </div>
  );

  const canSubmit = complete && goalsValid && m87Resolved && !isLocked && !status.saving;
  const submitHint = () => {
    if (isLocked) return 'Picks are locked.';
    if (!m87Resolved) return 'Submit opens once the Colombia–Ghana result is in (tonight).';
    if (!complete) return `${pickedCount}/${openSlots.length} matches picked — fill the rest to submit.`;
    if (!goalsValid) return 'Enter your Final total-goals guess (tiebreaker) to submit.';
    return submitted ? 'Submitted ✓ — you can keep editing until lock.' : 'Ready to submit.';
  };

  return (
    <div className="space-y-6 pb-28">
      <LiveBanner />
      <div className="card p-4 text-sm text-gray-300 space-y-1">
        <p className="font-semibold text-white">How your bracket works</p>
        <p>
          This continues your Round-of-32 picks — in each match you can only advance a team you
          <span className="text-wc-accent"> correctly picked</span> to get here; teams you had knocked out are greyed
          out, and a match where both your teams are gone is <span className="text-gray-400">skipped (0 pts)</span>.
          Single-survivor matches are filled in automatically. Your progress <span className="text-wc-accent">auto-saves</span>.
          Your last match opens once the <span className="text-white">Colombia–Ghana</span> result is in — then hit
          <span className="text-white"> Submit</span>. Picks lock at Sat 9:45am PT (first R16 kickoff).
        </p>
      </div>

      {!isLocked && submitted && (
        <div className="bg-wc-accent/10 border border-wc-accent/30 rounded-lg p-3 text-wc-accent text-sm">
          ✓ Your bracket is submitted. You can still tweak it until lock.
        </div>
      )}
      {!isLocked && !submitted && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-300 text-sm">
          ⚠️ Draft not submitted yet — it won't count until you hit <span className="font-semibold">Submit</span>
          {m87Resolved ? '.' : ' (opens after the Colombia–Ghana result).'}
        </div>
      )}
      {isLocked && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-300 text-sm">
          Picks are locked — this is now read-only.
        </div>
      )}

      {renderRound('R16', R16_SLOTS)}
      <BracketConnector active={QF_SLOTS.some((s) => resolved[s])} />
      {renderRound('QF', QF_SLOTS)}
      <BracketConnector active={SF_SLOTS.some((s) => resolved[s])} />
      {renderRound('SF', SF_SLOTS)}
      <BracketConnector active={!!resolved[FINAL_SLOT]} />
      {renderRound('F', [FINAL_SLOT])}

      <div className="card p-4 space-y-2">
        <h2 className="text-lg font-bold accent-text">Tiebreaker</h2>
        <p className="text-sm text-gray-400">
          Total goals in the actual World Cup Final (both teams combined). If players tie on points, the closest
          guess wins.
        </p>
        <input
          type="number"
          min="0"
          max="20"
          inputMode="numeric"
          value={finalGoals}
          disabled={isLocked}
          onChange={(e) => { setFinalGoals(e.target.value); setStatus((s) => ({ ...s, draftSaved: false, error: '' })); }}
          placeholder="e.g. 3"
          className="w-32 px-4 py-3 bg-wc-navyDarker border border-wc-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-wc-accent disabled:opacity-60"
        />
      </div>

      {!isLocked && (
        <div className="fixed bottom-0 left-0 right-0 bg-wc-navyDarker/95 backdrop-blur border-t border-wc-border p-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="text-sm text-gray-400">
              {submitHint()}
              {status.error && <div className="text-red-400">{status.error}</div>}
              {!status.error && status.draftSaved && !submitted && <div className="text-gray-500 text-xs">Draft saved.</div>}
            </div>
            <button onClick={handleSubmit} disabled={!canSubmit}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
              {status.saving ? 'Submitting...' : submitted ? 'Resubmit' : 'Submit picks'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Picks;
