let currentUser = null;
let ownedCardIds = new Set();
let shopCards = [];

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Não foi possível concluir a operação.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function showAuth(mode = 'login') {
  document.getElementById('loginScreen')?.classList.toggle('active', mode === 'login');
  document.getElementById('registerScreen')?.classList.toggle('active', mode === 'register');
  document.getElementById('menu')?.classList.toggle('active', false);
}

function showMenu() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('menu')?.classList.add('active');
  updateAccountUI();
}

function updateAccountUI() {
  const name = document.getElementById('accountName');
  const credits = document.getElementById('accountCredits');
  if (name) name.textContent = currentUser ? currentUser.username : '';
  if (credits) credits.textContent = currentUser ? `${currentUser.credits} CRÉDITOS` : '';
  const myName = document.getElementById('myName');
  if (myName && currentUser) myName.textContent = currentUser.username.toUpperCase();
}

async function refreshAccount() {
  const data = await api('/api/me');
  currentUser = data.user;
  ownedCardIds = new Set(data.ownedCardIds.map(Number));
  updateAccountUI();
  return data;
}

async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.email.value;
  const password = form.password.value;
  try {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    currentUser = data.user;
    await refreshAccount();
    form.reset();
    showMenu();
  } catch (error) {
    if (error.status === 401) alert('email ou senha inválidos');
    else alert(error.message);
  }
}

async function register(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.username.value.trim();
  const email = form.email.value;
  const password = form.password.value;
  const confirm = form.confirmPassword.value;
  if (password !== confirm) {
    alert('As senhas não coincidem.');
    return;
  }
  try {
    const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) });
    currentUser = data.user;
    await refreshAccount();
    form.reset();
    showMenu();
  } catch (error) {
    alert(error.message);
  }
}

async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) {}
  currentUser = null;
  ownedCardIds = new Set();
  shopCards = [];
  showAuth('login');
}

function cardPrice(card) {
  const atk = Number(card.atk || 0);
  if (atk >= 2000 && atk < 3000) return 200;
  if (atk >= 3000 && atk < 4000) return 300;
  if (atk >= 4000 && atk < 5000) return 400;
  if (atk >= 5000 && atk < 6000) return 500;
  if (atk >= 6000) return 600;
  return null;
}

async function showShop() {
  if (!currentUser) { showAuth('login'); return; }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('deckScreen')?.classList.add('active');
  try {
    const data = await api('/api/cards');
    shopCards = data.cards;
    renderShop();
  } catch (error) {
    alert(error.message);
  }
}

function renderShop() {
  const grid = document.getElementById('deckGrid');
  const count = document.getElementById('cardCount');
  const search = document.getElementById('search');
  if (!grid) return;
  const q = (search?.value || '').toLowerCase().trim();
  const filtered = shopCards.filter(c => c.name.toLowerCase().includes(q));
  if (count) count.textContent = `${ownedCardIds.size}/${shopCards.length} CARTAS • ${currentUser?.credits ?? 0} CRÉDITOS`;
  grid.innerHTML = filtered.map(card => {
    const price = cardPrice(card);
    const owned = ownedCardIds.has(Number(card.id));
    let action = '';
    if (owned) action = '<span class="shop-owned">✓ JÁ POSSUI</span>';
    else if (price === null) action = '<span class="shop-locked">INDISPONÍVEL</span>';
    else if ((currentUser?.credits || 0) < price) action = '<span class="shop-insufficient">créditos insuficientes</span>';
    else action = `<button class="shop-buy" onclick="event.stopPropagation(); purchaseCard(${Number(card.id)})">COMPRAR • ${price} CR</button>`;
    return `<div class="card-preview full-card-preview shop-card ${owned ? 'owned' : ''}" data-card-id="${Number(card.id)}" onclick="selectShopCard(${Number(card.id)})">
      ${cardVisual(card)}
      <div class="shop-overlay">${action}</div>
    </div>`;
  }).join('');
}

function selectShopCard(cardId) {
  const card = shopCards.find(c => Number(c.id) === Number(cardId));
  if (!card || ownedCardIds.has(Number(card.id))) return;
  const price = cardPrice(card);
  if (price === null) return;
  const cardEl = [...document.querySelectorAll('.shop-card')].find(el => el.querySelector('.shop-buy')?.getAttribute('onclick')?.includes(String(cardId)) || el.dataset.cardId === String(cardId));
  if ((currentUser?.credits || 0) < price) {
    if (cardEl) cardEl.classList.add('insufficient-pulse');
    return;
  }
  if (cardEl) cardEl.classList.add('selected-to-buy');
}

async function purchaseCard(cardId) {
  try {
    const data = await api('/api/cards/purchase', { method: 'POST', body: JSON.stringify({ cardId }) });
    currentUser.credits = data.credits;
    ownedCardIds.add(Number(cardId));
    updateAccountUI();
    renderShop();
  } catch (error) {
    if (error.status === 400 && error.data?.error === 'créditos insuficientes') {
      alert('créditos insuficientes');
      renderShop();
    } else {
      alert(error.message);
    }
  }
}

async function recordMatch(result) {
  if (!currentUser || !state || state.matchSaved) return;
  state.matchSaved = true;
  try {
    const data = await api('/api/matches', { method: 'POST', body: JSON.stringify({ difficulty: selectedDiff, result }) });
    currentUser = data.user;
    updateAccountUI();
    if (result === 'win') log(`Vitória! +${data.reward} créditos.`);
  } catch (error) {
    console.error('Erro ao salvar histórico:', error);
  }
}

async function showHistory() {
  if (!currentUser) return showAuth('login');
  const panel = document.getElementById('historyPanel');
  const list = document.getElementById('historyList');
  try {
    const data = await api('/api/history');
    list.innerHTML = data.history.length ? data.history.map(item => {
      const labels = { easy: 'Fácil', normal: 'Normal', hard: 'Difícil', expert: 'Mestre' };
      const result = item.result === 'win' ? 'VITÓRIA' : 'DERROTA';
      const sign = item.creditsChange > 0 ? `+${item.creditsChange}` : '0';
      return `<div class="history-row"><b>${result}</b><span>${labels[item.difficulty] || item.difficulty}</span><strong>${sign} CR</strong><small>${new Date(item.playedAt.replace(' ', 'T') + 'Z').toLocaleString('pt-BR')}</small></div>`;
    }).join('') : '<p>Nenhuma partida registrada ainda.</p>';
    panel.classList.add('open');
  } catch (error) { alert(error.message); }
}

function closeHistory() { document.getElementById('historyPanel')?.classList.remove('open'); }

window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('loginForm')?.addEventListener('submit', login);
  document.getElementById('registerForm')?.addEventListener('submit', register);
  try {
    await refreshAccount();
    showMenu();
  } catch (_) {
    showAuth('login');
  }
});
