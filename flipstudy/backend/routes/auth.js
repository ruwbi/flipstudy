/* /api/auth: register, login, me, change-password. */
const express = require('express');
const bcrypt = require('bcryptjs');
const { readDB, writeDB } = require('../utils/db');
const { validateUsername, validateEmail, validatePassword } = require('../utils/validation');
const { createToken } = require('../utils/token');
const requireAuth = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 10;
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const str = v => (typeof v === 'string' ? v : '');

function publicUser(username, record){
  return { username, email: record.email, joined: record.joined };
}
/** Exact match first, then case-insensitive. Returns the stored username or null. */
function findUsername(users, name){
  name = name.trim();
  if (!name) return null;
  if (has(users, name)) return name;
  const lower = name.toLowerCase();
  return Object.keys(users).find(u => u.toLowerCase() === lower) || null;
}

/* POST /api/auth/register  { username, email, password } */
router.post('/register', async (req, res) => {
  const uname = str(req.body && req.body.username).trim();
  const mail = str(req.body && req.body.email).trim();
  const password = str(req.body && req.body.password);

  if (!uname) return res.status(400).json({ error: 'Please enter your username' });
  if (!mail) return res.status(400).json({ error: 'Please enter your email address' });
  if (!password) return res.status(400).json({ error: 'Please enter your password' });

  const uCheck = validateUsername(uname);
  if (!uCheck.valid) return res.status(400).json({ error: uCheck.message });
  const eCheck = validateEmail(mail);
  if (!eCheck.valid) return res.status(400).json({ error: eCheck.message });
  const pCheck = validatePassword(password);
  if (!pCheck.valid) return res.status(400).json({ error: pCheck.message });

  const users = readDB('users');
  if (findUsername(users, uname)) return res.status(409).json({ error: 'Username is taken, choose another' });
  const emailInUse = Object.values(users).some(u => (u.email || '').toLowerCase() === mail.toLowerCase());
  if (emailInUse) return res.status(409).json({ error: 'This email is already in use' });

  users[uname] = {
    email: mail,
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    joined: Date.now(),
    tokenVersion: 0
  };
  writeDB('users', users);

  const decks = readDB('decks');
  decks[uname] = [];
  writeDB('decks', decks);

  res.status(201).json({ ok: true });
});

/* POST /api/auth/login  { username, password } */
router.post('/login', async (req, res) => {
  const username = str(req.body && req.body.username);
  const password = str(req.body && req.body.password);
  if (!username.trim()) return res.status(400).json({ error: 'Please enter your username' });
  if (!password) return res.status(400).json({ error: 'Please enter your password' });

  const users = readDB('users');
  const uname = findUsername(users, username);
  const record = uname && users[uname];
  const match = record ? await bcrypt.compare(password, record.passwordHash) : false;
  if (!record || !match) return res.status(401).json({ error: 'Username or password is incorrect' });

  res.json({ ok: true, token: createToken(uname, record.tokenVersion || 0), user: publicUser(uname, record) });
});

/* POST /api/auth/logout  (tokens are stateless, so the client simply discards its token) */
router.post('/logout', requireAuth, (req, res) => res.json({ ok: true }));

/* GET /api/auth/me */
router.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: publicUser(req.username, req.user) });
});

/* POST /api/auth/change-password  { currentPassword, newPassword } */
router.post('/change-password', requireAuth, async (req, res) => {
  const currentPassword = str(req.body && req.body.currentPassword);
  const newPassword = str(req.body && req.body.newPassword);

  const match = await bcrypt.compare(currentPassword, req.user.passwordHash);
  if (!match) return res.status(403).json({ error: 'Current password is incorrect' });

  const check = validatePassword(newPassword);
  if (!check.valid) return res.status(400).json({ error: check.message });

  const users = readDB('users');
  const record = users[req.username];
  record.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  record.tokenVersion = (record.tokenVersion || 0) + 1; // signs out every other device
  writeDB('users', users);

  // Hand back a fresh token so this device stays signed in.
  res.json({
    ok: true,
    message: 'Password updated successfully',
    token: createToken(req.username, record.tokenVersion)
  });
});

module.exports = router;
