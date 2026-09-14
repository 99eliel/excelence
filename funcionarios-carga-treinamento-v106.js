import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, query, where, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const VERSION = '20260914-106';
const COMPANY_SESSION = 'excellence-employees-company';
let perfil = null;
let observerTimer = null;

const esc = (v = '') => String(v ?? '')
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#039;');
const norm = (v = '') => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const digits = (v = '') => String(v || '').replace(/\D/g,'');

function isAdmin() { return perfil?.tipo === 'admin' && perfil?.ativo === true; }
function empresaId() { try { return sessionStorage.getItem(COMPANY_SESSION) || ''; } catch (_) { return ''; } }

function dateBr(v='') {
  if (!v) return '-';
  const d = v?.toDate ? v.toDate() : new Date(String(v).length===10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('pt-BR');
}

function cpfMask(v='') {
  const d=digits(v).slice(0,11);
  return d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
}

function initials(name='') {
  const p=String(name||'').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0]||'')+(p.length>1?(p.at(-1)?.[0]||''):'')).toUpperCase() || '•';
}

function parseHours(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0,value);
  const raw = String(value ?? '').trim().toLowerCase().replace(',', '.');
  if (!raw) return 0;
  const colon = raw.match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (colon) return Math.max(0, Number(colon[1]) + Number(colon[2])/60);
  const hm = raw.match(/(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*(?:min|m))?/);
  if ((raw.includes('h') || raw.includes('min')) && hm) {
    return Math.max(0, Number(hm[1]||0) + Number(hm[2]||0)/60);
  }
  const n = Number(raw.replace(/[^0-9.-]/g,''));
  return Number.isFinite(n) ? Math.max(0,n) : 0;
}

function hoursLabel(value, decimals = 2) {
  const h = Math.max(0, Number(value || 0));
  if (Math.abs(h - Math.round(h)) < 0.00001) return `${Math.round(h)}h`;
  return `${h.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:decimals})}h`;
}

function toast(message,error=false) {
  document.querySelector('[data-training-hours-toast]')?.remove();
  const el=document.createElement('div');el.dataset.trainingHoursToast='1';el.textContent=message;
  el.style.cssText=`position:fixed;right:18px;bottom:18px;z-index:160000;max-width:470px;padding:12px 15px;border-radius:13px;color:#fff;font-weight:850;background:${error?'#9f2e2e':'#073F5A'};box-shadow:0 18px 42px rgba(5,36,55,.25)`;
  document.body.appendChild(el);setTimeout(()=>el.remove(),3800);
}

async function qCompany(name,id=empresaId()) {
  if(!id)return[];
  const snap=await getDocs(query(collection(db,name),where('empresaId','==',id)));
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}

async function employeeByCpf(cpf,id=empresaId()) {
  const wanted=digits(cpf);if(!wanted||!id)return null;
  const rows=await qCompany('empresa_funcionarios',id);
  return rows.find(x=>digits(x.cpf)===wanted)||null;
}

function workloadForRow(row,planMap) {
  const plan=planMap.get(row.treinamentoId)||{};
  return parseHours(row.cargaHoraria ?? plan.cargaHoraria ?? plan.carga ?? 0);
}

function trainingTotals(employee,matrix,plans) {
  const legacyId=employee.treinamentoColaboradorId||employee.id;
  const rows=matrix.filter(x=>x.colaboradorId===legacyId||x.colaboradorId===employee.id);
  const planMap=new Map(plans.map(x=>[x.id,x]));
  const performed=rows.filter(x=>norm(x.status)==='concluido'||!!x.ultimaRealizacaoData);
  const seen=new Set();
  const realized=performed.reduce((sum,row)=>{
    const key=row.treinamentoId||row.id;
    if(seen.has(key))return sum;
    seen.add(key);
    return sum+workloadForRow(row,planMap);
  },0);
  const planned=Math.max(0,Number(employee.horasTreinamentoPrevistas||0));
  const remaining=planned>0?Math.max(0,planned-realized):0;
  const excess=planned>0?Math.max(0,realized-planned):0;
  const progress=planned>0?(realized/planned)*100:null;
  return {rows,performed,planMap,planned,realized,remaining,excess,progress};
}

function injectStyles() {
  if(document.getElementById('training-hours-v106-style'))return;
  const s=document.createElement('style');s.id='training-hours-v106-style';
  s.textContent=`
    .emp-training-hours-help{display:block;color:#607788;font-size:11px;line-height:1.4;margin-top:5px}.emp-hours-highlight{border-color:#b9d6e0!important;background:#f8fcfd!important}.emp-hours-highlight strong{color:#073F5A!important}.emp-hours-progress{height:7px;border-radius:999px;background:#e7eff2;overflow:hidden;margin-top:7px}.emp-hours-progress i{display:block;height:100%;background:linear-gradient(90deg,#0B607F,#D6A842)}
  `;document.head.appendChild(s);
}

async function prefillHours(form) {
  if(form.dataset.trainingHoursPrefilled==='1')return;
  const cpf=form.elements?.cpf?.value||'';
  if(digits(cpf).length!==11)return;
  form.dataset.trainingHoursPrefilled='1';
  try{
    const emp=await employeeByCpf(cpf);
    const input=form.elements.horasTreinamentoPrevistas;
    if(emp&&input)input.value=Number(emp.horasTreinamentoPrevistas||0);
  }catch(e){console.warn('Carga de treinamento não carregada:',e)}
}

function enhanceForm(form) {
  if(!form||form.dataset.trainingHoursEnhanced==='1')return;
  form.dataset.trainingHoursEnhanced='1';
  const status=form.elements?.ativo?.closest('div');
  const field=document.createElement('div');
  field.className='emp-hours-highlight';
  field.innerHTML=`<label>Horas de treinamento previstas</label><input type="number" min="0" step="0.25" inputmode="decimal" name="horasTreinamentoPrevistas" value="0" placeholder="Ex.: 20"><small class="emp-training-hours-help">Meta total de horas de capacitação deste funcionário. Cada treinamento realizado abate automaticamente essa carga no relatório individual.</small>`;
  if(status?.parentElement)status.insertAdjacentElement('afterend',field);else form.querySelector('.full:last-of-type')?.insertAdjacentElement('beforebegin',field);
  setTimeout(()=>prefillHours(form),30);
  form.elements?.cpf?.addEventListener('blur',()=>{delete form.dataset.trainingHoursPrefilled;prefillHours(form)});

  form.addEventListener('submit',()=>{
    const id=empresaId(),cpf=digits(form.elements?.cpf?.value||''),hours=Math.max(0,Number(String(form.elements?.horasTreinamentoPrevistas?.value||0).replace(',','.'))||0);
    if(!id||cpf.length!==11)return;
    persistAfterCoreSave(id,cpf,hours).catch(e=>console.warn('Horas de treinamento não sincronizadas:',e));
  },true);
}

async function persistAfterCoreSave(id,cpf,hours) {
  for(let attempt=0;attempt<14;attempt++){
    if(attempt)await new Promise(r=>setTimeout(r,250));
    const emp=await employeeByCpf(cpf,id).catch(()=>null);
    if(!emp)continue;
    await updateDoc(doc(db,'empresa_funcionarios',emp.id),{
      horasTreinamentoPrevistas:hours,
      horasTreinamentoAtualizadasEm:serverTimestamp(),
      horasTreinamentoAtualizadasPor:auth.currentUser?.uid||''
    });
    return;
  }
  throw new Error('Funcionário não localizado após salvar.');
}

function modalCpf(modal) {
  let cpf='';
  modal.querySelectorAll('.emp-info').forEach(card=>{
    if(norm(card.querySelector('small')?.textContent)==='cpf')cpf=digits(card.querySelector('strong')?.textContent||'');
  });
  return cpf;
}

async function enhanceProfile(modal) {
  if(!modal||modal.dataset.trainingHoursProfile==='1')return;
  const heading=norm(modal.querySelector('.emp-modal-head h2')?.textContent||'');
  if(heading!=='ficha do funcionario')return;
  const cpf=modalCpf(modal);if(cpf.length!==11)return;
  modal.dataset.trainingHoursProfile='1';
  try{
    const employee=await employeeByCpf(cpf);if(!employee)return;
    const [matrix,plans]=await Promise.all([qCompany('empresa_matriz_competencias'),qCompany('empresa_treinamentos')]);
    const t=trainingTotals(employee,matrix,plans);
    const grid=modal.querySelector('.emp-profile-grid');if(!grid)return;
    const progress=t.progress==null?0:Math.min(100,t.progress);
    grid.insertAdjacentHTML('beforeend',`
      <div class="emp-info emp-hours-highlight"><small>Horas previstas</small><strong>${t.planned>0?hoursLabel(t.planned):'Não definida'}</strong></div>
      <div class="emp-info emp-hours-highlight"><small>Horas realizadas / abatidas</small><strong>${hoursLabel(t.realized)}</strong></div>
      <div class="emp-info emp-hours-highlight"><small>Saldo de treinamento</small><strong>${t.planned<=0?'Defina a meta':t.excess>0?`${hoursLabel(t.excess)} excedentes`:hoursLabel(t.remaining)}</strong>${t.planned>0?`<div class="emp-hours-progress"><i style="width:${progress.toFixed(2)}%"></i></div>`:''}</div>`);
  }catch(e){console.warn('Resumo de horas de treinamento indisponível:',e)}
}

async function reportPayload(modal) {
  if(!isAdmin())throw new Error('Somente o administrador pode gerar este relatório.');
  const id=empresaId(),cpf=modalCpf(modal);if(!id||cpf.length!==11)throw new Error('Funcionário ou empresa não identificados.');
  const employee=await employeeByCpf(cpf,id);if(!employee)throw new Error('Funcionário não encontrado.');
  const [empresaSnap,matrix,plans]=await Promise.all([getDoc(doc(db,'empresas',id)),qCompany('empresa_matriz_competencias',id),qCompany('empresa_treinamentos',id)]);
  const company=empresaSnap.exists()?{id:empresaSnap.id,...empresaSnap.data()}:{id,nome:'Empresa'};
  const totals=trainingTotals(employee,matrix,plans);
  return {company,employee,...totals};
}

function reportHTML(data) {
  const {company,employee,rows,performed,planMap,planned,realized,remaining,excess,progress}=data;
  const logo=new URL(window.EXCELLENCE_BRAND?.logo||'logo-mp-consultoria.svg',window.location.href).href;
  const generated=new Date().toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
  const completed=rows.filter(x=>norm(x.status)==='concluido').length;
  const effective=rows.filter(x=>norm(x.eficaciaStatus)==='eficaz').length;
  const trainingRows=performed.length?performed.map(row=>{
    const plan=planMap.get(row.treinamentoId)||{};
    const h=workloadForRow(row,planMap);
    return `<tr><td><strong>${esc(row.treinamentoNome||plan.titulo||'Treinamento')}</strong></td><td>${esc(dateBr(row.ultimaRealizacaoData))}</td><td>${esc(hoursLabel(h))}</td><td>${esc(plan.instrutor||'-')}</td><td>${esc(row.status||'Realizado')}</td><td>${esc(row.eficaciaStatus||'Pendente')}</td><td>${esc(row.eficaciaAvaliador||'-')}</td></tr>`;
  }).join(''):'<tr><td colspan="7" class="empty">Nenhum treinamento realizado registrado.</td></tr>';
  const p=progress==null?0:Math.min(100,progress);
  const balanceLabel=planned<=0?'Meta não definida':excess>0?'Horas excedentes':'Horas restantes';
  const balanceValue=planned<=0?'—':hoursLabel(excess>0?excess:remaining);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório individual - ${esc(employee.nome||'Funcionário')}</title><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#183847;margin:0;font-size:11px}.page{width:100%}.header{background:linear-gradient(135deg,#073F5A,#0b607f);color:#fff;border-radius:14px;padding:14px 16px;display:grid;grid-template-columns:62px 1fr auto;gap:13px;align-items:center}.logo{width:60px;height:60px;object-fit:contain;background:#fff;border-radius:12px;padding:4px}.brand small{display:block;font-size:9px;font-weight:700;letter-spacing:.1em;color:#d5e9ef}.brand h1{margin:3px 0;font-size:20px;color:#fff}.brand p{margin:0;color:#dcecf2}.meta{text-align:right;font-size:9px;color:#dcecf2}.meta strong{display:block;color:#fff;font-size:11px}
    .employee{margin-top:12px;border:1px solid #d7e5ea;border-radius:14px;padding:12px;display:grid;grid-template-columns:96px 1fr;gap:14px;align-items:center;background:#fbfdfe}.photo{width:92px;height:112px;border-radius:14px;overflow:hidden;background:#e9f2f5;display:grid;place-items:center;color:#073F5A;font-size:26px;font-weight:800}.photo img{width:100%;height:100%;object-fit:cover}.employee h2{margin:0 0 8px;color:#073F5A;font-size:18px}.info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.info{border:1px solid #e2eaee;border-radius:9px;padding:7px;background:#fff}.info span{display:block;font-size:8px;font-weight:700;text-transform:uppercase;color:#728791}.info strong{display:block;margin-top:3px;font-size:10px}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.kpi{border:1px solid #dce7eb;border-radius:10px;padding:8px 10px;background:#f8fbfc}.kpi span{display:block;text-transform:uppercase;font-size:8px;color:#68808b;font-weight:700}.kpi strong{display:block;color:#073F5A;font-size:18px;margin-top:2px}.kpi.gold{background:#fff8e8}.progress{height:7px;background:#e7eff2;border-radius:99px;overflow:hidden;margin-top:5px}.progress i{display:block;height:100%;background:linear-gradient(90deg,#0B607F,#D6A842)}
    .section{margin-top:11px}.section-title{display:flex;justify-content:space-between;border-bottom:2px solid #073F5A;padding-bottom:5px;margin-bottom:7px}.section-title h3{margin:0;color:#073F5A;font-size:13px}.section-title span{font-size:9px;color:#657d88}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border-bottom:1px solid #e2eaee;padding:6px 5px;text-align:left;vertical-align:top;word-wrap:break-word}th{background:#f0f6f8;color:#496570;text-transform:uppercase;font-size:7.5px}td{font-size:9px}.empty{text-align:center;color:#71858e;padding:16px}.notes{border:1px solid #e1eaee;border-radius:10px;padding:8px;background:#fbfdfe;white-space:pre-wrap}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:24px}.signatures div{border-top:1px solid #78909a;padding-top:5px;text-align:center;color:#536c77;font-size:9px}.footer{margin-top:14px;padding-top:6px;border-top:1px solid #dfe8ec;display:flex;justify-content:space-between;color:#71858e;font-size:8px}.actions{display:flex;justify-content:flex-end;gap:8px;margin-bottom:10px}.actions button{border:0;border-radius:10px;padding:9px 12px;font-weight:700;cursor:pointer}.primary{background:#073F5A;color:#fff}.soft{background:#edf5f8;color:#073F5A}@page{size:A4 portrait;margin:9mm}@media print{.actions{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.header,.employee,.kpi,.section,tr{break-inside:avoid}}
  </style></head><body><div class="page"><div class="actions"><button class="primary" onclick="window.print()">Imprimir / salvar PDF</button><button class="soft" onclick="window.close()">Fechar</button></div><header class="header"><img class="logo" src="${esc(logo)}"><div class="brand"><small>EXCELLENCE SYSTEM • MP CONSULTORIA</small><h1>Relatório Individual de Capacitação</h1><p>${esc(company.nome||'Empresa')}</p></div><div class="meta"><strong>Ficha do funcionário</strong>Gerado em ${esc(generated)}</div></header>
  <section class="employee"><div class="photo">${employee.fotoUrl?`<img src="${esc(employee.fotoUrl)}">`:esc(initials(employee.nome))}</div><div><h2>${esc(employee.nome||'Funcionário')}</h2><div class="info-grid"><div class="info"><span>CPF</span><strong>${esc(cpfMask(employee.cpf)||'-')}</strong></div><div class="info"><span>Nascimento</span><strong>${esc(dateBr(employee.dataNascimento))}</strong></div><div class="info"><span>Admissão</span><strong>${esc(dateBr(employee.admissao))}</strong></div><div class="info"><span>Cargo / Função</span><strong>${esc(employee.cargo||employee.funcao||'-')}</strong></div><div class="info"><span>Setor</span><strong>${esc(employee.setor||'-')}</strong></div><div class="info"><span>Situação</span><strong>${employee.ativo===false?'Inativo':'Ativo'}</strong></div></div></div></section>
  <section class="summary"><div class="kpi gold"><span>Horas previstas</span><strong>${planned>0?hoursLabel(planned):'Não definida'}</strong>${planned>0?`<div class="progress"><i style="width:${p.toFixed(2)}%"></i></div>`:''}</div><div class="kpi"><span>Horas realizadas / abatidas</span><strong>${hoursLabel(realized)}</strong></div><div class="kpi"><span>${balanceLabel}</span><strong>${balanceValue}</strong></div><div class="kpi"><span>Progresso da carga</span><strong>${progress==null?'—':`${progress.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`}</strong></div></section>
  <section class="summary"><div class="kpi"><span>Treinamentos vinculados</span><strong>${rows.length}</strong></div><div class="kpi"><span>Já realizados</span><strong>${performed.length}</strong></div><div class="kpi"><span>Concluídos</span><strong>${completed}</strong></div><div class="kpi"><span>Eficazes</span><strong>${effective}</strong></div></section>
  <section class="section"><div class="section-title"><h3>Treinamentos realizados</h3><span>A carga de cada treinamento abate a meta prevista.</span></div><table><thead><tr><th>Treinamento</th><th>Realização</th><th>Carga</th><th>Instrutor</th><th>Status</th><th>Eficácia</th><th>Avaliador</th></tr></thead><tbody>${trainingRows}</tbody></table></section>
  ${employee.observacoes?`<section class="section"><div class="section-title"><h3>Observações da ficha</h3></div><div class="notes">${esc(employee.observacoes)}</div></section>`:''}<div class="signatures"><div>Responsável por RH / Treinamentos</div><div>Responsável pela empresa</div></div><div class="footer"><span>Excellence System • MP Consultoria</span><span>${esc(generated)}</span></div></div><script>setTimeout(()=>window.print(),500)</script></body></html>`;
}

async function openEnhancedReport(modal,button) {
  const old=button.textContent;button.disabled=true;button.textContent='Gerando...';
  try{
    const data=await reportPayload(modal);
    const w=window.open('','_blank','width=1100,height=820');
    if(!w)throw new Error('O navegador bloqueou a janela do relatório. Libere pop-ups para o sistema.');
    try{w.opener=null}catch(_){}
    w.document.open();w.document.write(reportHTML(data));w.document.close();
  }catch(e){toast(e?.message||'Não foi possível gerar o relatório.',true)}finally{button.disabled=false;button.textContent=old}
}

function enhanceAll() {
  if(!isAdmin())return;
  injectStyles();
  document.querySelectorAll('form[data-emp-form]').forEach(enhanceForm);
  document.querySelectorAll('.emp-modal').forEach(modal=>enhanceProfile(modal));
}

function schedule(){clearTimeout(observerTimer);observerTimer=setTimeout(enhanceAll,80)}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',event=>{
  const btn=event.target.closest?.('[data-employee-report-button]');
  if(!btn||!isAdmin())return;
  const modal=btn.closest('.emp-modal');if(!modal)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  openEnhancedReport(modal,btn);
},true);

onAuthStateChanged(auth,async user=>{
  perfil=null;if(!user)return;
  try{const snap=await getDoc(doc(db,'usuarios',user.uid));perfil=snap.exists()?{id:snap.id,...snap.data()}:null;schedule()}catch(e){console.warn('Carga de treinamento do funcionário indisponível:',e)}
});
window.addEventListener('load',schedule);
console.info(`Excellence System • carga de treinamento por funcionário ${VERSION} carregada.`);
