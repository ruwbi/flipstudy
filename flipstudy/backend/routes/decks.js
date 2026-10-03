/* /api/decks: every route requires a valid token and only touches the
   calling user's own decks (decks.json is keyed by username). */
const express = require('express');
const crypto = require('crypto');
const { readDB, writeDB } = require('../utils/db');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const uid = () => 'id' + crypto.randomBytes(5).toString('hex');
const str = v => (typeof v === 'string' ? v : '');
const NAME_MAX = 60, TERM_MAX = 300, DEF_MAX = 1500;
const isColor = c => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);

function myDecks(req){
  const decks = readDB('decks');
  if (!Object.prototype.hasOwnProperty.call(decks, req.username)) decks[req.username] = [];
  return { decks, mine: decks[req.username] };
}
function findDeck(mine, id){ return mine.find(d => d.id === id); }

/* GET /api/decks */
router.get('/', (req, res) => {
  res.json({ ok: true, decks: myDecks(req).mine });
});

/* POST /api/decks  { name, color } */
router.post('/', (req, res) => {
  const name = str(req.body.name).trim();
  const color = isColor(req.body.color) ? req.body.color : '#3f6ff0';
  if (!name) return res.status(400).json({ error: 'Please enter a deck name.' });
  if (name.length > NAME_MAX) return res.status(400).json({ error: `Deck name cannot exceed ${NAME_MAX} characters.` });
  const { decks, mine } = myDecks(req);
  const deck = { id: uid(), name, color, lastStudied: null, cards: [] };
  mine.push(deck);
  writeDB('decks', decks);
  res.status(201).json({ ok: true, deck });
});

/* PATCH /api/decks/:id  { name?, color? } */
router.patch('/:id', (req, res) => {
  const { decks, mine } = myDecks(req);
  const deck = findDeck(mine, req.params.id);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });
  const name = str(req.body.name).trim();
  if (name) {
    if (name.length > NAME_MAX) return res.status(400).json({ error: `Deck name cannot exceed ${NAME_MAX} characters.` });
    deck.name = name;
  }
  if (isColor(req.body.color)) deck.color = req.body.color;
  writeDB('decks', decks);
  res.json({ ok: true, deck });
});

/* PATCH /api/decks/:id/studied */
router.patch('/:id/studied', (req, res) => {
  const { decks, mine } = myDecks(req);
  const deck = findDeck(mine, req.params.id);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });
  deck.lastStudied = Date.now();
  writeDB('decks', decks);
  res.json({ ok: true, deck });
});

/* POST /api/decks/:id/duplicate */
router.post('/:id/duplicate', (req, res) => {
  const { decks, mine } = myDecks(req);
  const deck = findDeck(mine, req.params.id);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });
  const copy = {
    id: uid(), name: (deck.name + ' (Copy)').slice(0, NAME_MAX + 7), color: deck.color, lastStudied: null,
    cards: deck.cards.map(c => ({ ...c, id: uid() }))
  };
  mine.push(copy);
  writeDB('decks', decks);
  res.status(201).json({ ok: true, deck: copy });
});

/* DELETE /api/decks/:id */
router.delete('/:id', (req, res) => {
  const { decks, mine } = myDecks(req);
  const idx = mine.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Deck not found' });
  mine.splice(idx, 1);
  writeDB('decks', decks);
  res.json({ ok: true });
});

/* POST /api/decks/:id/cards  { term, def } */
router.post('/:id/cards', (req, res) => {
  const term = str(req.body.term).trim(), def = str(req.body.def).trim();
  if (!term || !def) return res.status(400).json({ error: 'Both a term and a definition are required.' });
  if (term.length > TERM_MAX) return res.status(400).json({ error: `Term cannot exceed ${TERM_MAX} characters.` });
  if (def.length > DEF_MAX) return res.status(400).json({ error: `Definition cannot exceed ${DEF_MAX} characters.` });
  const { decks, mine } = myDecks(req);
  const deck = findDeck(mine, req.params.id);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });
  const card = { id: uid(), term, def, learned: false };
  deck.cards.push(card);
  writeDB('decks', decks);
  res.status(201).json({ ok: true, card });
});

/* PATCH /api/decks/:id/cards/:cardId  { term?, def?, learned? } */
router.patch('/:id/cards/:cardId', (req, res) => {
  const { decks, mine } = myDecks(req);
  const deck = findDeck(mine, req.params.id);
  const card = deck && deck.cards.find(c => c.id === req.params.cardId);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  const term = str(req.body.term).trim(), def = str(req.body.def).trim();
  if (term) {
    if (term.length > TERM_MAX) return res.status(400).json({ error: `Term cannot exceed ${TERM_MAX} characters.` });
    card.term = term;
  }
  if (def) {
    if (def.length > DEF_MAX) return res.status(400).json({ error: `Definition cannot exceed ${DEF_MAX} characters.` });
    card.def = def;
  }
  if (req.body.learned !== undefined) card.learned = !!req.body.learned;
  writeDB('decks', decks);
  res.json({ ok: true, card });
});

/* PATCH /api/decks/:id/cards/:cardId/move  { toDeckId } */
router.patch('/:id/cards/:cardId/move', (req, res) => {
  const { decks, mine } = myDecks(req);
  const from = findDeck(mine, req.params.id);
  const to = findDeck(mine, str(req.body.toDeckId));
  if (!from || !to) return res.status(404).json({ error: 'Deck not found' });
  const idx = from.cards.findIndex(c => c.id === req.params.cardId);
  if (idx === -1) return res.status(404).json({ error: 'Card not found' });
  const [card] = from.cards.splice(idx, 1);
  to.cards.push(card);
  writeDB('decks', decks);
  res.json({ ok: true });
});

/* DELETE /api/decks/:id/cards/:cardId */
router.delete('/:id/cards/:cardId', (req, res) => {
  const { decks, mine } = myDecks(req);
  const deck = findDeck(mine, req.params.id);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });
  deck.cards = deck.cards.filter(c => c.id !== req.params.cardId);
  writeDB('decks', decks);
  res.json({ ok: true });
});

module.exports = router;
