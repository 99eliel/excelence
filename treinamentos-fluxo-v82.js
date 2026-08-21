import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection, getDocs, getDoc, doc, addDoc, setDoc, updateDoc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const V = '20260821-82';
const SESSION_COMPANY = 'excellence-training-company-v82';
const state = { user:null, perfil:null, empresaId:'', timer:null, enhancing:false };

const text = el => String(el?.textContent || '').replace(/\s+/g,' ').trim();
const lower = el => text(el).toLowerCase();
const esc = (v='') => String(v ?? '')
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#039;');

function toast(message, type='ok') {
  document.querySelector('[data-tr82-toast]')?.remove();
  const el=document.createElement('div');
  el.dataset.tr82Toast='1';
  el.textContent=message;
  el.style.cssText=`position:fixed;right:18px;bottom:18px;z-index:100000;padding:12px 14px;border-radius:14px;font-weight:850;color:#fff;max-width:420px;box-shadow:0 18px 42px rgba(5,36,55,.25);background:${type==='err'?'#9f2e2e':'#073F5A'}`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),4200);
}

function injectStyle(){
  if(document.getElementById('tr82-style')) return;
  const s=document.createElement('style'); s.id='tr82-style';
  s.textContent=`
    .tr82-flow{margin:14px 0;background:linear-gradient(135deg,#f4fafc,#fff9e9);border:1px solid #d7e8ee;border-radius:16px;padding:14px 16px;color:#234653}
    .tr82-flow strong{color:#073F5A}.tr82-flow small{display:block;margin-top:4px;color:#607788}
    .tr82-action{border:0;border-radius:9px;padding:7px 10px;font-weight:800;cursor:pointer;background:#eef5f7;color:#073F5A;margin-right:6px}
    .tr82-action.gold{background:#f5d98b;color:#563f09}.tr82-action.ok{background:#e3f5e9;color:#1f6b37}.tr82-action.warn{background:#fff4d6;color:#87630b}
    .tr82-modal-bg{position:fixed;inset:0;background:rgba(3,26,38,.58);z-index:100001;display:flex;align-items:center;justify-content:center;padding:18px}
    .tr82-modal{width:min(820px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.28);color:#173846}
    .tr82-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.tr82-modal-head h2{margin:0;color:#073F5A}.tr82-modal-head p{margin:4px 0 0;color:#607788}
    .tr82-close{border:0;background:#eef5f7;color:#073F5A;border-radius:10px;padding:8px 11px;font-weight:800;cursor:pointer}
    .tr82-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;max-height:430px;overflow:auto;padding:2px}
    .tr82-person{display:flex;gap:9px;align-items:flex-start;border:1px solid #d9e6eb;border-radius:12px;padding:10px;background:#fff}.tr82-person input{margin-top:3px}
    .tr82-person strong{display:block}.tr82-person small{color:#607788}
    .tr82-tools{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.tr82-btn{border:0;border-radius:11px;padding:10px 13px;font-weight:850;cursor:pointer}.tr82-btn.primary{background:#073F5A;color:#fff}.tr82-btn.soft{background:#eef5f7;color:#073F5A}.tr82-btn.gold{background:#e9b64e;color:#173846}
    .tr82-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tr82-form .full{grid-column:1/-1}.tr82-form label{display:block;font-size:13px;font-weight:800;color:#466572;margin-bottom:5px}.tr82-form input,.tr82-form select,.tr82-form textarea{width:100%;border:1px solid #cfdfe5;border-radius:10px;padding:10px}.tr82-form textarea{min-height:88px;resize:vertical}
    .tr82-badge{display:inline-block;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:850}.tr82-badge.ok{background:#e3f5e9;color:#1f6b37}.tr82-badge.warn{background:#fff4d6;color:#87630b}.tr82-badge.bad{background:#fde8e8;color:#9b2222}
    @media(max-width:700px){.tr82-list,.tr82-form{grid-template-columns:1fr}.tr82-form .full{grid-column:auto}}
  `;
  document.head.appendChild(s);
}

function setEmpresaId(id){
  state.empresaId=String(id||'');
  try{ if(state.empresaId) sessionStorage.setItem(SESSION_COMPANY,state.empresaId); else sessionStorage.removeItem(SESSION_COMPANY); }catch(_){ }
}

function getEmpresaId(){
  if(state.perfil?.tipo!=='admin' && state.perfil?.empresaId) return state.perfil.empresaId;
  if(state.empresaId) return state.empresaId;
  try{ const id=sessionStorage.getItem(SESSION_COMPANY)||''; if(id){state.empresaId=id;return id} }catch(_){ }
  return '';
}

async function ensureEmpresaId(){
  let id=getEmpresaId(); if(id) return id;
  if(state.perfil?.tipo!=='admin') return '';
  const hero=document.querySelector('.tr81-hero p');
  const nome=text(hero).split('•')[0].trim();
  if(!nome) return '';
  try{
    const s=await getDocs(collection(db,'empresas'));
    const found=s.docs.find(d=>String(d.data()?.nome||'').trim()===nome);
    if(found){setEmpresaId(found.id);return found.id}
  }catch(e){console.warn('Treinamentos v82: não foi possível inferir empresa.',e)}
  return '';
}

async function qCompany(name){
  const empresaId=await ensureEmpresaId();
  if(!empresaId) throw new Error('Empresa do módulo de Treinamentos não identificada.');
  const s=await getDocs(query(collection(db,name),where('empresaId','==',empresaId)));
  return s.docs.map(d=>({id:d.id,...d.data()}));
}

function dateBr(v){
  if(!v) return '-';
  if(v?.toDate) return v.toDate().toLocaleDateString('pt-BR');
  const d=new Date(String(v).length===10?`${v}T12:00:00`:v);
  return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('pt-BR');
}

function modal(title,subtitle,body){
  document.querySelector('.tr82-modal-bg')?.remove();
  const bg=document.createElement('div'); bg.className='tr82-modal-bg';
  bg.innerHTML=`<div class="tr82-modal"><div class="tr82-modal-head"><div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><button class="tr82-close" type="button" data-tr82-close>Fechar</button></div>${body}</div>`;
  document.body.appendChild(bg);
  bg.addEventListener('click',e=>{if(e.target===bg||e.target.closest('[data-tr82-close]'))bg.remove()});
  return bg;
}

async function saveMatrixItem(existing,data){
  if(existing?.id) await updateDoc(doc(db,'empresa_matriz_competencias',existing.id),{...data,atualizadoEm:serverTimestamp(),atualizadoPor:state.user?.uid||''});
  else await addDoc(collection(db,'empresa_matriz_competencias'),{...data,criadoEm:serverTimestamp(),criadoPor:state.user?.uid||'',atualizadoEm:serverTimestamp()});
}

async function openAudience(planId,planName){
  try{
    const [cols,matrix,planSnap]=await Promise.all([
      qCompany('empresa_colaboradores'),qCompany('empresa_matriz_competencias'),getDoc(doc(db,'empresa_treinamentos',planId))
    ]);
    if(!planSnap.exists()) return toast('Treinamento não encontrado.','err');
    const existing=matrix.filter(x=>x.treinamentoId===planId);
    const map=new Map(existing.map(x=>[x.colaboradorId,x]));
    const selected=new Set(existing.filter(x=>String(x.status||'').toLowerCase()!=='não aplicável'&&String(x.status||'').toLowerCase()!=='nao aplicavel').map(x=>x.colaboradorId));
    const bg=modal('Definir público do treinamento',planName,'');
    const box=bg.querySelector('.tr82-modal');
    box.insertAdjacentHTML('beforeend',`
      <div class="tr82-tools"><button class="tr82-btn soft" type="button" data-all>Selecionar todos</button><button class="tr82-btn soft" type="button" data-none>Limpar seleção</button><span class="tr82-badge warn" data-count>${selected.size} selecionado(s)</span></div>
      <div class="tr82-list">${cols.map(c=>`<label class="tr82-person"><input type="checkbox" data-person value="${esc(c.id)}" ${selected.has(c.id)?'checked':''}><span><strong>${esc(c.nome||'Colaborador')}</strong><small>${esc([c.funcao,c.setor].filter(Boolean).join(' • ')||'Sem função/setor')}</small></span></label>`).join('')||'<div>Nenhum colaborador cadastrado.</div>'}</div>
      <div class="tr82-tools" style="justify-content:flex-end;margin-top:14px"><button class="tr82-btn primary" type="button" data-save>Salvar público e gerar matriz</button></div>`);
    const checks=[...box.querySelectorAll('[data-person]')];
    const updateCount=()=>box.querySelector('[data-count]').textContent=`${checks.filter(c=>c.checked).length} selecionado(s)`;
    checks.forEach(c=>c.addEventListener('change',updateCount));
    box.querySelector('[data-all]')?.addEventListener('click',()=>{checks.forEach(c=>c.checked=true);updateCount()});
    box.querySelector('[data-none]')?.addEventListener('click',()=>{checks.forEach(c=>c.checked=false);updateCount()});
    box.querySelector('[data-save]')?.addEventListener('click',async()=>{
      const ids=new Set(checks.filter(c=>c.checked).map(c=>c.value));
      if(!ids.size && !confirm('Nenhum colaborador foi selecionado. Deseja deixar este treinamento sem público obrigatório?')) return;
      const empresaId=await ensureEmpresaId();
      for(const c of cols){
        const old=map.get(c.id);
        const applicable=ids.has(c.id);
        const status=applicable ? (String(old?.status||'').toLowerCase()==='concluído'?'Concluído':'Pendente') : 'Não aplicável';
        await saveMatrixItem(old,{
          empresaId,colaboradorId:c.id,colaboradorNome:c.nome||'',treinamentoId:planId,treinamentoNome:planName,
          status,aplicavel:applicable,publicoDefinido:true,
          ...(old?.status&&old.status!==status?{statusAnterior:old.status}:{}),
          eficaciaStatus:applicable?(old?.eficaciaStatus||'Pendente'):'Não aplicável'
        });
      }
      await updateDoc(doc(db,'empresa_treinamentos',planId),{
        publicoDefinido:true,publicoTotal:ids.size,publicoAtualizadoEm:serverTimestamp(),publicoAtualizadoPor:state.user?.uid||''
      });
      bg.remove();toast(`Público definido: ${ids.size} colaborador(es). A matriz foi atualizada.`);
    });
  }catch(e){console.error(e);toast(e.message||'Não foi possível definir o público.','err')}
}

async function ensureAutoPid({colaboradorId,colaboradorNome,treinamentoId='',treinamentoNome='',origemTipo,origemId,motivo}){
  const empresaId=await ensureEmpresaId();
  const pids=await qCompany('empresa_pids');
  const dup=pids.find(p=>p.autoGerado===true&&p.colaboradorId===colaboradorId&&p.origemTipo===origemTipo&&p.origemId===origemId&& !['concluído','concluido','fechado'].includes(String(p.status||'').toLowerCase()));
  if(dup) return dup.id;
  const d=await addDoc(collection(db,'empresa_pids'),{
    empresaId,colaboradorId,colaboradorNome,treinamentoId,treinamentoNome,
    origem:`${origemTipo==='treinamento'?'Treinamento':'Integração'}${treinamentoNome?`: ${treinamentoNome}`:''} — ${motivo}`,
    origemTipo,origemId,autoGerado:true,status:'Em andamento',prazo:'',
    objetivo:treinamentoNome?`Desenvolver a competência relacionada ao treinamento ${treinamentoNome}.`:'Tratar a necessidade identificada na avaliação de integração.',
    competencias:motivo,acoes:treinamentoNome?`Reforçar conteúdo, acompanhar aplicação prática e reavaliar a eficácia do treinamento ${treinamentoNome}.`:'Definir ações de desenvolvimento com o gestor e reavaliar a evolução do colaborador.',
    criadoEm:serverTimestamp(),criadoPor:state.user?.uid||'',origemAutomatica:true
  });
  return d.id;
}

async function recalcPlan(planId,realizacaoData=''){
  const planSnap=await getDoc(doc(db,'empresa_treinamentos',planId));
  if(!planSnap.exists()) return;
  const plan=planSnap.data();
  const matrix=(await qCompany('empresa_matriz_competencias')).filter(x=>x.treinamentoId===planId);
  let status='Em andamento';
  if(plan.publicoDefinido){
    const applicable=matrix.filter(x=>x.aplicavel!==false && !['não aplicável','nao aplicavel'].includes(String(x.status||'').toLowerCase()));
    const total=Number(plan.publicoTotal??applicable.length);
    const allDone=total>0 && applicable.length>=total && applicable.every(x=>String(x.status||'').toLowerCase()==='concluído');
    const allEffective=allDone && applicable.every(x=>String(x.eficaciaStatus||'').toLowerCase()==='eficaz');
    status=allEffective?'Concluído':'Em andamento';
  }
  await updateDoc(doc(db,'empresa_treinamentos',planId),{
    status,ultimaRealizacaoData:realizacaoData||plan.ultimaRealizacaoData||'',ultimaRealizacaoEm:serverTimestamp(),atualizadoEm:serverTimestamp()
  });
}

async function applyTrainingResult({planId,planName,data,result,participantIds,participantNames}){
  if(!planId||!participantIds.length) return;
  const empresaId=await ensureEmpresaId();
  const matrix=await qCompany('empresa_matriz_competencias');
  const map=new Map(matrix.filter(x=>x.treinamentoId===planId).map(x=>[x.colaboradorId,x]));
  const failed=String(result||'').toLowerCase()==='reprovado';
  for(let i=0;i<participantIds.length;i++){
    const cid=participantIds[i], cname=participantNames[i]||'';
    const old=map.get(cid);
    await saveMatrixItem(old,{
      empresaId,colaboradorId:cid,colaboradorNome:cname,treinamentoId:planId,treinamentoNome:planName,
      status:failed?'Pendente':'Concluído',aplicavel:true,ultimoResultado:result||'Realizado',ultimaRealizacaoData:data||'',
      eficaciaStatus:failed?'Ineficaz':'Pendente',eficaciaObservacao:failed?'Resultado reprovado no treinamento.':''
    });
    if(failed){
      await ensureAutoPid({colaboradorId:cid,colaboradorNome:cname,treinamentoId:planId,treinamentoNome:planName,origemTipo:'treinamento',origemId:`${planId}__${data||'sem-data'}__${cid}`,motivo:'Resultado reprovado no treinamento'});
    }
  }
  await recalcPlan(planId,data);
  toast(failed?'Matriz atualizada e PID aberto automaticamente para resultado reprovado.':'Matriz atualizada. A eficácia ficou pendente de avaliação.');
}

async function waitFormSuccess(form){
  for(let i=0;i<16;i++){
    await new Promise(r=>setTimeout(r,250));
    if(!form.isConnected) return true;
  }
  return false;
}

function captureEventSubmit(form){
  if(form.dataset.tr82Captured==='1') return;
  form.dataset.tr82Captured='1';
  const sel=form.elements.treinamentoId;
  const planId=sel?.value||'';
  const planName=sel?.selectedOptions?.[0]?.dataset?.name||sel?.selectedOptions?.[0]?.textContent||'Treinamento';
  const data=form.elements.data?.value||'';
  const result=form.elements.resultado?.value||'Realizado';
  const participants=[...(form.elements.participantes?.selectedOptions||[])];
  const payload={planId,planName,data,result,participantIds:participants.map(o=>o.value),participantNames:participants.map(o=>o.textContent||'')};
  (async()=>{
    const ok=await waitFormSuccess(form);
    if(ok) try{await applyTrainingResult(payload)}catch(e){console.error(e);toast('Realização salva, mas a automação da matriz falhou.','err')}
  })();
}

async function openEfficacy(eventId){
  try{
    const snap=await getDoc(doc(db,'empresa_treinamento_eventos',eventId));
    if(!snap.exists()) return toast('Realização não encontrada.','err');
    const ev={id:snap.id,...snap.data()};
    const current=ev.eficaciaStatus||'Pendente';
    const bg=modal('Avaliar eficácia',ev.treinamentoNome||'Treinamento',`<form class="tr82-form" data-eff-form>
      <div><label>Resultado da eficácia *</label><select name="status" required><option value="Pendente" ${current==='Pendente'?'selected':''}>Pendente</option><option value="Eficaz" ${current==='Eficaz'?'selected':''}>Eficaz</option><option value="Ineficaz" ${current==='Ineficaz'?'selected':''}>Ineficaz</option></select></div>
      <div><label>Data da avaliação</label><input type="date" name="data" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="full"><label>Observação / evidência da eficácia</label><textarea name="obs" placeholder="Ex.: aplicou corretamente no posto, ainda apresentou dificuldade..."></textarea></div>
      <div class="full"><button class="tr82-btn primary" type="submit">Salvar avaliação</button></div>
    </form>`);
    bg.querySelector('[data-eff-form]').addEventListener('submit',async e=>{
      e.preventDefault();const f=new FormData(e.currentTarget);const status=f.get('status');const obs=f.get('obs')||'';const data=f.get('data')||'';
      await updateDoc(doc(db,'empresa_treinamento_eventos',eventId),{eficaciaStatus:status,eficaciaObservacao:obs,eficaciaData:data,eficaciaAvaliadaEm:serverTimestamp(),eficaciaAvaliadaPor:state.user?.uid||''});
      const matrix=await qCompany('empresa_matriz_competencias');
      const map=new Map(matrix.filter(x=>x.treinamentoId===ev.treinamentoId).map(x=>[x.colaboradorId,x]));
      const ineffective=status==='Ineficaz';
      for(let i=0;i<(ev.participanteIds||[]).length;i++){
        const cid=ev.participanteIds[i], cname=(ev.participanteNomes||[])[i]||'';const old=map.get(cid);
        await saveMatrixItem(old,{
          empresaId:await ensureEmpresaId(),colaboradorId:cid,colaboradorNome:cname,treinamentoId:ev.treinamentoId,treinamentoNome:ev.treinamentoNome||'Treinamento',
          status:ineffective?'Pendente':'Concluído',aplicavel:true,ultimoResultado:ev.resultado||'Realizado',ultimaRealizacaoData:ev.data||'',
          eficaciaStatus:status,eficaciaObservacao:obs,eficaciaData:data
        });
        if(ineffective){
          await ensureAutoPid({colaboradorId:cid,colaboradorNome:cname,treinamentoId:ev.treinamentoId,treinamentoNome:ev.treinamentoNome||'',origemTipo:'treinamento',origemId:eventId,motivo:'Treinamento avaliado como ineficaz'});
        }
      }
      await recalcPlan(ev.treinamentoId,ev.data||'');
      bg.remove();toast(ineffective?'Eficácia marcada como ineficaz. Matriz reaberta e PID gerado.':'Eficácia registrada e matriz atualizada.');
      window.__EXCELLENCE_TRAINING_OPEN?.();
    });
  }catch(e){console.error(e);toast(e.message||'Não foi possível avaliar a eficácia.','err')}
}

async function openIntegrationEvaluation(id){
  try{
    const snap=await getDoc(doc(db,'empresa_integracoes',id));
    if(!snap.exists()) return toast('Integração não encontrada.','err');
    const it={id:snap.id,...snap.data()};
    const bg=modal('Avaliação de 30 dias',it.colaboradorNome||'Colaborador',`<form class="tr82-form" data-int-eval>
      <div><label>Resultado *</label><select name="status" required><option value="Aprovado">Aprovado / integrado</option><option value="Necessita desenvolvimento">Necessita desenvolvimento</option></select></div>
      <div><label>Data da avaliação</label><input type="date" name="data" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="full"><label>Resultado / observações</label><textarea name="obs" required placeholder="Registre o resultado observado após os 30 dias.">${esc(it.resultado30||'')}</textarea></div>
      <div class="full"><button class="tr82-btn primary" type="submit">Salvar avaliação</button></div>
    </form>`);
    bg.querySelector('[data-int-eval]').addEventListener('submit',async e=>{
      e.preventDefault();const f=new FormData(e.currentTarget);const st=f.get('status');const obs=f.get('obs')||'';const dt=f.get('data')||'';const needs=st==='Necessita desenvolvimento';
      await updateDoc(doc(db,'empresa_integracoes',id),{avaliacao30Status:st,resultado30:obs,avaliacao30RealizadaData:dt,avaliacao30RealizadaEm:serverTimestamp(),status:needs?'Em andamento':'Concluído',atualizadoEm:serverTimestamp()});
      if(needs){
        await ensureAutoPid({colaboradorId:it.colaboradorId,colaboradorNome:it.colaboradorNome||'',origemTipo:'integracao',origemId:id,motivo:'Avaliação de 30 dias identificou necessidade de desenvolvimento'});
      }
      bg.remove();toast(needs?'Avaliação registrada e PID aberto automaticamente.':'Integração concluída após avaliação de 30 dias.');window.__EXCELLENCE_TRAINING_OPEN?.();
    });
  }catch(e){console.error(e);toast(e.message||'Não foi possível avaliar a integração.','err')}
}

function enhanceOverview(){
  const content=document.querySelector('[data-tr81-content]');
  if(!content||content.querySelector('[data-tr82-flow]')) return;
  const h2=[...content.querySelectorAll('h2')].find(h=>lower(h).includes('fluxo do módulo'));
  if(!h2) return;
  const el=document.createElement('div');el.className='tr82-flow';el.dataset.tr82Flow='1';
  el.innerHTML='<strong>Fluxo automático ativo</strong><small>Defina o público → a matriz gera as pendências → a realização atualiza cada participante → a eficácia conclui a competência → reprovação ou ineficácia abre PID automaticamente.</small>';
  content.prepend(el);
}

function enhancePlan(){
  const h2=[...document.querySelectorAll('[data-tr81-content] h2')].find(h=>lower(h).includes('plano anual'));
  if(!h2) return;
  const section=h2.closest('.tr81-section'); if(!section||section.dataset.tr82Plan==='1') return; section.dataset.tr82Plan='1';
  const table=section.querySelector('table'); if(!table) return;
  const head=table.querySelector('thead tr'); if(head) head.insertAdjacentHTML('beforeend','<th>Público / matriz</th>');
  table.querySelectorAll('tbody tr').forEach(row=>{
    const del=row.querySelector('[data-del-plan]'); if(!del) return;
    const planId=del.dataset.delPlan; const planName=text(row.querySelector('td'))||'Treinamento';
    const td=document.createElement('td'); td.innerHTML='<button class="tr82-action gold" type="button" data-tr82-audience>Definir público</button>';
    td.querySelector('button').addEventListener('click',()=>openAudience(planId,planName)); row.appendChild(td);
  });
}

async function enhanceEvents(){
  const h2=[...document.querySelectorAll('[data-tr81-content] h2')].find(h=>lower(h).includes('realizações de treinamentos'));
  if(!h2) return;
  const section=h2.closest('.tr81-section'); if(!section||section.dataset.tr82Events==='loading'||section.dataset.tr82Events==='1') return; section.dataset.tr82Events='loading';
  try{
    const events=(await qCompany('empresa_treinamento_eventos')).sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
    const table=section.querySelector('table'); if(!table) return;
    table.querySelector('thead tr')?.insertAdjacentHTML('beforeend','<th>Eficácia</th>');
    const used=new Set();
    [...table.querySelectorAll('tbody tr')].forEach(row=>{
      if(row.children.length<2||row.textContent.includes('Nenhuma realização')) return;
      const nome=text(row.children[0]);const data=text(row.children[1]);const parts=text(row.children[2]);
      let idx=events.findIndex((e,i)=>!used.has(i)&&text({textContent:e.treinamentoNome||'Treinamento'})===nome&&dateBr(e.data)===data&&String((e.participanteNomes||[]).join(', '))===parts);
      if(idx<0) idx=events.findIndex((e,i)=>!used.has(i)&&String(e.treinamentoNome||'Treinamento')===nome&&dateBr(e.data)===data);
      if(idx<0) return;
      used.add(idx);const ev=events[idx];const status=ev.eficaciaStatus||'Pendente';const cls=status==='Eficaz'?'ok':status==='Ineficaz'?'bad':'warn';
      const td=document.createElement('td');td.innerHTML=`<span class="tr82-badge ${cls}">${esc(status)}</span><br><button class="tr82-action" type="button" data-tr82-eff> ${status==='Pendente'?'Avaliar eficácia':'Reavaliar'} </button>`;
      td.querySelector('button').addEventListener('click',()=>openEfficacy(ev.id));row.appendChild(td);
    });
    section.dataset.tr82Events='1';
  }catch(e){section.dataset.tr82Events='';console.warn('Treinamentos v82 eventos:',e)}
}

function enhanceIntegrations(){
  const h2=[...document.querySelectorAll('[data-tr81-content] h2')].find(h=>lower(h)==='integração');
  if(!h2) return;
  const section=h2.closest('.tr81-section'); if(!section||section.dataset.tr82Int==='1') return;section.dataset.tr82Int='1';
  const head=section.querySelector('thead tr'); if(head&&!text(head).includes('Avaliação 30 dias')) head.insertAdjacentHTML('beforeend','<th>Avaliação 30 dias</th>');
  section.querySelectorAll('tbody tr').forEach(row=>{
    const del=row.querySelector('[data-del-simple]');if(!del) return;
    const td=document.createElement('td');td.innerHTML='<button class="tr82-action" type="button">Avaliar 30 dias</button>';td.querySelector('button').addEventListener('click',()=>openIntegrationEvaluation(del.dataset.delSimple));row.appendChild(td);
  });
}

async function enhance(){
  if(state.enhancing) return; state.enhancing=true;
  try{injectStyle();enhanceOverview();enhancePlan();enhanceIntegrations();await enhanceEvents()}finally{state.enhancing=false}
}
function schedule(){clearTimeout(state.timer);state.timer=setTimeout(enhance,80)}

document.addEventListener('click',e=>{
  const card=e.target.closest?.('[data-tr81-company]'); if(card) setEmpresaId(card.dataset.tr81Company||'');
  if(e.target.closest?.('[data-tr81-back]')) setEmpresaId('');
},true);

document.addEventListener('submit',e=>{
  const form=e.target.closest?.('[data-event-form]'); if(form) captureEventSubmit(form);
},true);

onAuthStateChanged(auth,async user=>{
  state.user=user||null;state.perfil=null;
  if(!user){setEmpresaId('');return}
  try{const s=await getDoc(doc(db,'usuarios',user.uid));state.perfil=s.exists()?{id:s.id,...s.data()}:null;if(state.perfil?.tipo!=='admin'&&state.perfil?.empresaId)setEmpresaId(state.perfil.empresaId)}catch(e){console.warn('Treinamentos v82 perfil:',e)}
  schedule();
});

new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
window.addEventListener('load',schedule);
console.info(`Excellence System® fluxo integrado de Treinamentos ${V} carregado.`);
