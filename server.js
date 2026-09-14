const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = process.env.DUEL_DATA_DIR || path.join(ROOT, '..', 'game-data');
const DB_PATH = path.join(DATA_DIR, 'game.db');
const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cards.json'), 'utf8'));
const cardMap = new Map(cards.map(card => [Number(card.id), card]));
const REWARDS = { easy: 20, normal: 30, hard: 40, expert: 50 };
const COOKIE = 'duel_session';

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  credits INTEGER NOT NULL DEFAULT 200,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_cards (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id INTEGER NOT NULL,
  obtained_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, card_id)
);
CREATE TABLE IF NOT EXISTS match_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  difficulty TEXT NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('win','loss')),
  credits_change INTEGER NOT NULL,
  played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const seedInitialCards = db.transaction(userId => {
  const insert = db.prepare('INSERT OR IGNORE INTO user_cards (user_id, card_id) VALUES (?, ?)');
  for (let id = 1; id <= Math.min(30, cards.length); id++) insert.run(userId, id);
});

function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function cleanUsername(value) { return String(value || '').trim().replace(/\s+/g, ' '); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve({ hash: key.toString('hex'), salt })));
}
function safeEqualHex(a, b) {
  try {
    const aa = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  } catch { return false; }
}
function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash, userId, expires);
  return token;
}
function clearExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
}
function currentUser(req) {
  clearExpiredSessions();
  const token = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return db.prepare(`SELECT u.id, u.email, u.username, u.credits FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now')`).get(tokenHash) || null;
}
function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Não autenticado.' });
  req.user = user;
  next();
}
function publicUser(user) { return { id: user.id, email: user.email, username: user.username, credits: user.credits }; }
function cookieHeader(token, maxAge) { return `${COOKIE}=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`; }

app.use(express.json({ limit: '100kb' }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const username = cleanUsername(req.body.username);
    const password = String(req.body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Informe um email válido.' });
    if (password.length < 6) return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
    if (username.length < 3 || username.length > 24) return res.status(400).json({ error: 'O nome deve ter entre 3 e 24 caracteres.' });
    const exists = db.prepare('SELECT email, username FROM users WHERE email=? OR username=?').get(email, username);
    if (exists?.email?.toLowerCase() === email) return res.status(409).json({ error: 'Este email já está cadastrado.' });
    if (exists?.username?.toLowerCase() === username.toLowerCase()) return res.status(409).json({ error: 'Este nome já está em uso.' });
    const { hash, salt } = await hashPassword(password);
    const result = db.prepare('INSERT INTO users (email, password_hash, password_salt, username, credits) VALUES (?, ?, ?, ?, 200)').run(email, hash, salt, username);
    seedInitialCards(result.lastInsertRowid);
    const token = createSession(result.lastInsertRowid);
    res.setHeader('Set-Cookie', cookieHeader(token, 60 * 60 * 24 * 30));
    const user = db.prepare('SELECT id,email,username,credits FROM users WHERE id=?').get(result.lastInsertRowid);
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não foi possível criar a conta.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if (!user) return res.status(401).json({ error: 'email ou senha inválidos' });
    const { hash } = await hashPassword(password, user.password_salt);
    if (!safeEqualHex(hash, user.password_hash)) return res.status(401).json({ error: 'email ou senha inválidos' });
    const token = createSession(user.id);
    res.setHeader('Set-Cookie', cookieHeader(token, 60 * 60 * 24 * 30));
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não foi possível entrar.' });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(crypto.createHash('sha256').update(token).digest('hex'));
  res.setHeader('Set-Cookie', cookieHeader('', 0));
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const owned = db.prepare('SELECT card_id FROM user_cards WHERE user_id=? ORDER BY card_id').all(req.user.id).map(r => r.card_id);
  res.json({ user: publicUser(req.user), ownedCardIds: owned });
});

app.get('/api/cards', requireAuth, (req, res) => {
  const owned = new Set(db.prepare('SELECT card_id FROM user_cards WHERE user_id=?').all(req.user.id).map(r => r.card_id));
  res.json({ cards: cards.map(card => ({ ...card, owned: owned.has(Number(card.id)) })) });
});

app.post('/api/cards/purchase', requireAuth, (req, res) => {
  const cardId = Number(req.body.cardId);
  const card = cardMap.get(cardId);
  if (!card) return res.status(404).json({ error: 'Carta não encontrada.' });
  if (db.prepare('SELECT 1 FROM user_cards WHERE user_id=? AND card_id=?').get(req.user.id, cardId)) return res.status(409).json({ error: 'Você já possui esta carta.' });
  const atk = Number(card.atk || 0);
  let price = null;
  if (atk >= 2000 && atk < 3000) price = 200;
  else if (atk >= 3000 && atk < 4000) price = 300;
  else if (atk >= 4000 && atk < 5000) price = 400;
  else if (atk >= 5000 && atk < 6000) price = 500;
  else if (atk >= 6000) price = 600;
  else return res.status(400).json({ error: 'Esta carta não está em uma faixa de compra.' });

  const purchase = db.transaction(() => {
    const user = db.prepare('SELECT credits FROM users WHERE id=?').get(req.user.id);
    if (user.credits < price) return { insufficient: true, credits: user.credits, price };
    db.prepare('UPDATE users SET credits=credits-? WHERE id=?').run(price, req.user.id);
    db.prepare('INSERT INTO user_cards (user_id, card_id) VALUES (?, ?)').run(req.user.id, cardId);
    return { insufficient: false, credits: user.credits - price, price };
  })();
  if (purchase.insufficient) return res.status(400).json({ error: 'créditos insuficientes', credits: purchase.credits, price });
  res.json({ ok: true, cardId, credits: purchase.credits, price });
});

app.get('/api/history', requireAuth, (req, res) => {
  const history = db.prepare('SELECT id,difficulty,result,credits_change AS creditsChange,played_at AS playedAt FROM match_history WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id);
  res.json({ history });
});

app.post('/api/matches', requireAuth, (req, res) => {
  const difficulty = String(req.body.difficulty || '');
  const result = String(req.body.result || '');
  if (!Object.hasOwn(REWARDS, difficulty) || !['win','loss'].includes(result)) return res.status(400).json({ error: 'Resultado de partida inválido.' });
  const change = result === 'win' ? REWARDS[difficulty] : 0;
  const save = db.transaction(() => {
    db.prepare('INSERT INTO match_history (user_id,difficulty,result,credits_change) VALUES (?,?,?,?)').run(req.user.id,difficulty,result,change);
    if (change) db.prepare('UPDATE users SET credits=credits+? WHERE id=?').run(change,req.user.id);
    return db.prepare('SELECT id,email,username,credits FROM users WHERE id=?').get(req.user.id);
  })();
  res.json({ user: publicUser(save), reward: change });
});

app.use(express.static(ROOT));
app.listen(PORT, () => console.log(`Yu-Gi Duel Arena rodando em http://localhost:${PORT}`));
