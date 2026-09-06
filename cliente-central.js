import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const VERSION = '20260906-97';

const state = {
  perfil: null,
  empresa: null,
  centralAtiva: false,
  carregando: false,
  observerStarted: false,
  renderTimer: null
};

const AREAS = {
  estrutura_iso: 'Estrutura ISO',
  ecossistema: 'Ecossistema',
  arquivos_recebidos: 'Arquivos',
  diario_bordo: 'Diário de bordo',
  apontamento: 'Apontamento',
  treinamentos: 'Treinamentos'
};

const PERFIL_LABELS = {
  responsavel: 'Responsável da empresa',
  qualidade_rh: 'Qualidade / RH',
  producao: 'Produção',
  consulta: 'Consulta',
  personalizado: 'Acesso personalizado'
};

function esc(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function norm(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function text(el) {
  return String(el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function isCliente() {
  return state.perfil?.tipo === 'cliente' && state.perfil?.ativo === true && !!state.perfil?.empresaId;
}

function permitido(area) {
  if (!isCliente()) return false;
  if (!Array.isArray(state.perfil.permissoes)) return true;
  return state.perfil.permissoes.includes(area);
}

function mainEl() {
  return document.querySelector('.main');
}

function sidebarNav() {
  return document.querySelector('#sidebar .nav-group,.sidebar .nav-group,#sidebar nav,.sidebar nav,#sidebar,.sidebar');
}

function navButtons() {
  return Array.from(document.querySelectorAll('#sidebar .nav-btn,.sidebar .nav-btn'));
}

function navByTerms(...terms) {
  const wanted = terms.map(norm);
  return navButtons().find(btn => {
    const t = norm(text(btn));
    return wanted.some(term => t.includes(term));
  });
}

function toast(message, error = false) {
  document.querySelector('[data-client-central-toast]')?.remove();
  const el = document.createElement('div');
  el.dataset.clientCentralToast = '1';
  el.textContent = message;
  el.style.cssText = `position:fixed;right:18px;bottom:18px;z-index:130000;max-width:420px;padding:12px 15px;border-radius:13px;color:#fff;font-weight:850;box-shadow:0 18px 42px rgba(5,36,55,.25);background:${error ? '#9f2e2e' : '#073F5A'}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function injectStyle() {
  if (document.getElementById('cliente-central-style')) return;
  const style = document.createElement('style');
  style.id = 'cliente-central-style';
  style.textContent = `
    .cc-root{max-width:1500px;margin:0 auto;padding:24px;color:#173846}
    .cc-hero{position:relative;overflow:hidden;background:linear-gradient(135deg,#073F5A 0%,#0B607F 58%,#0A7898 100%);border-radius:24px;padding:26px;color:#fff;box-shadow:0 20px 50px rgba(7,63,90,.16)}
    .cc-hero:after{content:'';position:absolute;width:280px;height:280px;border-radius:50%;right:-90px;top:-130px;background:rgba(255,255,255,.08)}
    .cc-hero-top{position:relative;z-index:1;display:flex;justify-content:space-between;gap:20px;align-items:flex-start}
    .cc-hero small{display:block;color:#c9e3ec;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.07em}
    .cc-hero h1{margin:5px 0 7px;color:#fff;font-size:31px;line-height:1.08}.cc-hero p{margin:0;color:#e1eef3;max-width:800px}
    .cc-profile{position:relative;z-index:1;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.20);border-radius:15px;padding:11px 13px;min-width:205px}.cc-profile strong{display:block;color:#fff}.cc-profile span{display:block;color:#d8eaf0;font-size:12px;margin-top:3px}
    .cc-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:18px;position:relative;z-index:1}.cc-summary-card{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);border-radius:15px;padding:12px 14px}.cc-summary-card small{color:#d2e8ef}.cc-summary-card strong{display:block;color:#fff;font-size:27px;margin-top:2px}.cc-summary-card.wait strong{color:#f5c65b}.cc-summary-card.done strong{color:#8de0a6}
    .cc-section{background:#fff;border:1px solid #d9e6eb;border-radius:20px;padding:18px;margin-top:16px;box-shadow:0 10px 28px rgba(7,63,90,.05)}
    .cc-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:13px}.cc-section-head h2{margin:0;color:#073F5A;font-size:21px}.cc-section-head p{margin:4px 0 0;color:#607788;font-size:13px}
    .cc-pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;background:#eef5f7;color:#073F5A;font-size:11px;font-weight:900}.cc-pill.warn{background:#fff2ce;color:#83610c}.cc-pill.ok{background:#e5f6e9;color:#206b38}.cc-pill.info{background:#e6f3f8;color:#145b76}
    .cc-task-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}.cc-task-tab{border:1px solid #d4e3e8;background:#f8fbfc;border-radius:999px;padding:7px 11px;font-weight:850;color:#466572;cursor:pointer}.cc-task-tab.active{background:#073F5A;color:#fff;border-color:#073F5A}
    .cc-task-list{display:grid;gap:9px}.cc-task{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:11px;align-items:center;border:1px solid #dce8ed;border-radius:15px;padding:12px;background:#fbfdfe}.cc-task-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:#edf5f8;font-size:18px}.cc-task h3{margin:0;color:#123e50;font-size:15px}.cc-task p{margin:3px 0 0;color:#667f89;font-size:12px}.cc-action{border:0;border-radius:10px;padding:9px 11px;background:#073F5A;color:#fff;font-weight:850;cursor:pointer;white-space:nowrap}.cc-action.soft{background:#edf5f8;color:#073F5A}
    .cc-empty{border:1px dashed #c9dce4;border-radius:15px;padding:20px;text-align:center;background:#fbfdfe;color:#607788}.cc-empty strong{display:block;color:#073F5A;margin-bottom:4px}
    .cc-modules{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.cc-module{position:relative;border:1px solid #d9e6eb;border-radius:17px;padding:15px;background:#fff;cursor:pointer;text-align:left;transition:.15s ease}.cc-module:hover{transform:translateY(-1px);border-color:#8ab8c8;box-shadow:0 10px 25px rgba(7,63,90,.07)}.cc-module-icon{width:39px;height:39px;border-radius:12px;background:#edf5f8;color:#073F5A;display:grid;place-items:center;font-size:17px;margin-bottom:10px}.cc-module strong{display:block;color:#073F5A;font-size:15px}.cc-module span{display:block;color:#607788;font-size:12px;margin-top:4px;line-height:1.35}.cc-module em{position:absolute;right:12px;top:12px;font-style:normal;font-size:10px;color:#607788;background:#f2f6f8;padding:4px 7px;border-radius:999px}
    .cc-footnote{margin-top:12px;color:#6b818a;font-size:11px;text-align:right}
    @media(max-width:900px){.cc-summary,.cc-modules{grid-template-columns:1fr 1fr}.cc-hero-top{flex-direction:column}.cc-profile{width:100%;min-width:0}}
    @media(max-width:650px){.cc-root{padding:12px}.cc-summary,.cc-modules{grid-template-columns:1fr}.cc-task{grid-template-columns:40px minmax(0,1fr)}.cc-task .cc-action{grid-column:1/-1;width:100%}}
  `;
  document.head.appendChild(style);
}

async function qCompany(collectionName) {
  const empresaId = state.perfil?.empresaId || '';
  if (!empresaId) return [];
  const snap = await getDocs(query(collection(db, collectionName), where('empresaId', '==', empresaId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function isoTasks(respostas = []) {
  const byReq = new Map(respostas.map(r => [String(r.requisitoId || ''), r]));
  const r41 = byReq.get('4_1');
  const r42 = byReq.get('4_2');
  const pair = [r41, r42].filter(Boolean);
  const statuses = pair.map(r => norm(r.status));
  const needsAdjust = statuses.includes('ajustar');
  const waiting = pair.length === 2 && statuses.every(s => s === 'em_analise');
  const done = pair.length === 2 && statuses.every(s => ['concluido', 'aprovado'].includes(s));

  if (needsAdjust) {
    return [{ group:'todo', icon:'↻', title:'Ajustar diagnóstico inicial da ISO', detail:'A administração solicitou correções nas informações dos itens 4.1 / 4.2.', area:'estrutura_iso', action:'Abrir ISO' }];
  }
  if (done) {
    return [{ group:'done', icon:'✓', title:'Diagnóstico inicial da ISO concluído', detail:'As informações 4.1 / 4.2 já foram concluídas.', area:'estrutura_iso', action:'Consultar' }];
  }
  if (waiting || statuses.includes('em_analise')) {
    return [{ group:'waiting', icon:'◷', title:'Diagnóstico ISO aguardando análise', detail:'As informações enviadas estão com a administração.', area:'estrutura_iso', action:'Acompanhar' }];
  }
  return [{ group:'todo', icon:'✎', title:'Preencher diagnóstico inicial da ISO', detail:'Complete as informações dos requisitos 4.1 e 4.2 para enviar à análise.', area:'estrutura_iso', action:'Começar' }];
}

function ecosystemTasks(recursos = []) {
  const liberados = recursos.filter(r => r.clientePodeEditar === true);
  const pending = liberados.filter(r => norm(r.clienteStatus) !== 'enviado');
  const sent = liberados.filter(r => norm(r.clienteStatus) === 'enviado');
  const tasks = pending.slice(0, 5).map(r => ({
    group:'todo', icon:'↑', title:`Enviar: ${r.titulo || 'documento solicitado'}`,
    detail:r.clienteInstrucoes || 'Existe um item liberado pela administração aguardando envio da empresa.',
    area:'ecossistema', action:'Enviar arquivo'
  }));
  if (sent.length) tasks.push({ group:'done', icon:'✓', title:`${sent.length} envio(s) da empresa realizado(s)`, detail:'Os arquivos e links enviados ficam registrados no ecossistema.', area:'ecossistema', action:'Ver envios' });
  return tasks;
}

function trainingTasks(plans = [], matrix = []) {
  const applicable = matrix.filter(m => m.aplicavel !== false && norm(m.status) !== 'nao aplicavel');
  const tasks = [];
  for (const plan of plans) {
    const rows = applicable.filter(m => m.treinamentoId === plan.id);
    let stage = 'publico';
    if (plan.publicoDefinido === true && rows.length) {
      if (rows.some(r => norm(r.status) !== 'concluido')) stage = 'realizacao';
      else if (rows.some(r => norm(r.eficaciaStatus) !== 'eficaz')) stage = 'eficacia';
      else stage = 'concluido';
    }
    if (stage === 'concluido') {
      tasks.push({ group:'done', icon:'✓', title:`Treinamento concluído: ${plan.titulo || 'Treinamento'}`, detail:`${rows.length} pessoa(s) no público obrigatório.`, area:'treinamentos', action:'Ver relatório' });
    } else {
      const stageLabel = stage === 'publico' ? 'definir público' : stage === 'realizacao' ? 'registrar realização' : 'avaliar eficácia';
      tasks.push({ group:'todo', icon:'▤', title:plan.titulo || 'Treinamento em andamento', detail:`Próximo passo: ${stageLabel}.`, area:'treinamentos', action:'Continuar' });
    }
  }
  return tasks;
}

async function loadCentralData() {
  const result = { tasks:[], moduleMeta:{}, errors:[] };
  const jobs = [];

  if (permitido('estrutura_iso')) jobs.push(qCompany('respostas_iso').then(rows => { result.tasks.push(...isoTasks(rows)); result.moduleMeta.estrutura_iso = `${rows.length} resposta(s)`; }).catch(e => result.errors.push(e)));
  if (permitido('ecossistema')) jobs.push(qCompany('empresa_recursos').then(rows => { result.tasks.push(...ecosystemTasks(rows)); result.moduleMeta.ecossistema = `${rows.length} item(ns)`; }).catch(e => result.errors.push(e)));
  if (permitido('arquivos_recebidos')) jobs.push(qCompany('arquivos').then(rows => { result.moduleMeta.arquivos_recebidos = `${rows.filter(r => r.categoria === 'consultoria').length} recebido(s)`; }).catch(e => result.errors.push(e)));
  if (permitido('treinamentos')) jobs.push(Promise.all([qCompany('empresa_treinamentos'), qCompany('empresa_matriz_competencias')]).then(([plans,matrix]) => { result.tasks.push(...trainingTasks(plans,matrix)); result.moduleMeta.treinamentos = `${plans.length} treinamento(s)`; }).catch(e => result.errors.push(e)));

  await Promise.all(jobs);
  return result;
}

function moduleCards(meta = {}) {
  const defs = [
    ['estrutura_iso','ISO','☑','Responda e acompanhe requisitos e materiais da qualidade.'],
    ['ecossistema','Documentos','▣','Pastas, documentos e solicitações de envio da empresa.'],
    ['arquivos_recebidos','Arquivos recebidos','◆','Materiais enviados pela consultoria para sua empresa.'],
    ['diario_bordo','Diário de bordo','◷','Acompanhe horas contratadas, utilizadas e saldo disponível.'],
    ['apontamento','Produção','▦','Registre os apontamentos de produção autorizados para seu usuário.'],
    ['treinamentos','Treinamentos','▤','Acompanhe e gerencie treinamentos conforme sua permissão.']
  ];
  return defs.filter(([area]) => permitido(area)).map(([area,label,icon,desc]) => `
    <button class="cc-module" type="button" data-cc-area="${area}">
      ${meta[area] ? `<em>${esc(meta[area])}</em>` : ''}
      <span class="cc-module-icon">${icon}</span>
      <strong>${esc(label)}</strong>
      <span>${esc(desc)}</span>
    </button>
  `).join('');
}

function taskHTML(task) {
  const status = task.group === 'todo' ? '<span class="cc-pill warn">Preciso fazer</span>' : task.group === 'waiting' ? '<span class="cc-pill info">Aguardando</span>' : '<span class="cc-pill ok">Concluído</span>';
  return `<article class="cc-task" data-cc-task-group="${task.group}"><div class="cc-task-icon">${task.icon}</div><div><div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap"><h3>${esc(task.title)}</h3>${status}</div><p>${esc(task.detail)}</p></div><button class="cc-action ${task.group === 'done' ? 'soft' : ''}" type="button" data-cc-area="${task.area}">${esc(task.action)}</button></article>`;
}

function renderTaskFilter(root, group = 'todo') {
  root.querySelectorAll('[data-cc-task-group]').forEach(item => {
    item.style.display = item.dataset.ccTaskGroup === group ? '' : 'none';
  });
  root.querySelectorAll('[data-cc-task-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.ccTaskTab === group));
  const visible = Array.from(root.querySelectorAll('[data-cc-task-group]')).filter(el => el.dataset.ccTaskGroup === group);
  const empty = root.querySelector('[data-cc-task-empty]');
  if (empty) empty.style.display = visible.length ? 'none' : '';
}

async function renderCentral(force = false) {
  if (!isCliente() || !state.centralAtiva || state.carregando) return;
  const main = mainEl();
  if (!main) return scheduleRender(120);
  if (!force && main.querySelector('.cc-root')) return;

  state.carregando = true;
  injectStyle();
  main.innerHTML = `<section class="cc-root"><div class="cc-empty"><strong>Carregando sua central...</strong>Organizando as informações da empresa.</div></section>`;

  try {
    if (!state.empresa) {
      const snap = await getDoc(doc(db,'empresas',state.perfil.empresaId));
      state.empresa = snap.exists() ? { id:snap.id, ...snap.data() } : { id:state.perfil.empresaId, nome:'Empresa' };
    }
    const data = await loadCentralData();
    const todo = data.tasks.filter(t => t.group === 'todo');
    const waiting = data.tasks.filter(t => t.group === 'waiting');
    const done = data.tasks.filter(t => t.group === 'done');
    const perfilLabel = PERFIL_LABELS[state.perfil.perfilOperacional] || 'Acesso personalizado';
    const firstName = String(state.perfil.nome || auth.currentUser?.displayName || 'Usuário').trim().split(/\s+/)[0] || 'Usuário';

    main.innerHTML = `
      <section class="cc-root">
        <section class="cc-hero">
          <div class="cc-hero-top">
            <div><small>Central da empresa</small><h1>Olá, ${esc(firstName)}</h1><p>${esc(state.empresa?.nome || 'Empresa')} • Aqui você encontra primeiro o que precisa de atenção e depois acessa as demais áreas do sistema.</p></div>
            <div class="cc-profile"><strong>${esc(perfilLabel)}</strong><span>${Array.isArray(state.perfil.permissoes) ? `${state.perfil.permissoes.length} área(s) liberada(s)` : 'Acesso legado completo'}</span></div>
          </div>
          <div class="cc-summary"><div class="cc-summary-card wait"><small>Preciso fazer</small><strong>${todo.length}</strong></div><div class="cc-summary-card"><small>Aguardando</small><strong>${waiting.length}</strong></div><div class="cc-summary-card done"><small>Concluído</small><strong>${done.length}</strong></div></div>
        </section>

        <section class="cc-section">
          <div class="cc-section-head"><div><h2>O que precisa da sua atenção</h2><p>O sistema organiza as próximas ações sem esconder o histórico do que já foi enviado ou concluído.</p></div><button class="cc-action soft" type="button" data-cc-refresh>Atualizar</button></div>
          <div class="cc-task-tabs"><button class="cc-task-tab active" data-cc-task-tab="todo">Preciso fazer (${todo.length})</button><button class="cc-task-tab" data-cc-task-tab="waiting">Aguardando (${waiting.length})</button><button class="cc-task-tab" data-cc-task-tab="done">Concluído (${done.length})</button></div>
          <div class="cc-task-list">${data.tasks.map(taskHTML).join('')}<div class="cc-empty" data-cc-task-empty style="display:none"><strong>Nada nesta etapa</strong>Quando surgir alguma ação, ela aparecerá aqui.</div></div>
        </section>

        <section class="cc-section">
          <div class="cc-section-head"><div><h2>Áreas da empresa</h2><p>Acesse somente os módulos liberados para o seu usuário.</p></div><span class="cc-pill">${Object.values(AREAS).filter((_,i) => permitido(Object.keys(AREAS)[i])).length} módulo(s)</span></div>
          <div class="cc-modules">${moduleCards(data.moduleMeta) || '<div class="cc-empty"><strong>Nenhuma área liberada</strong>Peça à administração para revisar as permissões do seu usuário.</div>'}</div>
          ${data.errors.length ? '<div class="cc-footnote">Alguns indicadores não puderam ser carregados agora, mas os módulos continuam disponíveis.</div>' : ''}
        </section>
      </section>`;

    const root = main.querySelector('.cc-root');
    root.querySelectorAll('[data-cc-task-tab]').forEach(btn => btn.addEventListener('click', () => renderTaskFilter(root, btn.dataset.ccTaskTab)));
    root.querySelectorAll('[data-cc-area]').forEach(btn => btn.addEventListener('click', () => openArea(btn.dataset.ccArea)));
    root.querySelector('[data-cc-refresh]')?.addEventListener('click', () => renderCentral(true));
    renderTaskFilter(root, todo.length ? 'todo' : waiting.length ? 'waiting' : 'done');
    markHomeActive();
  } catch (error) {
    console.error('Central da empresa:', error);
    main.innerHTML = `<section class="cc-root"><div class="cc-empty"><strong>Não foi possível montar a central agora.</strong>Os módulos continuam disponíveis pelo menu lateral.<br><button class="cc-action" data-cc-retry style="margin-top:12px">Tentar novamente</button></div></section>`;
    main.querySelector('[data-cc-retry]')?.addEventListener('click', () => renderCentral(true));
  } finally {
    state.carregando = false;
  }
}

function markHomeActive() {
  navButtons().forEach(btn => btn.classList.toggle('active', btn.dataset.clientCentralNav === '1'));
}

function openArea(area) {
  state.centralAtiva = false;
  let btn = null;
  if (area === 'estrutura_iso') btn = navByTerms('estrutura iso');
  if (area === 'ecossistema') btn = navByTerms('ecossistema');
  if (area === 'arquivos_recebidos') btn = navByTerms('arquivos recebidos');
  if (area === 'diario_bordo') btn = navByTerms('diario de bordo','diário de bordo');
  if (area === 'apontamento') btn = navByTerms('apontamento');
  if (area === 'treinamentos') btn = navByTerms('treinamentos');
  if (btn) return btn.click();
  if (area === 'treinamentos') {
    window.dispatchEvent(new Event('excellence-open-trainings'));
    return;
  }
  toast('Essa área ainda não está disponível no menu para este usuário.', true);
}

function ensureHomeNav() {
  if (!isCliente()) return;
  const nav = sidebarNav();
  if (!nav || nav.querySelector('[data-client-central-nav]')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-btn';
  btn.dataset.clientCentralNav = '1';
  btn.innerHTML = '<span class="nav-icon">⌂</span><span>Início</span>';
  const iso = navByTerms('estrutura iso');
  if (iso?.parentElement === nav) nav.insertBefore(btn, iso);
  else nav.insertBefore(btn, nav.firstChild);
  btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    state.centralAtiva = true;
    renderCentral(true);
  });
}

function bindNavAwareness() {
  document.addEventListener('click', event => {
    const btn = event.target.closest?.('#sidebar .nav-btn,.sidebar .nav-btn');
    if (!btn || btn.dataset.clientCentralNav === '1') return;
    if (isCliente()) state.centralAtiva = false;
  }, true);
}

function scheduleRender(ms = 80) {
  clearTimeout(state.renderTimer);
  state.renderTimer = setTimeout(() => {
    ensureHomeNav();
    if (state.centralAtiva && !mainEl()?.querySelector('.cc-root')) renderCentral();
  }, ms);
}

function startObserver() {
  if (state.observerStarted) return;
  state.observerStarted = true;
  new MutationObserver(() => scheduleRender(90)).observe(document.body, { childList:true, subtree:true });
}

bindNavAwareness();
startObserver();

onAuthStateChanged(auth, async user => {
  state.perfil = null;
  state.empresa = null;
  state.centralAtiva = false;
  if (!user) return;
  try {
    const snap = await getDoc(doc(db,'usuarios',user.uid));
    state.perfil = snap.exists() ? { id:snap.id, ...snap.data() } : null;
    if (!isCliente()) return;
    state.centralAtiva = true;
    scheduleRender(260);
  } catch (error) {
    console.warn('Central da empresa indisponível:', error);
  }
});

window.addEventListener('load', () => scheduleRender(180));
console.info(`Excellence System • Central da Empresa ${VERSION} carregada.`);
