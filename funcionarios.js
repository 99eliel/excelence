import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection, query, where, getDocs, getDoc, doc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const VERSION = '20260907-99';
const COMPANY_SESSION = 'excellence-employees-company';
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const state = {
  user:null, perfil:null, empresas:[], empresaId:'', empresaNome:'', returnTo:'',
  employees:[], observerStarted:false, syncing:false
};

const esc=(v='')=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const norm=(v='')=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const digits=(v='')=>String(v||'').replace(/\D/g,'');
const text=el=>String(el?.textContent||'').replace(/\s+/g,' ').trim();

function cpfMask(v=''){
  const d=digits(v).slice(0,11);
  return d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
}
function dateBr(v=''){
  if(!v)return '-';
  const d=new Date(String(v).length===10?`${v}T12:00:00`:v);
  return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('pt-BR');
}
function age(v=''){
  if(!v)return '';
  const b=new Date(`${v}T12:00:00`);if(Number.isNaN(b.getTime()))return '';
  const n=new Date();let a=n.getFullYear()-b.getFullYear();
  const m=n.getMonth()-b.getMonth();if(m<0||(m===0&&n.getDate()<b.getDate()))a--;
  return a>=0?`${a} anos`:'';
}
function initials(name=''){
  const p=String(name).trim().split(/\s+/).filter(Boolean);
  return((p[0]?.[0]||'')+(p.length>1?(p.at(-1)?.[0]||''):'')).toUpperCase()||'•';
}
function safeFileName(name='foto'){
  return String(name||'foto')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9._-]/g,'-').replace(/-+/g,'-').slice(0,120);
}
function toast(message,type='ok'){
  document.querySelector('[data-emp-toast]')?.remove();
  const el=document.createElement('div');el.dataset.empToast='1';el.textContent=message;
  el.style.cssText=`position:fixed;right:18px;bottom:18px;z-index:100500;padding:12px 15px;border-radius:14px;font-weight:850;color:#fff;max-width:420px;box-shadow:0 18px 42px rgba(5,36,55,.25);background:${type==='err'?'#9f2e2e':'#073F5A'}`;
  document.body.appendChild(el);setTimeout(()=>el.remove(),3600);
}
function mainEl(){return document.querySelector('.main')}
function isAdmin(){return state.perfil?.tipo==='admin'}
function photoAvatar(item={},className='emp-avatar'){
  if(item.fotoUrl){
    return `<span class="${className} has-photo"><img src="${esc(item.fotoUrl)}" alt="Foto de ${esc(item.nome||'funcionário')}" loading="lazy"></span>`;
  }
  return `<span class="${className}">${esc(initials(item.nome))}</span>`;
}
function validatePhoto(file){
  if(!file||!file.name)return;
  if(!PHOTO_TYPES.has(file.type))throw new Error('A foto precisa estar em JPG, PNG ou WebP.');
  if(file.size>MAX_PHOTO_BYTES)throw new Error('A foto precisa ter no máximo 8 MB.');
}
async function uploadEmployeePhoto(employeeId,file){
  validatePhoto(file);
  const path=`empresas/${state.empresaId}/funcionarios/${employeeId}/foto/${Date.now()}-${safeFileName(file.name)}`;
  const fileRef=ref(storage,path);
  await uploadBytes(fileRef,file,{contentType:file.type});
  const url=await getDownloadURL(fileRef);
  return {fotoUrl:url,fotoPath:path,fotoNome:file.name};
}
async function deletePhotoPath(path){
  if(!path)return;
  try{await deleteObject(ref(storage,path))}catch(error){console.warn('Foto antiga não removida ou já inexistente:',path,error)}
}

function injectStyle(){
  if(document.getElementById('employees-root-style'))return;
  const s=document.createElement('style');s.id='employees-root-style';
  s.textContent=`
    .emp-root{padding:24px;max-width:1500px;margin:0 auto;color:#173846}.emp-hero{background:linear-gradient(135deg,#073F5A,#0b607f);color:#fff;border-radius:22px;padding:24px;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;box-shadow:0 18px 42px rgba(7,63,90,.14)}.emp-hero h1{margin:4px 0 7px;font-size:31px}.emp-hero p{margin:0;color:#dcecf2;max-width:850px}.emp-hero small{font-weight:900;letter-spacing:.06em}.emp-actions{display:flex;gap:8px;flex-wrap:wrap}
    .emp-btn{border:0;border-radius:11px;padding:10px 13px;font-weight:850;cursor:pointer}.emp-btn.primary{background:#073F5A;color:#fff}.emp-btn.gold{background:#e9b64e;color:#173846}.emp-btn.soft{background:#eef5f7;color:#073F5A}.emp-btn.danger{background:#fde8e8;color:#992525}.emp-btn.ok{background:#e3f5e9;color:#1f6b37}.emp-btn:disabled{opacity:.45;cursor:not-allowed}
    .emp-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}.emp-kpi{background:#fff;border:1px solid #d9e6eb;border-radius:16px;padding:15px;box-shadow:0 8px 22px rgba(7,63,90,.04)}.emp-kpi small{display:block;text-transform:uppercase;font-size:10px;font-weight:850;color:#67808b}.emp-kpi strong{display:block;color:#073F5A;font-size:27px;margin-top:4px}
    .emp-section{background:#fff;border:1px solid #d9e6eb;border-radius:18px;padding:18px;box-shadow:0 10px 28px rgba(7,63,90,.05)}.emp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:14px}.emp-head h2{margin:0;color:#073F5A}.emp-head p{margin:5px 0 0;color:#607788}
    .emp-toolbar{display:grid;grid-template-columns:minmax(280px,1fr) 180px auto;gap:10px;margin-bottom:14px;background:#f5f9fb;border:1px solid #dce8ed;padding:12px;border-radius:14px}.emp-toolbar input,.emp-toolbar select{width:100%;border:1px solid #cfdfe5;border-radius:10px;padding:10px;background:#fff;color:#173846}
    .emp-table-wrap{overflow:auto}.emp-table{width:100%;border-collapse:collapse;min-width:960px}.emp-table th,.emp-table td{padding:11px;border-bottom:1px solid #e5edef;text-align:left;vertical-align:middle}.emp-table th{font-size:10px;text-transform:uppercase;color:#607788;background:#f7fafb}.emp-person{display:flex;align-items:center;gap:10px}.emp-avatar{width:42px;height:42px;border-radius:13px;background:#e7f2f6;color:#073F5A;display:grid;place-items:center;font-weight:900;overflow:hidden;flex:0 0 42px}.emp-avatar.has-photo{background:#dce8ed}.emp-avatar img,.emp-profile-avatar img,.emp-photo-preview img{width:100%;height:100%;display:block;object-fit:cover}.emp-person strong{display:block;color:#123e50}.emp-person small{display:block;color:#6b828c;margin-top:2px}.emp-badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:850;background:#eef5f7;color:#073F5A}.emp-badge.ok{background:#e3f5e9;color:#1f6b37}.emp-badge.bad{background:#fde8e8;color:#9b2222}.emp-row-actions{display:flex;gap:6px;flex-wrap:wrap}
    .emp-empty{padding:28px;text-align:center;border:1px dashed #cbdde4;border-radius:14px;color:#607788;background:#fbfdfe}.emp-empty strong{display:block;color:#073F5A;font-size:17px;margin-bottom:5px}
    .emp-modal-bg{position:fixed;inset:0;background:rgba(3,26,38,.58);z-index:100501;display:flex;align-items:center;justify-content:center;padding:18px}.emp-modal{width:min(900px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.28)}.emp-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}.emp-modal-head h2{margin:0;color:#073F5A}.emp-modal-head p{margin:4px 0 0;color:#607788}.emp-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.emp-form .full{grid-column:1/-1}.emp-form label{display:block;font-size:13px;font-weight:800;color:#466572;margin-bottom:5px}.emp-form input,.emp-form select,.emp-form textarea{width:100%;border:1px solid #cfdfe5;border-radius:10px;padding:10px;background:#fff;color:#173846}.emp-form textarea{min-height:85px;resize:vertical}.emp-note{padding:12px 14px;border-radius:13px;background:#eef7fb;border:1px solid #c8e1ea;color:#24596d;margin-bottom:14px}
    .emp-photo-editor{display:grid;grid-template-columns:132px minmax(0,1fr);gap:16px;align-items:center;border:1px solid #d8e7ed;background:linear-gradient(180deg,#f7fbfc,#fff);border-radius:16px;padding:14px}.emp-photo-preview{width:120px;height:120px;border-radius:22px;background:#e8f2f6;color:#073F5A;display:grid;place-items:center;font-size:34px;font-weight:900;overflow:hidden;border:1px solid #d3e3e9}.emp-photo-copy small{display:block;color:#607788;margin-top:6px;line-height:1.45}.emp-photo-buttons{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}.emp-photo-remove-note{display:none;color:#9b2222;font-weight:800;margin-top:8px}.emp-photo-remove-note.show{display:block}
    .emp-company-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:16px}.emp-company{border:1px solid #d9e6eb;border-radius:18px;padding:18px;background:#fff;cursor:pointer}.emp-company:hover{border-color:#0b6f93;transform:translateY(-1px)}
    .emp-profile{display:grid;grid-template-columns:200px 1fr;gap:18px}.emp-profile-side{background:#f5f9fb;border-radius:16px;padding:16px;text-align:center}.emp-profile-avatar{width:112px;height:112px;border-radius:24px;background:#073F5A;color:#fff;display:grid;place-items:center;font-size:30px;font-weight:900;margin:0 auto 12px;overflow:hidden}.emp-profile-main{display:grid;gap:12px}.emp-profile-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.emp-info{border:1px solid #e0eaee;border-radius:12px;padding:10px}.emp-info small{display:block;color:#6b828c;font-size:10px;text-transform:uppercase;font-weight:850}.emp-info strong{display:block;color:#173846;margin-top:3px}
    .emp-training-history{border:1px solid #dbe7eb;border-radius:14px;padding:12px;background:#fbfdfe}.emp-training-history h3{margin:0 0 9px;color:#073F5A}.emp-training-list{display:grid;gap:7px}.emp-training-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;background:#fff;border:1px solid #e1eaee;border-radius:11px;padding:9px 10px}.emp-training-item strong{display:block;color:#173846}.emp-training-item small{display:block;color:#607788;margin-top:2px}.emp-training-item .emp-badge{white-space:nowrap}
    @media(max-width:900px){.emp-summary{grid-template-columns:repeat(2,1fr)}.emp-toolbar{grid-template-columns:1fr 160px}.emp-toolbar .emp-btn{grid-column:1/-1}.emp-company-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:650px){.emp-root{padding:12px}.emp-hero{flex-direction:column}.emp-summary,.emp-form,.emp-company-grid,.emp-profile-grid{grid-template-columns:1fr}.emp-toolbar{grid-template-columns:1fr}.emp-profile{grid-template-columns:1fr}.emp-photo-editor{grid-template-columns:1fr}.emp-photo-preview{margin:0 auto}.emp-photo-copy{text-align:center}.emp-photo-buttons{justify-content:center}.emp-actions .emp-btn{width:100%}.emp-training-item{grid-template-columns:1fr}}
  `;document.head.appendChild(s);
}

async function loadProfile(user){
  state.user=user||null;state.perfil=null;state.empresas=[];
  if(!user)return;
  const s=await getDoc(doc(db,'usuarios',user.uid));
  state.perfil=s.exists()?{id:s.id,...s.data()}:null;
}
async function loadCompanies(){
  if(!isAdmin()){state.empresas=[];return}
  const s=await getDocs(collection(db,'empresas'));
  state.empresas=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
}
function rememberCompany(id,name=''){
  state.empresaId=id||'';state.empresaNome=name||'';
  try{if(id)sessionStorage.setItem(COMPANY_SESSION,id);else sessionStorage.removeItem(COMPANY_SESSION)}catch(_){}
}
async function qCompany(name){
  const s=await getDocs(query(collection(db,name),where('empresaId','==',state.empresaId)));
  return s.docs.map(d=>({id:d.id,...d.data()}));
}

function mappedCentralFromLegacy(l){
  return {
    empresaId:state.empresaId,
    nome:l.nome||'', cpf:l.cpf||'', dataNascimento:l.dataNascimento||'',
    cargo:l.cargo||l.funcao||'', funcao:l.cargo||l.funcao||'', setor:l.setor||'',
    admissao:l.admissao||'', ativo:l.ativo!==false, observacoes:l.observacoes||'',
    fotoUrl:l.fotoUrl||'', fotoPath:l.fotoPath||'', fotoNome:l.fotoNome||'',
    treinamentoColaboradorId:l.id, origemTreinamentos:true, atualizadoEm:serverTimestamp()
  };
}
function mappedLegacyFromCentral(c){
  return {
    empresaId:state.empresaId,
    nome:c.nome||'', cpf:c.cpf||'', dataNascimento:c.dataNascimento||'',
    cargo:c.cargo||c.funcao||'', funcao:c.cargo||c.funcao||'', setor:c.setor||c.equipeNome||'',
    admissao:c.admissao||'', ativo:c.ativo!==false, observacoes:c.observacoes||'',
    fotoUrl:c.fotoUrl||'', fotoPath:c.fotoPath||'', fotoNome:c.fotoNome||'',
    origemApontamentoId:c.id, atualizadoEm:serverTimestamp()
  };
}
function matchEmployee(central,legacy){
  if(central.id===legacy.id)return true;
  if(central.treinamentoColaboradorId&&central.treinamentoColaboradorId===legacy.id)return true;
  if(legacy.origemApontamentoId&&legacy.origemApontamentoId===central.id)return true;
  const a=norm(central.nome),b=norm(legacy.nome);return !!a&&a===b;
}
async function syncCompanyEmployees(){
  if(!isAdmin()||!state.empresaId||state.syncing)return;
  state.syncing=true;
  try{
    let [central,legacy]=await Promise.all([qCompany('empresa_funcionarios'),qCompany('empresa_colaboradores')]);
    for(const l of legacy){
      let c=central.find(x=>matchEmployee(x,l));
      if(!c){
        const id=l.origemApontamentoId||l.id;
        await setDoc(doc(db,'empresa_funcionarios',id),mappedCentralFromLegacy(l),{merge:true});
      }else if(c.treinamentoColaboradorId!==l.id){
        await updateDoc(doc(db,'empresa_funcionarios',c.id),{treinamentoColaboradorId:l.id,atualizadoEm:serverTimestamp()});
      }
    }
    central=await qCompany('empresa_funcionarios');legacy=await qCompany('empresa_colaboradores');
    for(const c of central){
      let l=legacy.find(x=>matchEmployee(c,x));
      const legacyId=l?.id||c.treinamentoColaboradorId||c.id;
      await setDoc(doc(db,'empresa_colaboradores',legacyId),mappedLegacyFromCentral(c),{merge:true});
      if(c.treinamentoColaboradorId!==legacyId){
        await updateDoc(doc(db,'empresa_funcionarios',c.id),{treinamentoColaboradorId:legacyId,atualizadoEm:serverTimestamp()});
      }
    }
  }catch(e){console.warn('Sincronização central de funcionários:',e)}finally{state.syncing=false}
}
async function syncOneEmployee(id){
  const s=await getDoc(doc(db,'empresa_funcionarios',id));if(!s.exists())return;
  const c={id:s.id,...s.data()};
  const legacy=await qCompany('empresa_colaboradores');
  const l=legacy.find(x=>matchEmployee(c,x));
  const legacyId=l?.id||c.treinamentoColaboradorId||c.id;
  await setDoc(doc(db,'empresa_colaboradores',legacyId),mappedLegacyFromCentral(c),{merge:true});
  if(c.treinamentoColaboradorId!==legacyId)await updateDoc(doc(db,'empresa_funcionarios',id),{treinamentoColaboradorId:legacyId,atualizadoEm:serverTimestamp()});
  const collections=['empresa_matriz_competencias','empresa_pids','empresa_integracoes','empresa_carreiras'];
  for(const name of collections){
    const rows=await qCompany(name);
    for(const r of rows.filter(x=>x.colaboradorId===legacyId||x.colaboradorId===id)){
      const refDoc=doc(db,name,r.id);
      await updateDoc(refDoc,{colaboradorNome:c.nome||'',atualizadoEm:serverTimestamp()});
    }
  }
}

function modal(title,subtitle,body){
  document.querySelector('.emp-modal-bg')?.remove();
  const bg=document.createElement('div');bg.className='emp-modal-bg';
  bg.innerHTML=`<div class="emp-modal"><div class="emp-modal-head"><div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><button class="emp-btn soft" type="button" data-close>Fechar</button></div>${body}</div>`;
  document.body.appendChild(bg);bg.addEventListener('click',e=>{if(e.target===bg||e.target.closest('[data-close]'))bg.remove()});return bg;
}

async function openEmployees(opts={}){
  injectStyle();
  if(!state.perfil&&auth.currentUser)await loadProfile(auth.currentUser);
  if(!isAdmin())return toast('O cadastro central de funcionários está disponível para o administrador.','err');
  if(!state.empresas.length)await loadCompanies();
  state.returnTo=opts.returnTo||'';

  if(!opts.empresaId){
    rememberCompany('','');
    return renderCompanySelect();
  }

  const e=state.empresas.find(x=>x.id===opts.empresaId);
  if(!e)return toast('Empresa não encontrada.','err');
  rememberCompany(e.id,opts.empresaNome||e.nome||'Empresa');
  await syncCompanyEmployees();
  return renderEmployees();
}
function renderCompanySelect(){
  const main=mainEl();if(!main)return;
  main.innerHTML=`<section class="emp-root"><div class="emp-hero"><div><small>BASE CENTRAL DA EMPRESA</small><h1>Funcionários</h1><p>Escolha a empresa para gerenciar a base única de colaboradores do Excellence System.</p></div></div><div class="emp-company-grid">${state.empresas.map(e=>`<article class="emp-company" data-emp-company="${esc(e.id)}"><span class="emp-badge">Abrir</span><h3>${esc(e.nome||'Empresa')}</h3><p>${esc(e.cnpj||e.documento||'')}</p></article>`).join('')||'<div class="emp-empty">Nenhuma empresa cadastrada.</div>'}</div></section>`;
  main.querySelectorAll('[data-emp-company]').forEach(card=>card.addEventListener('click',async()=>{
    const e=state.empresas.find(x=>x.id===card.dataset.empCompany);if(!e)return;
    rememberCompany(e.id,e.nome||'Empresa');await syncCompanyEmployees();renderEmployees();
  }));
}
async function renderEmployees(){
  const main=mainEl();if(!main)return;
  const rows=await qCompany('empresa_funcionarios');
  rows.sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));state.employees=rows;
  const active=rows.filter(x=>x.ativo!==false).length,inactive=rows.length-active;
  const cargos=new Set(rows.map(x=>x.cargo||x.funcao).filter(Boolean)).size;
  main.innerHTML=`<section class="emp-root"><div class="emp-hero"><div><small>BASE CENTRAL DA EMPRESA</small><h1>Funcionários • ${esc(state.empresaNome)}</h1><p>Cadastre a pessoa uma única vez. Foto, dados cadastrais e vínculo com Treinamentos ficam centralizados nesta ficha.</p></div><div class="emp-actions">${state.returnTo==='trainings'?'<button class="emp-btn soft" type="button" data-back-training>Voltar aos treinamentos</button>':''}<button class="emp-btn soft" type="button" data-change-company>Trocar empresa</button><button class="emp-btn gold" type="button" data-new-employee>Novo funcionário</button></div></div><div class="emp-summary"><div class="emp-kpi"><small>Total</small><strong>${rows.length}</strong></div><div class="emp-kpi"><small>Ativos</small><strong>${active}</strong></div><div class="emp-kpi"><small>Inativos</small><strong>${inactive}</strong></div><div class="emp-kpi"><small>Cargos</small><strong>${cargos}</strong></div></div><section class="emp-section"><div class="emp-head"><div><h2>Equipe da empresa</h2><p>Nome, foto, CPF, nascimento e cargo ficam centralizados aqui.</p></div></div><div class="emp-toolbar"><input type="search" data-emp-search placeholder="Buscar por nome, CPF, cargo ou setor..."><select data-emp-status><option value="">Todos os status</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select><button class="emp-btn soft" type="button" data-sync>Sincronizar módulos</button></div>${rows.length?`<div class="emp-table-wrap"><table class="emp-table"><thead><tr><th>Funcionário</th><th>CPF</th><th>Nascimento</th><th>Cargo</th><th>Setor</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(c=>`<tr data-emp-row data-search="${esc(norm([c.nome,c.cpf,c.cargo,c.funcao,c.setor].filter(Boolean).join(' ')))}" data-status="${c.ativo===false?'inativo':'ativo'}"><td><div class="emp-person">${photoAvatar(c)}<span><strong>${esc(c.nome||'Sem nome')}</strong><small>${c.admissao?`Admissão: ${dateBr(c.admissao)}`:'Sem data de admissão'}</small></span></div></td><td>${esc(cpfMask(c.cpf)||'-')}</td><td>${esc(c.dataNascimento?`${dateBr(c.dataNascimento)}${age(c.dataNascimento)?` • ${age(c.dataNascimento)}`:''}`:'-')}</td><td>${esc(c.cargo||c.funcao||'-')}</td><td>${esc(c.setor||'-')}</td><td><span class="emp-badge ${c.ativo===false?'bad':'ok'}">${c.ativo===false?'Inativo':'Ativo'}</span></td><td><div class="emp-row-actions"><button class="emp-btn soft" data-profile="${c.id}">Ficha</button><button class="emp-btn soft" data-edit="${c.id}">Editar</button><button class="emp-btn ${c.ativo===false?'ok':'danger'}" data-toggle="${c.id}">${c.ativo===false?'Reativar':'Inativar'}</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="emp-empty"><strong>Nenhum funcionário cadastrado</strong>Crie o primeiro funcionário da empresa.</div>'}</section></section>`;
  const search=main.querySelector('[data-emp-search]'),status=main.querySelector('[data-emp-status]');
  const filter=()=>{const term=norm(search?.value||''),st=status?.value||'';main.querySelectorAll('[data-emp-row]').forEach(r=>{const okTerm=!term||String(r.dataset.search||'').includes(term),okStatus=!st||r.dataset.status===st;r.style.display=okTerm&&okStatus?'':'none'})};
  search?.addEventListener('input',filter);status?.addEventListener('change',filter);
  main.querySelector('[data-new-employee]')?.addEventListener('click',()=>showEmployeeForm());
  main.querySelector('[data-change-company]')?.addEventListener('click',()=>{rememberCompany('','');renderCompanySelect()});
  main.querySelector('[data-back-training]')?.addEventListener('click',()=>{state.returnTo='';window.dispatchEvent(new CustomEvent('excellence-open-trainings'))});
  main.querySelector('[data-sync]')?.addEventListener('click',async()=>{await syncCompanyEmployees();toast('Base de funcionários sincronizada com os módulos.');renderEmployees()});
  main.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>showEmployeeForm(rows.find(x=>x.id===b.dataset.edit))));
  main.querySelectorAll('[data-profile]').forEach(b=>b.addEventListener('click',()=>showProfile(rows.find(x=>x.id===b.dataset.profile))));
  main.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>toggleEmployee(rows.find(x=>x.id===b.dataset.toggle))));
}
function showEmployeeForm(item=null){
  const bg=modal(item?'Editar funcionário':'Novo funcionário',item?'Atualize a ficha central do colaborador.':'Cadastre a pessoa uma única vez para toda a empresa.',`<div class="emp-note">A foto e os dados desta ficha serão a referência central do colaborador. O vínculo com Treinamentos é mantido automaticamente.</div><form class="emp-form" data-emp-form data-remove-photo="0"><div class="full emp-photo-editor"><div class="emp-photo-preview" data-photo-preview>${item?.fotoUrl?`<img src="${esc(item.fotoUrl)}" alt="Foto atual de ${esc(item.nome||'funcionário')}">`:esc(initials(item?.nome||''))}</div><div class="emp-photo-copy"><label>Foto do funcionário</label><input type="file" name="foto" data-photo-input accept="image/jpeg,image/png,image/webp"><small>Use uma foto frontal e nítida. Formatos aceitos: JPG, PNG ou WebP, com até 8 MB. A imagem será usada na ficha e ficará disponível para o relatório individual de treinamentos.</small><div class="emp-photo-buttons">${item?.fotoUrl?'<button class="emp-btn danger" type="button" data-remove-photo>Remover foto</button>':''}</div><span class="emp-photo-remove-note" data-photo-remove-note>A foto atual será removida quando você salvar.</span></div></div><div class="full"><label>Nome completo *</label><input name="nome" required value="${esc(item?.nome||'')}"></div><div><label>CPF *</label><input name="cpf" inputmode="numeric" maxlength="14" required placeholder="000.000.000-00" value="${esc(cpfMask(item?.cpf||''))}"></div><div><label>Data de nascimento *</label><input type="date" name="dataNascimento" required value="${esc(item?.dataNascimento||'')}"></div><div><label>Cargo / Função *</label><input name="cargo" required value="${esc(item?.cargo||item?.funcao||'')}"></div><div><label>Setor</label><input name="setor" value="${esc(item?.setor||'')}"></div><div><label>Data de admissão</label><input type="date" name="admissao" value="${esc(item?.admissao||'')}"></div><div><label>Situação</label><select name="ativo"><option value="true" ${item?.ativo===false?'':'selected'}>Ativo</option><option value="false" ${item?.ativo===false?'selected':''}>Inativo</option></select></div><div class="full"><label>Observações</label><textarea name="observacoes">${esc(item?.observacoes||'')}</textarea></div><div class="full"><button class="emp-btn primary" type="submit">${item?'Salvar alterações':'Cadastrar funcionário'}</button></div></form>`);
  const form=bg.querySelector('[data-emp-form]');const cpf=form.elements.cpf;
  const photoInput=form.querySelector('[data-photo-input]'),photoPreview=form.querySelector('[data-photo-preview]'),removeBtn=form.querySelector('[data-remove-photo]'),removeNote=form.querySelector('[data-photo-remove-note]');
  cpf.addEventListener('input',()=>{cpf.value=cpfMask(cpf.value)});
  photoInput?.addEventListener('change',()=>{
    const file=photoInput.files?.[0];if(!file)return;
    try{validatePhoto(file)}catch(error){photoInput.value='';toast(error.message,'err');return}
    form.dataset.removePhoto='0';removeNote?.classList.remove('show');
    const reader=new FileReader();reader.onload=()=>{photoPreview.innerHTML=`<img src="${esc(reader.result)}" alt="Prévia da foto">`};reader.readAsDataURL(file);
  });
  removeBtn?.addEventListener('click',()=>{
    form.dataset.removePhoto='1';photoInput.value='';photoPreview.textContent=initials(form.elements.nome.value||item?.nome||'');removeNote?.classList.add('show');
  });
  form.elements.nome?.addEventListener('input',()=>{
    if(!photoInput.files?.[0]&&form.dataset.removePhoto==='1')photoPreview.textContent=initials(form.elements.nome.value||'');
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();const f=new FormData(form),cpfRaw=digits(f.get('cpf')),btn=e.submitter;
    if(cpfRaw.length!==11)return toast('Informe um CPF com 11 números.','err');
    const duplicate=state.employees.find(x=>x.id!==item?.id&&digits(x.cpf)===cpfRaw);
    if(duplicate)return toast('Já existe um funcionário com este CPF nesta empresa.','err');
    const refDoc=item?doc(db,'empresa_funcionarios',item.id):doc(collection(db,'empresa_funcionarios'));
    const newPhotoFile=photoInput?.files?.[0]||null,removePhoto=form.dataset.removePhoto==='1';
    let uploadedPhoto=null;
    if(btn){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent=newPhotoFile?'Enviando foto...':'Salvando...'}
    try{
      if(newPhotoFile)uploadedPhoto=await uploadEmployeePhoto(refDoc.id,newPhotoFile);
      const payload={empresaId:state.empresaId,nome:String(f.get('nome')||'').trim(),cpf:cpfRaw,dataNascimento:f.get('dataNascimento')||'',cargo:String(f.get('cargo')||'').trim(),funcao:String(f.get('cargo')||'').trim(),setor:String(f.get('setor')||'').trim(),admissao:f.get('admissao')||'',ativo:f.get('ativo')==='true',observacoes:String(f.get('observacoes')||'').trim(),atualizadoEm:serverTimestamp(),atualizadoPor:state.user?.uid||''};
      if(uploadedPhoto)Object.assign(payload,uploadedPhoto,{fotoAtualizadaEm:serverTimestamp(),fotoAtualizadaPor:state.user?.uid||''});
      else if(removePhoto)Object.assign(payload,{fotoUrl:'',fotoPath:'',fotoNome:'',fotoAtualizadaEm:serverTimestamp(),fotoAtualizadaPor:state.user?.uid||''});
      if(!item){payload.criadoEm=serverTimestamp();payload.criadoPor=state.user?.uid||''}
      await setDoc(refDoc,payload,{merge:true});
      await syncOneEmployee(refDoc.id);
      if((uploadedPhoto||removePhoto)&&item?.fotoPath&&item.fotoPath!==uploadedPhoto?.fotoPath)await deletePhotoPath(item.fotoPath);
      bg.remove();toast(item?'Funcionário atualizado.':'Funcionário cadastrado.');renderEmployees();
    }catch(error){
      if(uploadedPhoto?.fotoPath)await deletePhotoPath(uploadedPhoto.fotoPath);
      console.error('Erro ao salvar funcionário:',error);toast(error?.message||'Não foi possível salvar o funcionário.','err');
    }finally{
      if(btn){btn.disabled=false;btn.textContent=btn.dataset.oldText||'Salvar'}
    }
  });
}
async function toggleEmployee(item){
  if(!item)return;const next=item.ativo===false;
  const action=next?'reativar':'inativar';if(!confirm(`Deseja ${action} ${item.nome||'este funcionário'}?`))return;
  await updateDoc(doc(db,'empresa_funcionarios',item.id),{ativo:next,atualizadoEm:serverTimestamp(),atualizadoPor:state.user?.uid||''});
  await syncOneEmployee(item.id);toast(next?'Funcionário reativado.':'Funcionário inativado. O histórico foi preservado.');renderEmployees();
}
async function showProfile(item){
  if(!item)return;
  const legacyId=item.treinamentoColaboradorId||item.id;
  const [matrix,pids,ints,careers]=await Promise.all([qCompany('empresa_matriz_competencias'),qCompany('empresa_pids'),qCompany('empresa_integracoes'),qCompany('empresa_carreiras')]);
  const m=matrix.filter(x=>x.colaboradorId===legacyId||x.colaboradorId===item.id),completed=m.filter(x=>norm(x.status)==='concluido').length,effective=m.filter(x=>norm(x.eficaciaStatus)==='eficaz').length;
  const pidOpen=pids.filter(x=>(x.colaboradorId===legacyId||x.colaboradorId===item.id)&&!['concluido','fechado'].includes(norm(x.status))).length;
  const history=[...m].sort((a,b)=>String(b.ultimaRealizacaoData||'').localeCompare(String(a.ultimaRealizacaoData||'')));
  modal('Ficha do funcionário',item.nome||'',`<div class="emp-profile"><aside class="emp-profile-side">${photoAvatar(item,'emp-profile-avatar')}<strong>${esc(item.nome||'')}</strong><div style="margin-top:6px"><span class="emp-badge ${item.ativo===false?'bad':'ok'}">${item.ativo===false?'Inativo':'Ativo'}</span></div></aside><div class="emp-profile-main"><div class="emp-profile-grid"><div class="emp-info"><small>CPF</small><strong>${esc(cpfMask(item.cpf)||'-')}</strong></div><div class="emp-info"><small>Nascimento</small><strong>${esc(item.dataNascimento?`${dateBr(item.dataNascimento)}${age(item.dataNascimento)?` • ${age(item.dataNascimento)}`:''}`:'-')}</strong></div><div class="emp-info"><small>Cargo</small><strong>${esc(item.cargo||item.funcao||'-')}</strong></div><div class="emp-info"><small>Setor</small><strong>${esc(item.setor||'-')}</strong></div><div class="emp-info"><small>Admissão</small><strong>${esc(dateBr(item.admissao))}</strong></div><div class="emp-info"><small>Treinamentos</small><strong>${completed}/${m.length} concluídos • ${effective} eficazes</strong></div><div class="emp-info"><small>PID</small><strong>${pidOpen} em andamento</strong></div><div class="emp-info"><small>Integração / Carreira</small><strong>${ints.filter(x=>x.colaboradorId===legacyId||x.colaboradorId===item.id).length} integração(ões) • ${careers.filter(x=>x.colaboradorId===legacyId||x.colaboradorId===item.id).length} plano(s)</strong></div></div>${item.observacoes?`<div class="emp-info"><small>Observações</small><strong>${esc(item.observacoes)}</strong></div>`:''}<section class="emp-training-history"><h3>Histórico de treinamentos</h3>${history.length?`<div class="emp-training-list">${history.map(r=>`<div class="emp-training-item"><div><strong>${esc(r.treinamentoNome||'Treinamento')}</strong><small>${r.ultimaRealizacaoData?`Última realização: ${dateBr(r.ultimaRealizacaoData)}`:'Sem data de realização'} • Eficácia: ${esc(r.eficaciaStatus||'Pendente')}</small></div><span class="emp-badge ${norm(r.status)==='concluido'?'ok':''}">${esc(r.status||'Pendente')}</span></div>`).join('')}</div>`:'<div class="emp-empty" style="padding:14px">Nenhum treinamento vinculado a este funcionário.</div>'}</section></div></div>`);
}

function ensureMenu(){
  if(!isAdmin())return;
  const nav=document.querySelector('#sidebar .nav-group,.sidebar .nav-group,#sidebar nav,.sidebar nav,#sidebar');if(!nav)return;
  let btn=[...document.querySelectorAll('#sidebar .nav-btn,.sidebar .nav-btn')].find(b=>b.dataset.employeesCentral==='1');
  if(!btn){
    btn=document.createElement('button');btn.type='button';btn.className='nav-btn';btn.dataset.employeesCentral='1';btn.innerHTML='<span class="nav-icon">👥</span><span>Funcionários</span>';
    const empresas=[...document.querySelectorAll('#sidebar .nav-btn,.sidebar .nav-btn')].find(b=>norm(text(b)).includes('empresas'));
    const usuarios=[...document.querySelectorAll('#sidebar .nav-btn,.sidebar .nav-btn')].find(b=>norm(text(b)).includes('usuarios'));
    if(empresas?.parentElement===nav)empresas.insertAdjacentElement('afterend',btn);else if(usuarios?.parentElement===nav)nav.insertBefore(btn,usuarios);else nav.appendChild(btn);
  }
  if(btn.dataset.bound==='1')return;btn.dataset.bound='1';
  btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openEmployees()},true);
}
function startObserver(){
  if(state.observerStarted)return;state.observerStarted=true;
  new MutationObserver(()=>ensureMenu()).observe(document.body,{childList:true,subtree:true});
}

document.addEventListener('click',e=>{
  const b=e.target.closest?.('.tr-main-nav [data-screen="employees"]');
  if(!b||!isAdmin())return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  openEmployees({returnTo:'trainings'});
},true);

window.__EXCELLENCE_EMPLOYEES_OPEN=openEmployees;
window.addEventListener('excellence-open-employees',e=>openEmployees(e.detail||{}));
onAuthStateChanged(auth,async user=>{try{await loadProfile(user);if(isAdmin())await loadCompanies();startObserver();ensureMenu()}catch(e){console.warn('Funcionários:',e)}});
window.addEventListener('load',()=>{injectStyle();startObserver();ensureMenu()});
console.info(`Excellence System • Funcionários central ${VERSION} carregado.`);
