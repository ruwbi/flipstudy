/* FlipStudy backend: Express API.
   Required environment variables: SESSION_SECRET, CLIENT_ORIGIN. */
require('dotenv').config();
const express = require('express');
const cors = require('cors');

if (!process.env.SESSION_SECRET) {
  console.error('Missing SESSION_SECRET. Set it in your environment (or backend/.env for local development).');
  process.exit(1);
}

const authRoutes = require('./routes/auth');
const deckRoutes = require('./routes/decks');

const app = express();
const PORT = process.env.PORT || 4000;

// CLIENT_ORIGIN may hold one origin or several separated by commas.
const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map(s => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);
if (!allowedOrigins.length) console.warn('CLIENT_ORIGIN is not set: allowing requests from any origin.');

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => res.json({ ok: true, service: 'flipstudy-backend' }));
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/decks', deckRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body' });
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => console.log(`FlipStudy backend listening on port ${PORT}`));
