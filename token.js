/* Signed login tokens (HMAC-SHA256, keyed with SESSION_SECRET).
   Token format:  base64url(payload) . signature
   payload = { u: username, v: tokenVersion, exp: expiryMs }
   Bumping a user's tokenVersion (done on password change) invalidates all of their old tokens. */
const crypto = require('crypto');

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sign(data){
  return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(data).digest('base64url');
}

function createToken(username, version){
  const payload = Buffer.from(JSON.stringify({ u: username, v: version || 0, exp: Date.now() + TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Returns { u, v, exp } for a valid, unexpired token, otherwise null. */
function verifyToken(token){
  if (typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.u || typeof data.exp !== 'number' || Date.now() > data.exp) return null;
    return data;
  } catch (e) { return null; }
}

module.exports = { createToken, verifyToken };
