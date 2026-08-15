import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { collection, doc, getDoc, getDocs, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const PATCH_VERSION = '20260815-71';

const AREAS = [
  { id: 'estrutura_iso', label: 'Estrutura ISO', hint: 'ISO completa, tópicos e respostas 4.1 / 4.2' },
  { id: 'ecossistema', label: 'Ecossistema da empresa', hint: 'Pastas, documentos e materiais da empresa' },
  { id: 'arquivos_recebidos', label: 'Arquivos recebidos', hint: 'Arquivos e anexos recebidos da consultoria' },
  { id: 'diario_bordo', label: 'Diário de bordo', hint: 'Horas contratadas, atividades e relatório de diário' },
  { id: 'apontamento', label: 'Apontamento', hint: 'Produção, processos, equipes, funcionários e relatórios' }
];

let perfilAtual = null;
let observerStarted = false;
let redirectDone = false;
let toastTimer = null;

function esc(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function texto(el) {
  return String(el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function lower(el) {
  return texto(el).toLowerCase();
}

function isAdmin() {
  return perfilAtual?.tipo === 'admin';
}

function isCliente() {
  return perfilAtual?.tipo === 'cliente';
}

function isRestrito() {
  return Array.isArray(perfilAtual?.permissoes);
}

function pode(area) {
  if (!area || area === 'quem_somos') return true;
  if (isAdmin()) return true;
  if (!isCliente()) return true;
  if (!isRestrito()) return true; // usuários antigos continuam com acesso completo até o admin configurar.
  return perfilAtual.permissoes.includes(area);
}

function areaDoBotao(btn) {
  const t = lower(btn);
  if (t.includes('estrutura')) return 'estrutura_iso';
  if (t.includes('ecossistema')) return 'ecossistema';
  if (t.includes('arquivos')) return 'arquivos_recebidos';
  if (t.includes('diário') || t.includes('diario')) return 'diario_bordo';
  if (t.includes('apontamento')) return 'apontamento';
  if (t.includes('quem somos')) return 'quem_somos';
  if (btn?.dataset?.permissoesNav) return 'permissoes_admin';
  return '';
}

function sidebarNav() {
  return document.querySelector('#sidebar nav, #sidebar .nav, .sidebar nav, .sidebar .nav, #sidebar');
}

function navButtons() {
  return Array.from(document.querySelectorAll('#sidebar .nav-btn, .sidebar .nav-btn'));
}

function toast(message) {
  clearTimeout(toastTimer);
  document.querySelector('[data-perm-toast]')?.remove();
  const box = document.createElement('div');
  box.dataset.permToast = 'true';
  box.textContent = message;
  box.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:99999;background:#073F5A;color:#fff;border-radius:14px;padding:12px 14px;font-weight:900;box-shadow:0 18px 42px rgba(5,36,55,.25);max-width:320px;';
  document.body.appendChild(box);
  toastTimer = setTimeout(() => box.remove(), 3200);
}

function injectStyles() {
  if (document.getElementById('user-permissions-v71-css')) return;
  const style = document.createElement('style');
  style.id = 'user-permissions-v71-css';
  style.textContent = `
    .perm-page { display:grid; gap:16px; }
    .perm-hero, .perm-card {
      border:1px solid var(--line,#d8e5ea);
      border-radius:22px;
      padding:16px;
      background:#fff;
      box-shadow:0 14px 32px rgba(5,36,55,.07);
    }
    .perm-hero {
      background:linear-gradient(135deg,#073F5A,#0b5678 55%,#082f43);
      color:#fff;
    }
    .perm-hero h2 { color:#fff; margin:4px 0 6px; }
    .perm-hero p { margin:0; color:rgba(255,255,255,.86); }
    .perm-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(295px,1fr)); gap:14px; }
    .perm-user-card { display:grid; gap:12px; }
    .perm-user-top { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
    .perm-user-top h3 { margin:0; color:var(--primary-dark,#073F5A); }
    .perm-muted { color:var(--muted,#607788); font-size:12px; }
    .perm-pill { display:inline-flex; align-items:center; border-radius:999px; padding:5px 9px; background:rgba(7,63,90,.08); color:#073F5A; font-weight:900; font-size:12px; }
    .perm-pill.gold { background:rgba(214,168,66,.16); color:#8a6415; }
    .perm-options { display:grid; gap:8px; }
    .perm-option {
      display:grid;
      grid-template-columns:auto 1fr;
      gap:9px;
      align-items:flex-start;
      border:1px solid var(--line,#d8e5ea);
      border-radius:14px;
      padding:9px;
      background:#fbfdfe;
    }
    .perm-option input { margin-top:3px; }
    .perm-option b { display:block; color:#073F5A; }
    .perm-actions { display:flex; flex-wrap:wrap; gap:8px; }
    .perm-toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
    .perm-toolbar input { min-width:min(100%,360px); border:0; border-radius:14px; padding:11px 13px; }
    .perm-empty { border:1px dashed var(--line,#d8e5ea); border-radius:16px; padding:18px; text-align:center; color:var(--muted,#607788); background:#fff; }
  `;
  document.head.appendChild(style);
}

async function carregarPerfil(user) {
  perfilAtual = null;
  if (!user) return;
  const snap = await getDoc(doc(db, 'usuarios', user.uid));
  perfilAtual = snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

function aplicarPermissoesMenu() {
  if (!perfilAtual) return;

  injectAdminNav();

  if (!isCliente()) return;

  navButtons().forEach(btn => {
    const area = areaDoBotao(btn);
    if (!area || area === 'quem_somos') return;
    const liberado = pode(area);
    btn.style.display = liberado ? '' : 'none';
    btn.setAttribute('data-perm-area', area);
  });

  redirecionarPrimeiraTelaPermitida();
}

function redirecionarPrimeiraTelaPermitida() {
  if (!isCliente() || !isRestrito() || redirectDone) return;
  const botoes = navButtons().filter(btn => {
    const area = areaDoBotao(btn);
    return area && area !== 'quem_somos' && pode(area) && btn.style.display !== 'none';
  });
  if (!botoes.length) return;
  const ativo = navButtons().find(btn => btn.classList.contains('active'));
  const areaAtiva = areaDoBotao(ativo);
  if (areaAtiva && pode(areaAtiva) && ativo?.style.display !== 'none') return;

  const preferido = botoes.find(btn => areaDoBotao(btn) === 'apontamento') || botoes[0];
  redirectDone = true;
  setTimeout(() => preferido.click(), 160);
}

function injectAdminNav() {
  if (!isAdmin()) return;
  if (document.querySelector('[data-permissoes-nav]')) return;
  const nav = sidebarNav();
  if (!nav) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-btn';
  btn.dataset.permissoesNav = 'true';
  btn.innerHTML = '<span class="nav-icon">🔐</span><span>Permissões</span>';

  const quemSomos = navButtons().find(b => lower(b).includes('quem somos'));
  if (quemSomos?.parentElement === nav) nav.insertBefore(btn, quemSomos);
  else nav.appendChild(btn);
}

function marcarNavPermissoesAtivo() {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('[data-permissoes-nav]')?.classList.add('active');
}

function shell(content) {
  injectStyles();
  const main = document.querySelector('.main');
  if (!main) return;
  marcarNavPermissoesAtivo();
  main.innerHTML = `
    <header class="topbar">
      <div>
        <button class="btn btn-soft mobile-menu" id="mobileMenuBtn" type="button">☰ Menu</button>
        <h1>Permissões</h1>
        <p>Escolha quais telas cada usuário da empresa pode acessar.</p>
      </div>
    </header>
    ${content}
  `;
  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
}

async function carregarEmpresasMap() {
  const map = new Map();
  try {
    const snap = await getDocs(collection(db, 'empresas'));
    snap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
  } catch (error) {
    console.warn('Não foi possível carregar empresas para permissões:', error);
  }
  return map;
}

function permissoesDoUsuario(usuario) {
  if (Array.isArray(usuario.permissoes)) return usuario.permissoes;
  return AREAS.map(a => a.id);
}

function usuarioCardHTML(usuario, empresasMap) {
  const isUserAdmin = usuario.tipo === 'admin';
  const permissoes = permissoesDoUsuario(usuario);
  const empresa = empresasMap.get(usuario.empresaId || '');
  const legacy = !Array.isArray(usuario.permissoes) && !isUserAdmin;

  return `
    <article class="perm-card perm-user-card" data-perm-user-card data-user-id="${esc(usuario.id)}" data-user-search="${esc(`${usuario.nome || ''} ${usuario.email || ''} ${empresa?.nome || ''}`.toLowerCase())}">
      <div class="perm-user-top">
        <div>
          <h3>${esc(usuario.nome || 'Usuário sem nome')}</h3>
          <div class="perm-muted">${esc(usuario.email || '')}</div>
          <div class="perm-muted">${esc(empresa?.nome || 'Sem empresa vinculada')}</div>
        </div>
        <span class="perm-pill ${isUserAdmin ? 'gold' : ''}">${isUserAdmin ? 'Admin' : (usuario.ativo === false ? 'Bloqueado' : 'Cliente')}</span>
      </div>
      ${isUserAdmin ? `
        <div class="perm-empty">Administrador possui acesso completo ao sistema.</div>
      ` : `
        ${legacy ? '<span class="perm-pill gold">Acesso legado: tudo liberado até salvar</span>' : ''}
        <div class="perm-options">
          ${AREAS.map(area => `
            <label class="perm-option">
              <input type="checkbox" name="permissao" value="${area.id}" ${permissoes.includes(area.id) ? 'checked' : ''}>
              <span>
                <b>${esc(area.label)}</b>
                <small class="perm-muted">${esc(area.hint)}</small>
              </span>
            </label>
          `).join('')}
        </div>
        <div class="perm-actions">
          <button class="btn btn-small btn-gold" type="button" data-save-perms>Salvar permissões</button>
          <button class="btn btn-small btn-soft" type="button" data-only-apontamento>Só apontamento</button>
          <button class="btn btn-small btn-soft" type="button" data-all-perms>Liberar tudo</button>
          <button class="btn btn-small btn-danger" type="button" data-no-perms>Bloquear telas</button>
        </div>
      `}
    </article>
  `;
}

async function renderPermissoes() {
  if (!isAdmin()) {
    toast('Apenas administradores podem alterar permissões.');
    return;
  }

  shell('<section class="perm-page"><div class="perm-empty">Carregando usuários...</div></section>');

  try {
    const [usuariosSnap, empresasMap] = await Promise.all([
      getDocs(collection(db, 'usuarios')),
      carregarEmpresasMap()
    ]);

    const usuarios = usuariosSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.nome || a.email || '').localeCompare(String(b.nome || b.email || ''), 'pt-BR'));

    shell(`
      <section class="perm-page">
        <section class="perm-hero">
          <span class="kicker">Controle por tela</span>
          <h2>Permissões dos usuários</h2>
          <p>Use esta área para liberar só o Apontamento para alguém, ou escolher quais partes do sistema cada usuário pode acessar.</p>
          <div class="perm-toolbar" style="margin-top:14px;">
            <input type="search" data-perm-search placeholder="Pesquisar usuário, e-mail ou empresa...">
            <span class="perm-pill gold">${usuarios.length} usuário(s)</span>
          </div>
        </section>
        <section class="perm-grid">
          ${usuarios.length ? usuarios.map(u => usuarioCardHTML(u, empresasMap)).join('') : '<div class="perm-empty">Nenhum usuário cadastrado.</div>'}
        </section>
      </section>
    `);

    bindPermissoesEvents();
  } catch (error) {
    console.error('Erro ao carregar permissões:', error);
    shell(`<section class="perm-page"><div class="perm-empty">Não foi possível carregar as permissões. ${esc(error.message || '')}</div></section>`);
  }
}

function checkedAreas(card) {
  return Array.from(card.querySelectorAll('input[name="permissao"]:checked')).map(input => input.value);
}

function setAreas(card, areas) {
  card.querySelectorAll('input[name="permissao"]').forEach(input => {
    input.checked = areas.includes(input.value);
  });
}

async function salvarPermissoes(card) {
  const userId = card?.dataset?.userId;
  if (!userId) return;
  const permissoes = checkedAreas(card);
  await updateDoc(doc(db, 'usuarios', userId), {
    permissoes,
    permissoesAtualizadoEm: serverTimestamp(),
    permissoesAtualizadoPor: auth.currentUser?.uid || '',
    atualizadoEm: serverTimestamp(),
    atualizadoPor: auth.currentUser?.uid || ''
  });
  toast('Permissões salvas.');
  renderPermissoes();
}

function bindPermissoesEvents() {
  document.querySelector('[data-perm-search]')?.addEventListener('input', event => {
    const term = String(event.target.value || '').trim().toLowerCase();
    document.querySelectorAll('[data-perm-user-card]').forEach(card => {
      const haystack = card.getAttribute('data-user-search') || '';
      card.style.display = !term || haystack.includes(term) ? '' : 'none';
    });
  });

  document.querySelectorAll('[data-perm-user-card]').forEach(card => {
    card.querySelector('[data-save-perms]')?.addEventListener('click', () => salvarPermissoes(card));
    card.querySelector('[data-only-apontamento]')?.addEventListener('click', () => setAreas(card, ['apontamento']));
    card.querySelector('[data-all-perms]')?.addEventListener('click', () => setAreas(card, AREAS.map(a => a.id)));
    card.querySelector('[data-no-perms]')?.addEventListener('click', () => setAreas(card, []));
  });
}

document.addEventListener('click', event => {
  const permNav = event.target.closest?.('[data-permissoes-nav]');
  if (permNav) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    document.getElementById('sidebar')?.classList.remove('open');
    renderPermissoes();
    return;
  }

  const navBtn = event.target.closest?.('#sidebar .nav-btn, .sidebar .nav-btn');
  if (!navBtn || !isCliente() || !isRestrito()) return;
  const area = areaDoBotao(navBtn);
  if (area && area !== 'quem_somos' && !pode(area)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    toast('Seu usuário não tem permissão para acessar essa área.');
  }
}, true);

function startObserver() {
  if (observerStarted) return;
  observerStarted = true;
  const observer = new MutationObserver(() => aplicarPermissoesMenu());
  observer.observe(document.body, { childList: true, subtree: true });
}

onAuthStateChanged(auth, async user => {
  try {
    redirectDone = false;
    await carregarPerfil(user);
    aplicarPermissoesMenu();
    startObserver();
  } catch (error) {
    console.warn('Permissões indisponíveis:', error);
  }
});

window.addEventListener('load', () => {
  aplicarPermissoesMenu();
  startObserver();
});

console.info(`Excellence System® permissões por tela ${PATCH_VERSION} carregadas.`);
