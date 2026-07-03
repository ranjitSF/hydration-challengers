import React from 'react';
import { motion } from 'framer-motion';

// A small vertical connector line + chevron, animated in once its feeder picks are resolved.
const BracketConnector = ({ active }) => (
  <div className="flex flex-col items-center py-1">
    <motion.div
      initial={{ scaleY: 0, opacity: 0 }}
      animate={{ scaleY: 1, opacity: active ? 1 : 0.3 }}
      transition={{ duration: 0.4 }}
      className={`w-0.5 h-6 origin-top ${active ? 'bg-wc-accent' : 'bg-wc-border'}`}
    />
    <motion.div
      animate={{ opacity: active ? 1 : 0.3, y: active ? 0 : -2 }}
      className={`text-lg ${active ? 'text-wc-accent' : 'text-wc-border'}`}
    >
      ▼
    </motion.div>
  </div>
);

export default BracketConnector;
