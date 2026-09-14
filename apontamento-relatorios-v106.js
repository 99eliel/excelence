import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, query, where, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const VERSION = '20260914-106';
const NAV_ATTR = 'data-apontamento-relatorios-nav';
const CONFIG_COLLECTION = 'apontamento_relatorio_config';
const PREF_KEY = 'excellence-apontamento-report-bars';

const state = {
  perfil: null,
  empresas: [],
  empresaId: '',
  empresa: null,
  data: null,
  config: null,
  route: false,
  renderToken: 0,
  observerTimer: null
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (v = '') => String(v ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const norm = (v = '') => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const num = (v = 0, digits = 2) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const int = (v = 0) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const pct = (v = 0) => `${Number(v || 0) >= 0 ? '+' : ''}${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const isoToday = () => new Date().toISOString().slice(0, 10);
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };

function dateBR(v = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return v || '-';
  const [y,m,d] = String(v).split('-');
  return `${d}/${m}/${y}`;
}

function monthLabel(key = '') {
  const [y,m] = key.split('-').map(Number);
  if (!y || !m) return key;
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function minutesLabel(mins = 0) {
  const total = Math.max(0, Math.round(Number(mins || 0)));
  const h = Math.floor(total / 60), m = total % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2,'0')}` : `${h}h`;
}

function minsApt(a = {}) {
  const explicit = Number(a.minutosTrabalhados);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  return (Array.isArray(a.funcionarios) ? a.funcionarios : []).reduce((sum, f) => {
    return sum + Number(f.minutosReal ?? f.minutosDia ?? f.minutosPadrao ?? 0);
  }, 0);
}

function productName(a = {}, productMap = new Map()) {
  return a.processoNome || a.produtoNome || productMap.get(a.produtoId || a.processoId)?.nome || 'Produto/processo';
}

function canUseReports() {
  if (!state.perfil || state.perfil.ativo !== true) return false;
  if (state.perfil.tipo === 'admin') return true;
  if (state.perfil.tipo !== 'cliente' || !state.perfil.empresaId) return false;
  return !Array.isArray(state.perfil.permissoes) || state.perfil.permissoes.includes('apontamento');
}

function isAdmin() { return state.perfil?.tipo === 'admin' && state.perfil?.ativo === true; }
function mainEl() { return $('.main'); }
function sidebar() { return $('#sidebar .nav-group,.sidebar .nav-group,#sidebar nav,.sidebar nav,#sidebar,.sidebar'); }

function toast(message, error = false) {
  $('[data-apt-report-toast]')?.remove();
  const el = document.createElement('div');
  el.dataset.aptReportToast = '1';
  el.textContent = message;
  el.style.cssText = `position:fixed;right:18px;bottom:18px;z-index:160000;max-width:470px;padding:12px 15px;border-radius:13px;color:#fff;font-weight:850;background:${error ? '#9f2e2e' : '#073F5A'};box-shadow:0 18px 42px rgba(5,36,55,.25)`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3900);
}

function injectStyle() {
  if ($('#apt-report-v106-style')) return;
  const st = document.createElement('style');
  st.id = 'apt-report-v106-style';
  st.textContent = `
    .ar106{max-width:1500px;margin:0 auto;padding:24px;color:#173846;display:grid;gap:16px}.ar106-hero{background:linear-gradient(135deg,#073F5A,#0B607F 60%,#0A7898);color:#fff;border-radius:24px;padding:24px;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;box-shadow:0 20px 48px rgba(7,63,90,.16)}.ar106-hero h1{margin:4px 0 7px;color:#fff;font-size:30px}.ar106-hero p{margin:0;color:#dcecf2;max-width:850px}.ar106-hero small{font-weight:900;letter-spacing:.07em;color:#c8e4ed}.ar106-hero-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .ar106-btn{border:0;border-radius:11px;padding:10px 13px;font-weight:850;cursor:pointer}.ar106-btn.primary{background:#073F5A;color:#fff}.ar106-btn.gold{background:#e9b64e;color:#173846}.ar106-btn.soft{background:#edf5f8;color:#073F5A}.ar106-btn.white{background:#fff;color:#073F5A}.ar106-btn:disabled{opacity:.5;cursor:not-allowed}
    .ar106-card{background:#fff;border:1px solid #d9e6eb;border-radius:19px;padding:17px;box-shadow:0 10px 28px rgba(7,63,90,.05)}.ar106-card h2,.ar106-card h3{color:#073F5A;margin:0}.ar106-card p{color:#607788}.ar106-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:13px}.ar106-head p{margin:4px 0 0}.ar106-badge{display:inline-flex;border-radius:999px;padding:6px 9px;background:#eef5f7;color:#073F5A;font-size:11px;font-weight:900;white-space:nowrap}
    .ar106-filters{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.ar106-field label{display:block;font-size:10px;text-transform:uppercase;color:#627d89;font-weight:900;margin-bottom:5px;letter-spacing:.03em}.ar106-field input,.ar106-field select{width:100%;border:1px solid #cfdfe5;border-radius:10px;padding:10px;background:#fff;color:#173846}.ar106-filter-actions{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-top:11px}
    .ar106-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.ar106-kpi{border:1px solid #d8e5ea;border-radius:15px;padding:13px;background:#fbfdfe}.ar106-kpi small{display:block;color:#607788;text-transform:uppercase;font-weight:900;font-size:9px}.ar106-kpi strong{display:block;color:#073F5A;font-size:22px;margin-top:4px}.ar106-kpi span{display:block;color:#607788;font-size:11px;margin-top:4px}.ar106-kpi.accent{background:linear-gradient(135deg,#073F5A,#0b607f);border-color:#073F5A}.ar106-kpi.accent small,.ar106-kpi.accent span{color:#d7eaf0}.ar106-kpi.accent strong{color:#f0b23e}.ar106-kpi.good strong{color:#247447}.ar106-kpi.bad strong{color:#a33a31}
    .ar106-compare{display:grid;grid-template-columns:1.2fr 1fr 1fr auto;gap:10px;align-items:end}.ar106-compare-note{grid-column:1/-1;padding:10px 12px;border-radius:12px;background:#f4f8fa;color:#55717e;font-size:12px}.ar106-compare-note strong{color:#073F5A}
    .ar106-charts{display:grid;grid-template-columns:1fr 1fr;gap:14px}.ar106-chart-card{border:1px solid #d9e6eb;border-radius:18px;background:#fff;padding:14px;min-width:0}.ar106-chart-card.full{grid-column:1/-1}.ar106-chart-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:10px}.ar106-chart-head h3{font-size:17px}.ar106-chart-head p{margin:3px 0 0;font-size:11px}.ar106-chart-actions{display:flex;gap:6px;flex-wrap:wrap}.ar106-canvas-wrap{overflow-x:auto}.ar106-chart-card canvas{display:block;width:100%;height:auto;min-width:620px;border-radius:10px;background:#fff}.ar106-chart-note{font-size:10px;color:#607788;margin-top:7px}
    .ar106-table-wrap{overflow:auto;border:1px solid #d8e5ea;border-radius:14px}.ar106-table{width:100%;min-width:980px;border-collapse:collapse}.ar106-table th,.ar106-table td{padding:9px;border-bottom:1px solid #e4edef;text-align:left;vertical-align:top}.ar106-table th{background:#f2f7f9;color:#496570;text-transform:uppercase;font-size:9px}.ar106-table td{font-size:12px}.ar106-table td.num{text-align:right;font-variant-numeric:tabular-nums}.ar106-empty{padding:24px;text-align:center;border:1px dashed #c9dce4;border-radius:14px;background:#fbfdfe;color:#607788}.ar106-empty strong{display:block;color:#073F5A;margin-bottom:4px}
    .ar106-companies{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.ar106-company{border:1px solid #d9e6eb;border-radius:17px;padding:16px;background:#fff;cursor:pointer;text-align:left}.ar106-company:hover{border-color:#0B607F;transform:translateY(-1px)}.ar106-company strong{display:block;color:#073F5A;font-size:16px}.ar106-company span{display:block;color:#607788;font-size:12px;margin-top:5px}
    @media(max-width:1180px){.ar106-filters{grid-template-columns:repeat(3,1fr)}.ar106-kpis{grid-template-columns:repeat(3,1fr)}}@media(max-width:900px){.ar106-charts{grid-template-columns:1fr}.ar106-chart-card.full{grid-column:auto}.ar106-compare{grid-template-columns:1fr 1fr}.ar106-companies{grid-template-columns:1fr 1fr}}@media(max-width:650px){.ar106{padding:12px}.ar106-hero{flex-direction:column}.ar106-filters,.ar106-kpis,.ar106-compare,.ar106-companies{grid-template-columns:1fr}.ar106-hero-actions{justify-content:flex-start}.ar106-chart-card canvas{min-width:560px}}
    @media print{.ar106-hero-actions,.ar106-filter-actions,.ar106-chart-actions,[data-ar-config-save]{display:none!important}.ar106{padding:0}.ar106-card,.ar106-chart-card{box-shadow:none}.ar106-chart-card canvas{min-width:0}.ar106-table-wrap{overflow:visible}.ar106-table{min-width:0;font-size:9px}}
  `;
  document.head.appendChild(st);
}

async function loadProfile(user) {
  state.perfil = null;
  if (!user) return;
  const snap = await getDoc(doc(db, 'usuarios', user.uid));
  state.perfil = snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function loadCompanies() {
  if (!isAdmin()) {
    const id = state.perfil?.empresaId || '';
    if (!id) return [];
    const snap = await getDoc(doc(db, 'empresas', id));
    return snap.exists() ? [{ id:snap.id, ...snap.data() }] : [];
  }
  const snap = await getDocs(collection(db, 'empresas'));
  return snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
}

async function qCompany(name, empresaId) {
  const snap = await getDocs(query(collection(db, name), where('empresaId','==',empresaId)));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

async function loadConfig(empresaId) {
  const snap = await getDoc(doc(db, CONFIG_COLLECTION, empresaId));
  const raw = snap.exists() ? snap.data() : {};
  return {
    empresaId,
    comparacaoModo: raw.comparacaoModo || 'periodo_anterior',
    marcoZeroValor: Number(raw.marcoZeroValor || 0),
    marcoZeroData: raw.marcoZeroData || '',
    mostrarMarcoZero: raw.mostrarMarcoZero !== false
  };
}

async function loadData(empresaId) {
  const [empresaSnap, apontamentos, produtos, equipes, funcionarios, config] = await Promise.all([
    getDoc(doc(db,'empresas',empresaId)),
    qCompany('empresa_apontamentos', empresaId),
    qCompany('empresa_produtos', empresaId),
    qCompany('empresa_equipes', empresaId),
    qCompany('empresa_funcionarios', empresaId),
    loadConfig(empresaId).catch(() => ({ empresaId, comparacaoModo:'periodo_anterior', marcoZeroValor:0, marcoZeroData:'', mostrarMarcoZero:true }))
  ]);
  const empresa = empresaSnap.exists() ? { id:empresaSnap.id, ...empresaSnap.data() } : { id:empresaId, nome:'Empresa' };
  apontamentos.sort((a,b) => String(a.data||'').localeCompare(String(b.data||'')));
  return { empresa, apontamentos, produtos, equipes, funcionarios, config };
}

function summary(list = []) {
  const pieces = list.reduce((s,a) => s + Number(a.quantidade || 0), 0);
  const minutes = list.reduce((s,a) => s + minsApt(a), 0);
  return {
    count:list.length,
    pieces,
    minutes,
    hours:minutes / 60,
    ppm:minutes > 0 ? pieces / minutes : 0,
    minPerPiece:pieces > 0 ? minutes / pieces : 0,
    pph:minutes > 0 ? pieces / (minutes / 60) : 0
  };
}

function currentFilters() {
  return {
    start:$('[data-ar-start]')?.value || '',
    end:$('[data-ar-end]')?.value || '',
    product:$('[data-ar-product]')?.value || '',
    team:$('[data-ar-team]')?.value || '',
    employee:$('[data-ar-employee]')?.value || '',
    bars:$('[data-ar-bars]')?.value || '12',
    compare:$('[data-ar-compare-mode]')?.value || state.config?.comparacaoModo || 'periodo_anterior',
    zeroValue:Number(String($('[data-ar-zero-value]')?.value || state.config?.marcoZeroValor || 0).replace(',','.')) || 0,
    zeroDate:$('[data-ar-zero-date]')?.value || state.config?.marcoZeroData || ''
  };
}

function filterList(list, f, startOverride = null, endOverride = null) {
  const start = startOverride ?? f.start;
  const end = endOverride ?? f.end;
  return list.filter(a => {
    const id = a.produtoId || a.processoId || '';
    const team = a.equipeId || '';
    return (!start || String(a.data||'') >= start)
      && (!end || String(a.data||'') <= end)
      && (!f.product || id === f.product)
      && (!f.team || team === f.team)
      && (!f.employee || (Array.isArray(a.funcionarios) && a.funcionarios.some(x => x.id === f.employee)));
  });
}

function previousRange(start, end) {
  if (!start || !end) return null;
  const s = new Date(`${start}T12:00:00`), e = new Date(`${end}T12:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return null;
  const days = Math.round((e - s) / 86400000) + 1;
  const prevEnd = new Date(s.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { start:iso(prevStart), end:iso(prevEnd) };
}

function monthlyPoints(list, productMap) {
  const map = new Map();
  list.forEach(a => {
    const key = String(a.data || '').slice(0,7);
    if (!/^\d{4}-\d{2}$/.test(key)) return;
    const x = map.get(key) || { key, label:monthLabel(key), pieces:0, minutes:0 };
    x.pieces += Number(a.quantidade || 0);
    x.minutes += minsApt(a);
    map.set(key,x);
  });
  return Array.from(map.values()).sort((a,b)=>a.key.localeCompare(b.key)).map(x => ({ ...x, value:x.minutes ? x.pieces/x.minutes : 0 }));
}

function productPoints(list, productMap) {
  const map = new Map();
  list.forEach(a => {
    const id = a.produtoId || a.processoId || productName(a, productMap);
    const x = map.get(id) || { id, label:productName(a, productMap), pieces:0, minutes:0 };
    x.pieces += Number(a.quantidade || 0);
    x.minutes += minsApt(a);
    map.set(id,x);
  });
  return Array.from(map.values()).map(x => ({ ...x, value:x.minutes ? x.pieces/x.minutes : 0 })).sort((a,b)=>b.value-a.value);
}

function volumePoints(list) {
  const map = new Map();
  list.forEach(a => {
    const key = String(a.data || '').slice(0,7);
    if (!/^\d{4}-\d{2}$/.test(key)) return;
    map.set(key, (map.get(key) || 0) + Number(a.quantidade || 0));
  });
  return Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([key,value]) => ({ key, label:monthLabel(key), value }));
}

function limitPoints(points, bars) {
  const n = Number(bars || 0);
  if (!n || bars === 'all') return points;
  return points.slice(-n);
}

function evolutionInfo(current, previous, f, monthly) {
  let base = 0, baseLabel = '', percentBase = 0, percentLabel = '';
  if (f.compare === 'marco_zero') {
    base = Number(f.zeroValue || 0);
    baseLabel = f.zeroDate ? `Marco zero • ${dateBR(f.zeroDate)}` : 'Marco zero cadastrado';
    if (base > 0) {
      percentBase = base;
      percentLabel = 'vs. marco zero';
    } else {
      const firstReal = monthly.find(x => x.value > 0 && x.value !== current.ppm)?.value || previous.ppm || 0;
      percentBase = firstReal;
      percentLabel = firstReal ? 'vs. primeiro período real (marco zero = 0)' : 'base zero sem período anterior';
    }
  } else {
    base = previous.ppm;
    baseLabel = 'Período anterior equivalente';
    percentBase = previous.ppm;
    percentLabel = 'vs. período anterior';
  }
  const diff = current.ppm - base;
  const evolution = percentBase > 0 ? ((current.ppm / percentBase) - 1) * 100 : null;
  return { base, baseLabel, diff, evolution, percentLabel };
}

function optionList(rows, labelFn) {
  return rows.map(x => `<option value="${esc(x.id)}">${esc(labelFn(x))}</option>`).join('');
}

function markNav() {
  $$('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[${NAV_ATTR}]`)?.classList.toggle('active', state.route);
}

function ensureNav() {
  if (!canUseReports()) return;
  const nav = sidebar();
  if (!nav) return;
  let btn = nav.querySelector(`[${NAV_ATTR}]`);
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-btn';
    btn.setAttribute(NAV_ATTR, VERSION);
    btn.innerHTML = '<span>▥</span>Relatórios de produção';
    const apt = nav.querySelector('[data-apontamento-standalone-nav]');
    if (apt?.nextSibling) nav.insertBefore(btn, apt.nextSibling); else if (apt) nav.appendChild(btn); else nav.appendChild(btn);
  }
  btn.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    state.route = true;
    openReports();
  };
}

function hideLegacyReportTab() {
  $$('[data-tab="rel"]').forEach(btn => { btn.hidden = true; btn.style.display = 'none'; });
}

async function renderCompanySelect() {
  state.route = true;
  markNav();
  const main = mainEl();
  if (!main) return;
  const companies = await loadCompanies();
  state.empresas = companies;
  if (!isAdmin()) {
    if (companies[0]?.id) return openCompany(companies[0].id);
    main.innerHTML = '<section class="ar106"><div class="ar106-empty"><strong>Empresa não identificada</strong>Seu usuário não possui uma empresa vinculada.</div></section>';
    return;
  }
  main.innerHTML = `<section class="ar106"><section class="ar106-hero"><div><small>RELATÓRIOS DE PRODUÇÃO</small><h1>Escolha a empresa</h1><p>A área de relatórios agora é independente do lançamento de Apontamento.</p></div></section><section class="ar106-card"><div class="ar106-head"><div><h2>Empresas</h2><p>Selecione qual base deseja analisar.</p></div><input type="search" data-ar-company-search placeholder="Buscar empresa..." style="max-width:320px;border:1px solid #cfdfe5;border-radius:10px;padding:10px"></div><div class="ar106-companies">${companies.map(c=>`<button class="ar106-company" type="button" data-ar-open-company="${esc(c.id)}" data-search="${esc(norm(c.nome||''))}"><strong>${esc(c.nome||'Empresa')}</strong><span>${esc(c.cnpj||c.responsavel||'Abrir relatórios')}</span></button>`).join('')}</div></section></section>`;
  const search = $('[data-ar-company-search]', main);
  search?.addEventListener('input', () => {
    const term = norm(search.value);
    $$('[data-ar-open-company]',main).forEach(x => x.style.display = !term || String(x.dataset.search||'').includes(term) ? '' : 'none');
  });
  $$('[data-ar-open-company]',main).forEach(btn => btn.addEventListener('click',()=>openCompany(btn.dataset.arOpenCompany)));
}

async function openReports() {
  injectStyle();
  if (!canUseReports()) return;
  if (!isAdmin() && state.perfil?.empresaId) return openCompany(state.perfil.empresaId);
  return renderCompanySelect();
}

async function openCompany(empresaId) {
  state.route = true;
  state.empresaId = empresaId;
  markNav();
  const main = mainEl();
  if (!main) return;
  main.innerHTML = '<section class="ar106"><div class="ar106-empty"><strong>Carregando relatórios...</strong>Calculando indicadores e comparações.</div></section>';
  try {
    state.data = await loadData(empresaId);
    state.empresa = state.data.empresa;
    state.config = state.data.config;
    renderReportPage();
  } catch (error) {
    console.error('Relatórios de produção:', error);
    main.innerHTML = `<section class="ar106"><div class="ar106-empty"><strong>Não foi possível carregar os relatórios.</strong>${esc(error?.message || 'Tente novamente.')}</div></section>`;
  }
}

function renderReportPage() {
  const main = mainEl();
  const d = state.data;
  if (!main || !d) return;
  let bars = '12';
  try { bars = localStorage.getItem(`${PREF_KEY}:${state.empresaId}`) || '12'; } catch (_) {}
  const cfg = state.config || {};
  main.innerHTML = `<section class="ar106" data-ar-root>
    <section class="ar106-hero"><div><small>RELATÓRIOS DE PRODUÇÃO</small><h1>${esc(d.empresa.nome || 'Empresa')}</h1><p>Indicadores de produtividade, comparação de evolução e gráficos independentes do lançamento operacional.</p></div><div class="ar106-hero-actions">${isAdmin()?'<button class="ar106-btn white" type="button" data-ar-change-company>Trocar empresa</button>':''}<button class="ar106-btn gold" type="button" data-ar-print>Imprimir / PDF</button></div></section>
    <section class="ar106-card"><div class="ar106-head"><div><h2>Filtros</h2><p>Peças/minuto e minutos/peça são exibidos com 4 casas decimais.</p></div><span class="ar106-badge">Valores visíveis nos gráficos</span></div><div class="ar106-filters">
      <div class="ar106-field"><label>De</label><input type="date" data-ar-start value="${monthStart()}"></div>
      <div class="ar106-field"><label>Até</label><input type="date" data-ar-end value="${isoToday()}"></div>
      <div class="ar106-field"><label>Produto / processo</label><select data-ar-product><option value="">Todos</option>${optionList(d.produtos,x=>x.nome||x.processoNome||'Produto')}</select></div>
      <div class="ar106-field"><label>Equipe / célula</label><select data-ar-team><option value="">Todas</option>${optionList(d.equipes,x=>x.nome||'Equipe')}</select></div>
      <div class="ar106-field"><label>Funcionário</label><select data-ar-employee><option value="">Todos</option>${optionList(d.funcionarios,x=>x.nome||'Funcionário')}</select></div>
      <div class="ar106-field"><label>Pontos/barras no gráfico</label><select data-ar-bars><option value="6" ${bars==='6'?'selected':''}>6</option><option value="12" ${bars==='12'?'selected':''}>12</option><option value="24" ${bars==='24'?'selected':''}>24</option><option value="all" ${bars==='all'?'selected':''}>Todos</option></select></div>
    </div><div class="ar106-filter-actions"><button class="ar106-btn primary" type="button" data-ar-apply>Aplicar filtros</button><button class="ar106-btn soft" type="button" data-ar-clear>Período atual</button></div></section>
    <section class="ar106-card"><div class="ar106-head"><div><h2>Parâmetro de comparação</h2><p>Use o período anterior ou cadastre o cenário “antes” como marco zero.</p></div><span class="ar106-badge">Evolução automática em %</span></div><div class="ar106-compare">
      <div class="ar106-field"><label>Comparar com</label><select data-ar-compare-mode><option value="periodo_anterior" ${cfg.comparacaoModo!=='marco_zero'?'selected':''}>Período anterior equivalente</option><option value="marco_zero" ${cfg.comparacaoModo==='marco_zero'?'selected':''}>Marco zero / situação anterior</option></select></div>
      <div class="ar106-field"><label>Marco zero — peças/minuto</label><input data-ar-zero-value inputmode="decimal" value="${num(cfg.marcoZeroValor || 0,4)}"></div>
      <div class="ar106-field"><label>Data do marco zero</label><input type="date" data-ar-zero-date value="${esc(cfg.marcoZeroData||'')}"></div>
      ${isAdmin()?'<button class="ar106-btn gold" type="button" data-ar-config-save>Salvar parâmetro</button>':'<span></span>'}
      <div class="ar106-compare-note"><strong>Base zero:</strong> você pode deixar 0,0000 para registrar visualmente o início. Para o cálculo percentual, quando a base for zero o sistema usa o primeiro período real disponível, evitando divisão por zero.</div>
    </div></section>
    <section data-ar-results></section>
  </section>`;

  $('[data-ar-apply]')?.addEventListener('click', renderResults);
  $('[data-ar-clear]')?.addEventListener('click', () => { $('[data-ar-start]').value = monthStart(); $('[data-ar-end]').value = isoToday(); renderResults(); });
  $('[data-ar-bars]')?.addEventListener('change', e => { try { localStorage.setItem(`${PREF_KEY}:${state.empresaId}`, e.target.value); } catch (_) {} renderResults(); });
  $('[data-ar-compare-mode]')?.addEventListener('change', renderResults);
  $('[data-ar-zero-value]')?.addEventListener('change', renderResults);
  $('[data-ar-zero-date]')?.addEventListener('change', renderResults);
  $('[data-ar-change-company]')?.addEventListener('click', renderCompanySelect);
  $('[data-ar-config-save]')?.addEventListener('click', saveComparisonConfig);
  $('[data-ar-print]')?.addEventListener('click', () => window.print());
  renderResults();
}

async function saveComparisonConfig(event) {
  if (!isAdmin()) return;
  const btn = event.currentTarget;
  const f = currentFilters();
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    await setDoc(doc(db,CONFIG_COLLECTION,state.empresaId), {
      empresaId:state.empresaId,
      comparacaoModo:f.compare,
      marcoZeroValor:f.zeroValue,
      marcoZeroData:f.zeroDate,
      mostrarMarcoZero:true,
      atualizadoEm:serverTimestamp(),
      atualizadoPor:auth.currentUser?.uid || ''
    }, { merge:true });
    state.config = { ...state.config, comparacaoModo:f.compare, marcoZeroValor:f.zeroValue, marcoZeroData:f.zeroDate, mostrarMarcoZero:true };
    toast('Parâmetro de comparação salvo para esta empresa.');
    renderResults();
  } catch (error) {
    toast(error?.message || 'Não foi possível salvar o parâmetro.', true);
  } finally { btn.disabled = false; btn.textContent = old; }
}

function renderResults() {
  const d = state.data;
  const host = $('[data-ar-results]');
  if (!d || !host) return;
  const f = currentFilters();
  if (f.start && f.end && f.end < f.start) return toast('A data final não pode ser anterior à inicial.', true);
  const productMap = new Map(d.produtos.map(x => [x.id,x]));
  const list = filterList(d.apontamentos,f);
  const current = summary(list);
  const prevRange = previousRange(f.start,f.end);
  const previousList = prevRange ? filterList(d.apontamentos,f,prevRange.start,prevRange.end) : [];
  const previous = summary(previousList);
  let monthly = monthlyPoints(list,productMap);
  const compare = evolutionInfo(current,previous,f,monthly);

  if (f.compare === 'marco_zero' && state.config?.mostrarMarcoZero !== false) {
    monthly = [{ key:'0000-00', label:'Marco zero', value:f.zeroValue, pieces:0, minutes:0, zero:true }, ...monthly];
  }
  const trend = limitPoints(monthly,f.bars);
  const products = limitPoints(productPoints(list,productMap).slice().reverse(),f.bars).reverse();
  const volumes = limitPoints(volumePoints(list),f.bars);
  const evolutionClass = compare.evolution == null ? '' : compare.evolution >= 0 ? 'good' : 'bad';
  const evolutionText = compare.evolution == null ? '—' : pct(compare.evolution);

  host.innerHTML = `<section class="ar106-kpis">
    <div class="ar106-kpi"><small>Peças produzidas</small><strong>${int(current.pieces)}</strong><span>${current.count} lançamento(s)</span></div>
    <div class="ar106-kpi accent"><small>Peças / minuto</small><strong>${num(current.ppm,4)}</strong><span>Precisão de 4 casas decimais</span></div>
    <div class="ar106-kpi"><small>Minutos / peça</small><strong>${num(current.minPerPiece,4)}</strong><span>${minutesLabel(current.minutes)} trabalhados</span></div>
    <div class="ar106-kpi"><small>Antes / referência</small><strong>${num(compare.base,4)}</strong><span>${esc(compare.baseLabel)}</span></div>
    <div class="ar106-kpi ${evolutionClass}"><small>Evolução</small><strong>${evolutionText}</strong><span>${esc(compare.percentLabel)}</span></div>
    <div class="ar106-kpi ${compare.diff>=0?'good':'bad'}"><small>Ganho absoluto</small><strong>${compare.diff>=0?'+':''}${num(compare.diff,4)}</strong><span>peças/minuto</span></div>
  </section>
  <section class="ar106-charts" style="margin-top:16px">
    <article class="ar106-chart-card full"><div class="ar106-chart-head"><div><h3>Evolução de peças por minuto</h3><p>Os valores aparecem diretamente sobre cada ponto do gráfico.</p></div><div class="ar106-chart-actions"><button class="ar106-btn soft" type="button" data-save-chart="trend">Salvar PNG</button></div></div><div class="ar106-canvas-wrap"><canvas width="1400" height="560" data-chart="trend"></canvas></div><div class="ar106-chart-note">${trend.length} ponto(s) exibido(s). Ajuste a quantidade no filtro “Pontos/barras no gráfico”.</div></article>
    <article class="ar106-chart-card"><div class="ar106-chart-head"><div><h3>Produto por minuto</h3><p>Quantidade produzida dividida pelos minutos trabalhados de cada produto.</p></div><div class="ar106-chart-actions"><button class="ar106-btn soft" type="button" data-save-chart="product">Salvar PNG</button></div></div><div class="ar106-canvas-wrap"><canvas width="1100" height="600" data-chart="product"></canvas></div></article>
    <article class="ar106-chart-card"><div class="ar106-chart-head"><div><h3>Volume produzido por período</h3><p>Total de peças registradas em cada mês.</p></div><div class="ar106-chart-actions"><button class="ar106-btn soft" type="button" data-save-chart="volume">Salvar PNG</button></div></div><div class="ar106-canvas-wrap"><canvas width="1100" height="600" data-chart="volume"></canvas></div></article>
  </section>
  <section class="ar106-card" style="margin-top:16px"><div class="ar106-head"><div><h2>Detalhamento dos apontamentos</h2><p>Produtividade individual do lançamento com 4 casas decimais.</p></div><span class="ar106-badge">${list.length} registro(s)</span></div><div class="ar106-table-wrap"><table class="ar106-table"><thead><tr><th>Data</th><th>Produto / processo</th><th>Equipe / célula</th><th>Qtd.</th><th>Tempo</th><th>Peças/min</th><th>Min/peça</th><th>Funcionários</th></tr></thead><tbody>${list.length ? list.slice().reverse().map(a=>{const mins=minsApt(a),q=Number(a.quantidade||0),ppm=mins?q/mins:0,mpp=q?mins/q:0;return `<tr><td>${dateBR(a.data)}</td><td><strong>${esc(productName(a,productMap))}</strong></td><td>${esc(a.equipeNome||a.celula||'-')}</td><td class="num">${int(q)}</td><td>${minutesLabel(mins)}</td><td class="num"><strong>${num(ppm,4)}</strong></td><td class="num">${num(mpp,4)}</td><td>${esc((a.funcionarios||[]).map(x=>x.nome).filter(Boolean).join(', ')||'-')}</td></tr>`}).join('') : '<tr><td colspan="8" style="text-align:center;padding:22px;color:#607788">Nenhum apontamento encontrado no filtro.</td></tr>'}</tbody></table></div></section>`;

  drawLine($('[data-chart="trend"]',host), trend.map(x=>({ label:x.label, value:x.value, zero:x.zero })),'peças/min');
  drawBars($('[data-chart="product"]',host), products.map(x=>({ label:x.label, value:x.value })),'peças/min',4);
  drawBars($('[data-chart="volume"]',host), volumes.map(x=>({ label:x.label, value:x.value })),'peças',0);
  $$('[data-save-chart]',host).forEach(btn => btn.addEventListener('click',()=>saveChart(btn.dataset.saveChart)));
}

function canvasBase(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.font = '24px Arial'; ctx.fillStyle = '#173846';
  return ctx;
}

function fitLabel(ctx, text, maxWidth) {
  const raw = String(text || '');
  if (ctx.measureText(raw).width <= maxWidth) return raw;
  let out = raw;
  while (out.length > 4 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0,-1);
  return `${out}…`;
}

function drawAxes(ctx,w,h,pad,max) {
  ctx.strokeStyle='#dce7eb';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=pad.top+(h-pad.top-pad.bottom)*(i/4);
    ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(w-pad.right,y);ctx.stroke();
    const value=max*(1-i/4);ctx.fillStyle='#718790';ctx.font='18px Arial';ctx.textAlign='right';ctx.fillText(num(value,max<10?4:0),pad.left-12,y+6);
  }
}

function drawLine(canvas, points, unit) {
  const ctx=canvasBase(canvas);if(!ctx)return;
  const w=canvas.width,h=canvas.height,pad={left:110,right:45,top:70,bottom:90};
  if(!points.length){ctx.textAlign='center';ctx.fillStyle='#607788';ctx.font='26px Arial';ctx.fillText('Sem dados para o gráfico',w/2,h/2);return;}
  const max=Math.max(...points.map(x=>Number(x.value||0)),0.0001)*1.18;
  drawAxes(ctx,w,h,pad,max);
  const innerW=w-pad.left-pad.right,innerH=h-pad.top-pad.bottom;
  const step=points.length>1?innerW/(points.length-1):0;
  const coords=points.map((p,i)=>({x:points.length===1?pad.left+innerW/2:pad.left+i*step,y:pad.top+innerH-(Number(p.value||0)/max)*innerH,...p}));
  ctx.strokeStyle='#0B607F';ctx.lineWidth=5;ctx.beginPath();coords.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  coords.forEach(p=>{
    ctx.fillStyle=p.zero?'#D6A842':'#0B607F';ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#073F5A';ctx.font='bold 21px Arial';ctx.textAlign='center';ctx.fillText(num(p.value,4),p.x,Math.max(28,p.y-18));
    ctx.save();ctx.translate(p.x,h-pad.bottom+24);ctx.rotate(-Math.PI/8);ctx.font='18px Arial';ctx.fillStyle='#536f7a';ctx.textAlign='right';ctx.fillText(fitLabel(ctx,p.label,150),0,0);ctx.restore();
  });
  ctx.font='bold 20px Arial';ctx.fillStyle='#073F5A';ctx.textAlign='left';ctx.fillText(unit,pad.left,34);
}

function drawBars(canvas, points, unit, digits=4) {
  const ctx=canvasBase(canvas);if(!ctx)return;
  const w=canvas.width,h=canvas.height,pad={left:105,right:35,top:70,bottom:115};
  if(!points.length){ctx.textAlign='center';ctx.fillStyle='#607788';ctx.font='26px Arial';ctx.fillText('Sem dados para o gráfico',w/2,h/2);return;}
  const max=Math.max(...points.map(x=>Number(x.value||0)),1)*1.18;
  drawAxes(ctx,w,h,pad,max);
  const innerW=w-pad.left-pad.right,innerH=h-pad.top-pad.bottom,gap=18;
  const bw=Math.max(28,Math.min(100,(innerW-gap*(points.length+1))/points.length));
  const total=points.length*bw+(points.length-1)*gap;let x=pad.left+(innerW-total)/2;
  points.forEach((p,i)=>{
    const bh=Math.max(2,(Number(p.value||0)/max)*innerH),y=pad.top+innerH-bh;
    const grad=ctx.createLinearGradient(0,y,0,y+bh);grad.addColorStop(0,i===points.length-1?'#D6A842':'#1686a9');grad.addColorStop(1,i===points.length-1?'#b77b15':'#0B607F');ctx.fillStyle=grad;ctx.beginPath();ctx.roundRect(x,y,bw,bh,8);ctx.fill();
    ctx.fillStyle='#073F5A';ctx.font='bold 19px Arial';ctx.textAlign='center';ctx.fillText(num(p.value,digits),x+bw/2,Math.max(27,y-13));
    ctx.save();ctx.translate(x+bw/2,h-pad.bottom+28);ctx.rotate(-Math.PI/5);ctx.font='17px Arial';ctx.fillStyle='#536f7a';ctx.textAlign='right';ctx.fillText(fitLabel(ctx,p.label,165),0,0);ctx.restore();x+=bw+gap;
  });
  ctx.font='bold 20px Arial';ctx.fillStyle='#073F5A';ctx.textAlign='left';ctx.fillText(unit,pad.left,34);
}

function saveChart(type) {
  const canvas = $(`[data-chart="${type}"]`);
  if (!canvas) return;
  canvas.toBlob(blob => {
    if (!blob) return toast('Não foi possível gerar a imagem do gráfico.',true);
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${type}-${String(state.empresa?.nome||'empresa').replace(/[^a-zA-Z0-9_-]+/g,'-')}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  },'image/png',1);
}

function schedule() {
  clearTimeout(state.observerTimer);
  state.observerTimer=setTimeout(()=>{ensureNav();hideLegacyReportTab();if(state.route)markNav();},100);
}

new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',event=>{
  const legacy=event.target.closest?.('[data-tab="rel"]');
  if(legacy){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();state.route=true;openReports();return;}
  const other=event.target.closest?.('.nav-btn');
  if(other && !other.hasAttribute(NAV_ATTR) && !other.closest(`[${NAV_ATTR}]`)) state.route=false;
},true);

onAuthStateChanged(auth,async user=>{
  state.route=false;state.data=null;state.empresa=null;state.config=null;state.empresaId='';
  await loadProfile(user);
  schedule();
});

window.addEventListener('load',schedule);
console.info(`Excellence System • Relatórios de Produção ${VERSION} carregados.`);
