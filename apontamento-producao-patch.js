import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const PATCH_VERSION = '20260805-60';
let perfilAtual = null;
const loadingEmpresas = new Set();

function escapeHTML(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseNumberBR(value) {
  const clean = String(value ?? '')
    .replace(/[^0-9,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const number = Number(clean);
  return Number.isFinite(number) ? number : 0;
}

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

function formatDateBR(iso = '') {
  if (!iso) return '-';
  const [year, month, day] = String(iso).split('-').map(Number);
  if (!year || !month || !day) return escapeHTML(iso);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
}

function toast(message, type = 'success') {
  const existing = document.querySelector('.toast-message');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = `notice ${type} toast-message`;
  el.style.position = 'fixed';
  el.style.right = '18px';
  el.style.bottom = '18px';
  el.style.zIndex = '9999';
  el.style.maxWidth = '420px';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4300);
}

function normalizeError(error) {
  const code = String(error?.code || '');
  if (code.includes('permission-denied')) return 'Sem permissão no Firebase. Publique as regras novas do Firestore antes de usar o apontamento.';
  return error?.message || 'Erro ao salvar apontamento.';
}

function getEmpresaIdFromHistory() {
  const meta = history.state?.meta || {};
  const fromMeta = meta.adminView?.empresaId || meta.clientView?.empresaId || '';
  if (fromMeta) return fromMeta;
  const key = history.state?.key || '';
  const match = String(key).match(/admin:empresa:([^:]+):ecossistema/);
  return match ? match[1] : '';
}

function getEmpresaIdForPanel() {
  if (perfilAtual?.tipo === 'cliente') return perfilAtual.empresaId || '';
  return getEmpresaIdFromHistory();
}

function canManageApontamento(empresaId) {
  if (!perfilAtual || !empresaId) return false;
  if (perfilAtual.tipo === 'admin') return true;
  return perfilAtual.tipo === 'cliente' && perfilAtual.empresaId === empresaId;
}

function injectStyles() {
  if (document.getElementById('apontamento-producao-styles')) return;
  const style = document.createElement('style');
  style.id = 'apontamento-producao-styles';
  style.textContent = `
    .apontamento-panel {
      margin: 16px 0 18px;
      border: 1px solid var(--line, #d8e5ec);
      border-radius: 20px;
      background: linear-gradient(180deg, #ffffff, #f8fbfd);
      padding: 18px;
      box-shadow: 0 14px 34px rgba(5, 36, 55, .06);
    }
    .apontamento-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 14px;
    }
    .apontamento-head h2 { margin: 2px 0 4px; color: var(--primary-dark, #073f5a); }
    .apontamento-head p { margin: 0; color: var(--muted, #607788); }
    .apontamento-kpis {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin: 12px 0 14px;
    }
    .apontamento-kpis div {
      border: 1px solid var(--line, #d8e5ec);
      background: #fff;
      border-radius: 16px;
      padding: 12px;
    }
    .apontamento-kpis small { display: block; color: var(--muted, #607788); font-weight: 800; }
    .apontamento-kpis strong { display: block; margin-top: 4px; color: var(--primary-dark, #073f5a); font-size: 20px; }
    .apontamento-form {
      margin-top: 14px;
      padding: 14px;
      border: 1px dashed rgba(7, 63, 90, .25);
      background: #fff;
      border-radius: 18px;
    }
    .apontamento-form.hidden { display: none !important; }
    .apontamento-form .form-grid-4 {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .apontamento-form .form-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .apontamento-total-preview {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      margin: 10px 0 0;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(214,168,66,.12);
      color: #7b5a12;
      font-weight: 900;
    }
    .apontamento-table-wrap { overflow-x: auto; margin-top: 14px; }
    .apontamento-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 860px;
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
    }
    .apontamento-table th, .apontamento-table td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line, #d8e5ec);
      text-align: left;
      vertical-align: top;
    }
    .apontamento-table th {
      background: rgba(7,63,90,.07);
      color: var(--primary-dark, #073f5a);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .apontamento-table td strong { color: var(--primary-dark, #073f5a); }
    .apontamento-empty {
      margin-top: 14px;
      border: 1px dashed var(--line, #d8e5ec);
      border-radius: 16px;
      padding: 18px;
      text-align: center;
      color: var(--muted, #607788);
      background: #fff;
    }
    .apontamento-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    @media (max-width: 960px) {
      .apontamento-kpis, .apontamento-form .form-grid-4, .apontamento-form .form-grid-3 { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 640px) {
      .apontamento-head { flex-direction: column; }
      .apontamento-kpis, .apontamento-form .form-grid-4, .apontamento-form .form-grid-3 { grid-template-columns: 1fr; }
      .apontamento-panel { padding: 14px; }
    }
  `;
  document.head.appendChild(style);
}

function apontamentoPanelHTML(canWrite) {
  return `
    <section class="apontamento-panel" data-apontamento-panel>
      <div class="apontamento-head">
        <div>
          <span class="kicker">Apontamento</span>
          <h2>Apontamento de produção</h2>
          <p>Registre quantidade de peças produzidas e o valor de venda de cada peça.</p>
        </div>
        ${canWrite ? '<button class="btn btn-primary" type="button" data-apontamento-toggle>+ Adicionar apontamento</button>' : ''}
      </div>

      <div class="apontamento-kpis" data-apontamento-kpis>
        <div><small>Total de peças</small><strong>0</strong></div>
        <div><small>Valor total vendido</small><strong>R$ 0,00</strong></div>
        <div><small>Preço médio por peça</small><strong>R$ 0,00</strong></div>
      </div>

      ${canWrite ? `
        <form class="apontamento-form hidden" data-apontamento-form>
          <div class="form-grid-4">
            <div class="form-group"><label>Data</label><input name="data" type="date" value="${todayISO()}" required /></div>
            <div class="form-group"><label>Quantidade de peças</label><input name="quantidadePecas" type="number" min="0" step="1" required placeholder="Ex.: 120" /></div>
            <div class="form-group"><label>Valor de venda da peça</label><input name="valorVendaPeca" inputmode="decimal" required placeholder="Ex.: 35,90" /></div>
            <div class="form-group"><label>Célula</label><select name="celula"><option value="">Selecione</option><option value="CÉL 1">CÉL 1</option><option value="CÉL 2">CÉL 2</option><option value="CÉL 3">CÉL 3</option></select></div>
          </div>
          <div class="form-grid-4">
            <div class="form-group"><label>Descrição do modelo</label><input name="modelo" placeholder="Ex.: Avental, colete, camisa..." /></div>
            <div class="form-group"><label>Gênero</label><select name="genero"><option value="">Selecione</option><option value="Masculino">Masculino</option><option value="Feminino">Feminino</option><option value="Unissex">Unissex</option></select></div>
            <div class="form-group"><label>Cor</label><input name="cor" placeholder="Ex.: Preto" /></div>
            <div class="form-group"><label>Tamanho</label><input name="tamanho" placeholder="Ex.: P, M, G, GG" /></div>
          </div>
          <div class="form-group"><label>Observações / ocorrências</label><textarea name="observacoes" placeholder="Pessoas, máquinas/equipamentos, ocorrências ou outras observações do apontamento."></textarea></div>
          <div class="apontamento-total-preview"><span>Total calculado</span><strong data-apontamento-total-preview>R$ 0,00</strong></div>
          <div class="actions" style="margin-top:14px;">
            <button class="btn btn-gold" type="submit">Salvar apontamento</button>
            <button class="btn btn-soft" type="button" data-apontamento-cancel>Cancelar</button>
          </div>
        </form>
      ` : ''}

      <div data-apontamento-list>
        <div class="apontamento-empty">Carregando apontamentos...</div>
      </div>
    </section>
  `;
}

function renderKpis(box, apontamentos) {
  const totalPecas = apontamentos.reduce((sum, item) => sum + Number(item.quantidadePecas || 0), 0);
  const totalVenda = apontamentos.reduce((sum, item) => sum + Number(item.totalVenda || 0), 0);
  const precoMedio = totalPecas ? totalVenda / totalPecas : 0;
  box.innerHTML = `
    <div><small>Total de peças</small><strong>${formatNumber(totalPecas)}</strong></div>
    <div><small>Valor total vendido</small><strong>${formatBRL(totalVenda)}</strong></div>
    <div><small>Preço médio por peça</small><strong>${formatBRL(precoMedio)}</strong></div>
  `;
}

function apontamentoRowHTML(item, canWrite) {
  const total = Number(item.totalVenda || (Number(item.quantidadePecas || 0) * Number(item.valorVendaPeca || 0)));
  const meta = [item.genero, item.cor, item.tamanho, item.celula].filter(Boolean).join(' • ');
  return `
    <tr>
      <td>${formatDateBR(item.data)}</td>
      <td><strong>${escapeHTML(item.modelo || 'Modelo não informado')}</strong>${meta ? `<br><small>${escapeHTML(meta)}</small>` : ''}</td>
      <td>${formatNumber(item.quantidadePecas)}</td>
      <td>${formatBRL(item.valorVendaPeca)}</td>
      <td><strong>${formatBRL(total)}</strong></td>
      <td>${item.observacoes ? escapeHTML(item.observacoes).replaceAll('\n', '<br>') : '<span class="muted">-</span>'}</td>
      <td>${canWrite ? `<button class="btn btn-small btn-danger" type="button" data-apontamento-delete="${escapeHTML(item.id)}">Excluir</button>` : '<span class="muted">Consulta</span>'}</td>
    </tr>
  `;
}

function renderList(panel, apontamentos, canWrite) {
  const list = panel.querySelector('[data-apontamento-list]');
  const kpis = panel.querySelector('[data-apontamento-kpis]');
  renderKpis(kpis, apontamentos);

  if (!apontamentos.length) {
    list.innerHTML = '<div class="apontamento-empty">Nenhum apontamento cadastrado ainda.</div>';
    return;
  }

  list.innerHTML = `
    <div class="apontamento-table-wrap">
      <table class="apontamento-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Modelo</th>
            <th>Peças</th>
            <th>Valor da peça</th>
            <th>Total</th>
            <th>Ocorrências</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>${apontamentos.map(item => apontamentoRowHTML(item, canWrite)).join('')}</tbody>
      </table>
    </div>
  `;
}

async function loadApontamentos(empresaId) {
  const snap = await getDocs(query(collection(db, 'empresa_apontamentos'), where('empresaId', '==', empresaId)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const dateDiff = String(b.data || '').localeCompare(String(a.data || ''));
      if (dateDiff !== 0) return dateDiff;
      return Number(b.criadoEm?.seconds || 0) - Number(a.criadoEm?.seconds || 0);
    });
}

async function refreshApontamentos(panel, empresaId) {
  if (!empresaId || loadingEmpresas.has(empresaId)) return;
  loadingEmpresas.add(empresaId);
  try {
    const apontamentos = await loadApontamentos(empresaId);
    renderList(panel, apontamentos, canManageApontamento(empresaId));
  } catch (error) {
    panel.querySelector('[data-apontamento-list]').innerHTML = `<div class="notice error">${escapeHTML(normalizeError(error))}</div>`;
  } finally {
    loadingEmpresas.delete(empresaId);
  }
}

function bindPanel(panel, empresaId) {
  const form = panel.querySelector('[data-apontamento-form]');
  const toggle = panel.querySelector('[data-apontamento-toggle]');
  const cancel = panel.querySelector('[data-apontamento-cancel]');
  const preview = panel.querySelector('[data-apontamento-total-preview]');

  toggle?.addEventListener('click', () => {
    form?.classList.remove('hidden');
    form?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  cancel?.addEventListener('click', () => {
    form?.classList.add('hidden');
    form?.reset();
    const data = form?.querySelector('[name="data"]');
    if (data) data.value = todayISO();
    if (preview) preview.textContent = formatBRL(0);
  });

  function updatePreview() {
    if (!form || !preview) return;
    const fd = new FormData(form);
    const qtd = parseNumberBR(fd.get('quantidadePecas'));
    const valor = parseNumberBR(fd.get('valorVendaPeca'));
    preview.textContent = formatBRL(qtd * valor);
  }

  form?.addEventListener('input', updatePreview);

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = event.submitter;
    const oldText = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = 'Salvando...'; }
    try {
      const fd = new FormData(form);
      const quantidadePecas = Math.max(0, Math.round(parseNumberBR(fd.get('quantidadePecas'))));
      const valorVendaPeca = Math.max(0, parseNumberBR(fd.get('valorVendaPeca')));
      if (!quantidadePecas) throw new Error('Informe a quantidade de peças.');
      if (!valorVendaPeca) throw new Error('Informe o valor de venda da peça.');

      await addDoc(collection(db, 'empresa_apontamentos'), {
        empresaId,
        data: fd.get('data') || todayISO(),
        modelo: String(fd.get('modelo') || '').trim(),
        genero: String(fd.get('genero') || '').trim(),
        cor: String(fd.get('cor') || '').trim(),
        tamanho: String(fd.get('tamanho') || '').trim(),
        celula: String(fd.get('celula') || '').trim(),
        quantidadePecas,
        valorVendaPeca,
        totalVenda: Number((quantidadePecas * valorVendaPeca).toFixed(2)),
        observacoes: String(fd.get('observacoes') || '').trim(),
        origem: 'ecossistema_apontamento',
        criadoEm: serverTimestamp(),
        criadoPor: auth.currentUser?.uid || '',
        atualizadoEm: serverTimestamp(),
        atualizadoPor: auth.currentUser?.uid || ''
      });

      toast('Apontamento salvo com sucesso.');
      form.reset();
      form.querySelector('[name="data"]').value = todayISO();
      if (preview) preview.textContent = formatBRL(0);
      form.classList.add('hidden');
      await refreshApontamentos(panel, empresaId);
    } catch (error) {
      toast(normalizeError(error), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = oldText || 'Salvar apontamento'; }
    }
  });

  panel.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-apontamento-delete]');
    if (!btn) return;
    const ok = confirm('Excluir este apontamento de produção?');
    if (!ok) return;
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Excluindo...';
    try {
      await deleteDoc(doc(db, 'empresa_apontamentos', btn.dataset.apontamentoDelete));
      toast('Apontamento excluído.');
      await refreshApontamentos(panel, empresaId);
    } catch (error) {
      toast(normalizeError(error), 'error');
      btn.disabled = false;
      btn.innerHTML = oldText;
    }
  });
}

function enhancePanel(companyPanel) {
  if (!perfilAtual) return;
  const empresaId = getEmpresaIdForPanel();
  if (!empresaId) return;
  const existing = companyPanel.querySelector('[data-apontamento-panel]');
  if (existing && existing.dataset.empresaId === empresaId) return;
  existing?.remove();

  const canWrite = canManageApontamento(empresaId);
  const wrapper = document.createElement('div');
  wrapper.innerHTML = apontamentoPanelHTML(canWrite).trim();
  const apontamento = wrapper.firstElementChild;
  apontamento.dataset.empresaId = empresaId;

  const summary = companyPanel.querySelector('.ecosystem-summary');
  if (summary) summary.insertAdjacentElement('afterend', apontamento);
  else companyPanel.prepend(apontamento);

  bindPanel(apontamento, empresaId);
  refreshApontamentos(apontamento, empresaId);
}

function enhanceAll() {
  injectStyles();
  document.querySelectorAll('.company-ecosystem-panel').forEach(enhancePanel);
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      perfilAtual = null;
      return;
    }
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    perfilAtual = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    setTimeout(enhanceAll, 300);
  } catch (error) {
    console.warn('Perfil indisponível para apontamento:', error);
  }
});

const observer = new MutationObserver(() => window.requestAnimationFrame(enhanceAll));
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('load', enhanceAll);
document.addEventListener('click', () => setTimeout(enhanceAll, 180));

console.info(`Excellence System® apontamento de produção ${PATCH_VERSION} carregado.`);
