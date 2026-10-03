/* =======================================================================
   FlipStudy frontend: API client and shared UI helpers.
   Every page includes config.js (API address) and then this file.
   ======================================================================= */

/* ---------------- API base + auth token ----------------
   The address comes from window.FLIPSTUDY_API_BASE (set in config.js).
   It is normalized here so it always ends with exactly one "/api". */
const API_BASE = (function(){
  let base = (window.FLIPSTUDY_API_BASE || '').trim().replace(/\/+$/, '');
  if(!base) base = 'http://localhost:4000';
  if(!/\/api$/.test(base)) base += '/api';
  return base;
})();
const TOKEN_KEY = 'flipstudy_token';
const SESSION_KEY = 'flipstudy_user';       // plain username, for quick sync reads
const USERINFO_KEY = 'flipstudy_user_info'; // {username, email, joined}, for profile display

function authToken(){ return localStorage.getItem(TOKEN_KEY); }
function storeSession(token, user){
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(SESSION_KEY, user.username);
  localStorage.setItem(USERINFO_KEY, JSON.stringify(user));
}
function clearSession(){
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USERINFO_KEY);
}

/** Every API call goes through here: attaches the token, parses JSON, and
    normalizes the result to {ok, ...data} or {ok:false, error}. */
async function apiFetch(path, options = {}){
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = authToken();
  if(token) headers.Authorization = 'Bearer ' + token;

  let res, data;
  try{
    res = await fetch(API_BASE + path, Object.assign({}, options, { headers }));
    data = await res.json().catch(() => ({}));
  }catch(networkErr){
    return { ok:false, error:'Could not reach the server. If it was idle it may be starting up, so please try again in a few seconds.' };
  }

  // A 401 from login/register is just a wrong-credentials answer; anywhere else it means the session ended.
  if(res.status === 401 && !/^\/auth\/(login|register)/.test(path)){
    clearSession();
    window.location.href = 'index.html';
  }
  if(!res.ok) return { ok:false, error: data.error || 'Something went wrong.' };
  return Object.assign({ ok:true }, data);
}

/* ---------------- Settings (theme/sound/etc.) — stays device-local on purpose;
   these are viewer preferences, not account data, so they don't belong on the server. ---------------- */
const SETTINGS_KEY = 'flipstudy_settings_v1';
const COLORS = ['#3f6ff0','#2b7a78','#c9922f','#5b6489','#1d3fa8','#3a8a86','#7a6a4f','#4a5578'];

function loadSettings(){
  const defaults = {
    theme: 'light', sound: true, positions: {},
    accent: 'blue', fontSize: 'medium',
    cardOrder: 'sequential', autoFlip: false, flipDuration: 'normal',
    tagline: 'Learning something new every day.',
    streak: {count: 0, lastDate: null}, studySeconds: 0, lastActive: null, recentSessions: []
  };
  try{
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    return Object.assign({}, defaults, saved, {
      positions: Object.assign({}, defaults.positions, saved.positions),
      streak: Object.assign({}, defaults.streak, saved.streak)
    });
  }catch(e){ return defaults; }
}
function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); }
const SETTINGS = loadSettings();

const ACCENTS = {
  blue:   {name:'Blue',   500:'#3f6ff0', 600:'#2952d6', 700:'#1d3fa8'},
  purple: {name:'Purple', 500:'#8b5cf6', 600:'#7c3aed', 700:'#5b21b6'},
  green:  {name:'Green',  500:'#22c55e', 600:'#16a34a', 700:'#15803d'},
  pink:   {name:'Pink',   500:'#ec4899', 600:'#db2777', 700:'#9d174d'},
  orange: {name:'Orange', 500:'#f97316', 600:'#ea580c', 700:'#9a3412'},
  teal:   {name:'Teal',   500:'#14b8a6', 600:'#0d9488', 700:'#115e59'},
};
function applyAccent(){
  const a = ACCENTS[SETTINGS.accent] || ACCENTS.blue;
  const root = document.documentElement.style;
  root.setProperty('--blue-500', a[500]);
  root.setProperty('--blue-600', a[600]);
  root.setProperty('--blue-700', a[700]);
}
function setAccent(key){ if(!ACCENTS[key]) return; SETTINGS.accent = key; saveSettings(); applyAccent(); }
applyAccent();

const FONT_SIZES = {small:'15px', medium:'17px', large:'19.5px'};
function applyFontSize(){ document.documentElement.style.setProperty('--base-font', FONT_SIZES[SETTINGS.fontSize] || FONT_SIZES.medium); }
function setFontSize(key){ if(!FONT_SIZES[key]) return; SETTINGS.fontSize = key; saveSettings(); applyFontSize(); }
applyFontSize();

/* ---------------- Profile: streak, study time, last active (device-local) ---------------- */
function profileName(){ return SETTINGS.displayName || currentUser(); }
function setProfileName(name){ name = (name || '').trim(); if(name) SETTINGS.displayName = name; saveSettings(); }
function setTagline(text){ SETTINGS.tagline = (text || '').trim(); saveSettings(); }
/** Reads the join date the server sent back at login — stored in USERINFO_KEY. */
function joinedDate(){
  try{ return (JSON.parse(localStorage.getItem(USERINFO_KEY)) || {}).joined || null; }catch(e){ return null; }
}
function touchLastActive(){ SETTINGS.lastActive = Date.now(); saveSettings(); }
function recordStudyActivity(){
  const today = new Date().toDateString();
  if(SETTINGS.streak.lastDate !== today){
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    SETTINGS.streak.count = (SETTINGS.streak.lastDate === yesterday) ? SETTINGS.streak.count + 1 : 1;
    SETTINGS.streak.lastDate = today;
  }
  touchLastActive();
}
function addStudySeconds(sec){ SETTINGS.studySeconds = (SETTINGS.studySeconds || 0) + Math.max(0, sec); saveSettings(); }
function logStudySession(deckName, mode){
  SETTINGS.recentSessions = SETTINGS.recentSessions || [];
  SETTINGS.recentSessions.unshift({date: Date.now(), deckName, mode});
  SETTINGS.recentSessions = SETTINGS.recentSessions.slice(0, 10);
  saveSettings();
}
function formatDuration(totalSeconds){
  const mins = Math.round((totalSeconds || 0) / 60);
  if(mins < 1) return 'Under a minute';
  if(mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

/* ---------------- Export / clear (operate on the deck cache below) ---------------- */
function exportAllData(){
  const payload = {exportedAt: Date.now(), user: currentUser(), decks: userDecks(), settings: SETTINGS};
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `flipstudy-backup-${currentUser()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded.', 'success');
}

/* =======================================================================
   AUTHENTICATION — real API calls to the Express backend.
   ======================================================================= */
function currentUser(){ return localStorage.getItem(SESSION_KEY); }
function isLoggedIn(){ return !!authToken(); }

/** Redirect to login unless a token is present. Call at the top of every protected page.
    (Doesn't round-trip to the server — an expired/invalid token is caught generically
    by apiFetch's 401 handler the moment the page's first real API call fails.) */
function requireAuth(){ if(!isLoggedIn()){ window.location.href = 'index.html'; return; } touchLastActive(); }
/** Send an already-logged-in visitor away from the login/register pages. */
function redirectIfLoggedIn(){ if(isLoggedIn()) window.location.href = 'dashboard.html'; }

/* ---------------- Account validation rules (shared by register.html & settings.html) ---------------- */
const USERNAME_MIN = 4, USERNAME_MAX = 20;
const PASSWORD_MIN = 8, PASSWORD_MAX = 32;
const SPECIAL_CHARS = '!@#$%^&*_-+';

function validateUsername(username){
  username = username || '';
  const trimmed = username.trim();
  if(!trimmed) return {valid:false, message:''};
  if(trimmed.length < USERNAME_MIN) return {valid:false, message:`Username must be at least ${USERNAME_MIN} characters`};
  if(trimmed.length > USERNAME_MAX) return {valid:false, message:`Username cannot exceed ${USERNAME_MAX} characters`};
  if(!/^[A-Za-z0-9_]+$/.test(trimmed)) return {valid:false, message:'Only letters, numbers, and underscores allowed'};
  
  const onlyNumbers = /^\d+$/;
  if(onlyNumbers.test(trimmed)) {
    return {valid:false, message:"Username cannot consist of numbers only. Please include letters, example: user04"};
  }
  
  return {valid:true, message:'Username available'};
}


function passwordRuleChecklist(password){
  password = password || '';
  return [
    {label:`At least ${PASSWORD_MIN} characters`, met: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX},
    {label:'Include uppercase letter', met: /[A-Z]/.test(password)},
    {label:'Include lowercase letter', met: /[a-z]/.test(password)},
    {label:'Include number', met: /[0-9]/.test(password)},
    {label:'Include special character', met: new RegExp(`[${SPECIAL_CHARS.replace(/[-]/g,'\\-')}]`).test(password)}
  ];
}
function validatePassword(password){
  const rules = passwordRuleChecklist(password);
  const failed = rules.find(r => !r.met);
  return {valid: !failed, message: failed ? failed.label : ''};
}
function passwordStrength(password){
  if(!password) return {label:'', pct:0, level:0};
  const metCount = passwordRuleChecklist(password).filter(r => r.met).length;
  const levels = [
    {label:'Weak', pct:20}, {label:'Weak', pct:35}, {label:'Fair', pct:55},
    {label:'Good', pct:75}, {label:'Strong', pct:100}
  ];
  return {level: metCount, ...levels[metCount]};
}
function validateEmail(email){
  email = (email || '').trim();
  if(!email) return {valid:false, message:'Please enter your email address'};
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return {valid:false, message:'Please enter a valid email address'};
  return {valid:true, message:''};
}

/* ---------------- Register / login / logout / change-password ---------------- */
async function registerUser(username, email, password){
  return apiFetch('/auth/register', { method:'POST', body: JSON.stringify({ username, email, password }) });
}
async function loginUser(username, password){
  const res = await apiFetch('/auth/login', { method:'POST', body: JSON.stringify({ username, password }) });
  if(res.ok) storeSession(res.token, res.user);
  return res;
}
/** Tells the server, clears the local session, and returns to the login page. */
function logoutUser(){
  apiFetch('/auth/logout', { method:'POST' }).catch(() => {});
  clearSession();
  window.location.href = 'index.html';
}
/** New signature: the server identifies the account from the bearer token, so no username param. */
async function changePassword(currentPassword, newPassword){
  const res = await apiFetch('/auth/change-password', { method:'POST', body: JSON.stringify({ currentPassword, newPassword }) });
  if(res.ok && res.token) localStorage.setItem(TOKEN_KEY, res.token); // keep this device signed in
  return res;
}

/* =======================================================================
   DECKS & CARDS — a local cache backed by the real API.
   `refreshDecks()` is awaited ONCE per page load (see the bottom of each
   page's script). After that, userDecks()/getDeck() are plain synchronous
   reads of the cache, exactly like the old LocalStorage version, so the
   render functions that already existed on every page didn't need to
   change at all.
   For mutations: createDeck/duplicateDeck/addCard are awaited by their
   callers because the caller needs the server-assigned id back. Everything
   else (rename, delete, update, move, mark-learned) updates the cache
   immediately (optimistic) and syncs to the server in the background,
   because the caller already knows the id and doesn't need to wait —
   this keeps study-mode snappy even while it's saving progress. If a
   background save fails, the cache is resynced from the server and an
   error toast is shown, so the UI never silently drifts from the truth.
   ======================================================================= */
let _decks = [];
async function refreshDecks(){
  const res = await apiFetch('/decks');
  _decks = res.ok ? res.decks : [];
  if(!res.ok) showToast(res.error || 'Could not load your decks.', 'error');
  return _decks;
}
function userDecks(){ return _decks; }
function getDeck(id){ return _decks.find(d => d.id === id); }

function _syncInBackground(promise){
  promise.then(res => { if(!res.ok){ showToast(res.error || 'Could not save that change.', 'error'); refreshDecks(); } })
         .catch(() => { showToast('Could not reach the server — refreshing...', 'error'); refreshDecks(); });
}

/** Awaited by callers — they need the real id back before doing anything else with it. */
async function createDeck(name, color){
  name = (name || '').trim();
  if(!name) return null;
  const res = await apiFetch('/decks', { method:'POST', body: JSON.stringify({ name, color: color || COLORS[0] }) });
  if(!res.ok){ showToast(res.error || 'Could not create that deck.', 'error'); return null; }
  _decks.push(res.deck);
  return res.deck;
}
/** Optimistic + background sync — callers don't need to await this. */
function renameDeck(id, name, color){
  const d = getDeck(id); if(!d) return;
  if((name || '').trim()) d.name = name.trim();
  if(color) d.color = color;
  _syncInBackground(apiFetch(`/decks/${id}`, { method:'PATCH', body: JSON.stringify({ name: d.name, color: d.color }) }));
}
/** Awaited by callers — they show the new deck's name right away. */
async function duplicateDeck(id){
  const res = await apiFetch(`/decks/${id}/duplicate`, { method:'POST' });
  if(!res.ok){ showToast(res.error || 'Could not duplicate that deck.', 'error'); return null; }
  _decks.push(res.deck);
  return res.deck;
}
function deleteDeck(id){
  _decks = _decks.filter(d => d.id !== id);
  _syncInBackground(apiFetch(`/decks/${id}`, { method:'DELETE' }));
}
/** Awaited by callers — the new card needs its real id before the modal closes. */
async function addCard(deckId, term, def){
  term = (term || '').trim(); def = (def || '').trim();
  if(!term || !def) return null;
  const res = await apiFetch(`/decks/${deckId}/cards`, { method:'POST', body: JSON.stringify({ term, def }) });
  if(!res.ok){ showToast(res.error || 'Could not add that card.', 'error'); return null; }
  const d = getDeck(deckId); if(d) d.cards.push(res.card);
  return res.card;
}
function updateCard(deckId, cardId, term, def){
  const d = getDeck(deckId); const c = d && d.cards.find(c => c.id === cardId); if(!c) return;
  term = (term || '').trim(); def = (def || '').trim();
  if(term) c.term = term;
  if(def) c.def = def;
  _syncInBackground(apiFetch(`/decks/${deckId}/cards/${cardId}`, { method:'PATCH', body: JSON.stringify({ term: c.term, def: c.def }) }));
}
function deleteCard(deckId, cardId){
  const d = getDeck(deckId); if(!d) return;
  d.cards = d.cards.filter(c => c.id !== cardId);
  _syncInBackground(apiFetch(`/decks/${deckId}/cards/${cardId}`, { method:'DELETE' }));
}
function moveCard(fromDeckId, cardId, toDeckId){
  const from = getDeck(fromDeckId), to = getDeck(toDeckId);
  if(!from || !to || fromDeckId === toDeckId) return false;
  const idx = from.cards.findIndex(c => c.id === cardId);
  if(idx === -1) return false;
  const [card] = from.cards.splice(idx, 1);
  to.cards.push(card);
  _syncInBackground(apiFetch(`/decks/${fromDeckId}/cards/${cardId}/move`, { method:'PATCH', body: JSON.stringify({ toDeckId }) }));
  return true;
}
function setCardLearned(deckId, cardId, learned){
  const d = getDeck(deckId); const c = d && d.cards.find(c => c.id === cardId); if(!c) return;
  c.learned = !!learned;
  _syncInBackground(apiFetch(`/decks/${deckId}/cards/${cardId}`, { method:'PATCH', body: JSON.stringify({ learned: c.learned }) }));
}
function touchDeckStudied(deckId){
  const d = getDeck(deckId); if(!d) return;
  d.lastStudied = Date.now();
  _syncInBackground(apiFetch(`/decks/${deckId}/studied`, { method:'PATCH' }));
}

/* ---------------- Progress & study-session helpers (read the cache, unchanged) ---------------- */
function allCardsFlat(){ return userDecks().flatMap(d => d.cards.map(c => ({...c, deckId: d.id}))); }
function progressStats(){
  const all = allCardsFlat();
  const learned = all.filter(c => c.learned).length;
  return {total: all.length, learned, toStudy: all.length - learned};
}
function formatLastStudied(ts){
  if(!ts) return 'Not studied yet';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if(mins < 1) return 'Studied just now';
  if(mins < 60) return `Studied ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if(hrs < 24) return `Studied ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if(days === 1) return 'Studied yesterday';
  if(days < 7) return `Studied ${days}d ago`;
  return 'Studied ' + new Date(ts).toLocaleDateString();
}
function saveStudyPosition(deckId, idx){ SETTINGS.positions[deckId] = idx; saveSettings(); }
function loadStudyPosition(deckId){ return SETTINGS.positions[deckId] || 0; }

/* ---------------- Share a deck as plain text ---------------- */
function shareDeckText(deck){
  const lines = [`FlipStudy deck: ${deck.name} (${deck.cards.length} card${deck.cards.length === 1 ? '' : 's'})`, ''];
  deck.cards.slice(0, 25).forEach(c => lines.push(`• ${c.term} — ${c.def}`));
  if(deck.cards.length > 25) lines.push(`…and ${deck.cards.length - 25} more.`);
  return lines.join('\n');
}
async function shareDeck(deckId){
  const d = getDeck(deckId); if(!d) return;
  if(!d.cards.length){ showToast('Add some cards before sharing this deck.', 'error'); return; }
  const text = shareDeckText(d);
  try{
    if(navigator.share){ await navigator.share({title: 'FlipStudy deck: ' + d.name, text}); return; }
    await navigator.clipboard.writeText(text);
    showToast('Deck copied to clipboard — paste it anywhere!', 'success');
  }catch(e){
    showToast('Could not share automatically — select and copy the deck manually.', 'error');
  }
}

/* ---------------- Small shared UI helpers ---------------- */
function esc(s){ return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function shuffle(arr){ return [...arr].sort(() => Math.random() - 0.5); }

function initNav(activePage){
  document.querySelectorAll('.navlink[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === activePage));
  const burger = document.getElementById('hamburgerBtn');
  const links = document.getElementById('navLinks');
  if(burger) burger.onclick = () => links.classList.toggle('open');
  if(links) links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn) logoutBtn.onclick = () => confirmAction('Log out of FlipStudy?', logoutUser, 'Log Out');
  wireThemeAndSoundButtons();
}
function wireThemeAndSoundButtons(){
  const themeBtn = document.getElementById('themeToggleBtn');
  if(themeBtn) themeBtn.onclick = toggleTheme;
  const soundBtn = document.getElementById('soundToggleBtn');
  if(soundBtn) soundBtn.onclick = toggleSound;
  applyTheme();
  applySoundIcon();
}

/* ---------------- Theme (light / dark / system) ---------------- */
function effectiveTheme(){
  if(SETTINGS.theme === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return SETTINGS.theme;
}
function applyTheme(){
  const eff = effectiveTheme();
  document.documentElement.setAttribute('data-theme', eff);
  document.querySelectorAll('.theme-toggle-btn').forEach(b => b.innerHTML = eff === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>');
}
function setTheme(mode){ SETTINGS.theme = mode; saveSettings(); applyTheme(); }
function toggleTheme(){ SETTINGS.theme = effectiveTheme() === 'dark' ? 'light' : 'dark'; saveSettings(); applyTheme(); }
applyTheme();
if(window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if(SETTINGS.theme === 'system') applyTheme(); });

/* ---------------- Sound on/off ---------------- */
function soundEnabled(){ return SETTINGS.sound !== false; }
function toggleSound(){ SETTINGS.sound = !soundEnabled(); saveSettings(); applySoundIcon(); }
function applySoundIcon(){ document.querySelectorAll('.sound-toggle-btn').forEach(b => b.innerHTML = soundEnabled() ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute"></i>'); }

/* ---------------- Shared "create / edit deck" modal ---------------- */
let _deckModalEditId = null;
let _deckModalOnSaved = null;
function ensureDeckModal(){
  if(document.getElementById('sharedDeckModalOverlay')) return;
  const div = document.createElement('div');
  div.id = 'sharedDeckModalOverlay';
  div.className = 'modal-overlay';
  div.innerHTML = `
    <div class="modal">
      <h3 id="sharedDeckModalTitle">Create New Deck</h3>
      <div class="field"><input id="sharedDeckNameInput" placeholder="Deck name"></div>
      <label style="font-size:12.5px;font-weight:600;color:var(--muted);">Choose Color</label>
      <div class="color-grid" id="sharedColorGrid"></div>
      <div class="modal-actions">
        <button class="btn-secondary" id="sharedDeckCancel">Cancel</button>
        <button class="btn-primary" id="sharedDeckSave"><i class="fas fa-plus"></i> Save</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  document.getElementById('sharedDeckCancel').onclick = () => div.classList.remove('open');
  document.getElementById('sharedDeckSave').onclick = _saveSharedDeckModal;
  document.getElementById('sharedDeckNameInput').addEventListener('keydown', e => { if(e.key === 'Enter') _saveSharedDeckModal(); });
}
function _buildSharedColorGrid(sel){
  document.getElementById('sharedColorGrid').innerHTML = COLORS.map(c =>
    `<div class="color-swatch ${c === sel ? 'selected' : ''}" style="background:${c}" data-c="${c}" onclick="document.querySelectorAll('#sharedColorGrid .color-swatch').forEach(s=>s.classList.remove('selected')); this.classList.add('selected');"></div>`).join('');
}
function openDeckFormModal(editId, onSaved){
  ensureDeckModal();
  _deckModalEditId = editId || null;
  _deckModalOnSaved = onSaved || null;
  const d = editId ? getDeck(editId) : null;
  document.getElementById('sharedDeckModalTitle').textContent = editId ? 'Edit Deck' : 'Create New Deck';
  const nameInput = document.getElementById('sharedDeckNameInput');
  nameInput.value = d ? d.name : '';
  nameInput.classList.remove('input-error');
  document.getElementById('sharedDeckSave').innerHTML = editId ? '<i class="fas fa-pen"></i> Save' : '<i class="fas fa-plus"></i> Save';
  _buildSharedColorGrid(d ? d.color : COLORS[0]);
  document.getElementById('sharedDeckModalOverlay').classList.add('open');
  nameInput.focus();
}
function _saveSharedDeckModal(){
  const nameInput = document.getElementById('sharedDeckNameInput');
  const name = nameInput.value.trim();
  if(!name){ shakeField(nameInput); showToast('Please enter a deck name.', 'error'); return; }
  const colorEl = document.querySelector('#sharedColorGrid .color-swatch.selected');
  const color = colorEl ? colorEl.dataset.c : COLORS[0];
  const btn = document.getElementById('sharedDeckSave');
  withSaving(btn, 'Saving...', async () => {
    if(_deckModalEditId){ renameDeck(_deckModalEditId, name, color); showToast('Deck updated!', 'success'); }
    else { const created = await createDeck(name, color); if(!created) return; showToast('Deck created!', 'success'); }
    document.getElementById('sharedDeckModalOverlay').classList.remove('open');
    if(_deckModalOnSaved) _deckModalOnSaved();
  });
}

/* ---------------- Shared "move card to another deck" modal ---------------- */
function ensureMoveModal(){
  if(document.getElementById('sharedMoveModalOverlay')) return;
  const div = document.createElement('div');
  div.id = 'sharedMoveModalOverlay';
  div.className = 'modal-overlay';
  div.innerHTML = `
    <div class="modal">
      <h3><i class="fas fa-arrows-alt"></i> Move Card</h3>
      <div id="sharedMoveList"></div>
      <div class="modal-actions"><button class="btn-secondary" id="sharedMoveCancel">Cancel</button></div>
    </div>`;
  document.body.appendChild(div);
  document.getElementById('sharedMoveCancel').onclick = () => div.classList.remove('open');
}
function openMoveCardModal(fromDeckId, cardId, onMoved){
  ensureMoveModal();
  const others = userDecks().filter(d => d.id !== fromDeckId);
  const list = document.getElementById('sharedMoveList');
  if(!others.length){
    list.innerHTML = '<div class="empty-note">Create another deck first to move cards into it.</div>';
  } else {
    list.innerHTML = others.map(d => `<button class="deck-pick-btn" data-id="${d.id}"><span class="dot" style="background:${d.color}"></span>${esc(d.name)}</button>`).join('');
    list.querySelectorAll('.deck-pick-btn').forEach(btn => {
      btn.onclick = () => {
        const ok = moveCard(fromDeckId, cardId, btn.dataset.id);
        document.getElementById('sharedMoveModalOverlay').classList.remove('open');
        if(ok){ showToast('Card moved!', 'success'); if(onMoved) onMoved(); }
      };
    });
  }
  document.getElementById('sharedMoveModalOverlay').classList.add('open');
}

/* ---------------- Toast notifications ---------------- */
function toastHost(){
  let host = document.getElementById('toastHost');
  if(!host){ host = document.createElement('div'); host.id = 'toastHost'; host.className = 'toast-host'; document.body.appendChild(host); }
  return host;
}
function showToast(msg, type){
  const host = toastHost();
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 2600);
}

/* ---------------- Custom confirm dialog ---------------- */
let _confirmYes = null;
function ensureConfirmModal(){
  if(document.getElementById('globalConfirmOverlay')) return;
  const div = document.createElement('div');
  div.id = 'globalConfirmOverlay';
  div.className = 'modal-overlay confirm-overlay';
  div.innerHTML = `
    <div class="modal confirm-modal">
      <div class="confirm-icon"><i class="fas fa-triangle-exclamation"></i></div>
      <p id="globalConfirmMsg" class="confirm-msg"></p>
      <div class="modal-actions">
        <button class="btn-secondary" id="globalConfirmCancel">Cancel</button>
        <button class="btn-primary danger-btn" id="globalConfirmYes">Yes, Continue</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  document.getElementById('globalConfirmCancel').onclick = closeConfirm;
  document.getElementById('globalConfirmYes').onclick = () => { const fn = _confirmYes; closeConfirm(); if(fn) fn(); };
}
function closeConfirm(){ const el = document.getElementById('globalConfirmOverlay'); if(el) el.classList.remove('open'); _confirmYes = null; }
function confirmAction(message, onYes, yesLabel){
  ensureConfirmModal();
  document.getElementById('globalConfirmMsg').textContent = message;
  document.getElementById('globalConfirmYes').textContent = yesLabel || 'Yes, Continue';
  _confirmYes = onYes;
  document.getElementById('globalConfirmOverlay').classList.add('open');
}

/* ---------------- Shake + success-check micro-animations ---------------- */
function shakeField(el){ if(!el) return; el.classList.add('input-error', 'shake'); setTimeout(() => el.classList.remove('shake'), 400); }
function flashSuccess(afterEl){
  if(!afterEl) return;
  const mark = document.createElement('span');
  mark.className = 'success-check';
  mark.innerHTML = '<i class="fas fa-check"></i>';
  afterEl.insertAdjacentElement('afterend', mark);
  requestAnimationFrame(() => mark.classList.add('show'));
  setTimeout(() => mark.remove(), 1300);
}
/** Briefly puts a button into a spinning "saving…" state, then runs fn (sync or async). */
function withSaving(btn, label, fn){
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> ${label}`;
  setTimeout(async () => {
    await fn();
    btn.disabled = false;
    btn.innerHTML = original;
    flashSuccess(btn);
  }, 320);
}

/* ---------------- Subtle sound cues (Web Audio — no sound files needed) ---------------- */
let _actx = null;
function playTone(kind){
  if(!soundEnabled()) return;
  try{
    _actx = _actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = _actx.createOscillator(), g = _actx.createGain();
    o.connect(g); g.connect(_actx.destination);
    const now = _actx.currentTime;
    if(kind === 'correct'){ o.frequency.setValueAtTime(660, now); o.frequency.exponentialRampToValueAtTime(990, now + 0.12); }
    else if(kind === 'wrong'){ o.frequency.setValueAtTime(220, now); o.frequency.exponentialRampToValueAtTime(140, now + 0.18); }
    else if(kind === 'flip'){ o.frequency.setValueAtTime(400, now); o.frequency.exponentialRampToValueAtTime(300, now + 0.08); }
    else { o.frequency.setValueAtTime(523, now); o.frequency.exponentialRampToValueAtTime(784, now + 0.2); }
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    o.start(now); o.stop(now + 0.24);
  }catch(e){ /* Web Audio unavailable — sound is a nice-to-have, fail silently */ }
}

/* ---------------------------------------------------------------------
   DATA SCHEMA (stored on the server)
   users: { [username]: { email, passwordHash, joined, tokenVersion } }
   decks: { [username]: [ { id, name, color, lastStudied, cards:[
              { id, term, def, learned } ] } ] }
   The client session is a signed token kept in localStorage.
   --------------------------------------------------------------------- */

/* ---------------- Global keyboard & click behavior shared by every page ---------------- */
document.addEventListener('keydown', e => {
  if(e.key !== 'Escape') return;
  document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.deck-popover.open').forEach(p => p.classList.remove('open'));
  const links = document.getElementById('navLinks');
  if(links) links.classList.remove('open');
});
document.addEventListener('click', e => {
  if(e.target.classList && e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});
