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

const PATCH_VERSION = '20260809-64';
const STORAGE_EMPRESA_KEY = 'excellence-apontamento-empresa-id';
let perfilAtual = null;
let empresasCache = [];
let currentRoute = false;
let currentEmpresaId = '';
let enhanceTimer = null;

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

function minutesToHourLabel(minutes = 0) {
  const total = Math.max(0, Number(minutes || 0));
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  if (!h && !m) return '0h';
  if (!h) return `${m}min`;
  if (!m) return `${h}h`;
  return `${h}h ${m}min`;
}

function isAdmin() {
  return perfilAtual?.tipo === 'admin';
}

function getPerfilEmpresaId() {
  return perfilAtual?.empresaId || '';
}

async function loadEmpresas() {
  if (!isAdmin()) {
    const empresaId = getPerfilEmpresaId();
    if (!empresaId) return [];
    const snap = await getDoc(doc(db, 'empresas', empresaId));
    return snap.exists() ? [{ id: snap.id, ...snap.data() }] : [];
  }
  const snap = await getDocs(collection(db, 'empresas'));
  empresasCache = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
  return empresasCache;
}

async function queryEmpresa(collectionName, empresaId) {
  if (!empresaId) return [];
  const snap = await getDocs(query(collection(db, collectionName), where('empresaId', '==', empresaId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function sortProducts(produtos = []) {
  return [...produtos].sort((a, b) => {
    if ((a.ativo !== false) !== (b.ativo !== false)) return a.ativo !== false ? -1 : 1;
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
  });
}

function sortFuncionarios(funcionarios = []) {
  return [...funcionarios].sort((a, b) => {
    if ((a.ativo !== false) !== (b.ativo !== false)) return a.ativo !== false ? -1 : 1;
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
  });
}

function sortApontamentos(apontamentos = []) {
  return [...apontamentos].sort((a, b) => {
    const da = String(a.data || '');
    const db = String(b.data || '');
    if (da !== db) return db.localeCompare(da);
    return (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0);
  });
}

function calcResumo(apontamentos = []) {
  const totalPecas = apontamentos.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
  const totalVenda = apontamentos.reduce((sum, item) => sum + Number(item.totalVenda || 0), 0);
  const totalMinutos = apontamentos.reduce((sum, item) => sum + Number(item.minutosTrabalhados || 0), 0);
  const pessoas = apontamentos.reduce((sum, item) => sum + Number(item.quantidadePessoas || 0), 0);
  const horas = totalMinutos / 60;
  return {
    totalPecas,
    totalVenda,
    totalMinutos,
    pessoas,
    horas,
    precoMedio: totalPecas ? totalVenda / totalPecas : 0,
    pecasHora: horas ? totalPecas / horas : 0,
    valorHora: horas ? totalVenda / horas : 0
  };
}

function injectStyles() {
  if (document.getElementById('apontamento-standalone-v64-styles')) return;
  const style = document.createElement('style');
  style.id = 'apontamento-standalone-v64-styles';
  style.textContent = `
    .apontamento-page { display: grid; gap: 18px; }
    .apontamento-hero {
      border: 1px solid var(--line, #d8e5ea);
      border-radius: 24px;
      padding: 20px;
      background: linear-gradient(135deg, #073F5A 0%, #0b5678 54%, #0a3348 100%);
      color: #fff;
      box-shadow: 0 22px 50px rgba(5,36,55,.16);
    }
    .apontamento-hero h2 { margin: 4px 0 8px; color: #fff; }
    .apontamento-hero p { margin: 0; color: rgba(255,255,255,.82); max-width: 980px; }
    .apontamento-empresa-bar {
      margin-top: 16px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: end;
    }
    .apontamento-empresa-bar .form-group { min-width: min(100%, 360px); margin: 0; }
    .apontamento-empresa-bar label { color: rgba(255,255,255,.86); }
    .apontamento-empresa-bar select { background: #fff; }
    .apt-metrics { display: grid; grid-template-columns: repeat(4, minmax(145px, 1fr)); gap: 12px; }
    .apt-metric { background:#fff; border:1px solid var(--line,#d8e5ea); border-radius:18px; padding:14px; box-shadow:0 12px 24px rgba(5,36,55,.06); }
    .apt-metric small { display:block; color:var(--muted,#607788); font-weight:900; margin-bottom:5px; }
    .apt-metric strong { color:var(--primary-dark,#073F5A); font-size:20px; }
    .apt-grid { display:grid; grid-template-columns: minmax(320px,.95fr) minmax(360px,1.05fr); gap:16px; align-items:start; }
    .apt-grid.one { grid-template-columns: 1fr; }
    .apt-card { background:#fff; border:1px solid var(--line,#d8e5ea); border-radius:20px; padding:16px; box-shadow:0 14px 32px rgba(5,36,55,.06); }
    .apt-card h3 { margin:4px 0 8px; color:var(--primary-dark,#073F5A); }
    .apt-card p { margin:0 0 14px; color:var(--muted,#607788); }
    .apt-form-grid { display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap:12px; }
    .apt-form-grid .full { grid-column:1/-1; }
    .apt-list { display:grid; gap:10px; margin-top:14px; max-height:430px; overflow:auto; padding-right:4px; }
    .apt-item { border:1px solid var(--line,#d8e5ea); border-radius:16px; padding:12px; background:linear-gradient(180deg,#fff,#f8fbfd); display:grid; gap:8px; }
    .apt-item.inativo { opacity:.62; }
    .apt-item-top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .apt-item-top strong { color:var(--primary-dark,#073F5A); }
    .apt-meta { display:flex; flex-wrap:wrap; gap:8px; color:var(--muted,#607788); font-size:12px; font-weight:800; }
    .apt-pill { display:inline-flex; align-items:center; border-radius:999px; padding:5px 9px; background:rgba(7,63,90,.08); color:var(--primary-dark,#073F5A); font-weight:900; font-size:12px; white-space:nowrap; }
    .apt-pill.gold { background:rgba(214,168,66,.16); color:#8a6415; }
    .apt-pill.green { background:rgba(34,139,86,.12); color:#11643a; }
    .apt-actions { display:flex; justify-content:flex-end; gap:8px; flex-wrap:wrap; }
    .apt-total-box { margin-top:12px; border-radius:16px; border:1px solid rgba(214,168,66,.38); background:rgba(214,168,66,.10); padding:12px; display:grid; gap:6px; color:#72510f; font-weight:900; }
    .apt-total-line { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }
    .apt-check-grid { display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap:8px; max-height:220px; overflow:auto; padding:4px; border:1px solid var(--line,#d8e5ea); border-radius:14px; background:#f8fbfd; }
    .apt-check { display:flex; align-items:flex-start; gap:8px; border:1px solid var(--line,#d8e5ea); background:#fff; border-radius:12px; padding:10px; cursor:pointer; }
    .apt-check input { margin-top:3px; }
    .apt-check strong { display:block; color:var(--primary-dark,#073F5A); }
    .apt-empty { border:1px dashed var(--line-strong,#bdd3dd); border-radius:16px; padding:18px; color:var(--muted,#607788); text-align:center; background:#fff; }
    .apt-history { display:grid; gap:10px; }
    @media (max-width: 1120px) { .apt-metrics { grid-template-columns: repeat(2,minmax(0,1fr)); } .apt-grid { grid-template-columns:1fr; } }
    @media (max-width: 720px) { .apt-metrics { grid-template-columns:1fr; } .apt-form-grid { grid-template-columns:1fr; } .apt-check-grid { grid-template-columns:1fr; } .apt-item-top { flex-direction:column; } .apt-actions { justify-content:flex-start; } .apontamento-hero { border-radius:18px; padding:16px; } }
  `;
  document.head.appendChild(style);
}

function setButtonLoading(btn, loading, text = 'Salvando...') {
  if (!btn) return;
  if (loading) {
    btn.dataset.oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = text;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.oldText || btn.innerHTML;
  }
}

function toast(message, type = 'success') {
  const existing = document.querySelector('.toast-message');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = `notice ${type} toast-message`;
  el.style.position = 'fixed';
  el.style.right = '18px';
  el.style.bottom = '18px';
  el.style.zIndex = '100';
  el.style.maxWidth = '420px';
  el.innerHTML = escapeHTML(message);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function productOptions(produtos = []) {
  const ativos = produtos.filter(p => p.ativo !== false);
  if (!ativos.length) return '<option value="">Nenhum produto ativo cadastrado</option>';
  return '<option value="">Selecione um produto</option>' + ativos.map(p => `
    <option value="${escapeHTML(p.id)}">${escapeHTML(p.nome || 'Produto')} ${p.referencia ? `• ${escapeHTML(p.referencia)}` : ''} — ${money(p.valorVenda)}</option>
  `).join('');
}

function productListHTML(produtos = [], apontamentos = []) {
  const sorted = sortProducts(produtos);
  if (!sorted.length) return '<div class="apt-empty">Nenhum produto cadastrado ainda.</div>';
  return `<div class="apt-list">${sorted.map(produto => {
    const usado = apontamentos.some(a => a.produtoId === produto.id);
    return `
      <article class="apt-item ${produto.ativo === false ? 'inativo' : ''}">
        <div class="apt-item-top">
          <div>
            <strong>${escapeHTML(produto.nome || 'Produto')}</strong>
            <div class="apt-meta">
              ${produto.referencia ? `<span>Ref.: ${escapeHTML(produto.referencia)}</span>` : ''}
              ${produto.categoria ? `<span>${escapeHTML(produto.categoria)}</span>` : ''}
              <span>${produto.ativo === false ? 'Inativo' : 'Ativo'}</span>
            </div>
          </div>
          <span class="apt-pill gold">${money(produto.valorVenda)}</span>
        </div>
        <div class="apt-actions">
          <button class="btn btn-small btn-soft" type="button" data-apt-toggle-produto="${escapeHTML(produto.id)}" data-next-status="${produto.ativo === false ? 'true' : 'false'}">${produto.ativo === false ? 'Ativar' : 'Desativar'}</button>
          <button class="btn btn-small btn-danger" type="button" data-apt-delete-produto="${escapeHTML(produto.id)}">Excluir</button>
        </div>
        ${usado ? '<small class="muted">Histórico preservado nos apontamentos já lançados.</small>' : ''}
      </article>
    `;
  }).join('')}</div>`;
}

function funcionarioListHTML(funcionarios = [], apontamentos = []) {
  const sorted = sortFuncionarios(funcionarios);
  if (!sorted.length) return '<div class="apt-empty">Nenhum funcionário cadastrado ainda.</div>';
  return `<div class="apt-list">${sorted.map(func => {
    const usado = apontamentos.some(a => Array.isArray(a.funcionarios) && a.funcionarios.some(f => f.id === func.id));
    return `
      <article class="apt-item ${func.ativo === false ? 'inativo' : ''}">
        <div class="apt-item-top">
          <div>
            <strong>${escapeHTML(func.nome || 'Funcionário')}</strong>
            <div class="apt-meta">
              <span>${minutesToHourLabel(func.minutosDia)} por dia</span>
              ${func.funcao ? `<span>${escapeHTML(func.funcao)}</span>` : ''}
              ${func.celula ? `<span>${escapeHTML(func.celula)}</span>` : ''}
              <span>${func.ativo === false ? 'Inativo' : 'Ativo'}</span>
            </div>
          </div>
          <span class="apt-pill green">${Number(func.minutosDia || 0)} min</span>
        </div>
        <div class="apt-actions">
          <button class="btn btn-small btn-soft" type="button" data-apt-toggle-func="${escapeHTML(func.id)}" data-next-status="${func.ativo === false ? 'true' : 'false'}">${func.ativo === false ? 'Ativar' : 'Desativar'}</button>
          <button class="btn btn-small btn-danger" type="button" data-apt-delete-func="${escapeHTML(func.id)}">Excluir</button>
        </div>
        ${usado ? '<small class="muted">Os apontamentos antigos guardam a carga horária gravada na data do lançamento.</small>' : ''}
      </article>
    `;
  }).join('')}</div>`;
}

function funcionariosCheckboxHTML(funcionarios = []) {
  const ativos = sortFuncionarios(funcionarios).filter(f => f.ativo !== false);
  if (!ativos.length) return '<div class="apt-empty">Cadastre funcionários ativos para calcular horas trabalhadas.</div>';
  return `<div class="apt-check-grid">${ativos.map(func => `
    <label class="apt-check">
      <input type="checkbox" name="funcionarios" value="${escapeHTML(func.id)}" />
      <span>
        <strong>${escapeHTML(func.nome || 'Funcionário')}</strong>
        <small>${minutesToHourLabel(func.minutosDia)} por dia${func.funcao ? ` • ${escapeHTML(func.funcao)}` : ''}</small>
      </span>
    </label>
  `).join('')}</div>`;
}

function adminFormsHTML(produtos, funcionarios, apontamentos) {
  return `
    <div class="apt-grid">
      <section class="apt-card">
        <span class="kicker">Produtos</span>
        <h3>Cadastro de produtos e valores</h3>
        <p>Cadastre produto, referência e valor de venda para o lançamento rápido.</p>
        <form data-apt-produto-form>
          <div class="apt-form-grid">
            <div class="form-group full"><label>Nome do produto</label><input name="nome" required placeholder="Ex.: Camisa, Calça, Bermuda" /></div>
            <div class="form-group"><label>Referência/código</label><input name="referencia" placeholder="Opcional" /></div>
            <div class="form-group"><label>Categoria/linha</label><input name="categoria" placeholder="Opcional" /></div>
            <div class="form-group"><label>Valor de venda da peça</label><input name="valorVenda" required inputmode="decimal" placeholder="Ex.: 59,90" /></div>
            <div class="form-group"><label>Status</label><select name="ativo"><option value="true">Ativo</option><option value="false">Inativo</option></select></div>
          </div>
          <button class="btn btn-primary" type="submit">Cadastrar produto</button>
        </form>
        <div data-apt-produto-list>${productListHTML(produtos, apontamentos)}</div>
      </section>

      <section class="apt-card">
        <span class="kicker">Equipe</span>
        <h3>Funcionários e minutos diários</h3>
        <p>Informe manualmente quantos minutos por dia cada funcionário trabalha. O apontamento usa esse valor para calcular as horas.</p>
        <form data-apt-func-form>
          <div class="apt-form-grid">
            <div class="form-group full"><label>Nome do funcionário</label><input name="nome" required placeholder="Ex.: Maria, João..." /></div>
            <div class="form-group"><label>Minutos trabalhados por dia</label><input name="minutosDia" required inputmode="numeric" placeholder="Ex.: 480" /></div>
            <div class="form-group"><label>Função</label><input name="funcao" placeholder="Opcional" /></div>
            <div class="form-group"><label>Célula/equipe</label><input name="celula" placeholder="Opcional" /></div>
            <div class="form-group"><label>Status</label><select name="ativo"><option value="true">Ativo</option><option value="false">Inativo</option></select></div>
          </div>
          <button class="btn btn-primary" type="submit">Cadastrar funcionário</button>
        </form>
        <div data-apt-func-list>${funcionarioListHTML(funcionarios, apontamentos)}</div>
      </section>
    </div>
  `;
}

function lancamentoFormHTML(produtos, funcionarios, canAdmin) {
  return `
    <section class="apt-card">
      <span class="kicker">Produção</span>
      <h3>Registrar apontamento</h3>
      <p>${canAdmin ? 'O administrador também pode lançar produção.' : 'Selecione o produto, quantidade e quem trabalhou no dia.'}</p>
      <form data-apt-lancamento-form>
        <div class="apt-form-grid">
          <div class="form-group full"><label>Produto</label><select name="produtoId" required>${productOptions(produtos)}</select></div>
          <div class="form-group"><label>Quantidade produzida</label><input name="quantidade" required inputmode="decimal" placeholder="Ex.: 50" /></div>
          <div class="form-group"><label>Data</label><input name="data" type="date" value="${todayISO()}" /></div>
          <div class="form-group"><label>Célula/equipe</label><input name="celula" placeholder="Opcional" /></div>
          <div class="form-group full"><label>Funcionários que trabalharam</label>${funcionariosCheckboxHTML(funcionarios)}</div>
          <div class="form-group full"><label>Observações/ocorrências</label><textarea name="observacoes" placeholder="Ex.: produção parcial, ajuste, sobra, retrabalho..."></textarea></div>
        </div>
        <div class="apt-total-box" data-apt-preview>
          <div class="apt-total-line"><span>Valor total</span><strong>${money(0)}</strong></div>
          <div class="apt-total-line"><span>Tempo trabalhado</span><strong>0h</strong></div>
          <div class="apt-total-line"><span>Indicadores</span><strong>0 min/peça • 0 peças/pessoa</strong></div>
        </div>
        <button class="btn btn-gold" type="submit">Salvar apontamento</button>
      </form>
    </section>
  `;
}

function historyHTML(apontamentos = []) {
  const sorted = sortApontamentos(apontamentos).slice(0, 50);
  if (!sorted.length) return '<div class="apt-empty">Nenhum apontamento registrado ainda.</div>';
  return `<div class="apt-history">${sorted.map(item => {
    const canDelete = isAdmin() || item.criadoPor === auth.currentUser?.uid;
    const funcs = Array.isArray(item.funcionarios) ? item.funcionarios.map(f => f.nome).filter(Boolean).join(', ') : '';
    return `
      <article class="apt-item">
        <div class="apt-item-top">
          <div>
            <strong>${escapeHTML(item.produtoNome || 'Produto')}</strong>
            <div class="apt-meta">
              <span>${formatDate(item.data)}</span>
              ${item.produtoReferencia ? `<span>Ref.: ${escapeHTML(item.produtoReferencia)}</span>` : ''}
              ${item.celula ? `<span>${escapeHTML(item.celula)}</span>` : ''}
              ${item.criadoPorNome ? `<span>Por: ${escapeHTML(item.criadoPorNome)}</span>` : ''}
            </div>
          </div>
          <div class="apt-meta">
            <span class="apt-pill green">${integer(item.quantidade)} peça(s)</span>
            <span class="apt-pill gold">${money(item.totalVenda)}</span>
          </div>
        </div>
        <div class="apt-meta">
          <span>${minutesToHourLabel(item.minutosTrabalhados || 0)} trabalhadas</span>
          <span>${Number(item.quantidadePessoas || 0)} pessoa(s)</span>
          <span>${integer(item.minutosPorPeca || 0)} min/peça</span>
          <span>${integer(item.pecasPorPessoa || 0)} peças/pessoa</span>
          <span>${money(item.valorPorHora || 0)}/hora</span>
        </div>
        ${funcs ? `<small><strong>Equipe:</strong> ${escapeHTML(funcs)}</small>` : ''}
        ${item.observacoes ? `<small>${escapeHTML(item.observacoes)}</small>` : ''}
        ${canDelete ? `<div class="apt-actions"><button class="btn btn-small btn-danger" type="button" data-apt-delete-apontamento="${escapeHTML(item.id)}">Excluir apontamento</button></div>` : ''}
      </article>
    `;
  }).join('')}</div>`;
}

function pageHTML({ empresas, empresaId, empresaNome, produtos, funcionarios, apontamentos }) {
  const canAdmin = isAdmin();
  const resumo = calcResumo(apontamentos);
  const empresaSelect = canAdmin ? `
    <div class="apontamento-empresa-bar">
      <div class="form-group">
        <label>Empresa do apontamento</label>
        <select data-apt-empresa-select>
          ${empresas.map(e => `<option value="${escapeHTML(e.id)}" ${e.id === empresaId ? 'selected' : ''}>${escapeHTML(e.nome || 'Empresa')}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-gold" type="button" data-apt-refresh>Atualizar</button>
    </div>
  ` : `<div class="apontamento-empresa-bar"><span class="apt-pill gold">${escapeHTML(empresaNome || 'Minha empresa')}</span><button class="btn btn-gold" type="button" data-apt-refresh>Atualizar</button></div>`;

  return `
    <section class="apontamento-hero">
      <span class="kicker">Área própria</span>
      <h2>Apontamento de produção</h2>
      <p>Área separada do Ecossistema documental. Aqui ficam produtos, funcionários, minutos diários, produção lançada, horas trabalhadas e indicadores.</p>
      ${empresaSelect}
    </section>

    <section class="apt-metrics">
      <div class="apt-metric"><small>Peças produzidas</small><strong>${integer(resumo.totalPecas)}</strong></div>
      <div class="apt-metric"><small>Valor total</small><strong>${money(resumo.totalVenda)}</strong></div>
      <div class="apt-metric"><small>Horas trabalhadas</small><strong>${minutesToHourLabel(resumo.totalMinutos)}</strong></div>
      <div class="apt-metric"><small>Peças por hora</small><strong>${integer(resumo.pecasHora)}</strong></div>
    </section>

    ${canAdmin ? adminFormsHTML(produtos, funcionarios, apontamentos) : ''}

    <div class="apt-grid one">
      ${lancamentoFormHTML(produtos, funcionarios, canAdmin)}
    </div>

    <section class="apt-card">
      <div class="apt-item-top" style="margin-bottom:12px;">
        <div><span class="kicker">Histórico</span><h3>Últimos apontamentos</h3></div>
        <span class="apt-pill">${apontamentos.length} registro(s)</span>
      </div>
      ${historyHTML(apontamentos)}
    </section>
  `;
}

function updatePreview(area, produtos, funcionarios) {
  const form = area.querySelector('[data-apt-lancamento-form]');
  if (!form) return;
  const produto = produtos.find(p => p.id === form.produtoId?.value);
  const quantidade = parseNumber(form.quantidade?.value);
  const selectedIds = Array.from(form.querySelectorAll('input[name="funcionarios"]:checked')).map(input => input.value);
  const selectedFuncionarios = funcionarios.filter(f => selectedIds.includes(f.id));
  const totalVenda = produto ? quantidade * Number(produto.valorVenda || 0) : 0;
  const minutos = selectedFuncionarios.reduce((sum, f) => sum + Number(f.minutosDia || 0), 0);
  const pessoas = selectedFuncionarios.length;
  const minPeca = quantidade ? minutos / quantidade : 0;
  const pPessoa = pessoas ? quantidade / pessoas : 0;
  const preview = area.querySelector('[data-apt-preview]');
  if (!preview) return;
  preview.innerHTML = `
    <div class="apt-total-line"><span>Valor total</span><strong>${money(totalVenda)}</strong></div>
    <div class="apt-total-line"><span>Tempo trabalhado</span><strong>${minutesToHourLabel(minutos)}</strong></div>
    <div class="apt-total-line"><span>Indicadores</span><strong>${integer(minPeca)} min/peça • ${integer(pPessoa)} peças/pessoa</strong></div>
  `;
}

async function resolveEmpresaForPage() {
  const empresas = await loadEmpresas();
  if (!isAdmin()) {
    return { empresas, empresaId: getPerfilEmpresaId(), empresaNome: empresas[0]?.nome || 'Minha empresa' };
  }
  const saved = localStorage.getItem(STORAGE_EMPRESA_KEY) || '';
  const empresaId = currentEmpresaId || saved || empresas[0]?.id || '';
  currentEmpresaId = empresas.some(e => e.id === empresaId) ? empresaId : (empresas[0]?.id || '');
  if (currentEmpresaId) localStorage.setItem(STORAGE_EMPRESA_KEY, currentEmpresaId);
  const empresaNome = empresas.find(e => e.id === currentEmpresaId)?.nome || 'Empresa';
  return { empresas, empresaId: currentEmpresaId, empresaNome };
}

async function renderApontamentoPage() {
  if (!perfilAtual || !auth.currentUser) return;
  currentRoute = true;
  injectStyles();
  markNavActive();

  const main = document.querySelector('.main');
  if (!main) return;
  main.innerHTML = `
    <header class="topbar">
      <div>
        <button class="btn btn-soft mobile-menu" id="mobileMenuBtn" type="button">☰ Menu</button>
        <h1>Apontamento</h1>
        <p>Produção, funcionários, minutos diários, horas trabalhadas e indicadores.</p>
      </div>
      <div class="topbar-actions"><button class="btn btn-gold" type="button" data-apt-refresh>Atualizar</button></div>
    </header>
    <section class="apontamento-page" data-apt-page>
      <div class="apt-empty">Carregando apontamento...</div>
    </section>
  `;
  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  const area = main.querySelector('[data-apt-page]');
  try {
    const { empresas, empresaId, empresaNome } = await resolveEmpresaForPage();
    if (!empresaId) {
      area.innerHTML = '<div class="notice error">Nenhuma empresa vinculada para exibir o apontamento.</div>';
      return;
    }

    const [produtos, funcionarios, apontamentos] = await Promise.all([
      queryEmpresa('empresa_produtos', empresaId),
      queryEmpresa('empresa_funcionarios', empresaId),
      queryEmpresa('empresa_apontamentos', empresaId)
    ]);

    area.innerHTML = pageHTML({ empresas, empresaId, empresaNome, produtos, funcionarios, apontamentos });
    bindPageEvents(area, { empresas, empresaId, empresaNome, produtos, funcionarios, apontamentos });
  } catch (error) {
    console.error('Erro na área própria de apontamento:', error);
    area.innerHTML = `<div class="notice error">Não foi possível carregar o apontamento. ${escapeHTML(error?.message || '')}</div>`;
  }
}

function bindPageEvents(area, context) {
  const { empresaId, produtos, funcionarios, apontamentos } = context;

  area.querySelectorAll('[data-apt-refresh]').forEach(btn => btn.addEventListener('click', renderApontamentoPage));

  area.querySelector('[data-apt-empresa-select]')?.addEventListener('change', async (event) => {
    currentEmpresaId = event.currentTarget.value;
    localStorage.setItem(STORAGE_EMPRESA_KEY, currentEmpresaId);
    await renderApontamentoPage();
  });

  const produtoForm = area.querySelector('[data-apt-produto-form]');
  produtoForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isAdmin()) return;
    const btn = event.submitter;
    setButtonLoading(btn, true, 'Cadastrando...');
    try {
      const form = new FormData(event.currentTarget);
      const nome = String(form.get('nome') || '').trim();
      const valorVenda = parseNumber(form.get('valorVenda'));
      if (!nome) throw new Error('Informe o nome do produto.');
      if (valorVenda <= 0) throw new Error('Informe valor de venda maior que zero.');
      await addDoc(collection(db, 'empresa_produtos'), {
        empresaId,
        nome,
        referencia: String(form.get('referencia') || '').trim(),
        categoria: String(form.get('categoria') || '').trim(),
        valorVenda,
        ativo: String(form.get('ativo')) !== 'false',
        criadoEm: serverTimestamp(),
        criadoPor: auth.currentUser?.uid || '',
        atualizadoEm: serverTimestamp(),
        atualizadoPor: auth.currentUser?.uid || ''
      });
      toast('Produto cadastrado.', 'success');
      await renderApontamentoPage();
    } catch (error) {
      alert(error?.message || 'Erro ao cadastrar produto.');
    } finally {
      setButtonLoading(btn, false);
    }
  });

  const funcForm = area.querySelector('[data-apt-func-form]');
  funcForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isAdmin()) return;
    const btn = event.submitter;
    setButtonLoading(btn, true, 'Cadastrando...');
    try {
      const form = new FormData(event.currentTarget);
      const nome = String(form.get('nome') || '').trim();
      const minutosDia = Math.round(parseNumber(form.get('minutosDia')));
      if (!nome) throw new Error('Informe o nome do funcionário.');
      if (minutosDia <= 0) throw new Error('Informe os minutos diários do funcionário.');
      await addDoc(collection(db, 'empresa_funcionarios'), {
        empresaId,
        nome,
        minutosDia,
        funcao: String(form.get('funcao') || '').trim(),
        celula: String(form.get('celula') || '').trim(),
        ativo: String(form.get('ativo')) !== 'false',
        criadoEm: serverTimestamp(),
        criadoPor: auth.currentUser?.uid || '',
        atualizadoEm: serverTimestamp(),
        atualizadoPor: auth.currentUser?.uid || ''
      });
      toast('Funcionário cadastrado.', 'success');
      await renderApontamentoPage();
    } catch (error) {
      alert(error?.message || 'Erro ao cadastrar funcionário.');
    } finally {
      setButtonLoading(btn, false);
    }
  });

  area.querySelectorAll('[data-apt-toggle-produto]').forEach(btn => btn.addEventListener('click', async () => {
    if (!isAdmin()) return;
    setButtonLoading(btn, true, 'Atualizando...');
    try {
      await updateDoc(doc(db, 'empresa_produtos', btn.dataset.aptToggleProduto), {
        ativo: btn.dataset.nextStatus === 'true',
        atualizadoEm: serverTimestamp(),
        atualizadoPor: auth.currentUser?.uid || ''
      });
      await renderApontamentoPage();
    } catch (error) {
      alert(error?.message || 'Erro ao atualizar produto.');
    } finally {
      setButtonLoading(btn, false);
    }
  }));

  area.querySelectorAll('[data-apt-toggle-func]').forEach(btn => btn.addEventListener('click', async () => {
    if (!isAdmin()) return;
    setButtonLoading(btn, true, 'Atualizando...');
    try {
      await updateDoc(doc(db, 'empresa_funcionarios', btn.dataset.aptToggleFunc), {
        ativo: btn.dataset.nextStatus === 'true',
        atualizadoEm: serverTimestamp(),
        atualizadoPor: auth.currentUser?.uid || ''
      });
      await renderApontamentoPage();
    } catch (error) {
      alert(error?.message || 'Erro ao atualizar funcionário.');
    } finally {
      setButtonLoading(btn, false);
    }
  }));

  area.querySelectorAll('[data-apt-delete-produto]').forEach(btn => btn.addEventListener('click', async () => {
    if (!isAdmin()) return;
    const produto = produtos.find(p => p.id === btn.dataset.aptDeleteProduto);
    if (!confirm(`Excluir o produto "${produto?.nome || 'produto'}"?`)) return;
    setButtonLoading(btn, true, 'Excluindo...');
    try {
      await deleteDoc(doc(db, 'empresa_produtos', btn.dataset.aptDeleteProduto));
      await renderApontamentoPage();
    } catch (error) {
      alert(error?.message || 'Erro ao excluir produto.');
    } finally {
      setButtonLoading(btn, false);
    }
  }));

  area.querySelectorAll('[data-apt-delete-func]').forEach(btn => btn.addEventListener('click', async () => {
    if (!isAdmin()) return;
    const func = funcionarios.find(f => f.id === btn.dataset.aptDeleteFunc);
    if (!confirm(`Excluir o funcionário "${func?.nome || 'funcionário'}"?`)) return;
    setButtonLoading(btn, true, 'Excluindo...');
    try {
      await deleteDoc(doc(db, 'empresa_funcionarios', btn.dataset.aptDeleteFunc));
      await renderApontamentoPage();
    } catch (error) {
      alert(error?.message || 'Erro ao excluir funcionário.');
    } finally {
      setButtonLoading(btn, false);
    }
  }));

  const lancamentoForm = area.querySelector('[data-apt-lancamento-form]');
  lancamentoForm?.addEventListener('input', () => updatePreview(area, produtos, funcionarios));
  lancamentoForm?.addEventListener('change', () => updatePreview(area, produtos, funcionarios));
  lancamentoForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = event.submitter;
    setButtonLoading(btn, true, 'Salvando...');
    try {
      const form = new FormData(event.currentTarget);
      const produto = produtos.find(p => p.id === form.get('produtoId'));
      if (!produto || produto.ativo === false) throw new Error('Selecione um produto ativo cadastrado.');
      const quantidade = parseNumber(form.get('quantidade'));
      if (quantidade <= 0) throw new Error('Informe quantidade produzida maior que zero.');
      const ativos = funcionarios.filter(f => f.ativo !== false);
      const selectedIds = form.getAll('funcionarios').map(String);
      if (ativos.length && !selectedIds.length) throw new Error('Marque ao menos um funcionário para calcular as horas trabalhadas.');
      const selectedFuncionarios = funcionarios.filter(f => selectedIds.includes(f.id));
      const valorVenda = Number(produto.valorVenda || 0);
      const totalVenda = Number((quantidade * valorVenda).toFixed(2));
      const minutosTrabalhados = selectedFuncionarios.reduce((sum, f) => sum + Number(f.minutosDia || 0), 0);
      const horasTrabalhadas = Number((minutosTrabalhados / 60).toFixed(4));
      const quantidadePessoas = selectedFuncionarios.length;
      const minutosPorPeca = quantidade ? Number((minutosTrabalhados / quantidade).toFixed(4)) : 0;
      const pecasPorPessoa = quantidadePessoas ? Number((quantidade / quantidadePessoas).toFixed(4)) : 0;
      const valorPorHora = horasTrabalhadas ? Number((totalVenda / horasTrabalhadas).toFixed(4)) : 0;

      await addDoc(collection(db, 'empresa_apontamentos'), {
        empresaId,
        data: String(form.get('data') || todayISO()),
        produtoId: produto.id,
        produtoNome: produto.nome || '',
        produtoReferencia: produto.referencia || '',
        produtoCategoria: produto.categoria || '',
        quantidade,
        valorVenda,
        totalVenda,
        celula: String(form.get('celula') || '').trim(),
        observacoes: String(form.get('observacoes') || '').trim(),
        funcionarios: selectedFuncionarios.map(f => ({
          id: f.id,
          nome: f.nome || '',
          minutosDia: Number(f.minutosDia || 0),
          funcao: f.funcao || '',
          celula: f.celula || ''
        })),
        quantidadePessoas,
        minutosTrabalhados,
        horasTrabalhadas,
        minutosPorPeca,
        pecasPorPessoa,
        valorPorHora,
        criadoEm: serverTimestamp(),
        criadoPor: auth.currentUser?.uid || '',
        criadoPorNome: perfilAtual?.nome || auth.currentUser?.email || '',
        atualizadoEm: serverTimestamp(),
        atualizadoPor: auth.currentUser?.uid || ''
      });
      toast('Apontamento salvo.', 'success');
      await renderApontamentoPage();
    } catch (error) {
      alert(error?.message || 'Erro ao salvar apontamento.');
    } finally {
      setButtonLoading(btn, false);
    }
  });

  area.querySelectorAll('[data-apt-delete-apontamento]').forEach(btn => btn.addEventListener('click', async () => {
    const item = apontamentos.find(a => a.id === btn.dataset.aptDeleteApontamento);
    if (!item) return;
    const canDelete = isAdmin() || item.criadoPor === auth.currentUser?.uid;
    if (!canDelete) return alert('Você só pode excluir seus próprios apontamentos.');
    if (!confirm(`Excluir o apontamento de ${item.quantidade || 0} peça(s) de ${item.produtoNome || 'produto'}?`)) return;
    setButtonLoading(btn, true, 'Excluindo...');
    try {
      await deleteDoc(doc(db, 'empresa_apontamentos', item.id));
      await renderApontamentoPage();
    } catch (error) {
      alert(error?.message || 'Erro ao excluir apontamento.');
    } finally {
      setButtonLoading(btn, false);
    }
  }));
}

function markNavActive() {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('[data-apontamento-standalone-nav]')?.classList.toggle('active', currentRoute);
}

function ensureNavButton() {
  if (!perfilAtual || !document.querySelector('.app-layout')) return;
  const nav = document.querySelector('.nav-group');
  if (!nav) return;
  let btn = nav.querySelector('[data-apontamento-standalone-nav]');
  if (!btn) {
    btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.type = 'button';
    btn.setAttribute('data-apontamento-standalone-nav', PATCH_VERSION);
    btn.innerHTML = '<span>▦</span>Apontamento';
    const before = nav.querySelector('[data-page="quem-somos"]');
    nav.insertBefore(btn, before || null);
  }
  btn.onclick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('sidebar')?.classList.remove('open');
    await renderApontamentoPage();
  };
  if (currentRoute) markNavActive();
}

function scheduleEnhance() {
  clearTimeout(enhanceTimer);
  enhanceTimer = setTimeout(ensureNavButton, 120);
}

document.addEventListener('click', (event) => {
  const appNav = event.target.closest?.('.nav-btn[data-page]');
  if (appNav && !event.target.closest('[data-apontamento-standalone-nav]')) currentRoute = false;
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    perfilAtual = null;
    currentRoute = false;
    return;
  }
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    perfilAtual = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    perfilAtual = null;
    console.warn('Perfil indisponível para apontamento separado:', error);
  }
  scheduleEnhance();
});

const observer = new MutationObserver(scheduleEnhance);
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('load', scheduleEnhance);

console.info(`Excellence System® apontamento separado ${PATCH_VERSION} carregado.`);
