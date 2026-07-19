import './styles.css';
import { healthScore, localInsights, money, monthKey, summarize } from './lib/finance.js';
import { parseCsv, transactionsToCsv } from './lib/csv.js';
import { mergeCloudTransactions } from './lib/sync.js';
import {
  cloudConfigured,
  deleteAllCloudData,
  deleteCloudTransaction,
  getSession,
  loadCloudData,
  saveCloudBudget,
  saveCloudTransaction,
  saveManyCloudTransactions,
  sendMagicLink,
  signOut,
  supabase,
} from './lib/cloud.js';

const STORAGE_KEY = 'prosperia:v3';
const MAX_CSV_BYTES = 2 * 1024 * 1024;
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');
const today = new Date().toISOString().slice(0, 10);
const currentMonth = monthKey();
const dateInCurrentMonth = (day) => `${currentMonth}-${String(day).padStart(2, '0')}`;

const sampleTransactions = [
  ['income', 780, 2, 'Ventas del lunes', 'Ventas', false],
  ['expense', 265, 3, 'Fruta y materia prima', 'Insumos', false],
  ['income', 1120, 6, 'Pedidos de la semana', 'Pedidos', false],
  ['expense', 190, 7, 'Gas del negocio', 'Servicios', false],
  ['expense', 320, 9, 'Compra para la casa', 'Gasto personal', true],
  ['income', 940, 12, 'Ventas del fin de semana', 'Ventas', false],
].map(([type, amount, day, description, category, personal], index) => ({
  id: `demo-${index + 1}`,
  type, amount, date: dateInCurrentMonth(day), description, category, personal,
  notes: '', created_at: new Date().toISOString(),
}));

const stored = readStored();
const state = {
  view: 'home',
  selectedMonth: stored.selectedMonth || currentMonth,
  transactions: stored.transactions?.length ? stored.transactions : sampleTransactions,
  budget: Number(stored.budget || 0),
  demo: stored.demo ?? !stored.transactions?.length,
  filter: 'all',
  search: '',
  editingId: null,
  session: null,
  aiText: '',
};

const viewTitles = {
  home: ['Inicio', 'Así va tu negocio, explicado de forma sencilla'],
  movements: ['Movimientos', 'Todo el dinero que entró y salió'],
  analysis: ['Análisis', 'Pistas claras para tomar mejores decisiones'],
  settings: ['Tu cuenta', 'Tus datos, respaldo y preferencias'],
};

const app = document.querySelector('#app');
let modalReturnFocus = null;
app.innerHTML = shell();
bindEvents();
render();
initializeCloud();

function readStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    transactions: state.transactions,
    budget: state.budget,
    demo: state.demo,
    selectedMonth: state.selectedMonth,
  }));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function shell() {
  const navigation = `
    <button class="nav-button active" data-view="home" aria-current="page"><span class="nav-icon" aria-hidden="true">⌂</span>Inicio</button>
    <button class="nav-button" data-view="movements"><span class="nav-icon" aria-hidden="true">☷</span>Movimientos</button>
    <button class="nav-button" data-view="analysis"><span class="nav-icon" aria-hidden="true">◔</span>Análisis</button>
    <button class="nav-button" data-view="settings"><span class="nav-icon" aria-hidden="true">⚙</span>Tu cuenta</button>`;

  return `
    <a class="skip-link" href="#content">Saltar al contenido</a>
    <div class="app-shell">
      <aside class="sidebar" aria-label="Navegación principal">
        <div class="brand"><div class="brand-mark" aria-hidden="true">🌱</div><div><strong>Prospería</strong><small>Tu dinero, sin enredos</small></div></div>
        <nav class="side-nav">${navigation}</nav>
        <div class="side-bottom">
          <div class="sync-badge"><span class="sync-dot" id="sync-dot"></span><span id="sync-label">Guardado en este dispositivo</span></div>
          <button class="button secondary small" id="account-button">Entrar o crear cuenta</button>
        </div>
      </aside>

      <main class="main" id="content" tabindex="-1">
        <header class="topbar">
          <div><p class="eyebrow" id="page-eyebrow">Tu resumen</p><h1 id="page-title">Inicio</h1></div>
          <div class="top-actions">
            <label class="sr-only" for="month-picker">Mes que quieres revisar</label>
            <input class="month-input" id="month-picker" type="month" value="${state.selectedMonth}" />
            <button class="button primary" data-add="income"><span aria-hidden="true">＋</span> <b>Registrar</b></button>
          </div>
        </header>
        <section class="view active" id="view-home"></section>
        <section class="view" id="view-movements"></section>
        <section class="view" id="view-analysis"></section>
        <section class="view" id="view-settings"></section>
      </main>

      <nav class="mobile-nav" aria-label="Navegación móvil">${navigation}</nav>
    </div>

    <div class="modal-backdrop" id="transaction-modal" hidden>
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="transaction-title">
        <header class="modal-header"><h2 id="transaction-title">Registrar movimiento</h2><button class="icon-button" data-close="transaction-modal" aria-label="Cerrar">✕</button></header>
        <form class="modal-body" id="transaction-form">
          <div class="form-grid">
            <div class="type-switch" role="group" aria-label="Tipo de movimiento">
              <button type="button" class="type-option active" data-type="income" aria-pressed="true">↓ Dinero que entró</button>
              <button type="button" class="type-option" data-type="expense" aria-pressed="false">↑ Dinero que salió</button>
            </div>
            <input type="hidden" name="type" value="income" />
            <div class="field"><label for="tx-amount">¿Cuánto fue?</label><input id="tx-amount" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Ejemplo: 250" required /></div>
            <div class="field"><label for="tx-date">¿Qué día?</label><input id="tx-date" name="date" type="date" required /></div>
            <div class="field full"><label for="tx-description">¿Qué fue?</label><input id="tx-description" name="description" maxlength="100" placeholder="Ejemplo: Ventas del día" required /><small>Escribe algo que puedas reconocer después.</small></div>
            <div class="field"><label for="tx-category">¿De qué tipo?</label><select id="tx-category" name="category"></select></div>
            <div class="field"><label for="tx-notes">Nota opcional</label><input id="tx-notes" name="notes" maxlength="180" placeholder="Ejemplo: Mercado del centro" /></div>
            <label class="checkbox field full" id="personal-field"><input name="personal" type="checkbox" /><span><strong>Fue un gasto para mi casa o familia</strong><br><small>Prospería lo separará del negocio.</small></span></label>
          </div>
          <div class="modal-actions"><button type="button" class="button secondary" data-close="transaction-modal">Cancelar</button><button class="button primary" type="submit">Guardar movimiento</button></div>
        </form>
      </section>
    </div>

    <div class="modal-backdrop" id="auth-modal" hidden>
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <header class="modal-header"><h2 id="auth-title">Guarda tus datos en la nube</h2><button class="icon-button" data-close="auth-modal" aria-label="Cerrar">✕</button></header>
        <div class="modal-body">
          <p>Escribe tu correo. Te enviaremos un enlace para entrar, sin contraseñas que recordar.</p>
          <form id="auth-form" class="field">
            <label for="auth-email">Tu correo electrónico</label>
            <input id="auth-email" name="email" type="email" autocomplete="email" placeholder="nombre@correo.com" required />
            <button class="button primary block" type="submit">Enviarme el enlace</button>
          </form>
          <p class="notice" id="auth-help">Tus registros seguirán disponibles en este dispositivo aunque no crees una cuenta.</p>
        </div>
      </section>
    </div>

    <input class="sr-only" id="csv-input" type="file" accept=".csv,text/csv" />
    <div class="toast" id="toast" role="status" aria-live="polite"></div>`;
}

function bindEvents() {
  document.addEventListener('click', async (event) => {
    const nav = event.target.closest('[data-view]');
    if (nav) return changeView(nav.dataset.view);
    const add = event.target.closest('[data-add]');
    if (add) return openTransaction(add.dataset.add);
    const close = event.target.closest('[data-close]');
    if (close) return closeModal(close.dataset.close);
    const type = event.target.closest('[data-type]');
    if (type) return selectTransactionType(type.dataset.type);
    const edit = event.target.closest('[data-edit]');
    if (edit) return openTransaction(null, state.transactions.find((item) => item.id === edit.dataset.edit));
    const remove = event.target.closest('[data-delete]');
    if (remove) return removeTransaction(remove.dataset.delete);
    const filter = event.target.closest('[data-filter]');
    if (filter) { state.filter = filter.dataset.filter; renderMovements(); return; }
    if (event.target.closest('#account-button') || event.target.closest('#settings-account')) return handleAccount();
    if (event.target.closest('#start-real')) return startRealData();
    if (event.target.closest('#export-csv')) return exportCsv();
    if (event.target.closest('#import-csv')) return document.querySelector('#csv-input').click();
    if (event.target.closest('#ai-analysis')) return requestAiAnalysis();
    if (event.target.closest('#clear-data')) return clearAllData();
  });

  document.querySelector('#month-picker').addEventListener('change', (event) => {
    state.selectedMonth = event.target.value || currentMonth; persist(); render();
  });
  document.querySelector('#transaction-form').addEventListener('submit', saveTransaction);
  document.querySelector('#auth-form').addEventListener('submit', requestLogin);
  document.querySelector('#csv-input').addEventListener('change', importCsv);
  document.addEventListener('input', (event) => {
    if (event.target.id === 'movement-search') { state.search = event.target.value; renderMovements(); }
  });
  document.addEventListener('change', async (event) => {
    if (event.target.id === 'monthly-budget') {
      state.budget = Math.max(0, Number(event.target.value || 0)); persist();
      if (state.session) await saveCloudBudget(state.budget, state.session.user.id).catch(showError);
      toast('Límite mensual guardado'); render();
    }
  });
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeModal(backdrop.id);
  }));
  document.addEventListener('keydown', (event) => {
    const modal = [...document.querySelectorAll('.modal-backdrop:not([hidden])')].at(-1);
    if (!modal) return;
    if (event.key === 'Escape') return closeModal(modal.id);
    if (event.key === 'Tab') trapModalFocus(event, modal);
  });
}

function changeView(view) {
  state.view = view;
  document.querySelectorAll('[data-view]').forEach((button) => {
    const selected = button.dataset.view === view;
    button.classList.toggle('active', selected);
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.querySelectorAll('.view').forEach((section) => section.classList.toggle('active', section.id === `view-${view}`));
  const [title, subtitle] = viewTitles[view];
  document.querySelector('#page-title').textContent = title;
  document.querySelector('#page-eyebrow').textContent = subtitle;
  render();
  document.querySelector('#content').focus({ preventScroll: true });
}

function render() {
  updateSyncStatus();
  renderHome();
  renderMovements();
  renderAnalysis();
  renderSettings();
}

function currentSummary() { return summarize(state.transactions, state.selectedMonth); }

function renderHome() {
  const summary = currentSummary();
  const insights = localInsights(summary, state.budget);
  document.querySelector('#view-home').innerHTML = `
    ${state.demo ? `<div class="demo-banner"><p><strong>Estos son datos de ejemplo.</strong> Puedes probar todo sin miedo.</p><button class="button secondary small" id="start-real">Empezar con mis datos</button></div>` : ''}
    <div class="quick-actions">
      <button class="quick-action income" data-add="income"><span aria-hidden="true">↓</span>Registrar una venta</button>
      <button class="quick-action expense" data-add="expense"><span aria-hidden="true">↑</span>Registrar un gasto</button>
    </div>
    <div class="metrics" aria-label="Resumen del mes">
      ${metricCard('Dinero que entró', summary.income, `${summary.incomeCount} ${summary.incomeCount === 1 ? 'entrada' : 'entradas'}`, 'income')}
      ${metricCard('Dinero que salió', summary.expense, `${summary.expenseCount} ${summary.expenseCount === 1 ? 'gasto' : 'gastos'}`, 'expense')}
      ${metricCard('Lo que te quedó', summary.balance, summary.balance >= 0 ? 'Después de todos tus gastos' : 'Faltó dinero este mes', 'balance')}
    </div>
    <div class="dashboard-grid">
      <article class="panel">
        <div class="panel-header"><div><h2>En qué se fue el dinero</h2><p>Tus gastos más grandes</p></div></div>
        ${categoryBars(summary.categories)}
      </article>
      <article class="panel">
        <div class="panel-header"><div><h2>Lo que necesitas saber</h2><p>Sin palabras complicadas</p></div></div>
        <div class="insights">${insights.map(insightHtml).join('')}</div>
      </article>
      <article class="panel full">
        <div class="panel-header"><div><h2>Últimos movimientos</h2><p>Lo más reciente que registraste</p></div><button class="button secondary small" data-view="movements">Ver todos</button></div>
        ${transactionList(summary.selected.slice().sort(sortTransactions).slice(0, 6))}
      </article>
    </div>`;
}

function metricCard(label, value, help, type) {
  const tone = type === 'balance' ? (value >= 0 ? 'positive' : 'negative') : type === 'expense' ? 'negative' : 'positive';
  return `<article class="metric-card ${type}"><p class="metric-label">${label}</p><p class="money-value ${tone}">${money(value)}</p><p class="metric-help">${help}</p></article>`;
}

function categoryBars(categories) {
  const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!sorted.length) return emptyHtml('Todavía no hay gastos', 'Cuando registres uno, aquí verás en qué se fue el dinero.');
  const maximum = sorted[0][1];
  return `<div class="bars">${sorted.map(([name, value]) => `
    <div><div class="bar-top"><span class="bar-label">${escapeHtml(name)}</span><strong>${money(value)}</strong></div>
    <div class="bar-track" role="img" aria-label="${escapeHtml(name)}: ${money(value)}"><div class="bar-fill" style="width:${Math.max(4, (value / maximum) * 100)}%"></div></div></div>`).join('')}</div>`;
}

function insightHtml(insight) {
  return `<div class="insight ${insight.tone}"><div class="insight-icon" aria-hidden="true">${insight.icon}</div><div><h3>${escapeHtml(insight.title)}</h3><p>${escapeHtml(insight.text)}</p></div></div>`;
}

function renderMovements() {
  const container = document.querySelector('#view-movements');
  const query = state.search.trim().toLowerCase();
  const list = state.transactions.filter((item) => {
    const matchesMonth = !state.selectedMonth || item.date.slice(0, 7) === state.selectedMonth;
    const matchesFilter = state.filter === 'all'
      || (state.filter === 'income' && item.type === 'income')
      || (state.filter === 'expense' && item.type === 'expense' && !item.personal)
      || (state.filter === 'personal' && item.personal);
    const text = `${item.description} ${item.category} ${item.notes || ''}`.toLowerCase();
    return matchesMonth && matchesFilter && (!query || text.includes(query));
  }).sort(sortTransactions);

  container.innerHTML = `<article class="panel">
    <div class="panel-header"><div><h2>Busca o revisa un movimiento</h2><p>Puedes corregirlo o borrarlo cuando quieras.</p></div></div>
    <div class="toolbar"><label class="sr-only" for="movement-search">Buscar movimientos</label><input class="search" id="movement-search" type="search" value="${escapeHtml(state.search)}" placeholder="Buscar, por ejemplo: gas o ventas" />
      <div class="filter-pills" role="group" aria-label="Filtrar movimientos">
        ${filterButton('all', 'Todos')}${filterButton('income', 'Entradas')}${filterButton('expense', 'Gastos')}${filterButton('personal', 'Casa')}</div></div>
    ${transactionList(list, true)}
  </article>`;
}

function filterButton(value, label) {
  const selected = state.filter === value;
  return `<button class="pill ${selected ? 'active' : ''}" data-filter="${value}" aria-pressed="${selected}">${label}</button>`;
}

function transactionList(list, actions = false) {
  if (!list.length) return emptyHtml('No encontramos movimientos', 'Prueba otro filtro o registra uno nuevo.');
  return `<div class="transaction-list">${list.map((item) => transactionHtml(item, actions)).join('')}</div>`;
}

function transactionHtml(item, actions) {
  const date = new Date(`${item.date}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  return `<div class="transaction ${item.type}">
    <div class="tx-icon" aria-hidden="true">${item.type === 'income' ? '↓' : item.personal ? '⌂' : '↑'}</div>
    <div><div class="tx-name">${escapeHtml(item.description)}</div><div class="tx-meta">${escapeHtml(item.category)} · ${date}${item.personal ? ' · Casa' : ''}</div></div>
    <div class="tx-amount ${item.type === 'income' ? 'positive' : 'negative'}">${item.type === 'income' ? '+' : '−'}${money(item.amount)}</div>
    ${actions ? `<div class="tx-actions"><button data-edit="${item.id}" aria-label="Editar ${escapeHtml(item.description)}">Editar</button><button data-delete="${item.id}" aria-label="Borrar ${escapeHtml(item.description)}">Borrar</button></div>` : ''}
  </div>`;
}

function sortTransactions(a, b) { return b.date.localeCompare(a.date) || String(b.created_at).localeCompare(String(a.created_at)); }

function renderAnalysis() {
  const summary = currentSummary();
  const score = healthScore(summary, state.budget);
  const insights = localInsights(summary, state.budget);
  document.querySelector('#view-analysis').innerHTML = `<div class="analysis-grid">
    <article class="panel"><div class="panel-header"><div><h2>Salud de tu negocio</h2><p>Una orientación, no una calificación.</p></div></div>
      <div class="score-wrap"><div class="score" style="--score:${score}" role="img" aria-label="Salud financiera: ${score} de 100"><strong>${score}</strong></div>
      <div><h3>${score >= 75 ? 'Vas por buen camino' : score >= 45 ? 'Hay cosas que puedes mejorar' : summary.selected.length ? 'Necesita atención' : 'Faltan datos'}</h3><p>${score ? 'Mejora al conservar ganancias y separar los gastos de casa.' : 'Registra entradas y gastos para obtener una orientación.'}</p></div></div>
    </article>
    <article class="panel"><div class="panel-header"><div><h2>Las cuentas claras</h2><p>El negocio separado de la casa.</p></div></div>
      <div class="plain-stats">
        ${plainStat('Entró al negocio', money(summary.income))}
        ${plainStat('Gastos del negocio', money(summary.businessExpense))}
        ${plainStat('Gastos de casa mezclados', money(summary.personal))}
        ${plainStat('Ganancia del negocio', money(summary.businessBalance), summary.businessBalance >= 0 ? 'positive' : 'negative')}
      </div>
    </article>
    <article class="panel full"><div class="panel-header"><div><h2>Próximos pasos</h2><p>Acciones pequeñas y concretas.</p></div><button class="button soft small" id="ai-analysis">✨ Mejorar con IA</button></div>
      <div class="insights">${insights.map(insightHtml).join('')}${state.aiText ? insightHtml({ tone: 'good', icon: '✨', title: 'Sugerencia de Prospería IA', text: state.aiText }) : ''}</div>
    </article>
  </div>`;
}

function plainStat(label, value, tone = '') { return `<div class="plain-stat"><span>${label}</span><strong class="${tone}">${value}</strong></div>`; }

function renderSettings() {
  const accountText = state.session ? `Conectado como ${escapeHtml(state.session.user.email)}` : cloudConfigured ? 'Tus datos están guardados solo en este dispositivo.' : 'Falta conectar las variables públicas de Supabase.';
  document.querySelector('#view-settings').innerHTML = `<div class="settings-grid">
    <article class="panel"><div class="panel-header"><div><h2>Tu cuenta y respaldo</h2><p>${accountText}</p></div></div>
      <div class="notice">${state.session ? 'Tus cambios se sincronizan para que puedas abrir Prospería en otro teléfono o computadora.' : 'Puedes usar Prospería sin cuenta. Crear una cuenta sirve para recuperar tus datos y usar más de un dispositivo.'}</div>
      <div class="settings-actions"><button class="button primary" id="settings-account">${state.session ? 'Cerrar sesión' : 'Entrar con mi correo'}</button></div>
    </article>
    <article class="panel"><div class="panel-header"><div><h2>Mi límite de gastos</h2><p>Una guía sencilla para el mes.</p></div></div>
      <div class="field"><label for="monthly-budget">Quiero gastar como máximo</label><input id="monthly-budget" type="number" min="0" step="100" value="${state.budget || ''}" placeholder="Ejemplo: 5000" /><small>Si lo rebasas, te avisaremos. Puedes dejarlo vacío.</small></div>
    </article>
    <article class="panel"><div class="panel-header"><div><h2>Lleva tus datos contigo</h2><p>Descarga o importa una hoja CSV.</p></div></div>
      <div class="settings-actions"><button class="button secondary" id="export-csv">Descargar mis movimientos</button><button class="button secondary" id="import-csv">Importar CSV</button></div>
    </article>
    <article class="panel"><div class="panel-header"><div><h2>Privacidad y control</h2><p>Tú decides qué conservar.</p></div></div>
      <p>Prospería no vende tus datos. La IA recibe únicamente un resumen financiero, no tu correo ni tus notas completas.</p>
      ${state.session ? '<p class="settings-help">Al borrar tus datos se eliminan tus movimientos y preferencias. Tu acceso por correo seguirá disponible.</p>' : ''}
      <div class="settings-actions"><button class="button danger" id="clear-data">${state.session ? 'Borrar todos mis datos' : 'Borrar datos de este dispositivo'}</button></div>
    </article>
  </div>`;
}

function emptyHtml(title, text) { return `<div class="empty"><strong>${title}</strong>${text}</div>`; }

function openTransaction(type = 'income', item = null) {
  state.editingId = item?.id || null;
  const form = document.querySelector('#transaction-form');
  form.reset();
  form.elements.date.value = item?.date || today;
  form.elements.amount.value = item?.amount || '';
  form.elements.description.value = item?.description || '';
  form.elements.notes.value = item?.notes || '';
  form.elements.personal.checked = Boolean(item?.personal);
  selectTransactionType(item?.type || type || 'income', item?.category);
  document.querySelector('#transaction-title').textContent = item ? 'Corregir movimiento' : 'Registrar movimiento';
  openModal('transaction-modal');
  setTimeout(() => form.elements.amount.focus(), 50);
}

function selectTransactionType(type, selectedCategory = '') {
  const form = document.querySelector('#transaction-form');
  form.elements.type.value = type;
  document.querySelectorAll('.type-option').forEach((button) => {
    const selected = button.dataset.type === type;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const categories = type === 'income'
    ? ['Ventas', 'Servicios', 'Pedidos', 'Otro ingreso']
    : ['Insumos', 'Servicios', 'Transporte', 'Renta', 'Equipo', 'Gasto personal', 'Otro gasto'];
  form.elements.category.innerHTML = categories.map((category) => `<option ${category === selectedCategory ? 'selected' : ''}>${category}</option>`).join('');
  document.querySelector('#personal-field').hidden = type !== 'expense';
  if (type === 'income') form.elements.personal.checked = false;
}

async function saveTransaction(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const existing = state.transactions.find((item) => item.id === state.editingId);
  const item = {
    id: existing?.id || crypto.randomUUID(),
    type: form.get('type'),
    amount: Number(form.get('amount')),
    date: form.get('date'),
    description: String(form.get('description')).trim(),
    category: String(form.get('category')),
    personal: form.get('type') === 'expense' && form.get('personal') === 'on',
    notes: String(form.get('notes') || '').trim(),
    created_at: existing?.created_at || new Date().toISOString(),
  };
  if (!item.amount || item.amount <= 0 || !item.date || !item.description) return toast('Revisa el monto, la fecha y qué fue.');
  const position = state.transactions.findIndex((transaction) => transaction.id === item.id);
  if (position >= 0) state.transactions[position] = item; else state.transactions.unshift(item);
  state.demo = false; persist(); closeModal('transaction-modal'); render();
  toast(existing ? 'Movimiento corregido' : 'Movimiento guardado');
  if (state.session) saveCloudTransaction(item, state.session.user.id).catch(showError);
}

async function removeTransaction(id) {
  const item = state.transactions.find((transaction) => transaction.id === id);
  if (!item || !window.confirm(`¿Borrar “${item.description}”? Esta acción no se puede deshacer.`)) return;
  state.transactions = state.transactions.filter((transaction) => transaction.id !== id);
  persist(); render(); toast('Movimiento borrado');
  if (state.session) deleteCloudTransaction(id, state.session.user.id).catch(showError);
}

function startRealData() {
  if (!window.confirm('Quitaremos los ejemplos para que empieces con tus propios datos.')) return;
  state.transactions = state.transactions.filter((item) => !String(item.id).startsWith('demo-'));
  state.demo = false; persist(); render(); openTransaction('income');
}

function openModal(id) {
  const modal = document.querySelector(`#${id}`);
  if (!modal) return;
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const modal = document.querySelector(`#${id}`);
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  const returnFocus = modalReturnFocus;
  modalReturnFocus = null;
  if (returnFocus?.isConnected) setTimeout(() => returnFocus.focus(), 0);
}

function trapModalFocus(event, modal) {
  const focusable = [...modal.querySelectorAll(FOCUSABLE_SELECTOR)]
    .filter((element) => element.getClientRects().length > 0);
  if (!focusable.length) return event.preventDefault();

  const first = focusable[0];
  const last = focusable.at(-1);
  const focusIsInside = modal.contains(document.activeElement);
  if (event.shiftKey && (!focusIsInside || document.activeElement === first)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!focusIsInside || document.activeElement === last)) {
    event.preventDefault();
    first.focus();
  }
}

async function handleAccount() {
  if (state.session) {
    if (!window.confirm('¿Quieres cerrar sesión? Tus datos guardados en este dispositivo no se borrarán.')) return;
    await signOut(); state.session = null; render(); toast('Sesión cerrada'); return;
  }
  if (!cloudConfigured) {
    changeView('settings');
    return toast('Primero conecta las variables públicas de Supabase.');
  }
  openModal('auth-modal');
  setTimeout(() => document.querySelector('#auth-email').focus(), 50);
}

async function requestLogin(event) {
  event.preventDefault();
  const email = new FormData(event.currentTarget).get('email');
  try {
    await sendMagicLink(email);
    document.querySelector('#auth-help').textContent = 'Listo. Revisa tu correo y abre el enlace para entrar.';
    toast('Te enviamos un enlace por correo');
  } catch (error) { showError(error); }
}

async function initializeCloud() {
  if (!cloudConfigured) return updateSyncStatus();
  state.session = await getSession().catch(() => null);
  if (state.session) await syncFromCloud();
  supabase.auth.onAuthStateChange((_event, session) => {
    const changed = session?.user?.id !== state.session?.user?.id;
    state.session = session;
    if (session && changed) {
      setTimeout(() => syncFromCloud().finally(render), 0);
    } else {
      render();
    }
  });
  render();
}

async function syncFromCloud() {
  try {
    const userId = state.session.user.id;
    const remote = await loadCloudData(userId);
    const localReal = state.transactions.filter((item) => !String(item.id).startsWith('demo-'));
    const { merged, pendingUpload } = mergeCloudTransactions(localReal, remote.transactions);
    if (pendingUpload.length) await saveManyCloudTransactions(pendingUpload, userId);
    state.transactions = merged;
    state.budget = remote.budget || state.budget;
    state.demo = false; persist(); toast('Tus datos ya están sincronizados');
  } catch (error) { showError(error); }
}

function updateSyncStatus() {
  const dot = document.querySelector('#sync-dot');
  const label = document.querySelector('#sync-label');
  const button = document.querySelector('#account-button');
  dot.classList.toggle('online', Boolean(state.session));
  label.textContent = state.session ? 'Guardado y sincronizado' : 'Guardado en este dispositivo';
  button.textContent = state.session ? 'Cerrar sesión' : 'Entrar o crear cuenta';
}

function exportCsv() {
  const blob = new Blob([`\ufeff${transactionsToCsv(state.transactions)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `prosperia-movimientos-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
  URL.revokeObjectURL(url); toast('Archivo descargado');
}

async function importCsv(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > MAX_CSV_BYTES) return toast('El archivo es demasiado grande. Usa un CSV menor de 2 MB.');
  try {
    const imported = parseCsv(await file.text());
    if (!imported.length) return toast('No encontramos movimientos válidos en ese archivo.');
    state.transactions = [...imported, ...state.transactions.filter((item) => !String(item.id).startsWith('demo-'))];
    state.demo = false; persist(); render(); toast(`${imported.length} movimientos importados`);
    if (state.session) await saveManyCloudTransactions(imported, state.session.user.id);
  } catch (error) { showError(error); }
}

async function requestAiAnalysis() {
  const button = document.querySelector('#ai-analysis');
  if (button) { button.disabled = true; button.textContent = 'Analizando…'; }
  try {
    const summary = currentSummary();
    const headers = { 'content-type': 'application/json' };
    if (state.session?.access_token) headers.authorization = `Bearer ${state.session.access_token}`;
    const response = await fetch('/api/analyze', {
      method: 'POST', headers,
      body: JSON.stringify({
        month: state.selectedMonth,
        income: summary.income,
        expense: summary.expense,
        businessExpense: summary.businessExpense,
        personal: summary.personal,
        balance: summary.balance,
        categories: summary.categories,
        transactionCount: summary.selected.length,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo completar el análisis.');
    state.aiText = result.advice; renderAnalysis(); toast(result.ai ? 'Análisis mejorado con IA' : 'Mostramos una recomendación sin IA');
  } catch {
    const fallback = localInsights(currentSummary(), state.budget)[0];
    state.aiText = `${fallback.title}. ${fallback.text}`; renderAnalysis();
    toast('La IA no está disponible; usamos el análisis local.');
  }
}

async function clearAllData() {
  const message = state.session
    ? '¿Borrar definitivamente todos tus movimientos, tanto de la nube como de este dispositivo? Esta acción no se puede deshacer.'
    : '¿Borrar todos los movimientos y preferencias de este dispositivo? Esta acción no se puede deshacer.';
  if (!window.confirm(message)) return;
  try {
    if (state.session) await deleteAllCloudData(state.session.user.id);
    localStorage.removeItem(STORAGE_KEY); state.transactions = []; state.budget = 0; state.demo = false; render(); toast('Datos borrados');
  } catch (error) { showError(error); }
}

let toastTimer;
function toast(message, { error = false } = {}) {
  const element = document.querySelector('#toast');
  element.setAttribute('role', error ? 'alert' : 'status');
  element.setAttribute('aria-live', error ? 'assertive' : 'polite');
  element.textContent = message; element.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), error ? 6000 : 3200);
}
function showError(error) { console.error(error); toast(error?.message || 'Algo salió mal. Inténtalo de nuevo.', { error: true }); }
