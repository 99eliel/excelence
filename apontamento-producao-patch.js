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

const PATCH_VERSION = '20260806-61';
let perfilAtual = null;
let enhanceTimer = null;
let authReady = false;
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
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean.replace(/,/g, '');
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

function getEmpresaIdFromContext() {
  if (perfilAtual?.tipo === 'cliente') return perfilAtual.empresaId || '';

  const state = history.state || {};
  const meta = state.meta || {};
  const adminView = meta.adminView || {};
  if (adminView.empresaId) return adminView.empresaId;

  const key = String(state.key || '');
  const match = key.match(/admin:empresa:([^:]+):/);
  if (match) return match[1];

  return '';
}

function getEmpresaNome(panel) {
  const summaryName = panel.querySelector('.ecosystem-summary span:last-child strong')?.textContent?.trim();
  if (summaryName) return summaryName;
  const title = document.querySelector('main h1, .page-title h1, h1')?.textContent || '';
  return title.replace(/^Ecossistema:\s*/i, '').trim() || 'Empresa';
}

function isAdmin() {
  return perfilAtual?.tipo === 'admin';
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

function sortApontamentos(apontamentos = []) {
  return [...apontamentos].sort((a, b) => {
    const da = String(a.data || '');
    const db = String(b.data || '');
    if (da !== db) return db.localeCompare(da);
    const ca = a.criadoEm?.seconds || 0;
    const cb = b.criadoEm?.seconds || 0;
    return cb - ca;
  });
}

function calcResumo(apontamentos = []) {
  const totalPecas = apontamentos.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
  const totalVenda = apontamentos.reduce((sum, item) => sum + Number(item.totalVenda || 0), 0);
  return {
    totalPecas,
    totalVenda,
    precoMedio: totalPecas ? totalVenda / totalPecas : 0
  };
}

function injectStyles() {
  if (document.getElementById('apontamento-producao-v61-styles')) return;
  const style = document.createElement('style');
  style.id = 'apontamento-producao-v61-styles';
  style.textContent = `
    .apontamento-producao-panel {
      margin: 18px 0;
      border: 1px solid var(--line, #d8e5ea);
      border-radius: 22px;
      background: linear-gradient(180deg, #ffffff 0%, #f7fbfd 100%);
      box-shadow: 0 18px 45px rgba(5, 36, 55, .07);
      padding: 18px;
    }
    .apontamento-head {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .apontamento-head h2 { margin: 4px 0 6px; color: var(--primary-dark, #073F5A); }
    .apontamento-head p { margin: 0; color: var(--muted, #607788); max-width: 760px; }
    .apontamento-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(130px, 1fr));
      gap: 10px;
      min-width: min(100%, 470px);
    }
    .apontamento-metric {
      background: #fff;
      border: 1px solid var(--line, #d8e5ea);
      border-radius: 16px;
      padding: 12px;
      min-height: 72px;
    }
    .apontamento-metric small { display: block; color: var(--muted, #607788); font-weight: 800; margin-bottom: 4px; }
    .apontamento-metric strong { color: var(--primary-dark, #073F5A); font-size: 18px; }
    .apontamento-grid {
      display: grid;
      grid-template-columns: minmax(300px, .9fr) minmax(360px, 1.1fr);
      gap: 16px;
      align-items: start;
      margin-top: 14px;
    }
    .apontamento-grid.only-launch { grid-template-columns: minmax(0, 1fr); }
    .apontamento-card {
      background: #fff;
      border: 1px solid var(--line, #d8e5ea);
      border-radius: 18px;
      padding: 16px;
    }
    .apontamento-card h3 { margin: 4px 0 8px; color: var(--primary-dark, #073F5A); }
    .apontamento-card p { margin: 0 0 14px; color: var(--muted, #607788); }
    .apontamento-form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .apontamento-form-grid .full { grid-column: 1 / -1; }
    .apontamento-produto-list {
      display: grid;
      gap: 10px;
      margin-top: 14px;
      max-height: 420px;
      overflow: auto;
      padding-right: 4px;
    }
    .apontamento-produto-item,
    .apontamento-lancamento-item {
      border: 1px solid var(--line, #d8e5ea);
      border-radius: 16px;
      padding: 12px;
      background: linear-gradient(180deg, #fff, #f9fcfd);
      display: grid;
      gap: 8px;
    }
    .apontamento-produto-item.inativo { opacity: .62; }
    .apontamento-produto-top,
    .apontamento-lancamento-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .apontamento-produto-top strong,
    .apontamento-lancamento-top strong { color: var(--primary-dark, #073F5A); }
    .apontamento-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      color: var(--muted, #607788);
      font-size: 12px;
      font-weight: 800;
    }
    .apontamento-pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 5px 9px;
      background: rgba(7,63,90,.08);
      color: var(--primary-dark, #073F5A);
      font-weight: 900;
      font-size: 12px;
      white-space: nowrap;
    }
    .apontamento-pill.gold { background: rgba(214,168,66,.16); color: #8a6415; }
    .apontamento-pill.green { background: rgba(34,139,86,.12); color: #11643a; }
    .apontamento-total-box {
      margin-top: 12px;
      border-radius: 16px;
      border: 1px solid rgba(214,168,66,.38);
      background: rgba(214,168,66,.10);
      padding: 12px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      color: #72510f;
      font-weight: 900;
    }
    .apontamento-total-box strong { color: #72510f; font-size: 18px; }
    .apontamento-history { margin-top: 16px; }
    .apontamento-history-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .apontamento-history-list { display: grid; gap: 10px; }
    .apontamento-empty {
      border: 1px dashed var(--line-strong, #bdd3dd);
      border-radius: 16px;
      padding: 18px;
      color: var(--muted, #607788);
      text-align: center;
      background: #fff;
    }
    .apontamento-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    .apontamento-actions .btn { white-space: nowrap; }
    @media (max-width: 1120px) {
      .apontamento-head { flex-direction: column; }
      .apontamento-metrics { width: 100%; }
      .apontamento-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      .apontamento-producao-panel { padding: 14px; border-radius: 18px; }
      .apontamento-metrics { grid-template-columns: 1fr; }
      .apontamento-form-grid { grid-template-columns: 1fr; }
      .apontamento-produto-top, .apontamento-lancamento-top { flex-direction: column; }
      .apontamento-actions { justify-content: flex-start; }
      .apontamento-total-box { flex-direction: column; align-items: flex-start; }
    }
  `;
  document.head.appendChild(style);
}

function productOptions(produtos = []) {
  const ativos = produtos.filter(p => p.ativo !== false);
  if (!ativos.length) return '<option value="">Nenhum produto ativo cadastrado</option>';
  return '<option value="">Selecione um produto</option>' + ativos.map(p => `
    <option value="${escapeHTML(p.id)}" data-valor="${Number(p.valorVenda || 0)}">
      ${escapeHTML(p.nome || 'Produto')} ${p.referencia ? `• ${escapeHTML(p.referencia)}` : ''} — ${money(p.valorVenda)}
    </option>
  `).join('');
}

function productListHTML(produtos = [], apontamentos = []) {
  const sorted = sortProducts(produtos);
  if (!sorted.length) {
    return '<div class="apontamento-empty">Nenhum produto cadastrado ainda. Cadastre primeiro os produtos e valores para liberar o apontamento rápido.</div>';
  }

  return `<div class="apontamento-produto-list">${sorted.map(produto => {
    const usado = apontamentos.some(a => a.produtoId === produto.id);
    return `
      <article class="apontamento-produto-item ${produto.ativo === false ? 'inativo' : ''}">
        <div class="apontamento-produto-top">
          <div>
            <strong>${escapeHTML(produto.nome || 'Produto')}</strong>
            <div class="apontamento-meta">
              ${produto.referencia ? `<span>Ref.: ${escapeHTML(produto.referencia)}</span>` : ''}
              ${produto.categoria ? `<span>${escapeHTML(produto.categoria)}</span>` : ''}
              <span>${produto.ativo === false ? 'Inativo' : 'Ativo'}</span>
            </div>
          </div>
          <span class="apontamento-pill gold">${money(produto.valorVenda)}</span>
        </div>
        <div class="apontamento-actions">
          <button class="btn btn-small btn-soft" type="button" data-toggle-produto="${escapeHTML(produto.id)}" data-next-status="${produto.ativo === false ? 'true' : 'false'}">${produto.ativo === false ? 'Ativar' : 'Desativar'}</button>
          <button class="btn btn-small btn-danger" type="button" data-delete-produto="${escapeHTML(produto.id)}">Excluir</button>
        </div>
        ${usado ? '<small class="muted">Histórico preservado: os apontamentos já feitos guardam nome e valor do produto.</small>' : ''}
      </article>
    `;
  }).join('')}</div>`;
}

function lancamentosHTML(apontamentos = [], canAdmin = false) {
  const sorted = sortApontamentos(apontamentos).slice(0, 30);
  if (!sorted.length) return '<div class="apontamento-empty">Nenhum apontamento registrado ainda.</div>';

  return `<div class="apontamento-history-list">${sorted.map(item => {
    const canDelete = canAdmin || item.criadoPor === auth.currentUser?.uid;
    return `
      <article class="apontamento-lancamento-item">
        <div class="apontamento-lancamento-top">
          <div>
            <strong>${escapeHTML(item.produtoNome || 'Produto')}</strong>
            <div class="apontamento-meta">
              <span>${formatDate(item.data)}</span>
              ${item.produtoReferencia ? `<span>Ref.: ${escapeHTML(item.produtoReferencia)}</span>` : ''}
              ${item.celula ? `<span>${escapeHTML(item.celula)}</span>` : ''}
              ${item.criadoPorNome ? `<span>Por: ${escapeHTML(item.criadoPorNome)}</span>` : ''}
            </div>
          </div>
          <div class="apontamento-meta">
            <span class="apontamento-pill green">${integer(item.quantidade)} peça(s)</span>
            <span class="apontamento-pill gold">${money(item.totalVenda)}</span>
          </div>
        </div>
        ${item.observacoes ? `<small>${escapeHTML(item.observacoes)}</small>` : ''}
        <div class="apontamento-meta">
          <span>Valor unitário: ${money(item.valorVenda)}</span>
        </div>
        ${canDelete ? `<div class="apontamento-actions"><button class="btn btn-small btn-danger" type="button" data-delete-apontamento="${escapeHTML(item.id)}">Excluir apontamento</button></div>` : ''}
      </article>
    `;
  }).join('')}</div>`;
}

function adminProductFormHTML() {
  return `
    <section class="apontamento-card">
      <span class="kicker">Tabela do administrador</span>
      <h3>Cadastro de produtos e valores</h3>
      <p>Cadastre os produtos uma vez. Depois a empresa só escolhe o produto e informa a quantidade produzida.</p>
      <form data-produto-form>
        <div class="apontamento-form-grid">
          <div class="form-group full"><label>Nome do produto</label><input name="nome" required placeholder="Ex.: Camisa, Calça, Bermuda..." /></div>
          <div class="form-group"><label>Referência/código</label><input name="referencia" placeholder="Opcional" /></div>
          <div class="form-group"><label>Categoria/linha</label><input name="categoria" placeholder="Opcional" /></div>
          <div class="form-group"><label>Valor de venda da peça</label><input name="valorVenda" required inputmode="decimal" placeholder="Ex.: 59,90" /></div>
          <div class="form-group"><label>Status</label><select name="ativo"><option value="true">Ativo para apontamento</option><option value="false">Inativo</option></select></div>
        </div>
        <button class="btn btn-primary" type="submit">Cadastrar produto</button>
      </form>
      <div data-produto-list></div>
    </section>
  `;
}

function apontamentoFormHTML(produtos = [], empresaNome = '', canAdmin = false) {
  return `
    <section class="apontamento-card">
      <span class="kicker">Lançamento rápido</span>
      <h3>Registrar produção</h3>
      <p>${canAdmin ? 'Você também pode lançar produção pela administração.' : 'Escolha o produto cadastrado pela administração e informe somente a quantidade produzida.'}</p>
      <form data-apontamento-form>
        <div class="apontamento-form-grid">
          <div class="form-group full"><label>Produto</label><select name="produtoId" required>${productOptions(produtos)}</select></div>
          <div class="form-group"><label>Quantidade produzida</label><input name="quantidade" required inputmode="decimal" placeholder="Ex.: 50" /></div>
          <div class="form-group"><label>Data</label><input name="data" type="date" value="${todayISO()}" /></div>
          <div class="form-group"><label>Célula/equipe</label><select name="celula"><option value="">Não informar</option><option value="Célula 1">Célula 1</option><option value="Célula 2">Célula 2</option><option value="Célula 3">Célula 3</option><option value="Equipe externa">Equipe externa</option></select></div>
          <div class="form-group full"><label>Observações/ocorrências</label><textarea name="observacoes" placeholder="Ex.: produção parcial, ajuste, sobra, retrabalho..."></textarea></div>
        </div>
        <div class="apontamento-total-box">
          <span>Valor será calculado pelo produto cadastrado</span>
          <strong data-total-preview>${money(0)}</strong>
        </div>
        <button class="btn btn-gold" type="submit">Salvar apontamento</button>
      </form>
    </section>
  `;
}

function panelHTML({ empresaNome, produtos, apontamentos, canAdmin }) {
  const resumo = calcResumo(apontamentos);
  return `
    <div class="apontamento-head">
      <div>
        <span class="kicker">Apontamento de produção</span>
        <h2>Produtos produzidos</h2>
        <p>Fluxo organizado: primeiro o administrador cadastra produtos e valores. Depois a equipe apenas seleciona o produto e informa a quantidade produzida, como Camisa 50 ou Calça 80.</p>
      </div>
      <div class="apontamento-metrics">
        <div class="apontamento-metric"><small>Peças produzidas</small><strong>${integer(resumo.totalPecas)}</strong></div>
        <div class="apontamento-metric"><small>Valor total</small><strong>${money(resumo.totalVenda)}</strong></div>
        <div class="apontamento-metric"><small>Preço médio</small><strong>${money(resumo.precoMedio)}</strong></div>
      </div>
    </div>

    <div class="apontamento-grid ${canAdmin ? '' : 'only-launch'}">
      ${canAdmin ? adminProductFormHTML() : ''}
      ${apontamentoFormHTML(produtos, empresaNome, canAdmin)}
    </div>

    <section class="apontamento-card apontamento-history">
      <div class="apontamento-history-head">
        <div>
          <span class="kicker">Histórico</span>
          <h3>Últimos apontamentos</h3>
        </div>
        <span class="apontamento-pill">${apontamentos.length} registro(s)</span>
      </div>
      ${lancamentosHTML(apontamentos, canAdmin)}
    </section>
  `;
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

async function renderApontamento(panel, empresaId, force = false) {
  if (!authReady || !perfilAtual || !empresaId) return;
  const key = `${empresaId}:${PATCH_VERSION}`;
  if (!force && panel.dataset.apontamentoPatch === key) return;
  if (loadingPanels.has(panel)) return;

  loadingPanels.add(panel);
  injectStyles();

  let area = panel.querySelector('[data-apontamento-producao-panel]');
  if (!area) {
    area = document.createElement('section');
    area.className = 'apontamento-producao-panel';
    area.dataset.apontamentoProducaoPanel = 'true';
    const summary = panel.querySelector('.ecosystem-summary');
    const insertAfter = summary || panel.querySelector('.section-title-row') || panel.firstElementChild;
    if (insertAfter) insertAfter.insertAdjacentElement('afterend', area);
    else panel.prepend(area);
  }

  area.innerHTML = '<div class="apontamento-empty">Carregando produtos e apontamentos...</div>';

  try {
    const [produtos, apontamentos] = await Promise.all([
      queryEmpresa('empresa_produtos', empresaId),
      queryEmpresa('empresa_apontamentos', empresaId)
    ]);

    const empresaNome = getEmpresaNome(panel);
    const canAdmin = isAdmin();
    area.innerHTML = panelHTML({ empresaNome, produtos, apontamentos, canAdmin });
    panel.dataset.apontamentoPatch = key;
    bindApontamentoEvents(area, empresaId, produtos, apontamentos, panel);
  } catch (error) {
    console.error('Erro no apontamento de produção:', error);
    area.innerHTML = `<div class="notice error">Não foi possível carregar o apontamento de produção. ${escapeHTML(error?.message || '')}</div>`;
  } finally {
    loadingPanels.delete(panel);
  }
}

function bindApontamentoEvents(area, empresaId, produtos, apontamentos, panel) {
  const produtoForm = area.querySelector('[data-produto-form]');
  const produtoList = area.querySelector('[data-produto-list]');
  if (produtoList) produtoList.innerHTML = productListHTML(produtos, apontamentos);

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
      if (valorVenda <= 0) throw new Error('Informe um valor de venda maior que zero.');

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
      event.currentTarget.reset();
      await renderApontamento(panel, empresaId, true);
    } catch (error) {
      alert(error?.message || 'Erro ao cadastrar produto.');
    } finally {
      setButtonLoading(btn, false);
    }
  });

  area.querySelectorAll('[data-toggle-produto]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!isAdmin()) return;
      setButtonLoading(btn, true, 'Atualizando...');
      try {
        await updateDoc(doc(db, 'empresa_produtos', btn.dataset.toggleProduto), {
          ativo: btn.dataset.nextStatus === 'true',
          atualizadoEm: serverTimestamp(),
          atualizadoPor: auth.currentUser?.uid || ''
        });
        await renderApontamento(panel, empresaId, true);
      } catch (error) {
        alert(error?.message || 'Erro ao atualizar produto.');
      } finally {
        setButtonLoading(btn, false);
      }
    });
  });

  area.querySelectorAll('[data-delete-produto]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!isAdmin()) return;
      const produto = produtos.find(p => p.id === btn.dataset.deleteProduto);
      const ok = confirm(`Excluir o produto "${produto?.nome || 'produto'}"?\n\nOs apontamentos já feitos continuam preservados com nome e valor salvos no histórico.`);
      if (!ok) return;
      setButtonLoading(btn, true, 'Excluindo...');
      try {
        await deleteDoc(doc(db, 'empresa_produtos', btn.dataset.deleteProduto));
        await renderApontamento(panel, empresaId, true);
      } catch (error) {
        alert(error?.message || 'Erro ao excluir produto.');
      } finally {
        setButtonLoading(btn, false);
      }
    });
  });

  const apontamentoForm = area.querySelector('[data-apontamento-form]');
  const produtoSelect = apontamentoForm?.querySelector('select[name="produtoId"]');
  const quantidadeInput = apontamentoForm?.querySelector('input[name="quantidade"]');
  const totalPreview = apontamentoForm?.querySelector('[data-total-preview]');

  function syncPreview() {
    const produto = produtos.find(p => p.id === produtoSelect?.value);
    const quantidade = parseNumber(quantidadeInput?.value);
    const total = produto ? quantidade * Number(produto.valorVenda || 0) : 0;
    if (totalPreview) totalPreview.textContent = money(total);
  }

  produtoSelect?.addEventListener('change', syncPreview);
  quantidadeInput?.addEventListener('input', syncPreview);

  apontamentoForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = event.submitter;
    setButtonLoading(btn, true, 'Salvando...');
    try {
      const form = new FormData(event.currentTarget);
      const produto = produtos.find(p => p.id === form.get('produtoId'));
      if (!produto || produto.ativo === false) throw new Error('Selecione um produto ativo cadastrado pela administração.');
      const quantidade = parseNumber(form.get('quantidade'));
      if (quantidade <= 0) throw new Error('Informe uma quantidade produzida maior que zero.');
      const valorVenda = Number(produto.valorVenda || 0);
      const totalVenda = Number((quantidade * valorVenda).toFixed(2));

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
        criadoEm: serverTimestamp(),
        criadoPor: auth.currentUser?.uid || '',
        criadoPorNome: perfilAtual?.nome || auth.currentUser?.email || '',
        atualizadoEm: serverTimestamp(),
        atualizadoPor: auth.currentUser?.uid || ''
      });

      event.currentTarget.reset();
      event.currentTarget.querySelector('input[name="data"]').value = todayISO();
      await renderApontamento(panel, empresaId, true);
    } catch (error) {
      alert(error?.message || 'Erro ao salvar apontamento.');
    } finally {
      setButtonLoading(btn, false);
    }
  });

  area.querySelectorAll('[data-delete-apontamento]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = apontamentos.find(a => a.id === btn.dataset.deleteApontamento);
      if (!item) return;
      const canDelete = isAdmin() || item.criadoPor === auth.currentUser?.uid;
      if (!canDelete) return alert('Você só pode excluir seus próprios apontamentos.');
      const ok = confirm(`Excluir o apontamento de ${item.quantidade || 0} peça(s) de ${item.produtoNome || 'produto'}?`);
      if (!ok) return;
      setButtonLoading(btn, true, 'Excluindo...');
      try {
        await deleteDoc(doc(db, 'empresa_apontamentos', item.id));
        await renderApontamento(panel, empresaId, true);
      } catch (error) {
        alert(error?.message || 'Erro ao excluir apontamento.');
      } finally {
        setButtonLoading(btn, false);
      }
    });
  });
}

function enhanceAll() {
  if (!authReady || !perfilAtual) return;
  document.querySelectorAll('.company-ecosystem-panel').forEach(panel => {
    const empresaId = getEmpresaIdFromContext();
    if (!empresaId) return;
    renderApontamento(panel, empresaId).catch(error => console.error(error));
  });
}

function scheduleEnhance() {
  clearTimeout(enhanceTimer);
  enhanceTimer = setTimeout(enhanceAll, 180);
}

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
    console.warn('Perfil indisponível para apontamento:', error);
  }
  scheduleEnhance();
});

const observer = new MutationObserver(scheduleEnhance);
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('load', scheduleEnhance);
document.addEventListener('click', () => setTimeout(scheduleEnhance, 240));
window.addEventListener('popstate', () => setTimeout(scheduleEnhance, 240));

console.info(`Excellence System® apontamento de produção ${PATCH_VERSION} carregado.`);
