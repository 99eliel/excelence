import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const V = '20260821-90';
let perfil = null;
let queued = false;

const norm = (value = '') => String(value || '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const isAdmin = () => perfil?.tipo === 'admin';
const isMoneyText = value => /R\$\s*[\d.]+(?:,\d{1,2})?|\bvalor\s*(?:total|unitario|unitário|por hora)?\b|\/hora\b/i.test(String(value || ''));

function isReportElement(el) {
  return !!el?.closest?.('[data-report]');
}

function removeValueMetrics(container, allowReport = false) {
  container.querySelectorAll('.v68-metric').forEach(card => {
    if (!allowReport && isReportElement(card)) return;
    const label = norm(card.querySelector('small')?.textContent);
    if (label.includes('valor')) card.remove();
  });
}

function removeValueLines(container) {
  container.querySelectorAll('.v68-line').forEach(line => {
    const label = norm(line.querySelector('span')?.textContent);
    if (label.includes('valor')) line.remove();
  });
}

function cleanLaunchProductOptions(root) {
  root.querySelectorAll('form[data-lancar] select[name="produtoId"] option').forEach(option => {
    const original = String(option.textContent || '');
    const cleaned = original
      .replace(/\s*[—–-]\s*R\$\s*[\d.]+(?:,\d{1,2})?\s*$/i, '')
      .replace(/\s+R\$\s*[\d.]+(?:,\d{1,2})?\s*$/i, '')
      .trim();
    if (cleaned && cleaned !== original) option.textContent = cleaned;
  });
}

function cleanLaunchPreview(root) {
  root.querySelectorAll('form[data-lancar] [data-prev]').forEach(preview => removeValueLines(preview));
}

function cleanOperationalHistory(root) {
  root.querySelectorAll('.v68-card').forEach(card => {
    if (isReportElement(card)) return;
    const title = norm(card.querySelector('.kicker')?.textContent);
    const history = card.classList.contains('v75-history') || title.includes('historico');
    if (!history) return;

    card.querySelectorAll('.v68-pill, .v68-meta span').forEach(el => {
      if (isMoneyText(el.textContent)) el.remove();
    });
  });
}

function cleanOperationalScreens() {
  document.querySelectorAll('[data-v68]').forEach(root => {
    cleanLaunchProductOptions(root);
    cleanLaunchPreview(root);
    cleanOperationalHistory(root);

    root.querySelectorAll('.v68-metrics').forEach(metrics => {
      if (!isReportElement(metrics)) removeValueMetrics(metrics, true);
    });
  });
}

function removeValueColumns(table) {
  const headers = Array.from(table.querySelectorAll('thead th'));
  const indexes = headers
    .map((th, index) => ({ index, label: norm(th.textContent) }))
    .filter(item => item.label === 'valor' || item.label.includes('valor total'))
    .map(item => item.index)
    .sort((a, b) => b - a);

  if (!indexes.length) return;

  indexes.forEach(index => {
    table.querySelectorAll('tr').forEach(row => {
      const cells = Array.from(row.children);
      if (cells[index]) cells[index].remove();
    });
  });

  table.querySelectorAll('td[colspan]').forEach(td => {
    const current = Number(td.getAttribute('colspan') || 0);
    if (current > 1) td.setAttribute('colspan', String(Math.max(1, current - indexes.length)));
  });
}

function cleanClientReports() {
  if (isAdmin()) return;

  document.querySelectorAll('[data-report]').forEach(report => {
    removeValueMetrics(report, true);
    removeValueLines(report);
    report.querySelectorAll('.v68-table').forEach(removeValueColumns);

    // Proteção adicional para componentes futuros: qualquer indicador explicitamente financeiro
    // dentro do relatório do usuário comum é retirado antes de exibir ou imprimir.
    report.querySelectorAll('[data-financial], .financial-value, .valor-financeiro').forEach(el => el.remove());
  });
}

function enforceVisibility() {
  if (!perfil) return;
  cleanOperationalScreens();
  cleanClientReports();
}

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    enforceVisibility();
  });
}

document.addEventListener('click', event => {
  if (event.target.closest?.('[data-print]')) enforceVisibility();
}, true);

document.addEventListener('input', event => {
  if (event.target.closest?.('form[data-lancar]')) schedule();
}, true);

document.addEventListener('change', event => {
  if (event.target.closest?.('form[data-lancar]')) schedule();
}, true);

new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });

onAuthStateChanged(auth, async user => {
  perfil = null;
  if (!user) return;
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    perfil = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.warn('Controle financeiro do apontamento indisponível:', error);
  }
  schedule();
});

window.addEventListener('load', schedule);
console.info(`Excellence System® visibilidade financeira do Apontamento ${V} carregada.`);
