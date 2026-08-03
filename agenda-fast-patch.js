import { functions } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";

const AGENDA_FAST_VERSION = '20260801-47';
const CACHE_PREFIX = 'excellence-agenda-cache';
const PRELOAD_KEY = 'excellence-agenda-preload-at';
const CACHE_TTL = 10 * 60 * 1000;
const PRELOAD_TTL = 5 * 60 * 1000;

let inFlight = null;
let currentDays = 30;

function escapeHTML(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function agendaCacheKey(days = 30) {
  return `${CACHE_PREFIX}:${Number(days) || 30}`;
}

function readAgendaCache(days = 30) {
  try {
    const raw = localStorage.getItem(agendaCacheKey(days));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.events)) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function saveAgendaCache(days = 30, data = {}) {
  try {
    const payload = {
      days: Number(days) || 30,
      events: Array.isArray(data.events) ? data.events : [],
      total: Number(data.total || data.events?.length || 0),
      updatedAt: data.updatedAt || new Date().toISOString(),
      savedAt: Date.now(),
      cacheSource: data.cacheSource || 'client'
    };
    localStorage.setItem(agendaCacheKey(days), JSON.stringify(payload));
    return payload;
  } catch (_) {
    return data;
  }
}

function isCacheFresh(cache) {
  return cache && cache.savedAt && (Date.now() - Number(cache.savedAt)) < CACHE_TTL;
}

function formatAgendaDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function agendaPeriodLabel(period = '30') {
  const labels = { '7': 'Próximos 7 dias', '30': 'Próximos 30 dias', '60': 'Próximos 60 dias' };
  return labels[String(period)] || 'Próximos compromissos';
}

function agendaEventHTML(event = {}) {
  const title = event.title || 'Compromisso sem título';
  const start = formatAgendaDateTime(event.start);
  const end = event.end ? formatAgendaDateTime(event.end) : '';
  const details = [event.location ? `Local: ${event.location}` : '', event.description ? event.description : ''].filter(Boolean);

  return `
    <article class="agenda-event-card">
      <div class="agenda-event-time">
        <strong>${escapeHTML(start)}</strong>
        ${end && end !== start ? `<span>até ${escapeHTML(end)}</span>` : ''}
      </div>
      <div class="agenda-event-body">
        <h3>${escapeHTML(title)}</h3>
        ${details.length ? `<p>${escapeHTML(details.join(' • '))}</p>` : '<p class="muted">Sem detalhes adicionais.</p>'}
      </div>
    </article>
  `;
}

function agendaListHTML(events = []) {
  if (!events.length) {
    return `<div class="empty-state-card"><h2>Nenhum compromisso encontrado</h2><p>A agenda está sendo carregada em segundo plano ou não há eventos no período selecionado.</p></div>`;
  }

  const grouped = new Map();
  events.forEach(event => {
    const key = event.dayLabel || new Date(event.start).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(event);
  });

  return `<div class="agenda-groups">${Array.from(grouped.entries()).map(([day, items]) => `
    <section class="agenda-day-group">
      <div class="agenda-day-header"><strong>${escapeHTML(day)}</strong><span>${items.length} ${items.length === 1 ? 'compromisso' : 'compromissos'}</span></div>
      <div class="agenda-events">${items.map(agendaEventHTML).join('')}</div>
    </section>
  `).join('')}</div>`;
}

function statusHTML(status = 'loading', cache = null, error = '') {
  if (error && status !== 'cached') return `<div class="notice error agenda-fast-status">${escapeHTML(error)}</div>`;
  if (status === 'live') return '<div class="notice success agenda-fast-status">Agenda atualizada agora.</div>';
  if (status === 'cached') {
    const label = cache?.updatedAt ? new Date(cache.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'cache local';
    return `<div class="notice agenda-fast-status">Mostrando agenda salva (${escapeHTML(label)}). Atualizando em segundo plano...</div>`;
  }
  return `<div class="notice agenda-fast-status">Carregando agenda em segundo plano. Na primeira vez pode demorar um pouco, mas a tela não fica travada.</div>`;
}

function updatedLabel(data) {
  if (!data?.updatedAt) return 'não atualizada';
  const date = new Date(data.updatedAt);
  if (Number.isNaN(date.getTime())) return 'não atualizada';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function ensureStyles() {
  if (document.getElementById('agendaFastStyles')) return;
  const style = document.createElement('style');
  style.id = 'agendaFastStyles';
  style.textContent = `
    .agenda-fast-status{margin:14px 0}
    .agenda-fast-loader{display:flex;align-items:center;gap:10px;color:var(--muted,#627986);font-weight:700;margin:10px 0 16px}
    .agenda-fast-loader span{width:12px;height:12px;border-radius:50%;background:var(--primary,#073f5a);animation:agendaPulse 1s infinite alternate}
    @keyframes agendaPulse{from{opacity:.25;transform:scale(.9)}to{opacity:1;transform:scale(1.15)}}
  `;
  document.head.appendChild(style);
}

function setAgendaNavActive() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === 'agenda');
  });
}

function renderAgendaFast(data = null, status = 'loading', error = '') {
  ensureStyles();
  setAgendaNavActive();

  const days = Number(data?.days || currentDays || 30);
  const main = document.querySelector('.main');
  if (!main) return false;

  const agenda = data || { events: [], days };
  const isLoading = status === 'loading' || status === 'cached';

  main.innerHTML = `
    <header class="topbar">
      <div>
        <button class="btn btn-soft mobile-menu" id="mobileMenuBtn" type="button">☰ Menu</button>
        <h1>Agenda</h1>
        <p>Compromissos da Márcia sincronizados com o Google Calendar. Acesso exclusivo da administração.</p>
      </div>
      <div class="topbar-actions"></div>
    </header>

    <section class="card agenda-panel">
      <div class="section-head">
        <div>
          <span class="kicker">Agenda da Márcia</span>
          <h2>${escapeHTML(agendaPeriodLabel(days))}</h2>
          <p>Última atualização: ${escapeHTML(updatedLabel(agenda))}. Use o botão atualizar após alterar compromissos no Google Calendar.</p>
        </div>
        <div class="actions agenda-filter-actions">
          <button class="btn btn-small ${days === 7 ? 'btn-primary' : 'btn-soft'}" type="button" data-agenda-fast-period="7">7 dias</button>
          <button class="btn btn-small ${days === 30 ? 'btn-primary' : 'btn-soft'}" type="button" data-agenda-fast-period="30">30 dias</button>
          <button class="btn btn-small ${days === 60 ? 'btn-primary' : 'btn-soft'}" type="button" data-agenda-fast-period="60">60 dias</button>
          <button class="btn btn-small btn-gold" type="button" data-agenda-fast-refresh>Atualizar agenda</button>
        </div>
      </div>

      ${statusHTML(status, agenda, error)}
      ${isLoading ? '<div class="agenda-fast-loader"><span></span>Sincronizando sem travar a tela...</div>' : ''}
      ${agendaListHTML(agenda.events || [])}
    </section>
  `;

  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  document.querySelectorAll('[data-agenda-fast-period]').forEach(btn => {
    btn.addEventListener('click', () => openAgendaFast(Number(btn.dataset.agendaFastPeriod || 30), { force: false }));
  });

  document.querySelector('[data-agenda-fast-refresh]')?.addEventListener('click', () => {
    openAgendaFast(days, { force: true });
  });

  return true;
}

async function fetchAgenda(days = 30, force = false) {
  const callable = httpsCallable(functions, 'getAgendaMarcia');
  const result = await callable({ days: Number(days) || 30, force: Boolean(force) });
  const data = result.data || { events: [], days: Number(days) || 30 };
  return saveAgendaCache(days, data);
}

async function openAgendaFast(days = 30, options = {}) {
  currentDays = Number(days) || 30;
  const cache = readAgendaCache(currentDays);
  const hasCache = cache && Array.isArray(cache.events);

  renderAgendaFast(hasCache ? cache : { events: [], days: currentDays }, hasCache ? 'cached' : 'loading');

  if (!options.force && isCacheFresh(cache)) {
    renderAgendaFast(cache, 'live');
    return;
  }

  try {
    if (!inFlight || options.force) inFlight = fetchAgenda(currentDays, options.force === true);
    const data = await inFlight;
    inFlight = null;
    renderAgendaFast(data, 'live');
  } catch (error) {
    inFlight = null;
    const cachedAgain = readAgendaCache(currentDays);
    const message = error?.message || 'Não foi possível atualizar a agenda agora.';
    renderAgendaFast(cachedAgain || { events: [], days: currentDays }, cachedAgain ? 'cached' : 'error', message);
  }
}

function shouldPreload() {
  try {
    const last = Number(sessionStorage.getItem(PRELOAD_KEY) || 0);
    return Date.now() - last > PRELOAD_TTL;
  } catch (_) {
    return true;
  }
}

function markPreload() {
  try { sessionStorage.setItem(PRELOAD_KEY, String(Date.now())); } catch (_) {}
}

async function preloadAgenda() {
  if (!document.querySelector('[data-page="agenda"]')) return;
  if (!shouldPreload()) return;
  const cached = readAgendaCache(30);
  if (isCacheFresh(cached)) return;
  markPreload();
  try { await fetchAgenda(30, false); } catch (_) {}
}

document.addEventListener('click', event => {
  const navAgenda = event.target.closest('[data-page="agenda"]');
  if (!navAgenda) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openAgendaFast(30, { force: false });
}, true);

const observer = new MutationObserver(() => setTimeout(preloadAgenda, 900));
observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener('load', () => setTimeout(preloadAgenda, 1500));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) setTimeout(preloadAgenda, 600);
});

console.info(`Excellence System® agenda rápida ${AGENDA_FAST_VERSION} carregada.`);
