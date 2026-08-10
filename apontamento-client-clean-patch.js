import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const PATCH_VERSION = '20260809-67';
let perfilAtual = null;
let cleanupTimer = null;

function isCliente() {
  return perfilAtual?.tipo === 'cliente';
}

function texto(el) {
  return String(el?.textContent || '').trim().toLowerCase();
}

function isApontamentoAberto() {
  return !!document.querySelector('.apontamento-page, .apt-entry-page, [data-apt-page]');
}

function removerSeExiste(selector) {
  document.querySelectorAll(selector).forEach(el => el.remove());
}

function limparFaixaEmpresaCliente() {
  if (!isCliente() || !isApontamentoAberto()) return;

  // Remove botões/atalhos que só fazem sentido para admin.
  removerSeExiste('[data-apt-entry-back]');
  removerSeExiste('[data-apt-card-change-company]');
  removerSeExiste('.topbar [data-apt-refresh]');
  removerSeExiste('.topbar-actions [data-apt-refresh]');

  document.querySelectorAll('.apontamento-page button, [data-apt-page] button, .apontamento-hero button').forEach(btn => {
    const t = texto(btn);
    if (
      t.includes('mudar empresa') ||
      t.includes('escolher outra empresa') ||
      t === 'atualizar'
    ) {
      btn.remove();
    }
  });

  // No cliente, a empresa já é fixa pelo perfil. Não precisa mostrar seletor/pílulas.
  document.querySelectorAll('.apontamento-empresa-bar').forEach(bar => {
    bar.querySelectorAll('button, select, .form-group, [data-apt-refresh]').forEach(el => el.remove());
    bar.style.display = 'none';
  });

  // Remove sobras visuais como "Empresa selecionada" ou nome da empresa em pílulas duplicadas.
  document.querySelectorAll('.apontamento-page .apt-pill, .apontamento-page .apt-card-pill, [data-apt-page] .apt-pill, [data-apt-page] .apt-card-pill').forEach(pill => {
    const t = texto(pill);
    if (
      t.includes('empresa selecionada') ||
      t.startsWith('empresa:') ||
      t === 'atualizar' ||
      t === 'teste'
    ) {
      pill.remove();
    }
  });
}

function agendarLimpeza() {
  clearTimeout(cleanupTimer);
  cleanupTimer = setTimeout(limparFaixaEmpresaCliente, 80);
}

onAuthStateChanged(auth, async user => {
  perfilAtual = null;
  if (!user) return;
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    perfilAtual = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.warn('Perfil indisponível para limpeza do apontamento:', error);
  }
  agendarLimpeza();
});

const observer = new MutationObserver(agendarLimpeza);
observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener('load', agendarLimpeza);
console.info(`Excellence System® limpeza do apontamento para cliente ${PATCH_VERSION} carregada.`);
