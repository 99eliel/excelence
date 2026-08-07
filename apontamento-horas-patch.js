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
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const PATCH_VERSION = '20260807-62';
let perfilAtual = null;
let authReady = false;
let enhanceTimer = null;
const loadingPanels = new Set();

function escapeHTML(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseNumber(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const clean = raw.replace(/[^\d,.-]/g, '');
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(n) ? n : 0);
}

function integer(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function minutesText(value) {
  const total = Math.max(0, Math.round(Number(value || 0)));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
}

function isAdmin() {
  return perfilAtual?.tipo === 'admin';
}

function getEmpresaIdFromContext(panel = null) {
  if (perfilAtual?.tipo === 'cliente') return perfilAtual.empresaId || '';

  const direct = panel?.dataset?.empresaId || panel?.getAttribute?.('data-empresa-id') || '';
  if (direct) return direct;

  const state = history.state || {};
  const meta = state.meta || {};
  const adminView = meta.adminView || {};
  if (adminView.empresaId) return adminView.empresaId;

  const key = String(state.key || '');
  const match = key.match(/admin:empresa:([^:]+):/);
  if (match) return match[1];

  return '';
}

async function queryEmpresa(collectionName, empresaId) {
  if (!empresaId) return [];
  const snap = await getDocs(query(collection(db, collectionName), where('empresaId', '==', empresaId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function sortByName(items = []) {
  return [...items].sort((a, b) => {
    if ((a.ativo !== false) !== (b.ativo !== false)) return a.ativo !== false ? -1 : 1;
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
  });
}

function sortApontamentos(apontamentos = []) {
  return [...apontamentos].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
}

function calcResumoTempo(apontamentos = []) {
  const totalPecas = apontamentos.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
  const totalVenda = apontamentos.reduce((sum, item) => sum + Number(item.totalVenda || 0), 0);
  const totalMinutos = apontamentos.reduce((sum, item) => sum + Number(item.minutosTrabalhados || 0), 0);
  const totalPessoas = apontamentos.reduce((sum, item) => sum + Number(item.qtdePessoas || 0), 0);
  const horas = totalMinutos / 60;
  return {
    totalPecas,
    totalMinutos,
    mediaMinPorPeca: totalPecas ? totalMinutos / totalPecas : 0,
    mediaPecasPorPessoa: totalPessoas ? totalPecas / totalPessoas : 0,
    valorHora: horas ? totalVenda / horas : 0
  };
}

function injectStyles() {
  if (document.getElementById('apontamento-horas-v62-styles')) return;
  const style = document.createElement('style');
  style.id = 'apontamento-horas-v62-styles';
  style.textContent = `
    .apontamento-horas-card { background: #fff; border: 1px solid var(--line, #d8e5ea); border-radius: 18px; padding: 16px; }
    .apontamento-horas-card h3 { margin: 4px 0 8px; color: var(--primary-dark, #073F5A); }
    .apontamento-horas-card p { margin: 0 0 14px; color: var(--muted, #607788); }
    .apontamento-horas-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .apontamento-horas-form-grid .full { grid-column: 1 / -1; }
    .apontamento-funcionario-list, .apontamento-worker-picker, .apontamento-horas-history-list { display: grid; gap: 10px; margin-top: 14px; max-height: 420px; overflow: auto; padding-right: 4px; }
    .apontamento-funcionario-item, .apontamento-worker-option, .apontamento-horas-history-item { border: 1px solid var(--line, #d8e5ea); border-radius: 16px; padding: 12px; background: linear-gradient(180deg, #fff, #f9fcfd); display: grid; gap: 8px; }
    .apontamento-funcionario-item.inativo { opacity: .62; }
    .apontamento-funcionario-top, .apontamento-horas-history-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .apontamento-funcionario-top strong, .apontamento-horas-history-top strong { color: var(--primary-dark, #073F5A); }
    .apontamento-worker-option { cursor: pointer; grid-template-columns: auto 1fr; align-items: center; margin: 0; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
    .apontamento-worker-option input { width: 18px; height: 18px; accent-color: var(--primary, #073F5A); }
    .apontamento-worker-option:has(input:checked) { border-color: rgba(214,168,66,.78); box-shadow: 0 10px 24px rgba(214,168,66,.14); transform: translateY(-1px); }
    .apontamento-horas-preview { margin-top: 12px; border-radius: 16px; border: 1px solid rgba(214,168,66,.38); background: rgba(214,168,66,.10); padding: 12px; display: grid; gap: 8px; color: #72510f; font-weight: 900; }
    .apontamento-horas-preview-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
    .apontamento-horas-preview-row strong { color: #72510f; }
    .apontamento-pill.blue { background: rgba(7,63,90,.12); color: var(--primary-dark, #073F5A); }
    .apontamento-grid:has(.apontamento-horas-card) { grid-template-columns: minmax(280px, .9fr) minmax(280px, .9fr) minmax(360px, 1.2fr) !important; }
    .apontamento-horas-history { margin-top: 16px; }
    @media (max-width: 1280px) { .apontamento-grid:has(.apontamento-horas-card) { grid-template-columns: 1fr 1fr !important; } .apontamento-grid:has(.apontamento-horas-card) .apontamento-card:last-child { grid-column: 1 / -1; } }
    @media (max-width: 1120px) { .apontamento-grid:has(.apontamento-horas-card) { grid-template-columns: 1fr !important; } .apontamento-grid:has(.apontamento-horas-card) .apontamento-card:last-child { grid-column: auto; } }
    @media (max-width: 720px) { .apontamento-horas-form-grid { grid-template-columns: 1fr; } .apontamento-funcionario-top, .apontamento-horas-history-top { flex-direction: column; } .apontamento-horas-preview-row { flex-direction: column; align-items: flex-start; } }
  `;
  document.head.appendChild(style);
}

function funcionarioListHTML(funcionarios = [], apontamentos = []) {
  const sorted = sortByName(funcionarios);
  if (!sorted.length) return '<div class="apontamento-empty">Nenhum funcionário cadastrado ainda. Cadastre os minutos diários de cada pessoa para calcular as horas automaticamente.</div>';

  return `<div class="apontamento-funcionario-list">${sorted.map(funcionario => {
    const usado = apontamentos.some(a => Array.isArray(a.funcionarioIds) && a.funcionarioIds.includes(funcionario.id));
    return `
      <article class="apontamento-funcionario-item ${funcionario.ativo === false ? 'inativo' : ''}">
        <div class="apontamento-funcionario-top">
          <div>
            <strong>${escapeHTML(funcionario.nome || 'Funcionário')}</strong>
            <div class="apontamento-meta">
              ${funcionario.funcao ? `<span>${escapeHTML(funcionario.funcao)}</span>` : ''}
              ${funcionario.celula ? `<span>${escapeHTML(funcionario.celula)}</span>` : ''}
              <span>${funcionario.ativo === false ? 'Inativo' : 'Ativo'}</span>
            </div>
          </div>
          <span class="apontamento-pill blue">${minutesText(funcionario.minutosDia)} / dia</span>
        </div>
        <div class="apontamento-actions">
          <button class="btn btn-small btn-soft" type="button" data-toggle-funcionario="${escapeHTML(funcionario.id)}" data-next-status="${funcionario.ativo === false ? 'true' : 'false'}">${funcionario.ativo === false ? 'Ativar' : 'Desativar'}</button>
          <button class="btn btn-small btn-danger" type="button" data-delete-funcionario="${escapeHTML(funcionario.id)}">Excluir</button>
        </div>
        ${usado ? '<small class="muted">Histórico preservado: os apontamentos já feitos guardam nome e minutos.</small>' : ''}
      </article>
    `;
  }).join('')}</div>`;
}

function funcionarioPickerHTML(funcionarios = []) {
  const ativos = sortByName(funcionarios).filter(f => f.ativo !== false);
  if (!ativos.length) return '<div class="apontamento-empty">Nenhum funcionário ativo cadastrado. O administrador precisa cadastrar os minutos diários para usar o cálculo automático.</div>';

  return `<div class="apontamento-worker-picker">${ativos.map(funcionario => `
    <label class="apontamento-worker-option">
      <input type="checkbox" name="funcionarioIds" value="${escapeHTML(funcionario.id)}" data-minutos="${Number(funcionario.minutosDia || 0)}" />
      <span>
        <strong>${escapeHTML(funcionario.nome || 'Funcionário')}</strong>
        <span class="apontamento-meta">
          <span>${minutesText(funcionario.minutosDia)} / dia</span>
          ${funcionario.celula ? `<span>${escapeHTML(funcionario.celula)}</span>` : ''}
          ${funcionario.funcao ? `<span>${escapeHTML(funcionario.funcao)}</span>` : ''}
        </span>
      </span>
    </label>
  `).join('')}</div>`;
}

function adminFuncionarioCardHTML(funcionarios = [], apontamentos = []) {
  return `
    <section class="apontamento-horas-card" data-apontamento-horas-admin>
      <span class="kicker">Equipe e tempo</span>
      <h3>Funcionários e minutos diários</h3>
      <p>Cadastre manualmente quantos minutos por dia cada funcionário trabalha. Esses minutos entram no apontamento como base para horas trabalhadas, min/peça e peças por pessoa.</p>
      <form data-funcionario-form>
        <div class="apontamento-horas-form-grid">
          <div class="form-group full"><label>Nome do funcionário</label><input name="nome" required placeholder="Ex.: Ana, Maria, João..." /></div>
          <div class="form-group"><label>Minutos trabalhados por dia</label><input name="minutosDia" required inputmode="numeric" placeholder="Ex.: 520" /></div>
          <div class="form-group"><label>Célula/equipe</label><input name="celula" placeholder="Ex.: Célula 1" /></div>
          <div class="form-group"><label>Função</label><input name="funcao" placeholder="Opcional" /></div>
          <div class="form-group"><label>Status</label><select name="ativo"><option value="true">Ativo para apontamento</option><option value="false">Inativo</option></select></div>
        </div>
        <button class="btn btn-primary" type="submit">Cadastrar funcionário</button>
      </form>
      <div data-funcionario-list>${funcionarioListHTML(funcionarios, apontamentos)}</div>
    </section>
  `;
}

function horasHistoryHTML(apontamentos = []) {
  const comTempo = sortApontamentos(apontamentos).filter(a => Number(a.minutosTrabalhados || 0) > 0).slice(0, 20);
  if (!comTempo.length) return '<div class="apontamento-empty">Nenhum apontamento com tempo trabalhado registrado ainda.</div>';

  return `<div class="apontamento-horas-history-list">${comTempo.map(item => `
    <article class="apontamento-horas-history-item">
      <div class="apontamento-horas-history-top">
        <div>
          <strong>${escapeHTML(item.produtoNome || 'Produto')}</strong>
          <div class="apontamento-meta">
            <span>${formatDate(item.data)}</span>
            ${item.celula ? `<span>${escapeHTML(item.celula)}</span>` : ''}
            ${Array.isArray(item.funcionarioNomes) && item.funcionarioNomes.length ? `<span>${escapeHTML(item.funcionarioNomes.join(', '))}</span>` : ''}
          </div>
        </div>
        <div class="apontamento-meta">
          <span class="apontamento-pill green">${integer(item.quantidade)} peça(s)</span>
          <span class="apontamento-pill blue">${minutesText(item.minutosTrabalhados)}</span>
        </div>
      </div>
      <div class="apontamento-meta">
        <span>${integer(item.qtdePessoas || 0)} pessoa(s)</span>
        <span>${integer(item.minutosPorPeca || 0)} min/peça</span>
        <span>${integer(item.pecasPorPessoa || 0)} peças/pessoa</span>
      </div>
    </article>
  `).join('')}</div>`;
}

function addTimeMetrics(panel, apontamentos = []) {
  const metrics = panel.querySelector('.apontamento-metrics');
  if (!metrics) return;
  metrics.querySelectorAll('[data-apontamento-horas-metric]').forEach(el => el.remove());
  const resumo = calcResumoTempo(apontamentos);
  metrics.insertAdjacentHTML('beforeend', `
    <div class="apontamento-metric" data-apontamento-horas-metric><small>Horas trabalhadas</small><strong>${minutesText(resumo.totalMinutos)}</strong></div>
    <div class="apontamento-metric" data-apontamento-horas-metric><small>Min/peça médio</small><strong>${integer(resumo.mediaMinPorPeca)}</strong></div>
    <div class="apontamento-metric" data-apontamento-horas-metric><small>Peças por pessoa</small><strong>${integer(resumo.mediaPecasPorPessoa)}</strong></div>
    <div class="apontamento-metric" data-apontamento-horas-metric><small>Valor por hora</small><strong>${money(resumo.valorHora)}</strong></div>
  `);
}

function addHorasHistory(panel, apontamentos = []) {
  const area = panel.querySelector('[data-apontamento-producao-panel]');
  if (!area) return;
  let section = area.querySelector('[data-apontamento-horas-history]');
  if (!section) {
    section = document.createElement('section');
    section.className = 'apontamento-horas-card apontamento-horas-history';
    section.dataset.apontamentoHorasHistory = 'true';
    area.appendChild(section);
  }
  section.innerHTML = `
    <div class="apontamento-history-head">
      <div><span class="kicker">Tempo trabalhado</span><h3>Resumo de horas por apontamento</h3></div>
      <span class="apontamento-pill blue">${apontamentos.filter(a => Number(a.minutosTrabalhados || 0) > 0).length} com tempo</span>
    </div>
    ${horasHistoryHTML(apontamentos)}
  `;
}

function injectFuncionarioCard(panel, funcionarios, apontamentos) {
  if (!isAdmin()) return;
  const area = panel.querySelector('[data-apontamento-producao-panel]');
  const grid = area?.querySelector('.apontamento-grid');
  if (!grid) return;
  grid.querySelector('[data-apontamento-horas-admin]')?.remove();
  const launchCard = grid.querySelector('[data-apontamento-form]')?.closest('.apontamento-card');
  const wrap = document.createElement('div');
  wrap.innerHTML = adminFuncionarioCardHTML(funcionarios, apontamentos).trim();
  const card = wrap.firstElementChild;
  if (launchCard) launchCard.insertAdjacentElement('beforebegin', card);
  else grid.appendChild(card);
}

function injectHorasFields(panel, funcionarios) {
  const form = panel.querySelector('[data-apontamento-form]');
  if (!form) return;
  form.querySelector('[data-horas-fields]')?.remove();
  const grid = form.querySelector('.apontamento-form-grid');
  if (!grid) return;
  const observacoes = grid.querySelector('textarea[name="observacoes"]')?.closest('.form-group');
  const wrap = document.createElement('div');
  wrap.className = 'form-group full';
  wrap.dataset.horasFields = 'true';
  wrap.innerHTML = `
    <label>Funcionários que trabalharam</label>
    ${funcionarioPickerHTML(funcionarios)}
    <div class="apontamento-horas-form-grid" style="margin-top:12px">
      <div class="form-group"><label>Minutos trabalhados manual</label><input name="minutosTrabalhadosManual" inputmode="numeric" placeholder="Opcional, se precisar ajustar" /></div>
      <div class="form-group"><label>Quantidade de pessoas manual</label><input name="qtdePessoasManual" inputmode="decimal" placeholder="Opcional" /></div>
    </div>
    <div class="apontamento-horas-preview">
      <div class="apontamento-horas-preview-row"><span>Tempo trabalhado</span><strong data-tempo-preview>0min</strong></div>
      <div class="apontamento-horas-preview-row"><span>Indicadores</span><strong data-indicadores-preview>0 min/peça • 0 peças/pessoa</strong></div>
    </div>
  `;
  if (observacoes) observacoes.insertAdjacentElement('beforebegin', wrap);
  else grid.appendChild(wrap);
}

function bindFuncionarioAdmin(panel, empresaId, funcionarios) {
  const area = panel.querySelector('[data-apontamento-producao-panel]');
  const form = area?.querySelector('[data-funcionario-form]');
  if (form && form.dataset.boundHoras !== PATCH_VERSION) {
    form.dataset.boundHoras = PATCH_VERSION;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isAdmin()) return;
      const btn = event.submitter;
      const old = btn?.innerHTML;
      if (btn) { btn.disabled = true; btn.innerHTML = 'Cadastrando...'; }
      try {
        const data = new FormData(form);
        const nome = String(data.get('nome') || '').trim();
        const minutosDia = parseNumber(data.get('minutosDia'));
        if (!nome) throw new Error('Informe o nome do funcionário.');
        if (minutosDia <= 0) throw new Error('Informe os minutos trabalhados por dia.');
        await addDoc(collection(db, 'empresa_funcionarios'), {
          empresaId,
          nome,
          minutosDia,
          celula: String(data.get('celula') || '').trim(),
          funcao: String(data.get('funcao') || '').trim(),
          ativo: String(data.get('ativo')) !== 'false',
          criadoEm: serverTimestamp(),
          criadoPor: auth.currentUser?.uid || '',
          atualizadoEm: serverTimestamp(),
          atualizadoPor: auth.currentUser?.uid || ''
        });
        form.reset();
        await refreshPanel(panel, true);
      } catch (error) {
        alert(error?.message || 'Erro ao cadastrar funcionário.');
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = old || 'Cadastrar funcionário'; }
      }
    });
  }

  area?.querySelectorAll('[data-toggle-funcionario]').forEach(btn => {
    if (btn.dataset.boundHoras === PATCH_VERSION) return;
    btn.dataset.boundHoras = PATCH_VERSION;
    btn.addEventListener('click', async () => {
      if (!isAdmin()) return;
      const old = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Atualizando...';
      try {
        await updateDoc(doc(db, 'empresa_funcionarios', btn.dataset.toggleFuncionario), {
          ativo: btn.dataset.nextStatus === 'true',
          atualizadoEm: serverTimestamp(),
          atualizadoPor: auth.currentUser?.uid || ''
        });
        await refreshPanel(panel, true);
      } catch (error) {
        alert(error?.message || 'Erro ao atualizar funcionário.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = old;
      }
    });
  });

  area?.querySelectorAll('[data-delete-funcionario]').forEach(btn => {
    if (btn.dataset.boundHoras === PATCH_VERSION) return;
    btn.dataset.boundHoras = PATCH_VERSION;
    btn.addEventListener('click', async () => {
      if (!isAdmin()) return;
      const funcionario = funcionarios.find(f => f.id === btn.dataset.deleteFuncionario);
      const ok = confirm(`Excluir o funcionário "${funcionario?.nome || 'funcionário'}"?\n\nOs apontamentos já feitos continuam preservados com nome e minutos salvos no histórico.`);
      if (!ok) return;
      const old = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Excluindo...';
      try {
        await deleteDoc(doc(db, 'empresa_funcionarios', btn.dataset.deleteFuncionario));
        await refreshPanel(panel, true);
      } catch (error) {
        alert(error?.message || 'Erro ao excluir funcionário.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = old;
      }
    });
  });
}

function calcFormTempo(form, funcionarios) {
  const ids = Array.from(form.querySelectorAll('input[name="funcionarioIds"]:checked')).map(input => input.value);
  const selecionados = funcionarios.filter(f => ids.includes(f.id));
  const autoMinutos = selecionados.reduce((sum, f) => sum + Number(f.minutosDia || 0), 0);
  const manualMinutos = parseNumber(form.querySelector('input[name="minutosTrabalhadosManual"]')?.value);
  const manualPessoas = parseNumber(form.querySelector('input[name="qtdePessoasManual"]')?.value);
  return {
    selecionados,
    minutosTrabalhados: manualMinutos > 0 ? manualMinutos : autoMinutos,
    qtdePessoas: manualPessoas > 0 ? manualPessoas : selecionados.length
  };
}

function bindFormPreview(panel, funcionarios) {
  const form = panel.querySelector('[data-apontamento-form]');
  if (!form) return;
  const quantidadeInput = form.querySelector('input[name="quantidade"]');
  const tempoPreview = form.querySelector('[data-tempo-preview]');
  const indicadoresPreview = form.querySelector('[data-indicadores-preview]');

  function sync() {
    const quantidade = parseNumber(quantidadeInput?.value);
    const tempo = calcFormTempo(form, funcionarios);
    const minPorPeca = quantidade > 0 ? tempo.minutosTrabalhados / quantidade : 0;
    const pecasPorPessoa = tempo.qtdePessoas > 0 ? quantidade / tempo.qtdePessoas : 0;
    if (tempoPreview) tempoPreview.textContent = `${minutesText(tempo.minutosTrabalhados)} • ${integer(tempo.qtdePessoas)} pessoa(s)`;
    if (indicadoresPreview) indicadoresPreview.textContent = `${integer(minPorPeca)} min/peça • ${integer(pecasPorPessoa)} peças/pessoa`;
  }

  form.querySelectorAll('input[name="funcionarioIds"], input[name="minutosTrabalhadosManual"], input[name="qtdePessoasManual"], input[name="quantidade"]').forEach(input => {
    if (input.dataset.boundHorasPreview === PATCH_VERSION) return;
    input.dataset.boundHorasPreview = PATCH_VERSION;
    input.addEventListener('input', sync);
    input.addEventListener('change', sync);
  });
  sync();
}

async function saveApontamentoComHoras(form) {
  const panel = form.closest('.company-ecosystem-panel');
  const empresaId = getEmpresaIdFromContext(panel);
  if (!empresaId) throw new Error('Empresa não identificada para salvar o apontamento.');

  const [produtos, funcionarios] = await Promise.all([
    queryEmpresa('empresa_produtos', empresaId),
    queryEmpresa('empresa_funcionarios', empresaId)
  ]);

  const data = new FormData(form);
  const produto = produtos.find(p => p.id === data.get('produtoId'));
  if (!produto || produto.ativo === false) throw new Error('Selecione um produto ativo cadastrado pela administração.');

  const quantidade = parseNumber(data.get('quantidade'));
  if (quantidade <= 0) throw new Error('Informe uma quantidade produzida maior que zero.');

  const tempo = calcFormTempo(form, funcionarios);
  if (tempo.minutosTrabalhados <= 0) throw new Error('Marque os funcionários que trabalharam ou informe os minutos trabalhados manualmente.');
  if (tempo.qtdePessoas <= 0) throw new Error('Marque os funcionários ou informe a quantidade de pessoas manualmente.');

  const valorVenda = Number(produto.valorVenda || 0);
  const totalVenda = Number((quantidade * valorVenda).toFixed(2));
  const minutosPorPeca = quantidade > 0 ? tempo.minutosTrabalhados / quantidade : 0;
  const pecasPorPessoa = tempo.qtdePessoas > 0 ? quantidade / tempo.qtdePessoas : 0;
  const selecionados = tempo.selecionados.map(f => ({ id: f.id, nome: f.nome || '', minutosDia: Number(f.minutosDia || 0), celula: f.celula || '', funcao: f.funcao || '' }));

  await addDoc(collection(db, 'empresa_apontamentos'), {
    empresaId,
    data: String(data.get('data') || todayISO()),
    produtoId: produto.id,
    produtoNome: produto.nome || '',
    produtoReferencia: produto.referencia || '',
    produtoCategoria: produto.categoria || '',
    quantidade,
    valorVenda,
    totalVenda,
    funcionarioIds: selecionados.map(f => f.id),
    funcionarioNomes: selecionados.map(f => f.nome).filter(Boolean),
    funcionarios: selecionados,
    qtdePessoas: Number(tempo.qtdePessoas || 0),
    minutosTrabalhados: Number(tempo.minutosTrabalhados || 0),
    horasTrabalhadas: Number((Number(tempo.minutosTrabalhados || 0) / 60).toFixed(2)),
    minutosPorPeca: Number(minutosPorPeca.toFixed(2)),
    pecasPorPessoa: Number(pecasPorPessoa.toFixed(2)),
    celula: String(data.get('celula') || '').trim(),
    observacoes: String(data.get('observacoes') || '').trim(),
    criadoEm: serverTimestamp(),
    criadoPor: auth.currentUser?.uid || '',
    criadoPorNome: perfilAtual?.nome || auth.currentUser?.email || '',
    atualizadoEm: serverTimestamp(),
    atualizadoPor: auth.currentUser?.uid || ''
  });

  form.reset();
  const dataInput = form.querySelector('input[name="data"]');
  if (dataInput) dataInput.value = todayISO();
  await refreshPanel(panel, true);
}

async function refreshPanel(panel, force = false) {
  if (!panel) return;
  delete panel.dataset.apontamentoHorasPatch;
  delete panel.dataset.apontamentoPatch;
  await new Promise(resolve => setTimeout(resolve, 120));
  if (force) scheduleEnhance();
  document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

async function enhancePanel(panel, force = false) {
  if (!authReady || !perfilAtual || !panel) return;
  const empresaId = getEmpresaIdFromContext(panel);
  if (!empresaId) return;
  const key = `${empresaId}:${PATCH_VERSION}`;
  const alreadyReady = panel.dataset.apontamentoHorasPatch === key && panel.querySelector('[data-horas-fields]') && (!isAdmin() || panel.querySelector('[data-apontamento-horas-admin]'));
  if (!force && alreadyReady) return;
  if (loadingPanels.has(panel)) return;

  loadingPanels.add(panel);
  injectStyles();
  try {
    const [funcionarios, apontamentos] = await Promise.all([
      queryEmpresa('empresa_funcionarios', empresaId),
      queryEmpresa('empresa_apontamentos', empresaId)
    ]);
    addTimeMetrics(panel, apontamentos);
    injectFuncionarioCard(panel, funcionarios, apontamentos);
    injectHorasFields(panel, funcionarios);
    addHorasHistory(panel, apontamentos);
    bindFuncionarioAdmin(panel, empresaId, funcionarios);
    bindFormPreview(panel, funcionarios);
    panel.dataset.apontamentoHorasPatch = key;
  } catch (error) {
    console.error('Erro no complemento de horas do apontamento:', error);
  } finally {
    loadingPanels.delete(panel);
  }
}

function enhanceAll(force = false) {
  if (!authReady || !perfilAtual) return;
  document.querySelectorAll('.company-ecosystem-panel').forEach(panel => {
    enhancePanel(panel, force).catch(error => console.error(error));
  });
}

function scheduleEnhance() {
  clearTimeout(enhanceTimer);
  enhanceTimer = setTimeout(() => enhanceAll(false), 260);
}

document.addEventListener('submit', async (event) => {
  const form = event.target?.closest?.('[data-apontamento-form]');
  if (!form || !form.querySelector('[data-horas-fields]')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const btn = event.submitter;
  const old = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = 'Salvando com horas...'; }
  try {
    await saveApontamentoComHoras(form);
  } catch (error) {
    alert(error?.message || 'Erro ao salvar apontamento com horas.');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = old || 'Salvar apontamento'; }
  }
}, true);

onAuthStateChanged(auth, async (user) => {
  authReady = true;
  if (!user) {
    perfilAtual = null;
    return;
  }
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    perfilAtual = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    perfilAtual = null;
    console.warn('Perfil indisponível para complemento de horas:', error);
  }
  scheduleEnhance();
});

const observer = new MutationObserver(scheduleEnhance);
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('load', scheduleEnhance);
window.addEventListener('popstate', () => setTimeout(scheduleEnhance, 260));
document.addEventListener('click', () => setTimeout(scheduleEnhance, 260));

console.info(`Excellence System® complemento de horas no apontamento ${PATCH_VERSION} carregado.`);
