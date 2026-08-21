import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const VERSION = '20260821-84';
const COMPANY_SESSION = 'excellence-training-company';
const STEP_LABELS = {
  1: 'Treinamentos',
  2: 'Funcionários',
  3: 'Público',
  4: 'Realizações',
  5: 'Eficácia'
};

const state = {
  user: null,
  perfil: null,
  empresas: [],
  empresaId: '',
  empresaNome: '',
  viewStep: null,
  cache: null,
  cacheAt: 0,
  observerStarted: false
};

const esc = (v='') => String(v ?? '')
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#039;');
const norm = (v='') => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const text = el => String(el?.textContent || '').replace(/\s+/g,' ').trim();

function toast(message, type='ok') {
  document.querySelector('[data-training-toast]')?.remove();
  const el = document.createElement('div');
  el.dataset.trainingToast = '1';
  el.textContent = message;
  el.style.cssText = `position:fixed;right:18px;bottom:18px;z-index:100000;padding:12px 15px;border-radius:14px;font-weight:850;color:#fff;max-width:420px;box-shadow:0 18px 42px rgba(5,36,55,.25);background:${type==='err'?'#9f2e2e':'#073F5A'}`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 3800);
}

function injectStyle() {
  if (document.getElementById('training-root-style')) return;
  const s = document.createElement('style');
  s.id = 'training-root-style';
  s.textContent = `
    .tr-root{padding:24px;max-width:1500px;margin:0 auto;color:#173846}
    .tr-hero{background:linear-gradient(135deg,#073F5A,#0b607f);color:#fff;border-radius:22px;padding:24px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;box-shadow:0 18px 42px rgba(7,63,90,.14)}
    .tr-hero small{font-weight:900;letter-spacing:.06em}.tr-hero h1{font-size:32px;margin:5px 0 8px}.tr-hero p{margin:0;color:#dcecf2;max-width:820px}.tr-hero-actions{display:flex;gap:8px;flex-wrap:wrap}
    .tr-btn{border:0;border-radius:11px;padding:10px 13px;font-weight:850;cursor:pointer}.tr-btn.primary{background:#073F5A;color:#fff}.tr-btn.gold{background:#e9b64e;color:#173846}.tr-btn.soft{background:#eef5f7;color:#073F5A}.tr-btn.danger{background:#fde8e8;color:#992525}.tr-btn.ok{background:#e3f5e9;color:#1f6b37}.tr-btn:disabled{opacity:.45;cursor:not-allowed}
    .tr-flow-head{margin:18px 0 12px;background:#fff;border:1px solid #d9e6eb;border-radius:18px;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:14px;box-shadow:0 9px 26px rgba(7,63,90,.05)}
    .tr-current{display:flex;align-items:center;gap:12px}.tr-current-num{width:44px;height:44px;border-radius:14px;background:#073F5A;color:#fff;display:grid;place-items:center;font-size:20px;font-weight:900}.tr-current h2{margin:0;color:#073F5A;font-size:21px}.tr-current p{margin:3px 0 0;color:#607788;font-size:13px}
    .tr-done-nav{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.tr-done-nav button{border:1px solid #cfe0e6;background:#f7fafb;color:#073F5A;border-radius:999px;padding:7px 10px;font-weight:800;cursor:pointer;font-size:12px}.tr-done-nav button.active{background:#073F5A;color:#fff;border-color:#073F5A}
    .tr-section{background:#fff;border:1px solid #d9e6eb;border-radius:18px;padding:18px;box-shadow:0 10px 28px rgba(7,63,90,.05)}
    .tr-section + .tr-section{margin-top:14px}.tr-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}.tr-section-head h2,.tr-section-head h3{margin:0;color:#073F5A}.tr-section-head p{margin:5px 0 0;color:#607788}
    .tr-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.tr-card{border:1px solid #dbe7eb;border-radius:15px;padding:14px;background:#fbfdfe}.tr-card h3{margin:0 0 5px;color:#123e50}.tr-card p{margin:0;color:#647c87}.tr-card-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;flex-wrap:wrap}
    .tr-badge{display:inline-block;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:850;background:#eef5f7;color:#073F5A}.tr-badge.ok{background:#e3f5e9;color:#1f6b37}.tr-badge.warn{background:#fff4d6;color:#87630b}.tr-badge.bad{background:#fde8e8;color:#9b2222}
    .tr-table-wrap{overflow:auto}.tr-table{width:100%;border-collapse:collapse;min-width:760px}.tr-table th,.tr-table td{padding:10px;border-bottom:1px solid #e5edef;text-align:left;vertical-align:top}.tr-table th{font-size:11px;text-transform:uppercase;color:#607788;background:#f7fafb}.tr-table tr:last-child td{border-bottom:0}
    .tr-empty{padding:26px;text-align:center;border:1px dashed #cbdde4;border-radius:14px;color:#607788;background:#fbfdfe}.tr-empty strong{display:block;color:#073F5A;font-size:17px;margin-bottom:5px}
    .tr-next{margin-top:16px;padding-top:16px;border-top:1px solid #e5edef;display:flex;align-items:center;justify-content:space-between;gap:12px}.tr-next div strong{display:block;color:#073F5A}.tr-next div small{color:#607788}
    .tr-alert{border-radius:14px;padding:12px 14px;background:#fff8e4;border:1px solid #eedca8;color:#6b5313;margin-bottom:12px}.tr-alert.error{background:#fff0ee;border-color:#eac3bc;color:#8f2c22}.tr-alert.success{background:#eef9f1;border-color:#c9e6d0;color:#236b3a}
    .tr-modal-bg{position:fixed;inset:0;background:rgba(3,26,38,.58);z-index:100001;display:flex;align-items:center;justify-content:center;padding:18px}.tr-modal{width:min(900px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.28)}
    .tr-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}.tr-modal-head h2{margin:0;color:#073F5A}.tr-modal-head p{margin:4px 0 0;color:#607788}
    .tr-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tr-form .full{grid-column:1/-1}.tr-form label{display:block;font-size:13px;font-weight:800;color:#466572;margin-bottom:5px}.tr-form input,.tr-form select,.tr-form textarea{width:100%;border:1px solid #cfdfe5;border-radius:10px;padding:10px;background:#fff;color:#173846}.tr-form textarea{min-height:88px;resize:vertical}
    .tr-check-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.tr-check{display:flex;gap:9px;align-items:flex-start;border:1px solid #dbe7eb;border-radius:12px;padding:10px;background:#fff}.tr-check input{margin-top:3px}.tr-check strong{display:block}.tr-check small{display:block;color:#607788}
    .tr-person-result{display:grid;grid-template-columns:auto 1fr 150px;gap:10px;align-items:center;border:1px solid #dbe7eb;border-radius:12px;padding:10px}.tr-person-result select{width:100%;border:1px solid #cfdfe5;border-radius:9px;padding:8px}
    .tr-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.tr-kpi{background:#fff;border:1px solid #d9e6eb;border-radius:16px;padding:15px}.tr-kpi small{display:block;color:#607788;text-transform:uppercase;font-weight:800}.tr-kpi strong{display:block;font-size:28px;color:#073F5A;margin-top:4px}
    .tr-company-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:16px}.tr-company{border:1px solid #d9e6eb;border-radius:18px;padding:18px;background:#fff;cursor:pointer}.tr-company:hover{border-color:#0b6f93;transform:translateY(-1px)}
    .tr-matrix-mini{display:grid;gap:8px}.tr-matrix-row{border:1px solid #e0eaee;border-radius:12px;padding:11px}.tr-matrix-row strong{color:#073F5A}.tr-matrix-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.tr-tag{font-size:11px;border-radius:999px;padding:5px 8px;background:#eef5f7;color:#345968;font-weight:800}
    .tr-aux-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:14px}.tr-aux{border:1px solid #d9e6eb;border-radius:16px;padding:15px;background:#fbfdfe}.tr-aux h3{margin:0 0 5px;color:#073F5A}.tr-aux p{margin:0 0 12px;color:#607788}
    @media(max-width:980px){.tr-grid,.tr-company-grid,.tr-summary,.tr-aux-grid{grid-template-columns:repeat(2,1fr)}.tr-flow-head{align-items:flex-start;flex-direction:column}.tr-done-nav{justify-content:flex-start}}
    @media(max-width:680px){.tr-root{padding:12px}.tr-hero{flex-direction:column}.tr-grid,.tr-company-grid,.tr-summary,.tr-aux-grid,.tr-check-list,.tr-form{grid-template-columns:1fr}.tr-form .full{grid-column:auto}.tr-person-result{grid-template-columns:auto 1fr}.tr-person-result select{grid-column:2}.tr-next{align-items:flex-start;flex-direction:column}.tr-next .tr-btn{width:100%}}
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
    if (!id) { state.empresas=[]; return; }
    const s = await getDoc(doc(db,'empresas',id));
    state.empresas = s.exists() ? [{id:s.id,...s.data()}] : [];
  }
}

function mainEl() { return document.querySelector('.main'); }

function ensureMenu() {
  if (!state.perfil || !canAccess()) return;
  const nav = document.querySelector('#sidebar .nav-group,.sidebar .nav-group,#sidebar nav,.sidebar nav');
  if (!nav) return;
  let btn = [...nav.querySelectorAll('.nav-btn')].find(b=>norm(text(b)).includes('treinamento'));
  if (!btn) {
    btn = document.createElement('button');
    btn.type='button'; btn.className='nav-btn'; btn.innerHTML='<span>▤</span>Treinamentos';
    const apont=[...nav.querySelectorAll('.nav-btn')].find(b=>norm(text(b)).includes('apontamento'));
    const quem=[...nav.querySelectorAll('.nav-btn')].find(b=>norm(text(b)).includes('quem somos'));
    if (apont?.parentElement===nav) apont.insertAdjacentElement('afterend',btn);
    else if (quem?.parentElement===nav) nav.insertBefore(btn,quem);
    else nav.appendChild(btn);
  }
  btn.style.display='';
  if (btn.dataset.trainingRootBound==='1') return;
  btn.dataset.trainingRootBound='1';
  btn.addEventListener('click',e=>{
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    openTraining();
  },true);
}

function rememberCompany(id,name='') {
  state.empresaId = id || '';
  state.empresaNome = name || '';
  try {
    if (id) sessionStorage.setItem(COMPANY_SESSION,id);
    else sessionStorage.removeItem(COMPANY_SESSION);
  } catch (_) {}
}

function clearCache() { state.cache=null; state.cacheAt=0; }

async function qCompany(name) {
  const s = await getDocs(query(collection(db,name),where('empresaId','==',state.empresaId)));
  return s.docs.map(d=>({id:d.id,...d.data()}));
}

async function loadData(force=false) {
  if (!state.empresaId) return null;
  if (!force && state.cache && Date.now()-state.cacheAt < 8000) return state.cache;
  const [plans, cols, matrix, events, pids] = await Promise.all([
    qCompany('empresa_treinamentos'),
    qCompany('empresa_colaboradores'),
    qCompany('empresa_matriz_competencias'),
    qCompany('empresa_treinamento_eventos'),
    qCompany('empresa_pids')
  ]);
  plans.sort((a,b)=>String(a.dataPrevista||'').localeCompare(String(b.dataPrevista||'')));
  cols.sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
  events.sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
  state.cache={plans,cols,matrix,events,pids}; state.cacheAt=Date.now();
  return state.cache;
}

function applicableRows(d) {
  return d.matrix.filter(m=>m.aplicavel!==false && norm(m.status)!=='nao aplicavel');
}

function requiredStep(d) {
  if (!d.plans.length) return 1;
  if (!d.cols.length) return 2;
  const applicable=applicableRows(d);
  const allAudience=d.plans.every(p=>p.publicoDefinido===true) && applicable.length>0;
  if (!allAudience) return 3;
  const pending=applicable.filter(m=>norm(m.status)!=='concluido');
  if (pending.length) return 4;
  const efficacy=applicable.filter(m=>norm(m.eficaciaStatus)!=='eficaz');
  if (efficacy.length) return 5;
  return 6;
}

function badge(status='') {
  const n=norm(status);
  const cls=['concluido','eficaz','aprovado','ativo'].includes(n)?'ok':['reprovado','ineficaz','atrasado'].includes(n)?'bad':'warn';
  return `<span class="tr-badge ${cls}">${esc(status||'Pendente')}</span>`;
}

function dateBr(v) {
  if (!v) return '-';
  if (v?.toDate) return v.toDate().toLocaleDateString('pt-BR');
  const d = new Date(String(v).length===10?`${v}T12:00:00`:v);
  return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('pt-BR');
}

function modal(title, subtitle, body) {
  document.querySelector('.tr-modal-bg')?.remove();
  const bg=document.createElement('div'); bg.className='tr-modal-bg';
  bg.innerHTML=`<div class="tr-modal"><div class="tr-modal-head"><div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><button class="tr-btn soft" type="button" data-close>Fechar</button></div>${body}</div>`;
  document.body.appendChild(bg);
  bg.addEventListener('click',e=>{if(e.target===bg||e.target.closest('[data-close]'))bg.remove()});
  return bg;
}

async function openTraining() {
  if (!canAccess()) return toast('Seu usuário não tem permissão para Treinamentos.','err');
  injectStyle();
  if (!state.empresas.length) await loadCompanies();
  if (state.perfil?.tipo!=='admin') {
    const e=state.empresas[0];
    if (!e) return toast('Nenhuma empresa vinculada ao usuário.','err');
    rememberCompany(e.id,e.nome||'Empresa');
    state.viewStep=null; clearCache();
    return renderFlow(true);
  }
  if (!state.empresaId) {
    try {
      const stored=sessionStorage.getItem(COMPANY_SESSION)||'';
      const found=state.empresas.find(e=>e.id===stored);
      if (found) rememberCompany(found.id,found.nome||'Empresa');
    } catch (_) {}
  }
  if (!state.empresaId) return renderCompanySelect();
  return renderFlow(true);
}

function renderCompanySelect() {
  const main=mainEl(); if(!main)return;
  main.innerHTML=`<section class="tr-root">
    <div class="tr-hero"><div><small>GESTÃO DE PESSOAS</small><h1>Treinamentos</h1><p>Escolha a empresa. Depois o sistema conduz o processo em ordem, mostrando somente o passo que já pode ser executado.</p></div></div>
    <div class="tr-company-grid">${state.empresas.map(e=>`<article class="tr-company" data-company="${esc(e.id)}"><span class="tr-badge">Abrir</span><h3>${esc(e.nome||'Empresa')}</h3><p>${esc(e.cnpj||e.documento||'')}</p></article>`).join('')||'<div class="tr-empty">Nenhuma empresa cadastrada.</div>'}</div>
  </section>`;
  main.querySelectorAll('[data-company]').forEach(card=>card.addEventListener('click',()=>{
    const e=state.empresas.find(x=>x.id===card.dataset.company); if(!e)return;
    rememberCompany(e.id,e.nome||'Empresa'); state.viewStep=null; clearCache(); renderFlow(true);
  }));
}

function stepIntro(step) {
  const map={
    1:['Cadastre os treinamentos','Comece pelo que a empresa precisa ensinar. Nenhuma outra etapa aparece antes disso.'],
    2:['Cadastre os funcionários','Agora informe quem trabalha na empresa. Você pode importar diretamente do Apontamento.'],
    3:['Defina quem precisa de cada treinamento','Escolha as pessoas de cada treinamento. O sistema monta a matriz automaticamente, sem você precisar configurá-la manualmente.'],
    4:['Registre os treinamentos realizados','Somente agora aparecem as realizações. Registre quem participou e o resultado de cada pessoa.'],
    5:['Avalie a eficácia','Depois que todas as pendências de realização forem concluídas, valide se o treinamento realmente funcionou.'],
    6:['Fluxo principal concluído','Treinamentos, pessoas, público, realizações e eficácia estão em dia.']
  };
  return map[step]||map[1];
}

async function renderFlow(force=false) {
  const main=mainEl(); if(!main)return;
  const d=await loadData(force); if(!d)return;
  const current=requiredStep(d);
  if (state.viewStep==null || state.viewStep>current) state.viewStep=current;
  const view=state.viewStep;
  const intro=stepIntro(view);
  const doneButtons=[];
  for(let i=1;i<=Math.min(current,5);i++) {
    doneButtons.push(`<button type="button" data-step="${i}" class="${i===view?'active':''}">${i}. ${esc(STEP_LABELS[i])}</button>`);
  }
  main.innerHTML=`<section class="tr-root">
    <div class="tr-hero"><div><small>GESTÃO DE TREINAMENTOS</small><h1>${esc(state.empresaNome)}</h1><p>Fluxo sequencial: você vê somente a etapa atual e o que já concluiu. Etapas futuras permanecem ocultas até serem liberadas.</p></div><div class="tr-hero-actions">${state.perfil?.tipo==='admin'?'<button class="tr-btn soft" type="button" data-change-company>Trocar empresa</button>':''}</div></div>
    <div class="tr-flow-head"><div class="tr-current"><div class="tr-current-num">${view===6?'✓':view}</div><div><h2>${esc(intro[0])}</h2><p>${esc(intro[1])}</p></div></div><div class="tr-done-nav">${doneButtons.join('')}</div></div>
    <div data-step-content></div>
  </section>`;
  main.querySelector('[data-change-company]')?.addEventListener('click',()=>{rememberCompany('','');state.viewStep=null;clearCache();renderCompanySelect()});
  main.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{const n=Number(b.dataset.step);if(n<=current){state.viewStep=n;renderFlow()}}));
  if(view===1) return renderStep1(d,current);
  if(view===2) return renderStep2(d,current);
  if(view===3) return renderStep3(d,current);
  if(view===4) return renderStep4(d,current);
  if(view===5) return renderStep5(d,current);
  return renderComplete(d);
}

function contentEl(){return document.querySelector('[data-step-content]')}

function continueBlock(title,sub,nextStep,label) {
  return `<div class="tr-next"><div><strong>${esc(title)}</strong><small>${esc(sub)}</small></div><button class="tr-btn primary" type="button" data-continue="${nextStep}">${esc(label)}</button></div>`;
}
function bindContinue() {
  document.querySelector('[data-continue]')?.addEventListener('click',e=>{state.viewStep=Number(e.currentTarget.dataset.continue);renderFlow()});
}

function renderStep1(d,current) {
  const root=contentEl();
  root.innerHTML=`<section class="tr-section"><div class="tr-section-head"><div><h2>1. Treinamentos</h2><p>Cadastre primeiro todos os treinamentos que deseja controlar.</p></div><button class="tr-btn gold" type="button" data-new-training>Novo treinamento</button></div>
    ${d.plans.length?`<div class="tr-table-wrap"><table class="tr-table"><thead><tr><th>Treinamento</th><th>Previsão</th><th>Instrutor</th><th>Carga</th><th>Status</th><th></th></tr></thead><tbody>${d.plans.map(p=>`<tr><td><strong>${esc(p.titulo||p.nome||'Treinamento')}</strong><br><small>${esc(p.objetivo||'')}</small></td><td>${dateBr(p.dataPrevista)}</td><td>${esc(p.instrutor||'-')}</td><td>${esc(p.cargaHoraria||'-')}</td><td>${badge(p.status||'Planejado')}</td><td><button class="tr-btn soft" data-edit-training="${p.id}">Editar</button> <button class="tr-btn danger" data-delete-training="${p.id}">Excluir</button></td></tr>`).join('')}</tbody></table></div>`:`<div class="tr-empty"><strong>Nenhum treinamento cadastrado</strong>Comece criando o primeiro treinamento. A etapa de funcionários só será liberada depois.</div>`}
    ${d.plans.length?continueBlock('Treinamentos cadastrados','Agora você já pode informar os funcionários da empresa.',2,'Continuar para funcionários'):''}
  </section>`;
  root.querySelector('[data-new-training]')?.addEventListener('click',()=>showTrainingForm());
  root.querySelectorAll('[data-edit-training]').forEach(b=>b.addEventListener('click',()=>showTrainingForm(d.plans.find(p=>p.id===b.dataset.editTraining))));
  root.querySelectorAll('[data-delete-training]').forEach(b=>b.addEventListener('click',()=>deleteTraining(b.dataset.deleteTraining,d)));
  bindContinue();
}

function showTrainingForm(item=null) {
  const bg=modal(item?'Editar treinamento':'Novo treinamento',item?'Atualize os dados do treinamento.':'Cadastre o que será ensinado antes de avançar para os funcionários.',`<form class="tr-form" data-training-form>
    <div><label>Título *</label><input name="titulo" required value="${esc(item?.titulo||'')}"></div>
    <div><label>Data prevista</label><input type="date" name="dataPrevista" value="${esc(item?.dataPrevista||'')}"></div>
    <div><label>Instrutor</label><input name="instrutor" value="${esc(item?.instrutor||'')}"></div>
    <div><label>Carga horária</label><input name="cargaHoraria" placeholder="Ex.: 2h" value="${esc(item?.cargaHoraria||'')}"></div>
    <div><label>Periodicidade</label><input name="periodicidade" placeholder="Anual, admissão..." value="${esc(item?.periodicidade||'')}"></div>
    <div><label>Público planejado (descrição)</label><input name="publicoAlvo" placeholder="Ex.: líderes, costureiras..." value="${esc(item?.publicoAlvo||'')}"></div>
    <div class="full"><label>Objetivo</label><textarea name="objetivo">${esc(item?.objetivo||'')}</textarea></div>
    <div class="full"><label>Evidência esperada</label><input name="evidenciaEsperada" placeholder="Lista de presença, prova, certificado..." value="${esc(item?.evidenciaEsperada||'')}"></div>
    <div class="full"><button class="tr-btn primary" type="submit">${item?'Salvar alterações':'Salvar treinamento'}</button></div>
  </form>`);
  bg.querySelector('[data-training-form]').addEventListener('submit',async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);
    const data={empresaId:state.empresaId,titulo:f.get('titulo'),dataPrevista:f.get('dataPrevista')||'',instrutor:f.get('instrutor')||'',cargaHoraria:f.get('cargaHoraria')||'',periodicidade:f.get('periodicidade')||'',publicoAlvo:f.get('publicoAlvo')||'',objetivo:f.get('objetivo')||'',evidenciaEsperada:f.get('evidenciaEsperada')||'',atualizadoEm:serverTimestamp()};
    if(item) await updateDoc(doc(db,'empresa_treinamentos',item.id),data);
    else await addDoc(collection(db,'empresa_treinamentos'),{...data,status:'Planejado',publicoDefinido:false,criadoEm:serverTimestamp(),criadoPor:state.user?.uid||''});
    bg.remove();clearCache();toast(item?'Treinamento atualizado.':'Treinamento criado.');
    state.viewStep=1;renderFlow(true);
  });
}

async function deleteTraining(id,d) {
  const hasEvents=d.events.some(e=>e.treinamentoId===id);
  if(hasEvents) return toast('Este treinamento já possui realizações e não pode ser excluído.','err');
  if(!confirm('Excluir este treinamento?'))return;
  await deleteDoc(doc(db,'empresa_treinamentos',id));
  for(const m of d.matrix.filter(x=>x.treinamentoId===id)) await deleteDoc(doc(db,'empresa_matriz_competencias',m.id));
  clearCache();toast('Treinamento excluído.');renderFlow(true);
}

async function invalidateAudiences() {
  const d=await loadData();
  for(const p of d.plans) await updateDoc(doc(db,'empresa_treinamentos',p.id),{publicoDefinido:false,publicoRevisaoNecessaria:true,atualizadoEm:serverTimestamp()});
}

function renderStep2(d,current) {
  const root=contentEl();
  root.innerHTML=`<section class="tr-section"><div class="tr-section-head"><div><h2>2. Funcionários</h2><p>Cadastre as pessoas da empresa. Se elas já existem no Apontamento, importe para evitar retrabalho.</p></div><div><button class="tr-btn soft" type="button" data-import>Importar do Apontamento</button> <button class="tr-btn gold" type="button" data-new-employee>Novo funcionário</button></div></div>
    ${d.cols.length?`<div class="tr-table-wrap"><table class="tr-table"><thead><tr><th>Nome</th><th>Função</th><th>Setor</th><th>Admissão</th><th>Status</th><th></th></tr></thead><tbody>${d.cols.map(c=>`<tr><td><strong>${esc(c.nome||'')}</strong></td><td>${esc(c.funcao||'-')}</td><td>${esc(c.setor||'-')}</td><td>${dateBr(c.admissao)}</td><td>${badge(c.ativo===false?'Inativo':'Ativo')}</td><td><button class="tr-btn danger" data-delete-employee="${c.id}">Excluir</button></td></tr>`).join('')}</tbody></table></div>`:`<div class="tr-empty"><strong>Nenhum funcionário cadastrado</strong>Importe do Apontamento ou cadastre manualmente. A definição de público só aparece depois.</div>`}
    ${d.cols.length?continueBlock('Funcionários cadastrados','Agora o sistema pode relacionar pessoas aos treinamentos.',3,'Continuar para definir público'):''}
  </section>`;
  root.querySelector('[data-import]')?.addEventListener('click',importEmployees);
  root.querySelector('[data-new-employee]')?.addEventListener('click',showEmployeeForm);
  root.querySelectorAll('[data-delete-employee]').forEach(b=>b.addEventListener('click',()=>deleteEmployee(b.dataset.deleteEmployee,d)));
  bindContinue();
}

function showEmployeeForm() {
  const bg=modal('Novo funcionário','Cadastre apenas as informações essenciais para a gestão dos treinamentos.',`<form class="tr-form" data-employee-form>
    <div><label>Nome *</label><input name="nome" required></div><div><label>Função</label><input name="funcao"></div>
    <div><label>Setor</label><input name="setor"></div><div><label>Data de admissão</label><input type="date" name="admissao"></div>
    <div class="full"><button class="tr-btn primary" type="submit">Salvar funcionário</button></div>
  </form>`);
  bg.querySelector('[data-employee-form]').addEventListener('submit',async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);
    await addDoc(collection(db,'empresa_colaboradores'),{empresaId:state.empresaId,nome:f.get('nome'),funcao:f.get('funcao')||'',setor:f.get('setor')||'',admissao:f.get('admissao')||'',ativo:true,criadoEm:serverTimestamp(),criadoPor:state.user?.uid||''});
    await invalidateAudiences();
    bg.remove();clearCache();toast('Funcionário cadastrado.');state.viewStep=2;renderFlow(true);
  });
}

async function importEmployees() {
  const prod=await qCompany('empresa_funcionarios');
  const d=await loadData();
  const names=new Set(d.cols.map(x=>norm(x.nome)));
  let count=0;
  for(const f of prod){
    const nome=String(f.nome||'').trim(); if(!nome||names.has(norm(nome)))continue;
    await addDoc(collection(db,'empresa_colaboradores'),{empresaId:state.empresaId,nome,funcao:f.funcao||'',setor:f.equipeNome||f.setor||'',ativo:f.ativo!==false,origemApontamentoId:f.id,criadoEm:serverTimestamp(),criadoPor:state.user?.uid||''});
    names.add(norm(nome));count++;
  }
  if(count) await invalidateAudiences();
  clearCache();toast(count?`${count} funcionário(s) importado(s).`:'Nenhum funcionário novo para importar.');state.viewStep=2;renderFlow(true);
}

async function deleteEmployee(id,d) {
  if(!confirm('Excluir este funcionário da área de treinamentos?'))return;
  await deleteDoc(doc(db,'empresa_colaboradores',id));
  for(const m of d.matrix.filter(x=>x.colaboradorId===id)) await deleteDoc(doc(db,'empresa_matriz_competencias',m.id));
  await invalidateAudiences();clearCache();toast('Funcionário excluído.');state.viewStep=2;renderFlow(true);
}

async function saveMatrix(old,data) {
  if(old?.id) await updateDoc(doc(db,'empresa_matriz_competencias',old.id),{...data,atualizadoEm:serverTimestamp(),atualizadoPor:state.user?.uid||''});
  else await addDoc(collection(db,'empresa_matriz_competencias'),{...data,criadoEm:serverTimestamp(),criadoPor:state.user?.uid||'',atualizadoEm:serverTimestamp()});
}

function renderStep3(d,current) {
  const root=contentEl();
  const byEmployee=new Map();
  for(const c of d.cols) byEmployee.set(c.id,[]);
  for(const m of applicableRows(d)) if(byEmployee.has(m.colaboradorId)) byEmployee.get(m.colaboradorId).push(m.treinamentoNome||'Treinamento');
  const allDefined=d.plans.every(p=>p.publicoDefinido===true) && applicableRows(d).length>0;
  root.innerHTML=`<section class="tr-section"><div class="tr-section-head"><div><h2>3. Definir público</h2><p>Abra cada treinamento e marque quem precisa realizá-lo. A matriz é criada automaticamente em segundo plano.</p></div></div>
    <div class="tr-grid">${d.plans.map(p=>{const count=d.matrix.filter(m=>m.treinamentoId===p.id&&m.aplicavel!==false&&norm(m.status)!=='nao aplicavel').length;return `<article class="tr-card"><h3>${esc(p.titulo||'Treinamento')}</h3><p>${p.publicoDefinido===true?`${count} pessoa(s) definida(s)`:'Público ainda não definido'}</p><div class="tr-card-foot">${p.publicoDefinido===true?'<span class="tr-badge ok">Definido</span>':'<span class="tr-badge warn">Pendente</span>'}<button class="tr-btn ${p.publicoDefinido===true?'soft':'gold'}" data-audience="${p.id}">${p.publicoDefinido===true?'Revisar pessoas':'Definir pessoas'}</button></div></article>`}).join('')}</div>
    ${allDefined?`<div class="tr-section" style="margin-top:14px"><div class="tr-section-head"><div><h3>Resumo gerado</h3><p>Você não precisa montar uma planilha manualmente. O sistema já relacionou cada funcionário aos seus treinamentos.</p></div></div><div class="tr-matrix-mini">${d.cols.map(c=>`<div class="tr-matrix-row"><strong>${esc(c.nome)}</strong><div class="tr-matrix-tags">${(byEmployee.get(c.id)||[]).map(t=>`<span class="tr-tag">${esc(t)}</span>`).join('')||'<span class="tr-tag">Nenhum treinamento obrigatório</span>'}</div></div>`).join('')}</div></div>${continueBlock('Público definido','Agora aparecem as realizações. Até aqui, elas permaneceram ocultas.',4,'Continuar para realizações')}`:`<div class="tr-alert" style="margin-top:14px"><strong>Conclua esta etapa:</strong> todos os treinamentos precisam ter pelo menos uma pessoa definida antes de avançar.</div>`}
  </section>`;
  root.querySelectorAll('[data-audience]').forEach(b=>b.addEventListener('click',()=>showAudience(d.plans.find(p=>p.id===b.dataset.audience),d)));
  bindContinue();
}

function showAudience(plan,d) {
  const existing=d.matrix.filter(m=>m.treinamentoId===plan.id);
  const selected=new Set(existing.filter(m=>m.aplicavel!==false&&norm(m.status)!=='nao aplicavel').map(m=>m.colaboradorId));
  const bg=modal('Quem precisa deste treinamento?',plan.titulo||'Treinamento',`<div class="tr-check-list">${d.cols.map(c=>`<label class="tr-check"><input type="checkbox" data-person value="${c.id}" ${selected.has(c.id)?'checked':''}><span><strong>${esc(c.nome)}</strong><small>${esc([c.funcao,c.setor].filter(Boolean).join(' • ')||'Sem função/setor')}</small></span></label>`).join('')}</div><div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="tr-btn primary" type="button" data-save-audience>Salvar pessoas</button></div>`);
  bg.querySelector('[data-save-audience]').addEventListener('click',async()=>{
    const ids=new Set([...bg.querySelectorAll('[data-person]:checked')].map(x=>x.value));
    if(!ids.size) return toast('Selecione pelo menos um funcionário para este treinamento.','err');
    const map=new Map(existing.map(x=>[x.colaboradorId,x]));
    for(const c of d.cols){
      const old=map.get(c.id), applicable=ids.has(c.id);
      const oldStatus=norm(old?.status);
      const keepDone=applicable&&oldStatus==='concluido';
      await saveMatrix(old,{empresaId:state.empresaId,colaboradorId:c.id,colaboradorNome:c.nome||'',treinamentoId:plan.id,treinamentoNome:plan.titulo||'Treinamento',aplicavel:applicable,status:applicable?(keepDone?'Concluído':'Pendente'):'Não aplicável',eficaciaStatus:applicable?(old?.eficaciaStatus||'Pendente'):'Não aplicável'});
    }
    await updateDoc(doc(db,'empresa_treinamentos',plan.id),{publicoDefinido:true,publicoRevisaoNecessaria:false,publicoTotal:ids.size,publicoAtualizadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()});
    bg.remove();clearCache();toast('Público salvo. A matriz foi atualizada automaticamente.');state.viewStep=3;renderFlow(true);
  });
}

async function ensurePid({colaboradorId,colaboradorNome,treinamentoId,treinamentoNome,origemId,motivo}) {
  const pids=await qCompany('empresa_pids');
  const dup=pids.find(p=>p.autoGerado===true&&p.colaboradorId===colaboradorId&&p.origemId===origemId&&!['concluido','fechado'].includes(norm(p.status)));
  if(dup)return dup.id;
  const d=await addDoc(collection(db,'empresa_pids'),{empresaId:state.empresaId,colaboradorId,colaboradorNome,treinamentoId,treinamentoNome,origem:`Treinamento: ${treinamentoNome} — ${motivo}`,origemTipo:'treinamento',origemId,autoGerado:true,status:'Em andamento',objetivo:`Desenvolver a competência relacionada ao treinamento ${treinamentoNome}.`,competencias:motivo,acoes:`Reforçar conteúdo, acompanhar aplicação prática e realizar novo treinamento quando necessário.`,criadoEm:serverTimestamp(),criadoPor:state.user?.uid||''});
  return d.id;
}

async function recalcPlan(planId) {
  const [planSnap,matrix]=await Promise.all([getDoc(doc(db,'empresa_treinamentos',planId)),qCompany('empresa_matriz_competencias')]);
  if(!planSnap.exists())return;
  const rows=matrix.filter(m=>m.treinamentoId===planId&&m.aplicavel!==false&&norm(m.status)!=='nao aplicavel');
  const allEffective=rows.length>0&&rows.every(m=>norm(m.status)==='concluido'&&norm(m.eficaciaStatus)==='eficaz');
  await updateDoc(doc(db,'empresa_treinamentos',planId),{status:allEffective?'Concluído':'Em andamento',atualizadoEm:serverTimestamp()});
}

function renderStep4(d,current) {
  const root=contentEl();
  const applicable=applicableRows(d);
  const pending=applicable.filter(m=>norm(m.status)!=='concluido');
  const openPids=d.pids.filter(p=>!['concluido','fechado'].includes(norm(p.status)));
  root.innerHTML=`<section class="tr-section"><div class="tr-section-head"><div><h2>4. Realizações</h2><p>Registre o treinamento quando ele realmente acontecer. Só aparecem pessoas que ainda estão pendentes.</p></div><button class="tr-btn gold" type="button" data-new-event ${pending.length?'':'disabled'}>Registrar realização</button></div>
    ${openPids.length?`<div class="tr-alert error"><strong>${openPids.length} PID(s) em andamento.</strong> Reprovações ou ineficácias geram desenvolvimento automaticamente. <button class="tr-btn soft" type="button" data-view-pids style="margin-left:8px">Ver PID</button></div>`:''}
    ${pending.length?`<div class="tr-grid">${d.plans.map(p=>{const rows=pending.filter(m=>m.treinamentoId===p.id);if(!rows.length)return '';return `<article class="tr-card"><h3>${esc(p.titulo||'Treinamento')}</h3><p>${rows.length} pessoa(s) ainda precisam concluir.</p><div class="tr-matrix-tags">${rows.slice(0,6).map(r=>`<span class="tr-tag">${esc(r.colaboradorNome)}</span>`).join('')}${rows.length>6?`<span class="tr-tag">+${rows.length-6}</span>`:''}</div></article>`}).join('')}</div>`:`<div class="tr-alert success"><strong>Todas as realizações obrigatórias foram concluídas.</strong> Agora a etapa de eficácia pode ser aberta.</div>`}
    <div class="tr-section" style="margin-top:14px"><div class="tr-section-head"><div><h3>Últimas realizações</h3><p>Histórico das atividades registradas.</p></div></div>${d.events.length?`<div class="tr-table-wrap"><table class="tr-table"><thead><tr><th>Treinamento</th><th>Data</th><th>Participantes</th><th>Instrutor</th><th>Evidência</th></tr></thead><tbody>${d.events.slice(0,8).map(e=>`<tr><td><strong>${esc(e.treinamentoNome||'Treinamento')}</strong></td><td>${dateBr(e.data)}</td><td>${esc((e.participanteNomes||e.participantes?.map(x=>x.nome)||[]).join(', ')||'-')}</td><td>${esc(e.instrutor||'-')}</td><td>${e.evidenciaUrl?`<a href="${esc(e.evidenciaUrl)}" target="_blank" rel="noopener">Abrir</a>`:'-'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="tr-empty">Nenhuma realização registrada ainda.</div>'}</div>
    ${!pending.length&&applicable.length?continueBlock('Realizações em dia','Agora o sistema libera a avaliação de eficácia.',5,'Continuar para eficácia'):''}
  </section>`;
  root.querySelector('[data-new-event]')?.addEventListener('click',()=>showEventForm(d,pending));
  root.querySelector('[data-view-pids]')?.addEventListener('click',()=>renderAux('pid'));
  bindContinue();
}

function showEventForm(d,pending) {
  const planIds=[...new Set(pending.map(m=>m.treinamentoId))];
  const plans=d.plans.filter(p=>planIds.includes(p.id));
  const bg=modal('Registrar realização','Escolha o treinamento e informe apenas quem realmente participou.',`<form class="tr-form" data-event-form>
    <div><label>Treinamento *</label><select name="treinamentoId" required><option value="">Selecione</option>${plans.map(p=>`<option value="${p.id}">${esc(p.titulo||'Treinamento')}</option>`).join('')}</select></div>
    <div><label>Data *</label><input type="date" name="data" required></div>
    <div><label>Instrutor</label><input name="instrutor"></div><div><label>Carga horária</label><input name="cargaHoraria"></div>
    <div class="full"><label>Participantes e resultado</label><div data-participants><div class="tr-empty">Escolha um treinamento primeiro.</div></div></div>
    <div><label>Evidência (opcional)</label><input type="file" name="evidencia" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"></div>
    <div class="full"><label>Observações</label><textarea name="observacoes"></textarea></div>
    <div class="full"><button class="tr-btn primary" type="submit">Salvar realização</button></div>
  </form>`);
  const form=bg.querySelector('[data-event-form]');
  const renderPeople=()=>{
    const id=form.elements.treinamentoId.value;
    const rows=pending.filter(m=>m.treinamentoId===id);
    const box=form.querySelector('[data-participants]');
    box.innerHTML=rows.length?rows.map(r=>`<div class="tr-person-result"><input type="checkbox" data-attendee value="${r.colaboradorId}" data-name="${esc(r.colaboradorNome)}" checked><strong>${esc(r.colaboradorNome)}</strong><select data-result><option>Aprovado</option><option>Reprovado</option></select></div>`).join(''):'<div class="tr-empty">Nenhuma pendência para este treinamento.</div>';
  };
  form.elements.treinamentoId.addEventListener('change',renderPeople);
  form.addEventListener('submit',async e=>{
    e.preventDefault();const f=new FormData(form);const plan=d.plans.find(p=>p.id===f.get('treinamentoId'));
    const attendees=[...form.querySelectorAll('[data-attendee]:checked')].map(ch=>({id:ch.value,nome:ch.dataset.name,resultado:ch.closest('.tr-person-result').querySelector('[data-result]').value}));
    if(!attendees.length)return toast('Marque pelo menos um participante.','err');
    let evidenciaUrl='',evidenciaPath='',evidenciaNome='';const file=form.elements.evidencia.files?.[0];
    if(file){evidenciaNome=file.name;evidenciaPath=`empresas/${state.empresaId}/treinamentos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const rr=ref(storage,evidenciaPath);await uploadBytes(rr,file);evidenciaUrl=await getDownloadURL(rr)}
    const eventRef=await addDoc(collection(db,'empresa_treinamento_eventos'),{empresaId:state.empresaId,treinamentoId:plan.id,treinamentoNome:plan.titulo||'Treinamento',data:f.get('data'),instrutor:f.get('instrutor')||'',cargaHoraria:f.get('cargaHoraria')||'',participantes:attendees,participanteIds:attendees.map(x=>x.id),participanteNomes:attendees.map(x=>x.nome),resultado:attendees.every(x=>x.resultado==='Aprovado')?'Aprovado':'Misto',observacoes:f.get('observacoes')||'',evidenciaUrl,evidenciaPath,evidenciaNome,criadoEm:serverTimestamp(),criadoPor:state.user?.uid||''});
    for(const a of attendees){
      const row=d.matrix.find(m=>m.treinamentoId===plan.id&&m.colaboradorId===a.id);if(!row)continue;
      if(a.resultado==='Aprovado') await updateDoc(doc(db,'empresa_matriz_competencias',row.id),{status:'Concluído',eficaciaStatus:'Pendente',ultimaRealizacaoId:eventRef.id,ultimaRealizacaoData:f.get('data'),atualizadoEm:serverTimestamp()});
      else {await updateDoc(doc(db,'empresa_matriz_competencias',row.id),{status:'Pendente',eficaciaStatus:'Ineficaz',ultimaRealizacaoId:eventRef.id,ultimaRealizacaoData:f.get('data'),atualizadoEm:serverTimestamp()});await ensurePid({colaboradorId:a.id,colaboradorNome:a.nome,treinamentoId:plan.id,treinamentoNome:plan.titulo||'Treinamento',origemId:`${eventRef.id}:${a.id}`,motivo:'Resultado reprovado no treinamento.'})}
    }
    await updateDoc(doc(db,'empresa_treinamentos',plan.id),{status:'Em andamento',ultimaRealizacaoData:f.get('data'),atualizadoEm:serverTimestamp()});
    bg.remove();clearCache();toast('Realização registrada.');state.viewStep=null;renderFlow(true);
  });
}

function renderStep5(d,current) {
  const root=contentEl();
  const applicable=applicableRows(d);
  const pending=applicable.filter(m=>norm(m.status)==='concluido'&&norm(m.eficaciaStatus)!=='eficaz');
  root.innerHTML=`<section class="tr-section"><div class="tr-section-head"><div><h2>5. Eficácia</h2><p>Confirme se o aprendizado foi aplicado e trouxe o resultado esperado.</p></div></div>
    ${pending.length?`<div class="tr-grid">${pending.map(m=>`<article class="tr-card"><h3>${esc(m.colaboradorNome)}</h3><p><strong>${esc(m.treinamentoNome)}</strong><br>Realização: ${dateBr(m.ultimaRealizacaoData)}</p><div class="tr-card-foot"><span class="tr-badge warn">Aguardando eficácia</span><button class="tr-btn gold" data-efficacy="${m.id}">Avaliar</button></div></article>`).join('')}</div>`:`<div class="tr-alert success"><strong>Todas as eficácias estão validadas.</strong> O fluxo principal foi concluído.</div>`}
  </section>`;
  root.querySelectorAll('[data-efficacy]').forEach(b=>b.addEventListener('click',()=>showEfficacy(d.matrix.find(m=>m.id===b.dataset.efficacy))));
  if(!pending.length){state.viewStep=6;setTimeout(()=>renderFlow(true),50)}
}

function showEfficacy(row) {
  const bg=modal('Avaliar eficácia',`${row.colaboradorNome} • ${row.treinamentoNome}`,`<form class="tr-form" data-efficacy-form>
    <div><label>Resultado *</label><select name="resultado" required><option>Eficaz</option><option>Ineficaz</option></select></div><div><label>Data da avaliação</label><input type="date" name="data"></div>
    <div><label>Avaliador</label><input name="avaliador"></div><div class="full"><label>Observações</label><textarea name="observacoes"></textarea></div>
    <div class="full"><button class="tr-btn primary" type="submit">Salvar avaliação</button></div>
  </form>`);
  bg.querySelector('[data-efficacy-form]').addEventListener('submit',async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);const result=f.get('resultado');
    if(result==='Eficaz') await updateDoc(doc(db,'empresa_matriz_competencias',row.id),{status:'Concluído',eficaciaStatus:'Eficaz',eficaciaData:f.get('data')||'',eficaciaAvaliador:f.get('avaliador')||'',eficaciaObservacoes:f.get('observacoes')||'',atualizadoEm:serverTimestamp()});
    else {await updateDoc(doc(db,'empresa_matriz_competencias',row.id),{status:'Pendente',eficaciaStatus:'Ineficaz',eficaciaData:f.get('data')||'',eficaciaAvaliador:f.get('avaliador')||'',eficaciaObservacoes:f.get('observacoes')||'',atualizadoEm:serverTimestamp()});await ensurePid({colaboradorId:row.colaboradorId,colaboradorNome:row.colaboradorNome,treinamentoId:row.treinamentoId,treinamentoNome:row.treinamentoNome,origemId:`eficacia:${row.id}:${f.get('data')||Date.now()}`,motivo:'Treinamento avaliado como ineficaz.'})}
    await recalcPlan(row.treinamentoId);
    bg.remove();clearCache();toast(result==='Eficaz'?'Eficácia confirmada.':'Ineficácia registrada. O treinamento voltou para pendência e um PID foi aberto.');state.viewStep=null;renderFlow(true);
  });
}

function renderComplete(d) {
  const root=contentEl();
  const applicable=applicableRows(d);const openPids=d.pids.filter(p=>!['concluido','fechado'].includes(norm(p.status)));
  root.innerHTML=`<div class="tr-alert success"><strong>Fluxo principal concluído.</strong> Todos os treinamentos obrigatórios têm realização e eficácia validadas.</div>
    <div class="tr-summary"><div class="tr-kpi"><small>Treinamentos</small><strong>${d.plans.length}</strong></div><div class="tr-kpi"><small>Funcionários</small><strong>${d.cols.length}</strong></div><div class="tr-kpi"><small>Competências</small><strong>${applicable.length}</strong></div><div class="tr-kpi"><small>Realizações</small><strong>${d.events.length}</strong></div></div>
    <section class="tr-section" style="margin-top:14px"><div class="tr-section-head"><div><h2>Gestão contínua</h2><p>Estas ferramentas só aparecem depois do fluxo principal, ou quando alguma reprovação exigir desenvolvimento.</p></div></div><div class="tr-aux-grid"><div class="tr-aux"><h3>Integração</h3><p>Acompanhe integração institucional, SGQ, técnica e avaliação de 30 dias.</p><button class="tr-btn soft" data-aux="integracao">Abrir integração</button></div><div class="tr-aux"><h3>PID</h3><p>${openPids.length?`${openPids.length} PID(s) aberto(s).`:'Planos de desenvolvimento individuais.'}</p><button class="tr-btn ${openPids.length?'gold':'soft'}" data-aux="pid">Abrir PID</button></div><div class="tr-aux"><h3>Carreira</h3><p>Registre objetivos, lacunas e evolução profissional.</p><button class="tr-btn soft" data-aux="carreira">Abrir carreira</button></div></div></section>`;
  root.querySelectorAll('[data-aux]').forEach(b=>b.addEventListener('click',()=>renderAux(b.dataset.aux)));
}

async function renderAux(type) {
  const main=mainEl(); if(!main)return;
  const map={integracao:['Integração','empresa_integracoes'],pid:['PID','empresa_pids'],carreira:['Carreira','empresa_carreiras']};
  const [title,col]=map[type];const rows=await qCompany(col);
  main.innerHTML=`<section class="tr-root"><div class="tr-hero"><div><small>GESTÃO CONTÍNUA</small><h1>${title}</h1><p>${esc(state.empresaNome)}</p></div><div class="tr-hero-actions"><button class="tr-btn soft" data-back-flow>Voltar ao fluxo</button></div></div><section class="tr-section" style="margin-top:16px"><div class="tr-section-head"><div><h2>${title}</h2><p>Área complementar do desenvolvimento profissional.</p></div><button class="tr-btn gold" data-new-aux>Novo registro</button></div>${rows.length?`<div class="tr-table-wrap"><table class="tr-table"><thead><tr><th>Funcionário</th><th>Resumo</th><th>Status</th><th>Data/Prazo</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.colaboradorNome||'-')}</strong></td><td>${esc(r.objetivo||r.origem||r.resultado30||r.cargoObjetivo||'-')}</td><td>${badge(r.status||'Em andamento')}</td><td>${dateBr(r.prazo||r.dataAvaliacao30||r.data||'')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="tr-empty">Nenhum registro.</div>'}</section></section>`;
  main.querySelector('[data-back-flow]')?.addEventListener('click',()=>{state.viewStep=6;renderFlow()});
  main.querySelector('[data-new-aux]')?.addEventListener('click',()=>showAuxForm(type));
}

async function showAuxForm(type) {
  const d=await loadData();
  let fields='';
  if(type==='integracao') fields=`<div><label>Data de admissão</label><input type="date" name="data"></div><div><label>Avaliação 30 dias</label><input type="date" name="dataAvaliacao30"></div><div><label>Institucional</label><select name="institucional"><option>Pendente</option><option>Concluído</option></select></div><div><label>SGQ</label><select name="sgq"><option>Pendente</option><option>Concluído</option></select></div><div><label>Técnica</label><select name="tecnica"><option>Pendente</option><option>Concluído</option></select></div><div><label>Liberação gestor</label><select name="gestor"><option>Pendente</option><option>Concluído</option></select></div><div class="full"><label>Resultado 30 dias</label><textarea name="resultado30"></textarea></div>`;
  if(type==='pid') fields=`<div><label>Origem</label><input name="origem"></div><div><label>Prazo</label><input type="date" name="prazo"></div><div class="full"><label>Objetivo</label><textarea name="objetivo"></textarea></div><div class="full"><label>Competências/lacunas</label><textarea name="competencias"></textarea></div><div class="full"><label>Ações</label><textarea name="acoes"></textarea></div>`;
  if(type==='carreira') fields=`<div><label>Cargo atual</label><input name="cargoAtual"></div><div><label>Objetivo futuro</label><input name="cargoObjetivo"></div><div><label>Nível atual (1 a 4)</label><input type="number" min="1" max="4" name="nivelAtual"></div><div><label>Nível esperado (1 a 4)</label><input type="number" min="1" max="4" name="nivelEsperado"></div><div class="full"><label>Lacunas</label><textarea name="lacunas"></textarea></div><div class="full"><label>Plano de ação</label><textarea name="acoes"></textarea></div>`;
  const bg=modal(type==='integracao'?'Nova integração':type==='pid'?'Novo PID':'Carreira e evolução','',`<form class="tr-form" data-aux-form><div><label>Funcionário *</label><select name="colaboradorId" required><option value="">Selecione</option>${d.cols.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></div><div><label>Status</label><select name="status"><option>Em andamento</option><option>Pendente</option><option>Concluído</option></select></div>${fields}<div class="full"><button class="tr-btn primary" type="submit">Salvar</button></div></form>`);
  bg.querySelector('[data-aux-form]').addEventListener('submit',async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);const sel=e.currentTarget.elements.colaboradorId;const col=type==='integracao'?'empresa_integracoes':type==='pid'?'empresa_pids':'empresa_carreiras';const data={empresaId:state.empresaId,colaboradorId:f.get('colaboradorId'),colaboradorNome:sel.selectedOptions[0]?.textContent||'',status:f.get('status')||'Em andamento',criadoEm:serverTimestamp(),criadoPor:state.user?.uid||''};for(const [k,v] of f.entries())if(!['colaboradorId','status'].includes(k))data[k]=v;await addDoc(collection(db,col),data);bg.remove();clearCache();toast('Registro salvo.');renderAux(type);
  });
}

window.__EXCELLENCE_TRAINING_OPEN = openTraining;
window.addEventListener('excellence-open-trainings',()=>openTraining());
document.addEventListener('excellence-open-trainings',()=>openTraining());

function startObserver(){
  if(state.observerStarted)return;state.observerStarted=true;
  new MutationObserver(()=>ensureMenu()).observe(document.body,{childList:true,subtree:true});
}

onAuthStateChanged(auth,async user=>{
  try{
    await loadProfile(user);state.empresas=[];rememberCompany('','');state.viewStep=null;clearCache();startObserver();ensureMenu();
  }catch(e){console.warn('Treinamentos:',e)}
});
window.addEventListener('load',()=>{injectStyle();startObserver();ensureMenu()});
console.info(`Excellence System® Treinamentos raiz ${VERSION} carregado.`);
