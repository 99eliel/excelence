import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection, getDocs, getDoc, doc, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const V = '20260820-81';
const state = {
  user: null,
  perfil: null,
  empresas: [],
  empresaId: '',
  empresaNome: '',
  tab: 'visao',
  cache: {}
};

const TABS = [
  ['visao','Visão geral'],
  ['plano','Plano anual'],
  ['matriz','Matriz de competências'],
  ['realizacoes','Realizações'],
  ['colaboradores','Colaboradores'],
  ['integracao','Integração'],
  ['pid','PID'],
  ['carreira','Carreira']
];

const esc = (v='') => String(v ?? '')
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#039;');

function toast(message, type='ok') {
  document.querySelector('[data-tr81-toast]')?.remove();
  const el = document.createElement('div');
  el.dataset.tr81Toast = '1';
  el.textContent = message;
  el.style.cssText = `position:fixed;right:18px;bottom:18px;z-index:99999;padding:12px 14px;border-radius:14px;font-weight:800;color:white;max-width:380px;box-shadow:0 18px 42px rgba(5,36,55,.25);background:${type==='err'?'#a52b2b':'#073F5A'}`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),3500);
}

function mainEl() {
  return document.querySelector('.main');
}

function injectStyle() {
  if (document.getElementById('tr81-style')) return;
  const s = document.createElement('style');
  s.id = 'tr81-style';
  s.textContent = `
  .tr81{padding:24px;max-width:1600px;margin:0 auto;color:#173846}
  .tr81-hero{background:linear-gradient(135deg,#073F5A,#0b607f);color:#fff;border-radius:22px;padding:24px;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;box-shadow:0 18px 42px rgba(7,63,90,.15)}
  .tr81-hero h1{margin:4px 0 8px;font-size:34px}.tr81-hero p{margin:0;color:#dcecf2;max-width:780px}
  .tr81-chip{background:rgba(255,255,255,.12);padding:8px 12px;border-radius:999px;font-weight:800;white-space:nowrap}
  .tr81-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.tr81-tab{border:1px solid #cfe0e6;background:#fff;color:#073F5A;border-radius:12px;padding:10px 14px;font-weight:800;cursor:pointer}
  .tr81-tab.active{background:#073F5A;color:#fff;border-color:#073F5A}
  .tr81-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.tr81-kpi,.tr81-card{background:#fff;border:1px solid #d8e5ea;border-radius:18px;padding:16px;box-shadow:0 10px 28px rgba(7,63,90,.06)}
  .tr81-kpi small{display:block;color:#607788;font-weight:800;text-transform:uppercase}.tr81-kpi strong{display:block;font-size:28px;color:#073F5A;margin-top:5px}
  .tr81-section{margin-top:14px;background:#fff;border:1px solid #d8e5ea;border-radius:18px;padding:16px}
  .tr81-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.tr81-head h2{margin:0;color:#073F5A}
  .tr81-btn{border:0;border-radius:11px;padding:10px 13px;font-weight:800;cursor:pointer}.tr81-btn.primary{background:#073F5A;color:white}.tr81-btn.gold{background:#e9b64e;color:#173846}.tr81-btn.soft{background:#eef5f7;color:#073F5A}.tr81-btn.danger{background:#fde8e8;color:#9b2222}
  .tr81-table-wrap{overflow:auto}.tr81-table{width:100%;border-collapse:collapse;min-width:760px}.tr81-table th,.tr81-table td{padding:10px;border-bottom:1px solid #e5edef;text-align:left;vertical-align:top}.tr81-table th{font-size:12px;text-transform:uppercase;color:#607788;background:#f7fafb}
  .tr81-badge{display:inline-block;border-radius:999px;padding:5px 8px;font-size:12px;font-weight:800;background:#eef5f7;color:#073F5A}.tr81-badge.ok{background:#e3f5e9;color:#1f6b37}.tr81-badge.warn{background:#fff4d6;color:#87630b}.tr81-badge.bad{background:#fde8e8;color:#9b2222}
  .tr81-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tr81-form .full{grid-column:1/-1}.tr81-form label{display:block;font-weight:800;font-size:13px;margin-bottom:5px;color:#466572}
  .tr81-form input,.tr81-form select,.tr81-form textarea{width:100%;border:1px solid #cfdfe5;border-radius:11px;padding:10px;background:#fff;color:#173846}.tr81-form textarea{min-height:88px;resize:vertical}
  .tr81-modal-bg{position:fixed;inset:0;background:rgba(4,27,39,.55);z-index:99990;display:flex;align-items:center;justify-content:center;padding:18px}.tr81-modal{width:min(860px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:18px;box-shadow:0 22px 70px rgba(0,0,0,.28)}
  .tr81-company-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:16px}.tr81-company{background:#fff;border:1px solid #d8e5ea;border-radius:18px;padding:18px;cursor:pointer}.tr81-company:hover{border-color:#0b6f93;transform:translateY(-1px)}
  .tr81-empty{padding:24px;text-align:center;color:#607788;border:1px dashed #cfdfe5;border-radius:14px}
  .tr81-matrix{overflow:auto}.tr81-matrix table{border-collapse:collapse;min-width:900px}.tr81-matrix th,.tr81-matrix td{border:1px solid #dce7eb;padding:7px;background:#fff}.tr81-matrix th{background:#f4f8fa;position:sticky;top:0}.tr81-matrix select{min-width:120px;padding:6px;border-radius:8px;border:1px solid #cfdfe5}
  @media(max-width:980px){.tr81-grid{grid-template-columns:repeat(2,1fr)}.tr81-company-grid{grid-template-columns:1fr 1fr}.tr81-form{grid-template-columns:1fr}.tr81-form .full{grid-column:auto}.tr81-hero{flex-direction:column}}
  @media(max-width:640px){.tr81{padding:12px}.tr81-grid,.tr81-company-grid{grid-template-columns:1fr}.tr81-hero h1{font-size:27px}}
  `;
  document.head.appendChild(s);
}

function canAccess() {
  if (!state.perfil) return false;
  if (state.perfil.tipo === 'admin') return true;
  if (!Array.isArray(state.perfil.permissoes)) return true;
  return state.perfil.permissoes.includes('treinamentos');
}

async function loadProfile(user) {
  state.user = user || null;
  state.perfil = null;
  if (!user) return;
  const snap = await getDoc(doc(db,'usuarios',user.uid));
  state.perfil = snap.exists() ? {id:snap.id,...snap.data()} : null;
}

async function loadCompanies() {
  if (state.perfil?.tipo === 'admin') {
    const s = await getDocs(collection(db,'empresas'));
    state.empresas = s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
  } else {
    const id = state.perfil?.empresaId || '';
    if (!id) { state.empresas = []; return; }
    const s = await getDoc(doc(db,'empresas',id));
    state.empresas = s.exists() ? [{id:s.id,...s.data()}] : [];
  }
}

function ensureMenu() {
  if (!state.perfil || !canAccess()) return;
  const nav = document.querySelector('#sidebar .nav-group,.sidebar .nav-group,#sidebar nav,.sidebar nav');
  if (!nav) return;
  const buttons = [...nav.querySelectorAll('.nav-btn')];
  let btn = buttons.find(b=>String(b.textContent||'').toLowerCase().includes('treinamento'));
  if (!btn) {
    btn = document.createElement('button');
    btn.className='nav-btn';
    btn.type='button';
    btn.innerHTML='<span>▤</span>Treinamentos';
    const apont = buttons.find(b=>String(b.textContent||'').toLowerCase().includes('apontamento'));
    const quem = buttons.find(b=>String(b.textContent||'').toLowerCase().includes('quem somos'));
    if (apont?.parentElement===nav) apont.insertAdjacentElement('afterend',btn);
    else if (quem?.parentElement===nav) nav.insertBefore(btn,quem);
    else nav.appendChild(btn);
  }
  if (btn.dataset.tr81Bound==='1') return;
  btn.dataset.tr81Bound='1';
  btn.style.display='';
  btn.addEventListener('click',ev=>{
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    openTraining();
  },true);
}

async function openTraining() {
  if (!canAccess()) return toast('Seu usuário não tem permissão para Treinamentos.','err');
  injectStyle();
  if (!state.empresas.length) await loadCompanies();
  if (state.perfil?.tipo !== 'admin') {
    const e = state.empresas[0];
    if (!e) return toast('Nenhuma empresa vinculada ao usuário.','err');
    state.empresaId = e.id; state.empresaNome = e.nome || 'Empresa';
    return renderTraining();
  }
  if (!state.empresaId) return renderCompanySelect();
  return renderTraining();
}

function renderCompanySelect() {
  const main = mainEl();
  if (!main) return;
  main.innerHTML = `<section class="tr81">
    <div class="tr81-hero"><div><small>GESTÃO DE PESSOAS</small><h1>Treinamentos</h1><p>Escolha uma empresa para gerenciar plano anual, competências, realizações, integração, PID e evolução profissional.</p></div><span class="tr81-chip">${state.empresas.length} empresa(s)</span></div>
    <div class="tr81-company-grid">${state.empresas.map(e=>`<article class="tr81-company" data-tr81-company="${esc(e.id)}"><span class="tr81-badge">Abrir</span><h3>${esc(e.nome||'Empresa')}</h3><p>${esc(e.cnpj||e.documento||'')}</p></article>`).join('') || '<div class="tr81-empty">Nenhuma empresa cadastrada.</div>'}</div>
  </section>`;
  main.querySelectorAll('[data-tr81-company]').forEach(card=>card.addEventListener('click',()=>{
    const e = state.empresas.find(x=>x.id===card.dataset.tr81Company);
    if (!e) return;
    state.empresaId=e.id; state.empresaNome=e.nome||'Empresa'; state.tab='visao'; state.cache={};
    renderTraining();
  }));
}

function shell(content) {
  const main = mainEl(); if (!main) return;
  const back = state.perfil?.tipo==='admin' ? `<button class="tr81-btn soft" data-tr81-back>Trocar empresa</button>` : '';
  main.innerHTML = `<section class="tr81">
    <div class="tr81-hero"><div><small>GESTÃO DE COMPETÊNCIAS E DESENVOLVIMENTO</small><h1>Treinamentos</h1><p>${esc(state.empresaNome)} • plano anual, matriz de competências, integrações, PIDs e evolução profissional.</p></div><div>${back}</div></div>
    <nav class="tr81-tabs">${TABS.map(([id,label])=>`<button class="tr81-tab ${state.tab===id?'active':''}" data-tr81-tab="${id}">${label}</button>`).join('')}</nav>
    <div data-tr81-content>${content}</div>
  </section>`;
  main.querySelector('[data-tr81-back]')?.addEventListener('click',()=>{state.empresaId='';state.empresaNome='';state.cache={};renderCompanySelect()});
  main.querySelectorAll('[data-tr81-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tr81Tab;renderTraining()}));
}

async function qcol(name) {
  const s = await getDocs(query(collection(db,name),where('empresaId','==',state.empresaId)));
  return s.docs.map(d=>({id:d.id,...d.data()}));
}

function dateBr(v) {
  if (!v) return '-';
  if (v.toDate) return v.toDate().toLocaleDateString('pt-BR');
  const d = new Date(String(v).length===10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('pt-BR');
}

function statusBadge(status='pendente') {
  const s=String(status||'pendente').toLowerCase();
  const cls = ['concluido','realizado','ativo','aprovado','eficaz'].includes(s) ? 'ok' : ['atrasado','reprovado','ineficaz'].includes(s) ? 'bad' : 'warn';
  return `<span class="tr81-badge ${cls}">${esc(status||'Pendente')}</span>`;
}

async function renderTraining() {
  if (!state.empresaId) return openTraining();
  shell('<div class="tr81-empty">Carregando...</div>');
  try {
    if (state.tab==='visao') return renderOverview();
    if (state.tab==='plano') return renderPlan();
    if (state.tab==='colaboradores') return renderCollaborators();
    if (state.tab==='realizacoes') return renderEvents();
    if (state.tab==='matriz') return renderMatrix();
    if (state.tab==='integracao') return renderSimple('empresa_integracoes','Integração','Nova integração','integracao');
    if (state.tab==='pid') return renderSimple('empresa_pids','PID','Novo PID','pid');
    if (state.tab==='carreira') return renderSimple('empresa_carreiras','Carreira e evolução','Novo registro','carreira');
  } catch (e) {
    console.error(e);
    shell(`<div class="tr81-empty">Não foi possível carregar esta área.<br><small>${esc(e.message||'')}</small></div>`);
  }
}

async function renderOverview() {
  const [plans, matrix, events, cols, ints, pids, careers] = await Promise.all([
    qcol('empresa_treinamentos'),qcol('empresa_matriz_competencias'),qcol('empresa_treinamento_eventos'),
    qcol('empresa_colaboradores'),qcol('empresa_integracoes'),qcol('empresa_pids'),qcol('empresa_carreiras')
  ]);
  const now = new Date();
  const late = plans.filter(p=>p.dataPrevista && new Date(`${p.dataPrevista}T23:59:59`)<now && !['concluido','realizado'].includes(String(p.status||'').toLowerCase())).length;
  const pendingMatrix = matrix.filter(m=>!['concluido','nao_aplicavel'].includes(String(m.status||'').toLowerCase())).length;
  const openPids = pids.filter(p=>!['concluido','fechado'].includes(String(p.status||'').toLowerCase())).length;
  shell(`
    <div class="tr81-grid">
      <div class="tr81-kpi"><small>Treinamentos previstos</small><strong>${plans.length}</strong></div>
      <div class="tr81-kpi"><small>Realizações registradas</small><strong>${events.length}</strong></div>
      <div class="tr81-kpi"><small>Pendências da matriz</small><strong>${pendingMatrix}</strong></div>
      <div class="tr81-kpi"><small>Treinamentos atrasados</small><strong>${late}</strong></div>
      <div class="tr81-kpi"><small>Colaboradores</small><strong>${cols.length}</strong></div>
      <div class="tr81-kpi"><small>Integrações</small><strong>${ints.length}</strong></div>
      <div class="tr81-kpi"><small>PIDs abertos</small><strong>${openPids}</strong></div>
      <div class="tr81-kpi"><small>Planos de carreira</small><strong>${careers.length}</strong></div>
    </div>
    <div class="tr81-section"><div class="tr81-head"><div><h2>Fluxo do módulo</h2><p>Planeje → relacione competências → registre realização → avalie eficácia → abra PID quando necessário.</p></div></div>
      <div class="tr81-grid">${[
        ['Plano anual','Organize treinamentos, mês, carga horária, público e instrutor.','plano'],
        ['Matriz','Acompanhe o que cada colaborador precisa concluir.','matriz'],
        ['Integração','Controle integração institucional, SGQ, técnica e avaliação de 30 dias.','integracao'],
        ['PID','Registre lacunas, ações, prazo e eficácia do desenvolvimento.','pid']
      ].map(([a,b,t])=>`<div class="tr81-card"><h3>${a}</h3><p>${b}</p><button class="tr81-btn soft" data-go="${t}">Abrir</button></div>`).join('')}</div>
    </div>`);
  mainEl().querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.go;renderTraining()}));
}

function modal(title, body) {
  document.querySelector('.tr81-modal-bg')?.remove();
  const bg=document.createElement('div'); bg.className='tr81-modal-bg';
  bg.innerHTML=`<div class="tr81-modal"><div class="tr81-head"><h2>${esc(title)}</h2><button class="tr81-btn soft" data-close>Fechar</button></div>${body}</div>`;
  document.body.appendChild(bg);
  bg.addEventListener('click',e=>{if(e.target===bg||e.target.closest('[data-close]'))bg.remove()});
  return bg;
}

async function renderPlan() {
  const rows=(await qcol('empresa_treinamentos')).sort((a,b)=>String(a.dataPrevista||a.mesPrevisto||'').localeCompare(String(b.dataPrevista||b.mesPrevisto||'')));
  shell(`<section class="tr81-section"><div class="tr81-head"><div><h2>Plano anual de treinamentos</h2><p>Baseado no planejamento anual: tema, público, instrutor, carga horária, periodicidade e evidência.</p></div><button class="tr81-btn gold" data-new-plan>Novo treinamento</button></div>
    <div class="tr81-table-wrap"><table class="tr81-table"><thead><tr><th>Treinamento</th><th>Previsão</th><th>Público</th><th>Instrutor</th><th>Carga</th><th>Status</th><th></th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td><strong>${esc(r.titulo||r.nome||'Treinamento')}</strong><br><small>${esc(r.objetivo||'')}</small></td><td>${esc(r.mesPrevisto||dateBr(r.dataPrevista))}</td><td>${esc(r.publicoAlvo||'-')}</td><td>${esc(r.instrutor||'-')}</td><td>${esc(r.cargaHoraria||'-')}</td><td>${statusBadge(r.status)}</td><td><button class="tr81-btn danger" data-del-plan="${r.id}">Excluir</button></td></tr>`).join('')||'<tr><td colspan="7">Nenhum treinamento cadastrado.</td></tr>'}
    </tbody></table></div></section>`);
  mainEl().querySelector('[data-new-plan]')?.addEventListener('click',showPlanForm);
  mainEl().querySelectorAll('[data-del-plan]').forEach(b=>b.addEventListener('click',async()=>{if(confirm('Excluir este treinamento?')){await deleteDoc(doc(db,'empresa_treinamentos',b.dataset.delPlan));renderPlan()}}));
}

function showPlanForm() {
  const bg=modal('Novo treinamento',`<form class="tr81-form" data-plan-form>
    <div><label>Título *</label><input name="titulo" required></div>
    <div><label>Data prevista</label><input type="date" name="dataPrevista"></div>
    <div><label>Público-alvo</label><input name="publicoAlvo"></div>
    <div><label>Instrutor</label><input name="instrutor"></div>
    <div><label>Carga horária</label><input name="cargaHoraria" placeholder="Ex.: 2h"></div>
    <div><label>Periodicidade</label><input name="periodicidade" placeholder="Anual, admissão..."></div>
    <div class="full"><label>Objetivo</label><textarea name="objetivo"></textarea></div>
    <div class="full"><label>Evidência esperada</label><input name="evidenciaEsperada" placeholder="Lista de presença, prova, certificado..."></div>
    <div><label>Status</label><select name="status"><option>Planejado</option><option>Em andamento</option><option>Concluído</option></select></div>
    <div style="display:flex;align-items:end"><button class="tr81-btn primary" type="submit">Salvar treinamento</button></div>
  </form>`);
  bg.querySelector('[data-plan-form]').addEventListener('submit',async e=>{
    e.preventDefault(); const f=new FormData(e.currentTarget);
    await addDoc(collection(db,'empresa_treinamentos'),{
      empresaId:state.empresaId,titulo:f.get('titulo'),dataPrevista:f.get('dataPrevista')||'',
      publicoAlvo:f.get('publicoAlvo')||'',instrutor:f.get('instrutor')||'',cargaHoraria:f.get('cargaHoraria')||'',
      periodicidade:f.get('periodicidade')||'',objetivo:f.get('objetivo')||'',evidenciaEsperada:f.get('evidenciaEsperada')||'',
      status:f.get('status')||'Planejado',criadoEm:serverTimestamp(),criadoPor:state.user?.uid||''
    });
    bg.remove(); toast('Treinamento salvo.'); renderPlan();
  });
}

async function renderCollaborators() {
  const rows=(await qcol('empresa_colaboradores')).sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
  shell(`<section class="tr81-section"><div class="tr81-head"><div><h2>Colaboradores</h2><p>Base para matriz, integrações, realizações, PID e carreira.</p></div><div><button class="tr81-btn soft" data-import-col>Importar do Apontamento</button> <button class="tr81-btn gold" data-new-col>Novo colaborador</button></div></div>
  <div class="tr81-table-wrap"><table class="tr81-table"><thead><tr><th>Nome</th><th>Função</th><th>Setor</th><th>Admissão</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.nome)}</strong></td><td>${esc(r.funcao||'-')}</td><td>${esc(r.setor||'-')}</td><td>${dateBr(r.admissao)}</td><td>${statusBadge(r.ativo===false?'Inativo':'Ativo')}</td><td><button class="tr81-btn danger" data-del-col="${r.id}">Excluir</button></td></tr>`).join('')||'<tr><td colspan="6">Nenhum colaborador cadastrado.</td></tr>'}</tbody></table></div></section>`);
  mainEl().querySelector('[data-new-col]')?.addEventListener('click',showCollaboratorForm);
  mainEl().querySelector('[data-import-col]')?.addEventListener('click',importFromProduction);
  mainEl().querySelectorAll('[data-del-col]').forEach(b=>b.addEventListener('click',async()=>{if(confirm('Excluir colaborador?')){await deleteDoc(doc(db,'empresa_colaboradores',b.dataset.delCol));renderCollaborators()}}));
}

function showCollaboratorForm() {
  const bg=modal('Novo colaborador',`<form class="tr81-form" data-col-form>
    <div><label>Nome *</label><input name="nome" required></div><div><label>Função</label><input name="funcao"></div>
    <div><label>Setor</label><input name="setor"></div><div><label>Data de admissão</label><input type="date" name="admissao"></div>
    <div class="full"><button class="tr81-btn primary" type="submit">Salvar colaborador</button></div>
  </form>`);
  bg.querySelector('[data-col-form]').addEventListener('submit',async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);
    await addDoc(collection(db,'empresa_colaboradores'),{empresaId:state.empresaId,nome:f.get('nome'),funcao:f.get('funcao')||'',setor:f.get('setor')||'',admissao:f.get('admissao')||'',ativo:true,criadoEm:serverTimestamp(),criadoPor:state.user?.uid||''});
    bg.remove();toast('Colaborador salvo.');renderCollaborators();
  });
}

async function importFromProduction() {
  const prod = await qcol('empresa_funcionarios');
  const existing = await qcol('empresa_colaboradores');
  const names = new Set(existing.map(x=>String(x.nome||'').trim().toLowerCase()));
  let count=0;
  for (const f of prod) {
    const nome=String(f.nome||'').trim(); if(!nome||names.has(nome.toLowerCase())) continue;
    await addDoc(collection(db,'empresa_colaboradores'),{empresaId:state.empresaId,nome,funcao:f.funcao||'',setor:f.equipeNome||f.setor||'',ativo:f.ativo!==false,origemApontamentoId:f.id,criadoEm:serverTimestamp(),criadoPor:state.user?.uid||''});
    names.add(nome.toLowerCase());count++;
  }
  toast(`${count} colaborador(es) importado(s).`);renderCollaborators();
}

async function renderEvents() {
  const [events, plans, cols]=await Promise.all([qcol('empresa_treinamento_eventos'),qcol('empresa_treinamentos'),qcol('empresa_colaboradores')]);
  events.sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
  shell(`<section class="tr81-section"><div class="tr81-head"><div><h2>Realizações de treinamentos</h2><p>Registre quem participou, resultado, carga horária e evidência.</p></div><button class="tr81-btn gold" data-new-event>Registrar realização</button></div>
  <div class="tr81-table-wrap"><table class="tr81-table"><thead><tr><th>Treinamento</th><th>Data</th><th>Participantes</th><th>Instrutor</th><th>Resultado</th><th>Evidência</th></tr></thead><tbody>${events.map(r=>`<tr><td><strong>${esc(r.treinamentoNome||'Treinamento')}</strong></td><td>${dateBr(r.data)}</td><td>${esc((r.participanteNomes||[]).join(', ')||'-')}</td><td>${esc(r.instrutor||'-')}</td><td>${statusBadge(r.resultado||'Realizado')}</td><td>${r.evidenciaUrl?`<a href="${esc(r.evidenciaUrl)}" target="_blank" rel="noopener">Abrir</a>`:'-'}</td></tr>`).join('')||'<tr><td colspan="6">Nenhuma realização registrada.</td></tr>'}</tbody></table></div></section>`);
  mainEl().querySelector('[data-new-event]')?.addEventListener('click',()=>showEventForm(plans,cols));
}

function showEventForm(plans,cols) {
  const bg=modal('Registrar realização',`<form class="tr81-form" data-event-form>
    <div><label>Treinamento *</label><select name="treinamentoId" required><option value="">Selecione</option>${plans.map(p=>`<option value="${esc(p.id)}" data-name="${esc(p.titulo||p.nome||'Treinamento')}">${esc(p.titulo||p.nome||'Treinamento')}</option>`).join('')}</select></div>
    <div><label>Data *</label><input type="date" name="data" required></div>
    <div><label>Instrutor</label><input name="instrutor"></div><div><label>Carga horária</label><input name="cargaHoraria"></div>
    <div class="full"><label>Participantes</label><select name="participantes" multiple size="6">${cols.map(c=>`<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select></div>
    <div><label>Resultado</label><select name="resultado"><option>Realizado</option><option>Aprovado</option><option>Reprovado</option></select></div>
    <div><label>Evidência (opcional)</label><input type="file" name="evidencia" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"></div>
    <div class="full"><label>Observações</label><textarea name="observacoes"></textarea></div>
    <div class="full"><button class="tr81-btn primary" type="submit">Salvar realização</button></div>
  </form>`);
  bg.querySelector('[data-event-form]').addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget;const f=new FormData(form);
    const sel=form.elements.treinamentoId;const opt=sel.selectedOptions[0];
    const part=[...form.elements.participantes.selectedOptions];
    let evidenciaUrl='', evidenciaPath='', evidenciaNome='';
    const file=form.elements.evidencia.files?.[0];
    if(file){
      evidenciaNome=file.name;
      evidenciaPath=`empresas/${state.empresaId}/treinamentos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const rr=ref(storage,evidenciaPath); await uploadBytes(rr,file); evidenciaUrl=await getDownloadURL(rr);
    }
    await addDoc(collection(db,'empresa_treinamento_eventos'),{
      empresaId:state.empresaId,treinamentoId:f.get('treinamentoId'),treinamentoNome:opt?.dataset.name||opt?.textContent||'Treinamento',
      data:f.get('data'),instrutor:f.get('instrutor')||'',cargaHoraria:f.get('cargaHoraria')||'',resultado:f.get('resultado')||'Realizado',
      participanteIds:part.map(o=>o.value),participanteNomes:part.map(o=>o.textContent),observacoes:f.get('observacoes')||'',
      evidenciaUrl,evidenciaPath,evidenciaNome,criadoEm:serverTimestamp(),criadoPor:state.user?.uid||''
    });
    bg.remove();toast('Realização registrada.');renderEvents();
  });
}

async function renderMatrix() {
  const [plans,cols,items]=await Promise.all([qcol('empresa_treinamentos'),qcol('empresa_colaboradores'),qcol('empresa_matriz_competencias')]);
  const map=new Map(items.map(x=>[`${x.colaboradorId}__${x.treinamentoId}`,x]));
  shell(`<section class="tr81-section"><div class="tr81-head"><div><h2>Matriz de competências</h2><p>Atualize o status de cada treinamento por colaborador.</p></div></div>
    ${!plans.length||!cols.length?'<div class="tr81-empty">Cadastre treinamentos e colaboradores para montar a matriz.</div>':`<div class="tr81-matrix"><table><thead><tr><th>Colaborador</th>${plans.map(p=>`<th>${esc(p.titulo||p.nome||'Treinamento')}</th>`).join('')}</tr></thead><tbody>${cols.map(c=>`<tr><th>${esc(c.nome)}</th>${plans.map(p=>{const it=map.get(`${c.id}__${p.id}`);const st=it?.status||'Pendente';return `<td><select data-matrix data-col="${c.id}" data-col-name="${esc(c.nome)}" data-plan="${p.id}" data-plan-name="${esc(p.titulo||p.nome||'Treinamento')}" data-id="${it?.id||''}">${['Pendente','Concluído','Atrasado','Não aplicável'].map(o=>`<option ${o===st?'selected':''}>${o}</option>`).join('')}</select></td>`}).join('')}</tr>`).join('')}</tbody></table></div>`}
  </section>`);
  mainEl().querySelectorAll('[data-matrix]').forEach(s=>s.addEventListener('change',async()=>{
    const data={empresaId:state.empresaId,colaboradorId:s.dataset.col,colaboradorNome:s.dataset.colName,treinamentoId:s.dataset.plan,treinamentoNome:s.dataset.planName,status:s.value,atualizadoEm:serverTimestamp(),atualizadoPor:state.user?.uid||''};
    if(s.dataset.id) await updateDoc(doc(db,'empresa_matriz_competencias',s.dataset.id),data);
    else {const d=await addDoc(collection(db,'empresa_matriz_competencias'),{...data,criadoEm:serverTimestamp()});s.dataset.id=d.id}
    toast('Matriz atualizada.');
  }));
}

async function renderSimple(collectionName,title,newLabel,type) {
  const [rows,cols]=await Promise.all([qcol(collectionName),qcol('empresa_colaboradores')]);
  shell(`<section class="tr81-section"><div class="tr81-head"><div><h2>${esc(title)}</h2><p>${type==='integracao'?'Acompanhe integração institucional, SGQ, técnica, liberação e avaliação de 30 dias.':type==='pid'?'Controle lacunas, ações, prazo e eficácia do desenvolvimento.':'Registre objetivo profissional, lacunas e evolução de carreira.'}</p></div><button class="tr81-btn gold" data-new-simple>${esc(newLabel)}</button></div>
  <div class="tr81-table-wrap"><table class="tr81-table"><thead><tr><th>Colaborador</th><th>Resumo</th><th>Status</th><th>Data/Prazo</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.colaboradorNome||'-')}</strong></td><td>${esc(r.objetivo||r.origem||r.resultado30||r.cargoObjetivo||'-')}</td><td>${statusBadge(r.status||'Em andamento')}</td><td>${dateBr(r.prazo||r.dataAvaliacao30||r.data||'')}</td><td><button class="tr81-btn danger" data-del-simple="${r.id}">Excluir</button></td></tr>`).join('')||'<tr><td colspan="5">Nenhum registro.</td></tr>'}</tbody></table></div></section>`);
  mainEl().querySelector('[data-new-simple]')?.addEventListener('click',()=>showSimpleForm(collectionName,type,cols));
  mainEl().querySelectorAll('[data-del-simple]').forEach(b=>b.addEventListener('click',async()=>{if(confirm('Excluir registro?')){await deleteDoc(doc(db,collectionName,b.dataset.delSimple));renderSimple(collectionName,title,newLabel,type)}}));
}

function showSimpleForm(collectionName,type,cols) {
  let fields='';
  if(type==='integracao') fields=`
    <div><label>Data de admissão</label><input type="date" name="data"></div><div><label>Avaliação 30 dias</label><input type="date" name="dataAvaliacao30"></div>
    <div><label>Integração institucional</label><select name="institucional"><option>Pendente</option><option>Concluído</option></select></div><div><label>SGQ</label><select name="sgq"><option>Pendente</option><option>Concluído</option></select></div>
    <div><label>Integração técnica</label><select name="tecnica"><option>Pendente</option><option>Concluído</option></select></div><div><label>Liberação gestor</label><select name="gestor"><option>Pendente</option><option>Concluído</option></select></div>
    <div class="full"><label>Resultado após 30 dias</label><textarea name="resultado30"></textarea></div>`;
  if(type==='pid') fields=`
    <div><label>Origem da necessidade</label><input name="origem"></div><div><label>Prazo</label><input type="date" name="prazo"></div>
    <div class="full"><label>Objetivo de desenvolvimento</label><textarea name="objetivo"></textarea></div><div class="full"><label>Competências / lacunas</label><textarea name="competencias"></textarea></div><div class="full"><label>Ações e treinamentos recomendados</label><textarea name="acoes"></textarea></div>`;
  if(type==='carreira') fields=`
    <div><label>Cargo atual</label><input name="cargoAtual"></div><div><label>Cargo/objetivo futuro</label><input name="cargoObjetivo"></div>
    <div><label>Nível atual (1 a 4)</label><input type="number" min="1" max="4" name="nivelAtual"></div><div><label>Nível esperado (1 a 4)</label><input type="number" min="1" max="4" name="nivelEsperado"></div>
    <div class="full"><label>Lacunas</label><textarea name="lacunas"></textarea></div><div class="full"><label>Plano de ação</label><textarea name="acoes"></textarea></div>`;
  const bg=modal(type==='integracao'?'Nova integração':type==='pid'?'Novo PID':'Carreira e evolução',`<form class="tr81-form" data-simple-form>
    <div><label>Colaborador *</label><select name="colaboradorId" required><option value="">Selecione</option>${cols.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></div>
    <div><label>Status</label><select name="status"><option>Em andamento</option><option>Pendente</option><option>Concluído</option></select></div>
    ${fields}<div class="full"><button class="tr81-btn primary" type="submit">Salvar</button></div>
  </form>`);
  bg.querySelector('[data-simple-form]').addEventListener('submit',async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);const sel=e.currentTarget.elements.colaboradorId;
    const data={empresaId:state.empresaId,colaboradorId:f.get('colaboradorId'),colaboradorNome:sel.selectedOptions[0]?.textContent||'',status:f.get('status')||'Em andamento',criadoEm:serverTimestamp(),criadoPor:state.user?.uid||''};
    for(const [k,v] of f.entries()) if(k!=='colaboradorId'&&k!=='status') data[k]=v;
    await addDoc(collection(db,collectionName),data);bg.remove();toast('Registro salvo.');renderTraining();
  });
}

window.__EXCELLENCE_TRAINING_OPEN = openTraining;
window.addEventListener('excellence-open-trainings',()=>openTraining());
document.addEventListener('excellence-open-trainings',()=>openTraining());

let obsStarted=false;
function startObserver(){
  if(obsStarted)return;obsStarted=true;
  new MutationObserver(()=>ensureMenu()).observe(document.body,{childList:true,subtree:true});
}

onAuthStateChanged(auth,async user=>{
  try{
    await loadProfile(user);
    state.empresas=[];state.empresaId='';state.empresaNome='';
    startObserver();ensureMenu();
  }catch(e){console.warn('Treinamentos v81:',e)}
});
window.addEventListener('load',()=>{injectStyle();startObserver();ensureMenu()});
console.info(`Excellence System® Treinamentos ${V} carregado.`);
