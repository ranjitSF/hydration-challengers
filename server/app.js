import express from 'express';
import cors from 'cors';
import { initializeFirebase } from './config/firebase.js';
import playersRouter from './routes/players.js';
import matchesRouter from './routes/matches.js';
import picksRouter from './routes/picks.js';
import standingsRouter from './routes/standings.js';
import adminRouter from './routes/admin.js';
import configRouter from './routes/config.js';
import cronRouter from './routes/cron.js';
import liveRouter from './routes/live.js';
import scenarioRouter from './routes/scenario.js';

initializeFirebase();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/players', playersRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/picks', picksRouter);
app.use('/api/standings', standingsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/config', configRouter);
app.use('/api/cron', cronRouter);
app.use('/api/live', liveRouter);
app.use('/api/scenario', scenarioRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

export default app;
