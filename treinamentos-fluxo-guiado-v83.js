import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { collection, getDocs, getDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const V = '20260821-83';
const COMPANY_SESSION = 'excellence-training-company-v82';
const state = { user:null, perfil:null, empresaId:'', timer:null, busy:false, cacheAt:0, cache:null };

const text = el => String(el?.textContent || '').replace(/\s+/g,' ').trim();
const low = el => text(el).toLowerCase();
const norm = v => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const esc = (v='') => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

function injectStyle(){
  if(document.getElementById('tr83-style')) return;
  const s=document.createElement('style'); s.id='tr83-style';
  s.textContent=`
    .tr83-guide{margin:16px 0 12px;background:#fff;border:1px solid #d8e6eb;border-radius:20px;padding:18px;box-shadow:0 10px 30px rgba(7,63,90,.06)}
    .tr83-guide-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:14px}.tr83-guide-head h2{margin:0;color:#073F5A;font-size:22px}.tr83-guide-head p{margin:5px 0 0;color:#607788;max-width:760px}
    .tr83-progress{min-width:190px}.tr83-progress-top{display:flex;justify-content:space-between;gap:10px;font-size:12px;font-weight:850;color:#466572;margin-bottom:6px}.tr83-progress-bar{height:9px;background:#eaf1f4;border-radius:999px;overflow:hidden}.tr83-progress-bar span{display:block;height:100%;background:#0b6f93;border-radius:999px}
    .tr83-next{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;background:linear-gradient(135deg,#073F5A,#0b607f);color:#fff;border-radius:16px;padding:14px 16px;margin-bottom:14px}.tr83-next-num{width:42px;height:42px;border-radius:13px;background:rgba(255,255,255,.14);display:grid;place-items:center;font-size:20px;font-weight:900}.tr83-next h3{margin:0 0 3px;font-size:17px}.tr83-next p{margin:0;color:#dcecf2;font-size:13px}.tr83-next button{border:0;border-radius:11px;padding:10px 13px;background:#f0c760;color:#173846;font-weight:900;cursor:pointer;white-space:nowrap}
    .tr83-steps{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.tr83-step{position:relative;border:1px solid #dbe7eb;background:#f9fbfc;border-radius:14px;padding:12px;text-align:left;cursor:pointer;min-height:104px;transition:.15s ease}.tr83-step:hover{transform:translateY(-1px);border-color:#83b6c8}.tr83-step.done{background:#f4fbf6;border-color:#bfe0c8}.tr83-step.current{background:#fff9e8;border-color:#e8c668}.tr83-step.warn{background:#fff5f3;border-color:#e4b7ae}.tr83-step .n{display:inline-grid;place-items:center;width:25px;height:25px;border-radius:8px;background:#e8f1f4;color:#073F5A;font-weight:900;font-size:12px;margin-bottom:8px}.tr83-step.done .n{background:#dcefe2;color:#1f6b37}.tr83-step.current .n{background:#f4d98d;color:#6b4b00}.tr83-step strong{display:block;color:#163b49;font-size:13px;margin-bottom:4px}.tr83-step small{display:block;color:#6b808b;line-height:1.25}.tr83-step .status{margin-top:7px;font-weight:850;color:#073F5A;font-size:11px}
    .tr83-context{margin:8px 0 12px;padding:11px 13px;border-radius:13px;background:#f4f8fa;border-left:4px solid #0b6f93;color:#345865}.tr83-context strong{color:#073F5A}.tr83-context small{display:block;margin-top:3px;color:#647d88}
    .tr81-tabs{order:initial}.tr81-tab[data-tr83-advanced="1"]{opacity:.82}.tr81-tab[data-tr81-tab="visao"]{font-weight:900}
    @media(max-width:1150px){.tr83-steps{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:720px){.tr83-guide-head{display:block}.tr83-progress{margin-top:12px}.tr83-next{grid-template-columns:auto 1fr}.tr83-next button{grid-column:1/-1;width:100%}.tr83-steps{grid-template-columns:1fr 1fr}}
    @media(max-width:460px){.tr83-steps{grid-template-columns:1fr}}
  `;
  document.head.appendChild(s);
}

async function loadProfile(user){
  state.user=user||null; state.perfil=null;
  if(!user) return;
  const s=await getDoc(doc(db,'usuarios',user.uid));
  state.perfil=s.exists()?{id:s.id,...s.data()}:null;
}

async function empresaId(){
  if(state.perfil?.tipo!=='admin' && state.perfil?.empresaId) return state.perfil.empresaId;
  if(state.empresaId) return state.empresaId;
  try{ const id=sessionStorage.getItem(COMPANY_SESSION)||''; if(id){state.empresaId=id;return id} }catch(_){ }
  const hero=document.querySelector('.tr81-hero p');
  const nome=text(hero).split('•')[0].trim();
  if(!nome) return '';
  const s=await getDocs(collection(db,'empresas'));
  const found=s.docs.find(d=>String(d.data()?.nome||'').trim()===nome);
  if(found){state.empresaId=found.id;try{sessionStorage.setItem(COMPANY_SESSION,found.id)}catch(_){ }return found.id}
  return '';
}

async function qcol(name,id){
  const s=await getDocs(query(collection(db,name),where('empresaId','==',id)));
  return s.docs.map(d=>({id:d.id,...d.data()}));
}

async function progress(force=false){
  const id=await empresaId();
  if(!id) return null;
  if(!force && state.cache && state.cache.empresaId===id && Date.now()-state.cacheAt<5000) return state.cache;
  const [plans,cols,matrix,events,pids,integrations]=await Promise.all([
    qcol('empresa_treinamentos',id), qcol('empresa_colaboradores',id), qcol('empresa_matriz_competencias',id),
    qcol('empresa_treinamento_eventos',id), qcol('empresa_pids',id), qcol('empresa_integracoes',id)
  ]);
  const publicPending=plans.filter(p=>p.publicoDefinido!==true).length;
  const applicable=matrix.filter(m=>m.aplicavel!==false && !['nao aplicavel','não aplicável'].includes(norm(m.status)));
  const matrixPending=applicable.filter(m=>norm(m.status)!=='concluido').length;
  const efficacyPending=applicable.filter(m=>norm(m.status)==='concluido' && norm(m.eficaciaStatus)!=='eficaz').length;
  const openPids=pids.filter(p=>!['concluido','fechado'].includes(norm(p.status))).length;
  const basicDone=(plans.length>0?1:0)+(cols.length>0?1:0)+(plans.length>0&&publicPending===0?1:0);
  const data={empresaId:id,plans,cols,matrix,events,pids,integrations,publicPending,applicable,matrixPending,efficacyPending,openPids,basicDone};
  state.cache=data;state.cacheAt=Date.now();return data;
}

function tabs(){ return [...document.querySelectorAll('.tr81-tabs [data-tr81-tab]')]; }
function tab(id){ return document.querySelector(`.tr81-tabs [data-tr81-tab="${id}"]`); }
function openTab(id){ const b=tab(id); if(b) b.click(); }

function arrangeTabs(){
  const nav=document.querySelector('.tr81-tabs'); if(!nav) return;
  const order=['visao','plano','colaboradores','matriz','realizacoes','integracao','pid','carreira'];
  const labels={visao:'Resumo',plano:'1. Treinamentos',colaboradores:'2. Funcionários',matriz:'3. Público e matriz',realizacoes:'4. Realizações',integracao:'Integração',pid:'PID',carreira:'Carreira'};
  order.forEach(id=>{const b=tab(id);if(b){b.textContent=labels[id]||b.textContent;b.dataset.tr83Advanced=['integracao','pid','carreira'].includes(id)?'1':'0';nav.appendChild(b)}});
}

function nextStep(d){
  if(!d.plans.length) return {n:1,title:'Crie o primeiro treinamento',desc:'Cadastre o treinamento, objetivo, data prevista, público, instrutor e carga horária.',tab:'plano',action:'new-plan',button:'Criar treinamento'};
  if(!d.cols.length) return {n:2,title:'Cadastre ou importe os funcionários',desc:'Você pode importar os funcionários que já existem no Apontamento ou cadastrar manualmente.',tab:'colaboradores',action:'colaboradores',button:'Abrir funcionários'};
  if(d.publicPending>0) return {n:3,title:'Defina quem precisa de cada treinamento',desc:`${d.publicPending} treinamento(s) ainda estão sem público definido. Ao definir, a matriz é gerada automaticamente.`,tab:'plano',action:'audience',button:'Definir público'};
  if(d.matrixPending>0) return {n:4,title:'Agora registre os treinamentos realizados',desc:`Há ${d.matrixPending} competência(s) pendente(s) na matriz. Quando o treinamento acontecer, registre os participantes e o resultado.`,tab:'realizacoes',action:'event',button:'Registrar realização'};
  if(d.efficacyPending>0) return {n:5,title:'Avalie a eficácia dos treinamentos',desc:`${d.efficacyPending} competência(s) aguardam confirmação de eficácia.`,tab:'realizacoes',action:'efficacy',button:'Avaliar eficácia'};
  return {n:6,title:'Fluxo principal está em dia',desc:'Acompanhe integrações, PIDs e evolução profissional somente quando houver necessidade.',tab:'visao',action:'visao',button:'Ver resumo'};
}

function runAction(step){
  openTab(step.tab);
  if(step.action==='new-plan') setTimeout(()=>document.querySelector('[data-new-plan]')?.click(),140);
  if(step.action==='event') setTimeout(()=>document.querySelector('[data-new-event]')?.click(),140);
}

function stepClass(done,current,warn=false){ return ['tr83-step',done?'done':'',current?'current':'',warn?'warn':''].filter(Boolean).join(' '); }

function renderGuide(d){
  const root=document.querySelector('.tr81'); const nav=document.querySelector('.tr81-tabs'); if(!root||!nav) return;
  document.querySelector('[data-tr83-guide]')?.remove();
  const next=nextStep(d);
  const setupPercent=Math.round((d.basicDone/3)*100);
  const audienceDone=d.plans.length>0&&d.cols.length>0&&d.publicPending===0;
  const steps=[
    {n:1,title:'Treinamentos',sub:'Cadastre o que será ensinado.',status:`${d.plans.length} cadastrado(s)`,done:d.plans.length>0,tab:'plano'},
    {n:2,title:'Funcionários',sub:'Importe ou cadastre as pessoas.',status:`${d.cols.length} funcionário(s)`,done:d.cols.length>0,tab:'colaboradores'},
    {n:3,title:'Público e matriz',sub:'Defina quem precisa de cada treinamento.',status:d.plans.length?`${Math.max(0,d.plans.length-d.publicPending)}/${d.plans.length} definidos`:'Aguardando passo 1',done:audienceDone,tab:d.publicPending?'plano':'matriz'},
    {n:4,title:'Realizações',sub:'Registre quando o treinamento acontecer.',status:`${d.events.length} realização(ões)`,done:d.events.length>0,tab:'realizacoes'},
    {n:5,title:'Eficácia',sub:'Confirme se o aprendizado funcionou.',status:d.efficacyPending?`${d.efficacyPending} aguardando`:(d.events.length?'Em dia':'Aguardando realização'),done:d.events.length>0&&d.efficacyPending===0,tab:'realizacoes'},
    {n:6,title:'Desenvolvimento',sub:'PID, integração e carreira quando necessário.',status:d.openPids?`${d.openPids} PID(s) aberto(s)`:'Sob demanda',done:false,warn:d.openPids>0,tab:d.openPids?'pid':'integracao'}
  ];
  const box=document.createElement('section');box.className='tr83-guide';box.dataset.tr83Guide='1';
  box.innerHTML=`
    <div class="tr83-guide-head"><div><h2>Fluxo guiado</h2><p>O sistema mostra a ordem recomendada. Você não precisa decorar as abas: conclua um passo e siga para o próximo.</p></div>
      <div class="tr83-progress"><div class="tr83-progress-top"><span>Configuração inicial</span><strong>${setupPercent}%</strong></div><div class="tr83-progress-bar"><span style="width:${setupPercent}%"></span></div></div></div>
    <div class="tr83-next"><div class="tr83-next-num">${next.n}</div><div><h3>Próximo passo: ${esc(next.title)}</h3><p>${esc(next.desc)}</p></div><button type="button" data-tr83-next>${esc(next.button)}</button></div>
    <div class="tr83-steps">${steps.map(s=>`<button type="button" class="${stepClass(s.done,next.n===s.n,s.warn)}" data-tr83-tab="${s.tab}"><span class="n">${s.n}</span><strong>${esc(s.title)}</strong><small>${esc(s.sub)}</small><span class="status">${esc(s.status)}</span></button>`).join('')}</div>`;
  nav.parentElement.insertBefore(box,nav);
  box.querySelector('[data-tr83-next]')?.addEventListener('click',()=>runAction(next));
  box.querySelectorAll('[data-tr83-tab]').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.tr83Tab)));
}

function renderContext(){
  document.querySelector('[data-tr83-context]')?.remove();
  const nav=document.querySelector('.tr81-tabs');if(!nav)return;
  const active=tabs().find(b=>b.classList.contains('active'))?.dataset.tr81Tab || '';
  const messages={
    visao:['Resumo do módulo','Veja o que está pendente e use o Fluxo guiado para continuar de onde parou.'],
    plano:['Passo 1 — Treinamentos','Primeiro cadastre os treinamentos. Depois use “Definir público” em cada um para indicar quais funcionários precisam realizá-lo.'],
    colaboradores:['Passo 2 — Funcionários','Importe do Apontamento para evitar retrabalho ou cadastre manualmente quem ainda não estiver no sistema.'],
    matriz:['Passo 3 — Público e matriz','Aqui você confere, por funcionário, o que está pendente, concluído, atrasado ou não se aplica. A matriz nasce do público definido nos treinamentos.'],
    realizacoes:['Passos 4 e 5 — Realização e eficácia','Quando o treinamento acontecer, registre os participantes e depois avalie a eficácia. Reprovação ou ineficácia gera PID automaticamente.'],
    integracao:['Acompanhamento — Integração','Use para novos colaboradores: integração institucional, SGQ, técnica, liberação e avaliação após 30 dias.'],
    pid:['Acompanhamento — PID','Use quando houver lacuna de competência, reprovação, ineficácia ou necessidade identificada na integração.'],
    carreira:['Acompanhamento — Carreira','Área de desenvolvimento de médio e longo prazo; não é necessária para iniciar o fluxo de treinamentos.']
  };
  const m=messages[active];if(!m)return;
  const el=document.createElement('div');el.className='tr83-context';el.dataset.tr83Context='1';el.innerHTML=`<strong>${esc(m[0])}</strong><small>${esc(m[1])}</small>`;
  nav.insertAdjacentElement('afterend',el);
}

async function enhance(force=false){
  if(state.busy || !document.querySelector('.tr81')) return;
  state.busy=true;
  try{
    injectStyle();arrangeTabs();renderContext();
    const d=await progress(force);if(d)renderGuide(d);
  }catch(e){console.warn('Treinamentos fluxo guiado v83:',e)}finally{state.busy=false}
}

function schedule(force=false){clearTimeout(state.timer);state.timer=setTimeout(()=>enhance(force),100)}

new MutationObserver(()=>schedule(false)).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{
  const b=e.target.closest?.('button');if(!b||!b.closest('.tr81,.tr81-modal,.tr82-modal-bg'))return;
  const t=norm(text(b));
  if(/salvar|registrar|excluir|definir publico|avaliar eficacia|avaliar 30/.test(t)){state.cacheAt=0;setTimeout(()=>schedule(true),900)}
},true);

document.addEventListener('submit',e=>{if(e.target.closest?.('.tr81-modal,.tr82-modal-bg')){state.cacheAt=0;setTimeout(()=>schedule(true),1000)}},true);

onAuthStateChanged(auth,async user=>{try{await loadProfile(user);state.empresaId='';state.cache=null;state.cacheAt=0;schedule(true)}catch(e){console.warn('Treinamentos v83 perfil:',e)}});
window.addEventListener('load',()=>schedule(true));
console.info(`Excellence System® fluxo guiado de Treinamentos ${V} carregado.`);
