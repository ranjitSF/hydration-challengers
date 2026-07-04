import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Row = ({ round, pts }) => (
  <div className="flex justify-between py-1 border-b border-wc-border/50 last:border-0">
    <span className="text-gray-300">{round}</span>
    <span className="font-semibold accent-text">{pts}</span>
  </div>
);

const RulesModal = ({ open, onClose }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
          className="card p-6 max-w-lg w-full my-8 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="text-4xl mb-1">🏆</div>
            <h2 className="text-2xl font-bold">How the pool works</h2>
          </div>

          <div className="space-y-1 text-sm text-gray-300">
            <p className="font-semibold text-white">Your bracket</p>
            <p>
              It continues your Round-of-32 picks. In each match you can only advance a team you <span className="text-wc-accent">correctly
              picked</span> to reach that round — teams you had knocked out are greyed out. Nail both sides and you get a real choice;
              hit one and it's filled in for you; miss both and that match is skipped (0 pts).
            </p>
          </div>

          <div className="space-y-1 text-sm">
            <p className="font-semibold text-white">Points per correct pick</p>
            <div className="bg-wc-navyDarker rounded-lg p-3">
              <Row round="Round of 32 (carried in)" pts="3 each" />
              <Row round="Round of 16" pts="6 each" />
              <Row round="Quarter-finals" pts="10 each" />
              <Row round="Semi-finals" pts="16 each" />
              <Row round="Final (champions)" pts="30" />
            </div>
          </div>

          <div className="space-y-1 text-sm text-gray-300">
            <p className="font-semibold text-white">Submitting</p>
            <p>
              Fill your bracket anytime — it <span className="text-wc-accent">auto-saves</span>. You can <span className="text-white">Submit</span> once
              the Colombia–Ghana result is in (your last match depends on it). Picks lock at <span className="text-white">Sat 9:45am PT</span>,
              just before the first Round-of-16 game. Only a submitted bracket counts.
            </p>
          </div>

          <div className="space-y-1 text-sm text-gray-300">
            <p className="font-semibold text-white">Tiebreaker</p>
            <p>
              Guess the total goals in the actual World Cup Final. If players tie on points, the closest guess wins (then
              whoever got more of the later rounds right).
            </p>
          </div>

          <div className="space-y-1 text-sm text-gray-300">
            <p className="font-semibold text-white">Leaderboard</p>
            <p>Track your spot live. After picks lock, tap anyone to see their full bracket and how each pick scored.</p>
          </div>

          <button onClick={onClose} className="w-full btn-primary">Got it — let's pick</button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default RulesModal;
