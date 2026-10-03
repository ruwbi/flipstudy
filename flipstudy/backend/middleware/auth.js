/* requireAuth: protects routes behind a valid signed token.
   The frontend sends:  Authorization: Bearer <token> */
const { readDB } = require('../utils/db');
const { verifyToken } = require('../utils/token');

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function requireAuth(req, res, next){
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Session expired, please log in again' });

  const users = readDB('users');
  if (!has(users, data.u) || (users[data.u].tokenVersion || 0) !== data.v) {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }

  req.username = data.u;
  req.user = users[data.u];
  next();
}

module.exports = requireAuth;
