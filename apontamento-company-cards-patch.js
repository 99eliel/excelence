import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const PATCH_VERSION = '20260809-65';
const STORAGE_EMPRESA_KEY = 'excellence-apontamento-empresa-id';
let perfilAtual = null;
let empresasCache = [];
let bypassOriginalClick = false;
let cardsOpen = false;

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

function injectStyles() {
  if (document.getElementById('apontamento-company-cards-v65-styles')) return;
  const style = document.createElement('style');
  style.id = 'apontamento-company-cards-v65-styles';
  style.textContent = `
    .apt-card-select-page { display:grid; gap:18px; }
    .apt-card-select-hero {
      border:1px solid var(--line,#d8e5ea);
      border-radius:24px;
      padding:20px;
      background:linear-gradient(135deg,#073F5A 0%,#0b5678 54%,#0a3348 100%);
      color:#fff;
      box-shadow:0 22px 50px rgba(5,36,55,.16);
    }
    .apt-card-select-hero h2 { margin:4px 0 8px; color:#fff; }
    .apt-card-select-hero p { margin:0; color:rgba(255,255,255,.84); max-width:980px; }
    .apt-card-select-toolbar { display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap; margin-top:16px; }
    .apt-card-select-toolbar input { min-width:min(100%,380px); background:#fff; border:0; border-radius:14px; padding:12px 14px; }
    .apt-company-card-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(245px,1fr)); gap:14px; }
    .apt-company-square {
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
    .apt-company-square:hover { transform:translateY(-2px); border-color:rgba(214,168,66,.65); box-shadow:0 22px 42px rgba(5,36,55,.11); }
    .apt-company-square h3 { margin:0; color:var(--primary-dark,#073F5A); }
    .apt-company-square p { margin:0; color:var(--muted,#607788); }
    .apt-company-square-top, .apt-company-square-foot { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; }
    .apt-company-square-icon { width:44px; height:44px; border-radius:16px; display:grid; place-items:center; background:rgba(7,63,90,.09); color:var(--primary-dark,#073F5A); font-weight:900; }
    .apt-card-pill { display:inline-flex; align-items:center; border-radius:999px; padding:5px 9px; background:rgba(7,63,90,.08); color:var(--primary-dark,#073F5A); font-weight:900; font-size:12px; white-space:nowrap; }
    .apt-card-pill.gold { background:rgba(214,168,66,.16); color:#8a6415; }
    .apontamento-empresa-bar.cards-refined { align-items:center; }
    .apontamento-empresa-bar.cards-refined .form-group { display:none !important; }
    @media (max-width:720px) { .apt-card-select-hero { border-radius:18px; padding:16px; } .apt-company-card-grid { grid-template-columns:1fr; } }
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

function setApontamentoActive() {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('[data-apontamento-nav]')?.classList.add('active');
}

function ensureMobileMenu() {
  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
}

function mainShell(content) {
  const main = document.querySelector('.main');
  if (!main) return false;
  setApontamentoActive();
  main.innerHTML = `
    <header class="topbar">
      <div>
        <button class="btn btn-soft mobile-menu" id="mobileMenuBtn" type="button">☰ Menu</button>
        <h1>Apontamento</h1>
        <p>Selecione a empresa antes de abrir produtos, funcionários, produção e horas trabalhadas.</p>
      </div>
    </header>
    ${content}
  `;
  ensureMobileMenu();
  return true;
}

function companyCardHTML(empresa = {}) {
  const initials = String(empresa.nome || 'E').trim().slice(0, 2).toUpperCase();
  const detalhe = [
    empresa.cnpj ? `CNPJ: ${empresa.cnpj}` : '',
    empresa.responsavel ? `Resp.: ${empresa.responsavel}` : ''
  ].filter(Boolean).join(' • ');

  return `
    <button class="apt-company-square" type="button" data-apt-card-open="${escapeHTML(empresa.id)}" data-company-name="${escapeHTML(String(empresa.nome || '').toLowerCase())}">
      <div class="apt-company-square-top">
        <span class="apt-company-square-icon">${escapeHTML(initials)}</span>
        <span class="apt-card-pill gold">Abrir</span>
      </div>
      <div>
        <h3>${escapeHTML(empresa.nome || 'Empresa sem nome')}</h3>
        <p>${escapeHTML(detalhe || 'Selecionar empresa para abrir apontamento')}</p>
      </div>
      <div class="apt-company-square-foot">
        <span class="apt-card-pill">Apontamento</span>
        <small class="muted">Produtos • equipe • horas</small>
      </div>
    </button>
  `;
}

async function renderCompanyCards() {
  cardsOpen = true;
  injectStyles();
  mainShell('<section class="apt-card-select-page"><div class="apt-empty">Carregando empresas...</div></section>');

  try {
    const empresas = await loadEmpresas();
    const html = `
      <section class="apt-card-select-page">
        <section class="apt-card-select-hero">
          <span class="kicker">Seleção por empresa</span>
          <h2>Escolha a empresa do apontamento</h2>
          <p>Agora o apontamento abre primeiro como cartões de empresas, igual a aba Empresas. Depois que você escolher uma empresa, entram os produtos, funcionários, minutos e produção dela.</p>
          <div class="apt-card-select-toolbar">
            <input type="search" data-apt-card-search placeholder="Pesquisar empresa..." />
            <span class="apt-card-pill gold">${empresas.length} empresa(s)</span>
          </div>
        </section>
        ${empresas.length ? `<section class="apt-company-card-grid">${empresas.map(companyCardHTML).join('')}</section>` : '<div class="apt-empty">Nenhuma empresa disponível para apontamento.</div>'}
      </section>
    `;
    mainShell(html);
    bindCards();
  } catch (error) {
    console.error('Erro ao carregar empresas para apontamento:', error);
    mainShell(`<section class="apt-card-select-page"><div class="notice error">Não foi possível carregar as empresas. ${escapeHTML(error?.message || '')}</div></section>`);
  }
}

function bindCards() {
  document.querySelector('[data-apt-card-search]')?.addEventListener('input', event => {
    const term = String(event.target.value || '').trim().toLowerCase();
    document.querySelectorAll('[data-apt-card-open]').forEach(card => {
      const name = card.getAttribute('data-company-name') || '';
      card.style.display = !term || name.includes(term) ? '' : 'none';
    });
  });

  document.querySelectorAll('[data-apt-card-open]').forEach(card => {
    card.addEventListener('click', () => openEmpresaWithOriginalApontamento(card.dataset.aptCardOpen));
  });
}

function openEmpresaWithOriginalApontamento(empresaId) {
  if (!empresaId) return;
  try { localStorage.setItem(STORAGE_EMPRESA_KEY, empresaId); } catch (_) {}
  cardsOpen = false;
  bypassOriginalClick = true;

  const nav = document.querySelector('[data-apontamento-nav]');
  if (nav) nav.click();

  setTimeout(() => {
    const select = document.querySelector('[data-apt-empresa-select]');
    if (select && select.value !== empresaId) {
      select.value = empresaId;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    refineOriginalApontamento(empresaId);
  }, 350);

  setTimeout(() => refineOriginalApontamento(empresaId), 900);
}

function refineOriginalApontamento(empresaId = '') {
  const bar = document.querySelector('.apontamento-empresa-bar');
  if (!bar) return;
  injectStyles();
  bar.classList.add('cards-refined');

  if (!bar.querySelector('[data-apt-card-change-company]')) {
    const empresa = empresasCache.find(e => e.id === empresaId) || empresasCache.find(e => e.id === localStorage.getItem(STORAGE_EMPRESA_KEY));
    const label = document.createElement('span');
    label.className = 'apt-card-pill gold';
    label.textContent = empresa?.nome ? `Empresa: ${empresa.nome}` : 'Empresa selecionada';
    const changeBtn = document.createElement('button');
    changeBtn.className = 'btn btn-soft';
    changeBtn.type = 'button';
    changeBtn.setAttribute('data-apt-card-change-company', 'true');
    changeBtn.textContent = 'Escolher outra empresa';
    changeBtn.addEventListener('click', renderCompanyCards);
    bar.prepend(changeBtn);
    bar.prepend(label);
  }
}

document.addEventListener('click', event => {
  const nav = event.target.closest('[data-apontamento-nav]');
  if (!nav) return;

  if (bypassOriginalClick) {
    bypassOriginalClick = false;
    setTimeout(refineOriginalApontamento, 500);
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  renderCompanyCards();
}, true);

const observer = new MutationObserver(() => {
  if (cardsOpen) setApontamentoActive();
  refineOriginalApontamento();
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
    console.warn('Perfil indisponível para seleção de apontamento:', error);
  }
});

console.info(`Excellence System® seleção de empresa do apontamento ${PATCH_VERSION} carregada.`);
