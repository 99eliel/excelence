import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const VERSION = '20260908-105';
const cache = new Map();
const state = { perfil: null, busy: false, timer: null };

const norm = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

function toast(message, error = false) {
  document.querySelector('[data-empresa-modulos-toast]')?.remove();
  const el = document.createElement('div');
  el.dataset.empresaModulosToast = '1';
  el.textContent = message;
  el.style.cssText = `position:fixed;right:18px;bottom:18px;z-index:140000;max-width:460px;padding:12px 15px;border-radius:13px;color:#fff;font-weight:850;background:${error ? '#9f2e2e' : '#073F5A'};box-shadow:0 18px 42px rgba(5,36,55,.25)`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3900);
}

function isAdmin() {
  return state.perfil?.tipo === 'admin' && state.perfil?.ativo === true;
}

function isCliente() {
  return state.perfil?.tipo === 'cliente' && state.perfil?.ativo === true && !!state.perfil?.empresaId;
}

function currentAdminEmpresaId() {
  const meta = history.state?.meta || {};
  const view = meta.adminView || {};
  if (view.empresaId) return String(view.empresaId);
  const key = String(history.state?.key || '');
  const match = key.match(/admin:empresa:([^:]+)/);
  return match?.[1] || '';
}

async function getEmpresa(empresaId, force = false) {
  if (!empresaId) return null;
  if (!force && cache.has(empresaId)) return cache.get(empresaId);
  const snap = await getDoc(doc(db, 'empresas', empresaId));
  const empresa = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  if (empresa) cache.set(empresaId, empresa);
  return empresa;
}

function isoAtiva(empresa) {
  return empresa?.isoAtiva !== false;
}

function ensureStyle() {
  if (document.getElementById('empresa-modulos-style')) return;
  const style = document.createElement('style');
  style.id = 'empresa-modulos-style';
  style.textContent = `
    .empresa-module-control{margin-top:14px;border:1px solid #d7e5ea;border-radius:14px;padding:12px 13px;background:#f8fbfc;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .empresa-module-control strong{display:block;color:#073F5A}.empresa-module-control small{display:block;color:#607788;margin-top:3px;max-width:680px}
    .empresa-module-status{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900;margin-bottom:6px;background:#e4f5e9;color:#24663b}.empresa-module-status.off{background:#fce8e6;color:#992c25}
    .empresa-module-toggle{border:0;border-radius:11px;padding:10px 13px;font-weight:900;cursor:pointer;background:#073F5A;color:#fff}.empresa-module-toggle.off{background:#8f2d28}.empresa-module-toggle:disabled{opacity:.55;cursor:not-allowed}
    .area-card.iso-disabled-for-client{border-style:dashed}.area-card.iso-disabled-for-client>.kicker:after{content:' • facultativa/desativada para o cliente';color:#9a4a42}
  `;
  document.head.appendChild(style);
}

function findIsoAdminCard() {
  return Array.from(document.querySelectorAll('.area-card')).find(card => {
    const kicker = norm(card.querySelector('.kicker')?.textContent || '');
    return kicker.includes('gestao iso');
  });
}

async function enhanceAdmin() {
  if (!isAdmin()) return;
  const empresaId = currentAdminEmpresaId();
  if (!empresaId) return;
  const card = findIsoAdminCard();
  if (!card) return;

  const empresa = await getEmpresa(empresaId);
  if (!empresa) return;
  const enabled = isoAtiva(empresa);
  card.classList.toggle('iso-disabled-for-client', !enabled);

  let box = card.querySelector('[data-empresa-iso-control]');
  if (!box) {
    box = document.createElement('div');
    box.className = 'empresa-module-control';
    box.dataset.empresaIsoControl = empresaId;
    card.appendChild(box);
  }

  box.innerHTML = `
    <div>
      <span class="empresa-module-status ${enabled ? '' : 'off'}">${enabled ? 'Ativada para a empresa' : 'Desativada para a empresa'}</span>
      <strong>ISO 9001:2015 é facultativa</strong>
      <small>Quando desativada, usuários desta empresa não veem a ISO, o diagnóstico nem pendências ISO. Os dados já existentes são preservados e reaparecem se você ativar novamente.</small>
    </div>
    <button class="empresa-module-toggle ${enabled ? 'off' : ''}" type="button" data-toggle-empresa-iso="${empresaId}">${enabled ? 'Desativar ISO' : 'Ativar ISO'}</button>`;
}

async function toggleIso(empresaId, button) {
  if (!isAdmin() || state.busy) return;
  state.busy = true;
  const old = button.textContent;
  button.disabled = true;
  button.textContent = 'Salvando...';
  try {
    const empresa = await getEmpresa(empresaId, true);
    if (!empresa) throw new Error('Empresa não encontrada.');
    const next = !isoAtiva(empresa);
    await updateDoc(doc(db, 'empresas', empresaId), {
      isoAtiva: next,
      isoAtualizadoEm: serverTimestamp(),
      isoAtualizadoPor: auth.currentUser?.uid || ''
    });
    cache.set(empresaId, { ...empresa, isoAtiva: next });
    toast(next ? 'ISO ativada para esta empresa.' : 'ISO desativada para esta empresa. Os dados foram preservados.');
    await enhanceAdmin();
  } catch (error) {
    toast(error?.message || 'Não foi possível alterar a configuração da ISO.', true);
    button.disabled = false;
    button.textContent = old;
  } finally {
    state.busy = false;
  }
}

function clientIsoNavButton() {
  return Array.from(document.querySelectorAll('#sidebar .nav-btn,.sidebar .nav-btn')).find(btn => norm(btn.textContent).includes('estrutura iso'));
}

function clientHomeButton() {
  return document.querySelector('[data-client-central-nav]') || Array.from(document.querySelectorAll('#sidebar .nav-btn,.sidebar .nav-btn')).find(btn => norm(btn.textContent).trim() === 'inicio');
}

function updateCentralCounts() {
  const root = document.querySelector('.cc-root');
  if (!root) return;
  const tasks = Array.from(root.querySelectorAll('.cc-task')).filter(task => task.style.display !== 'none' && !task.dataset.isoCompanyHidden);
  const counts = {
    todo: tasks.filter(t => t.dataset.ccTaskGroup === 'todo').length,
    waiting: tasks.filter(t => t.dataset.ccTaskGroup === 'waiting').length,
    done: tasks.filter(t => t.dataset.ccTaskGroup === 'done').length
  };
  const cards = root.querySelectorAll('.cc-summary-card strong');
  if (cards[0]) cards[0].textContent = counts.todo;
  if (cards[1]) cards[1].textContent = counts.waiting;
  if (cards[2]) cards[2].textContent = counts.done;
  root.querySelectorAll('[data-cc-task-tab]').forEach(btn => {
    const group = btn.dataset.ccTaskTab;
    const label = group === 'todo' ? 'Preciso fazer' : group === 'waiting' ? 'Aguardando' : 'Concluído';
    btn.textContent = `${label} (${counts[group] || 0})`;
  });
  const areasSection = Array.from(root.querySelectorAll('.cc-section')).find(section => norm(section.querySelector('h2')?.textContent || '') === 'areas da empresa');
  const pill = areasSection?.querySelector('.cc-pill');
  if (pill) {
    const visibleModules = Array.from(areasSection.querySelectorAll('.cc-module')).filter(el => el.style.display !== 'none').length;
    pill.textContent = `${visibleModules} módulo(s)`;
  }
}

async function syncClient() {
  if (!isCliente()) return;
  const empresa = await getEmpresa(state.perfil.empresaId);
  if (!empresa) return;
  const enabled = isoAtiva(empresa);
  document.documentElement.dataset.empresaIsoAtiva = enabled ? '1' : '0';

  const nav = clientIsoNavButton();
  if (nav) {
    nav.hidden = !enabled;
    nav.style.display = enabled ? '' : 'none';
    nav.setAttribute('aria-hidden', enabled ? 'false' : 'true');
  }

  document.querySelectorAll('[data-cc-area="estrutura_iso"]').forEach(button => {
    const card = button.closest('.cc-module');
    const task = button.closest('.cc-task');
    if (card) card.style.display = enabled ? '' : 'none';
    if (task) {
      task.style.display = enabled ? '' : 'none';
      if (enabled) delete task.dataset.isoCompanyHidden;
      else task.dataset.isoCompanyHidden = '1';
    }
  });

  if (!enabled) {
    const viewType = String(history.state?.meta?.clientView?.type || '');
    if (['requirement', 'isoCompleta', 'isoTopicos', 'diagnosticoInicial'].includes(viewType)) {
      setTimeout(() => clientHomeButton()?.click(), 20);
    }
  }
  updateCentralCounts();
}

async function syncAll() {
  ensureStyle();
  try {
    if (isAdmin()) await enhanceAdmin();
    if (isCliente()) await syncClient();
  } catch (error) {
    console.warn('Configuração de módulos da empresa indisponível:', error);
  }
}

function schedule(ms = 80) {
  clearTimeout(state.timer);
  state.timer = setTimeout(syncAll, ms);
}

document.addEventListener('click', event => {
  const toggle = event.target.closest?.('[data-toggle-empresa-iso]');
  if (toggle) {
    event.preventDefault();
    event.stopPropagation();
    toggleIso(toggle.dataset.toggleEmpresaIso, toggle);
    return;
  }

  if (isCliente() && document.documentElement.dataset.empresaIsoAtiva === '0') {
    const isoArea = event.target.closest?.('[data-cc-area="estrutura_iso"]');
    const isoNav = event.target.closest?.('#sidebar .nav-btn,.sidebar .nav-btn');
    if (isoArea || (isoNav && norm(isoNav.textContent).includes('estrutura iso'))) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toast('A ISO está desativada para esta empresa.', true);
    }
  }
}, true);

new MutationObserver(() => schedule(90)).observe(document.body, { childList: true, subtree: true });
window.addEventListener('popstate', () => schedule(80));
window.addEventListener('load', () => schedule(180));

onAuthStateChanged(auth, async user => {
  state.perfil = null;
  cache.clear();
  if (!user) return;
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    state.perfil = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    schedule(120);
  } catch (error) {
    console.warn('Perfil indisponível para configuração de módulos:', error);
  }
});

console.info(`Excellence System • módulos facultativos por empresa ${VERSION} carregados.`);
