import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const PATCH_VERSION = '20260809-66';
const STORAGE_EMPRESA_KEY = 'excellence-apontamento-empresa-id';
let perfilAtual = null;
let empresasCache = [];
let allowOriginalApontamentoOpen = false;
let cardsScreenOpen = false;

function escapeHTML(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isAdmin() {
  return perfilAtual?.tipo === 'admin';
}

function navButton() {
  return document.querySelector('[data-apontamento-standalone-nav]');
}

function markApontamentoActive() {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  navButton()?.classList.add('active');
}

function injectStyles() {
  if (document.getElementById('apontamento-nav-cards-entry-v66-styles')) return;
  const style = document.createElement('style');
  style.id = 'apontamento-nav-cards-entry-v66-styles';
  style.textContent = `
    .apt-entry-page { display:grid; gap:18px; }
    .apt-entry-hero {
      border:1px solid var(--line,#d8e5ea);
      border-radius:24px;
      padding:20px;
      background:linear-gradient(135deg,#073F5A 0%,#0b5678 54%,#0a3348 100%);
      color:#fff;
      box-shadow:0 22px 50px rgba(5,36,55,.16);
    }
    .apt-entry-hero h2 { margin:4px 0 8px; color:#fff; }
    .apt-entry-hero p { margin:0; color:rgba(255,255,255,.84); max-width:980px; }
    .apt-entry-toolbar { display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap; margin-top:16px; }
    .apt-entry-toolbar input { min-width:min(100%,390px); background:#fff; border:0; border-radius:14px; padding:12px 14px; }
    .apt-entry-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(245px,1fr)); gap:14px; }
    .apt-entry-company-card {
      border:1px solid var(--line,#d8e5ea);
      border-radius:22px;
      background:#fff;
      padding:16px;
      box-shadow:0 16px 34px rgba(5,36,55,.07);
      display:grid;
      gap:12px;
      text-align:left;
      cursor:pointer;
      transition:.18s ease;
      min-height:172px;
    }
    .apt-entry-company-card:hover { transform:translateY(-2px); border-color:rgba(214,168,66,.65); box-shadow:0 22px 42px rgba(5,36,55,.11); }
    .apt-entry-company-card h3 { margin:0; color:var(--primary-dark,#073F5A); }
    .apt-entry-company-card p { margin:0; color:var(--muted,#607788); }
    .apt-entry-company-top, .apt-entry-company-foot { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; }
    .apt-entry-company-icon { width:44px; height:44px; border-radius:16px; display:grid; place-items:center; background:rgba(7,63,90,.09); color:var(--primary-dark,#073F5A); font-weight:900; }
    .apt-entry-pill { display:inline-flex; align-items:center; border-radius:999px; padding:5px 9px; background:rgba(7,63,90,.08); color:var(--primary-dark,#073F5A); font-weight:900; font-size:12px; white-space:nowrap; }
    .apt-entry-pill.gold { background:rgba(214,168,66,.16); color:#8a6415; }
    @media (max-width:720px) { .apt-entry-hero { border-radius:18px; padding:16px; } .apt-entry-grid { grid-template-columns:1fr; } }
  `;
  document.head.appendChild(style);
}

async function loadEmpresas() {
  if (!perfilAtual) return [];
  if (!isAdmin()) {
    const empresaId = perfilAtual.empresaId || '';
    if (!empresaId) return [];
    const snap = await getDoc(doc(db, 'empresas', empresaId));
    empresasCache = snap.exists() ? [{ id: snap.id, ...snap.data() }] : [];
    return empresasCache;
  }

  const snap = await getDocs(collection(db, 'empresas'));
  empresasCache = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
  return empresasCache;
}

function renderShell(content) {
  const main = document.querySelector('.main');
  if (!main) return false;
  cardsScreenOpen = true;
  markApontamentoActive();
  main.innerHTML = `
    <header class="topbar">
      <div>
        <button class="btn btn-soft mobile-menu" id="mobileMenuBtn" type="button">☰ Menu</button>
        <h1>Apontamento</h1>
        <p>Escolha a empresa antes de abrir produção, equipe, minutos e horas trabalhadas.</p>
      </div>
    </header>
    ${content}
  `;
  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
  return true;
}

function companyCardHTML(empresa = {}) {
  const initials = String(empresa.nome || 'E').trim().slice(0, 2).toUpperCase();
  const detail = [
    empresa.cnpj ? `CNPJ: ${empresa.cnpj}` : '',
    empresa.responsavel ? `Resp.: ${empresa.responsavel}` : ''
  ].filter(Boolean).join(' • ');

  return `
    <button class="apt-entry-company-card" type="button" data-apt-entry-company="${escapeHTML(empresa.id)}" data-company-name="${escapeHTML(String(empresa.nome || '').toLowerCase())}">
      <div class="apt-entry-company-top">
        <span class="apt-entry-company-icon">${escapeHTML(initials)}</span>
        <span class="apt-entry-pill gold">Abrir</span>
      </div>
      <div>
        <h3>${escapeHTML(empresa.nome || 'Empresa sem nome')}</h3>
        <p>${escapeHTML(detail || 'Selecionar empresa para abrir o apontamento')}</p>
      </div>
      <div class="apt-entry-company-foot">
        <span class="apt-entry-pill">Apontamento</span>
        <small class="muted">Produtos • equipe • horas</small>
      </div>
    </button>
  `;
}

async function renderCompanySelector() {
  injectStyles();
  try { localStorage.removeItem(STORAGE_EMPRESA_KEY); } catch (_) {}
  renderShell('<section class="apt-entry-page"><div class="apt-empty">Carregando empresas...</div></section>');

  try {
    const empresas = await loadEmpresas();
    renderShell(`
      <section class="apt-entry-page">
        <section class="apt-entry-hero">
          <span class="kicker">Seleção por empresa</span>
          <h2>Escolha a empresa do apontamento</h2>
          <p>O apontamento não abre mais direto na última empresa usada. Primeiro você escolhe a empresa em cards, e só depois entram os produtos, funcionários e lançamentos dela.</p>
          <div class="apt-entry-toolbar">
            <input type="search" data-apt-entry-search placeholder="Pesquisar empresa..." />
            <span class="apt-entry-pill gold">${empresas.length} empresa(s)</span>
          </div>
        </section>
        ${empresas.length ? `<section class="apt-entry-grid">${empresas.map(companyCardHTML).join('')}</section>` : '<div class="apt-empty">Nenhuma empresa disponível para apontamento.</div>'}
      </section>
    `);
    bindSelectorEvents();
  } catch (error) {
    console.error('Erro ao abrir seleção de apontamento:', error);
    renderShell(`<section class="apt-entry-page"><div class="notice error">Não foi possível carregar as empresas. ${escapeHTML(error?.message || '')}</div></section>`);
  }
}

function bindSelectorEvents() {
  document.querySelector('[data-apt-entry-search]')?.addEventListener('input', event => {
    const term = String(event.target.value || '').trim().toLowerCase();
    document.querySelectorAll('[data-apt-entry-company]').forEach(card => {
      const name = card.getAttribute('data-company-name') || '';
      card.style.display = !term || name.includes(term) ? '' : 'none';
    });
  });

  document.querySelectorAll('[data-apt-entry-company]').forEach(card => {
    card.addEventListener('click', () => openOriginalApontamento(card.dataset.aptEntryCompany));
  });
}

function openOriginalApontamento(empresaId) {
  if (!empresaId) return;
  try { localStorage.setItem(STORAGE_EMPRESA_KEY, empresaId); } catch (_) {}
  cardsScreenOpen = false;
  allowOriginalApontamentoOpen = true;

  const nav = navButton();
  if (nav) nav.click();

  const syncSelect = () => {
    const select = document.querySelector('[data-apt-empresa-select]');
    if (select && select.value !== empresaId) {
      select.value = empresaId;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const bar = document.querySelector('.apontamento-empresa-bar');
    if (bar && !bar.querySelector('[data-apt-entry-back]')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-soft';
      btn.dataset.aptEntryBack = 'true';
      btn.textContent = 'Mudar empresa';
      btn.addEventListener('click', renderCompanySelector);
      bar.prepend(btn);
    }
  };

  setTimeout(syncSelect, 250);
  setTimeout(syncSelect, 700);
  setTimeout(syncSelect, 1200);
}

function tagStandaloneNav() {
  const nav = navButton();
  if (nav) {
    nav.setAttribute('data-apontamento-entry-guard', PATCH_VERSION);
  }
}

document.addEventListener('click', event => {
  const nav = event.target.closest?.('[data-apontamento-standalone-nav]');
  if (!nav) return;

  if (allowOriginalApontamentoOpen) {
    allowOriginalApontamentoOpen = false;
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  document.getElementById('sidebar')?.classList.remove('open');
  renderCompanySelector();
}, true);

const observer = new MutationObserver(() => {
  tagStandaloneNav();
  if (cardsScreenOpen) markApontamentoActive();
});
observer.observe(document.body, { childList: true, subtree: true });

onAuthStateChanged(auth, async user => {
  perfilAtual = null;
  empresasCache = [];
  if (!user) return;
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    perfilAtual = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.warn('Perfil indisponível para entrada do apontamento:', error);
  }
  tagStandaloneNav();
});

window.addEventListener('load', tagStandaloneNav);
console.info(`Excellence System® entrada por cards do apontamento ${PATCH_VERSION} carregada.`);
