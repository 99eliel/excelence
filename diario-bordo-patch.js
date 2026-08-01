import { auth, db } from './firebase-config.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const DIARIO_VERSION = '20260801-45';
const PERFIL_CACHE = { value: null, uid: '' };

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toastDiario(message, type = 'success') {
  const existing = document.querySelector('.toast-diario');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = `notice ${type} toast-diario`;
  el.style.position = 'fixed';
  el.style.right = '18px';
  el.style.bottom = '18px';
  el.style.zIndex = '2500';
  el.style.maxWidth = '440px';
  el.innerHTML = escapeHTML(message);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4300);
}

function parseNumber(value) {
  const n = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function minutesFromTime(value) {
  if (!value) return null;
  const [h, m] = String(value).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesBetween(start, end) {
  const a = minutesFromTime(start);
  const b = minutesFromTime(end);
  if (a === null || b === null) return 0;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function calculateActivityMinutes(inicio, fim, almocoInicio = '', almocoFim = '') {
  const bruto = minutesBetween(inicio, fim);
  const almoco = almocoInicio && almocoFim ? minutesBetween(almocoInicio, almocoFim) : 0;
  return {
    bruto,
    almoco,
    descontado: Math.max(bruto - almoco, 0)
  };
}

function minutesToHourLabel(minutes = 0) {
  const safe = Math.max(Math.round(Number(minutes || 0)), 0);
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function decimalHours(minutes = 0) {
  return Math.round((Number(minutes || 0) / 60) * 100) / 100;
}

function formatDateBR(dateISO = '') {
  if (!dateISO) return '-';
  const [year, month, day] = String(dateISO).split('-');
  if (!year || !month || !day) return dateISO;
  return `${day}/${month}/${year}`;
}

async function getPerfilAtual() {
  const user = auth.currentUser;
  if (!user) return null;
  if (PERFIL_CACHE.uid === user.uid && PERFIL_CACHE.value) return PERFIL_CACHE.value;
  const snap = await getDoc(doc(db, 'usuarios', user.uid));
  if (!snap.exists()) return null;
  PERFIL_CACHE.uid = user.uid;
  PERFIL_CACHE.value = { id: snap.id, ...snap.data() };
  return PERFIL_CACHE.value;
}

function isAdminPerfil(perfil) {
  return perfil?.tipo === 'admin' && perfil?.ativo === true;
}

function getCurrentAdminEmpresaId() {
  const meta = window.history.state?.meta || {};
  const view = meta.adminView || {};
  if (view.empresaId) return view.empresaId;
  const key = window.history.state?.key || '';
  const match = String(key).match(/admin:empresa:([^:]+)/);
  return match ? match[1] : '';
}

async function getEmpresa(empresaId) {
  if (!empresaId) return null;
  const snap = await getDoc(doc(db, 'empresas', empresaId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function getDiarioData(empresaId) {
  const [configSnap, atividadesSnap] = await Promise.all([
    getDoc(doc(db, 'diario_bordo_config', empresaId)),
    getDocs(query(collection(db, 'diario_bordo_atividades'), where('empresaId', '==', empresaId)))
  ]);

  const config = configSnap.exists()
    ? { id: configSnap.id, ...configSnap.data() }
    : { empresaId, horasContratadas: 0 };

  const atividades = atividadesSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const da = `${a.data || ''} ${a.inicio || ''}`;
      const dbb = `${b.data || ''} ${b.inicio || ''}`;
      return dbb.localeCompare(da);
    });

  return { config, atividades };
}

function diarioSummary(config, atividades) {
  const contratadasMin = Math.round(parseNumber(config?.horasContratadas) * 60);
  const usadasMin = atividades.reduce((sum, item) => sum + Number(item.minutosDescontados || 0), 0);
  const restantesMin = contratadasMin - usadasMin;
  const percentual = contratadasMin > 0 ? Math.min(Math.round((usadasMin / contratadasMin) * 100), 999) : 0;
  return { contratadasMin, usadasMin, restantesMin, percentual };
}

function activityIcon(item) {
  const title = String(item.titulo || '').toLowerCase();
  if (title.includes('reuni')) return '🤝';
  if (title.includes('trein')) return '🎓';
  if (title.includes('auditor')) return '🔎';
  if (title.includes('document')) return '📄';
  if (title.includes('almoço') || title.includes('almoco')) return '🍽️';
  return '📝';
}

function progressBarHTML(percentual) {
  const pct = Math.max(0, Math.min(Number(percentual || 0), 100));
  return `
    <div class="diario-progress">
      <span style="width:${pct}%"></span>
    </div>
  `;
}

function activityListHTML(atividades, adminMode) {
  if (!atividades.length) {
    return `
      <div class="diario-empty">
        <h3>Nenhuma atividade lançada ainda</h3>
        <p>Quando a administração registrar atividades, o histórico aparecerá aqui com horas utilizadas e saldo restante.</p>
      </div>
    `;
  }

  return `
    <div class="diario-timeline">
      ${atividades.map(item => `
        <article class="diario-activity">
          <div class="diario-activity-icon">${activityIcon(item)}</div>
          <div class="diario-activity-body">
            <div class="diario-activity-head">
              <div>
                <strong>${escapeHTML(item.titulo || 'Atividade')}</strong>
                <span>${formatDateBR(item.data)} • ${escapeHTML(item.inicio || '--:--')} às ${escapeHTML(item.fim || '--:--')}</span>
              </div>
              <div class="diario-activity-hours">
                ${minutesToHourLabel(item.minutosDescontados || 0)}
              </div>
            </div>
            ${item.descricao ? `<p>${escapeHTML(item.descricao)}</p>` : ''}
            <div class="diario-activity-meta">
              <span>Bruto: ${minutesToHourLabel(item.minutosBrutos || 0)}</span>
              <span>Almoço/pausa sem desconto: ${minutesToHourLabel(item.almocoMinutos || 0)}</span>
              <span>Descontado: ${minutesToHourLabel(item.minutosDescontados || 0)}</span>
            </div>
            ${adminMode ? `
              <div class="diario-activity-actions">
                <button class="btn btn-small btn-danger" type="button" data-diario-delete="${escapeHTML(item.id)}">Excluir lançamento</button>
              </div>
            ` : ''}
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function diarioModalHTML({ empresa, config, atividades, adminMode }) {
  const summary = diarioSummary(config, atividades);
  const restanteClass = summary.restantesMin < 0 ? 'danger' : 'ok';

  return `
    <div class="diario-modal" role="dialog" aria-modal="true">
      <div class="diario-header">
        <div>
          <span class="kicker">Diário de bordo</span>
          <h2>${escapeHTML(empresa?.nome || 'Empresa')}</h2>
          <p>Controle das horas contratadas, atividades realizadas e saldo disponível para acompanhamento da consultoria.</p>
        </div>
        <button class="btn btn-small btn-soft" type="button" data-diario-close>Fechar</button>
      </div>

      <div class="diario-summary-grid">
        <div class="diario-stat">
          <span>Horas contratadas</span>
          <strong>${minutesToHourLabel(summary.contratadasMin)}</strong>
          <small>${decimalHours(summary.contratadasMin)}h no contrato</small>
        </div>
        <div class="diario-stat">
          <span>Horas utilizadas</span>
          <strong>${minutesToHourLabel(summary.usadasMin)}</strong>
          <small>${atividades.length} lançamento(s)</small>
        </div>
        <div class="diario-stat ${restanteClass}">
          <span>Saldo restante</span>
          <strong>${summary.restantesMin < 0 ? '-' : ''}${minutesToHourLabel(Math.abs(summary.restantesMin))}</strong>
          <small>${summary.restantesMin < 0 ? 'Ultrapassou o contratado' : 'Disponível para uso'}</small>
        </div>
      </div>

      <section class="diario-card">
        <div class="diario-section-head">
          <div>
            <h3>Progresso das horas</h3>
            <p>${summary.percentual}% das horas contratadas já foram utilizadas.</p>
          </div>
        </div>
        ${progressBarHTML(summary.percentual)}
      </section>

      ${adminMode ? `
        <section class="diario-grid-2">
          <form class="diario-card" id="diarioConfigForm">
            <div class="diario-section-head">
              <div>
                <h3>Horas contratadas</h3>
                <p>Defina o total de horas combinadas com esta empresa.</p>
              </div>
            </div>
            <div class="form-group">
              <label>Total de horas</label>
              <input name="horasContratadas" type="number" step="0.25" min="0" value="${escapeHTML(config?.horasContratadas || '')}" placeholder="Ex.: 120" required />
            </div>
            <button class="btn btn-primary" type="submit">Salvar horas</button>
          </form>

          <form class="diario-card" id="diarioAtividadeForm">
            <div class="diario-section-head">
              <div>
                <h3>Adicionar atividade</h3>
                <p>Informe início e término. O horário de almoço/pausa não será descontado.</p>
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-group"><label>Data</label><input name="data" type="date" value="${todayISO()}" required /></div>
              <div class="form-group"><label>Atividade</label><input name="titulo" placeholder="Ex.: Reunião, treinamento, revisão documental..." required /></div>
            </div>
            <div class="form-group">
              <label>Descrição</label>
              <textarea name="descricao" placeholder="Descreva o que foi feito neste período."></textarea>
            </div>
            <div class="form-grid-2">
              <div class="form-group"><label>Começou</label><input name="inicio" type="time" required /></div>
              <div class="form-group"><label>Terminou</label><input name="fim" type="time" required /></div>
            </div>
            <div class="diario-lunch-box">
              <strong>Almoço / pausa que não desconta</strong>
              <div class="form-grid-2">
                <div class="form-group"><label>Início do almoço</label><input name="almocoInicio" type="time" /></div>
                <div class="form-group"><label>Fim do almoço</label><input name="almocoFim" type="time" /></div>
              </div>
              <small>Exemplo: 08:00 às 17:00 com almoço 12:00 às 13:00 desconta 8h, não 9h.</small>
            </div>
            <div class="diario-preview" id="diarioPreview">Preencha os horários para calcular o desconto.</div>
            <button class="btn btn-gold" type="submit">Salvar atividade</button>
          </form>
        </section>
      ` : `
        <section class="diario-card">
          <h3>Acompanhamento</h3>
          <p class="muted">Esta área é somente para visualização. Os lançamentos são feitos pela administração.</p>
        </section>
      `}

      <section class="diario-card">
        <div class="diario-section-head">
          <div>
            <h3>Histórico de atividades</h3>
            <p>Todos os registros ficam vinculados a esta empresa.</p>
          </div>
        </div>
        ${activityListHTML(atividades, adminMode)}
      </section>
    </div>
  `;
}

async function renderDiarioModal(empresaId, adminMode = false) {
  if (!empresaId) return toastDiario('Empresa não identificada para abrir o diário.', 'error');

  const [empresa, data] = await Promise.all([
    getEmpresa(empresaId),
    getDiarioData(empresaId)
  ]);

  document.querySelector('.diario-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'diario-backdrop';
  backdrop.innerHTML = diarioModalHTML({
    empresa,
    config: data.config,
    atividades: data.atividades,
    adminMode
  });
  document.body.appendChild(backdrop);
  bindDiarioModal(backdrop, empresaId, adminMode);
}

function setLoading(button, loading, text = 'Salvando...') {
  if (!button) return;
  if (loading) {
    button.dataset.oldText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = text;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.oldText || button.innerHTML;
  }
}

async function saveConfig(empresaId, form) {
  const horasContratadas = parseNumber(form.get('horasContratadas'));
  if (horasContratadas < 0) throw new Error('Informe um total de horas válido.');
  await setDoc(doc(db, 'diario_bordo_config', empresaId), {
    empresaId,
    horasContratadas,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: auth.currentUser?.uid || ''
  }, { merge: true });
}

async function saveAtividade(empresaId, form) {
  const data = String(form.get('data') || '').trim();
  const titulo = String(form.get('titulo') || '').trim();
  const descricao = String(form.get('descricao') || '').trim();
  const inicio = String(form.get('inicio') || '').trim();
  const fim = String(form.get('fim') || '').trim();
  const almocoInicio = String(form.get('almocoInicio') || '').trim();
  const almocoFim = String(form.get('almocoFim') || '').trim();

  if (!data) throw new Error('Informe a data da atividade.');
  if (!titulo) throw new Error('Informe o nome da atividade.');
  if (!inicio || !fim) throw new Error('Informe o horário de início e término.');
  if ((almocoInicio && !almocoFim) || (!almocoInicio && almocoFim)) {
    throw new Error('Informe início e fim do almoço, ou deixe os dois campos vazios.');
  }

  const calc = calculateActivityMinutes(inicio, fim, almocoInicio, almocoFim);
  if (calc.bruto <= 0) throw new Error('O horário da atividade precisa ter duração maior que zero.');
  if (calc.almoco > calc.bruto) throw new Error('O almoço/pausa não pode ser maior que o período total.');

  await addDoc(collection(db, 'diario_bordo_atividades'), {
    empresaId,
    data,
    titulo,
    descricao,
    inicio,
    fim,
    almocoInicio,
    almocoFim,
    minutosBrutos: calc.bruto,
    almocoMinutos: calc.almoco,
    minutosDescontados: calc.descontado,
    horasDescontadas: decimalHours(calc.descontado),
    criadoEm: serverTimestamp(),
    criadoPor: auth.currentUser?.uid || '',
    atualizadoEm: serverTimestamp(),
    atualizadoPor: auth.currentUser?.uid || ''
  });
}

function updatePreview(formEl) {
  const preview = document.getElementById('diarioPreview');
  if (!preview) return;
  const form = new FormData(formEl);
  const inicio = String(form.get('inicio') || '');
  const fim = String(form.get('fim') || '');
  const almocoInicio = String(form.get('almocoInicio') || '');
  const almocoFim = String(form.get('almocoFim') || '');
  if (!inicio || !fim) {
    preview.textContent = 'Preencha os horários para calcular o desconto.';
    return;
  }
  const calc = calculateActivityMinutes(inicio, fim, almocoInicio, almocoFim);
  preview.innerHTML = `
    <strong>${minutesToHourLabel(calc.descontado)}</strong> serão descontados.
    <span>Período bruto: ${minutesToHourLabel(calc.bruto)} • Almoço/pausa: ${minutesToHourLabel(calc.almoco)}</span>
  `;
}

function bindDiarioModal(backdrop, empresaId, adminMode) {
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop || event.target.closest('[data-diario-close]')) {
      backdrop.remove();
    }
  });

  const atividadeForm = backdrop.querySelector('#diarioAtividadeForm');
  atividadeForm?.addEventListener('input', () => updatePreview(atividadeForm));
  atividadeForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const btn = event.submitter;
    setLoading(btn, true, 'Salvando atividade...');
    try {
      await saveAtividade(empresaId, new FormData(atividadeForm));
      toastDiario('Atividade registrada no diário de bordo.');
      await renderDiarioModal(empresaId, adminMode);
    } catch (error) {
      toastDiario(error?.message || 'Erro ao salvar atividade.', 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  const configForm = backdrop.querySelector('#diarioConfigForm');
  configForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const btn = event.submitter;
    setLoading(btn, true, 'Salvando horas...');
    try {
      await saveConfig(empresaId, new FormData(configForm));
      toastDiario('Horas contratadas atualizadas.');
      await renderDiarioModal(empresaId, adminMode);
    } catch (error) {
      toastDiario(error?.message || 'Erro ao salvar horas contratadas.', 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  backdrop.querySelectorAll('[data-diario-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = confirm('Excluir este lançamento do diário de bordo?');
      if (!ok) return;
      try {
        await deleteDoc(doc(db, 'diario_bordo_atividades', btn.dataset.diarioDelete));
        toastDiario('Lançamento excluído.');
        await renderDiarioModal(empresaId, adminMode);
      } catch (error) {
        toastDiario(error?.message || 'Erro ao excluir lançamento.', 'error');
      }
    });
  });
}

async function injectAdminCompanyCard(perfil) {
  if (!isAdminPerfil(perfil)) return;
  const empresaId = getCurrentAdminEmpresaId();
  const grid = document.getElementById('abrirEcossistemaEmpresa')?.closest('section.grid');
  if (!empresaId || !grid || document.getElementById('abrirDiarioEmpresa')) return;

  const data = await getDiarioData(empresaId).catch(() => ({ config: {}, atividades: [] }));
  const summary = diarioSummary(data.config, data.atividades);

  grid.insertAdjacentHTML('beforeend', `
    <article class="card stack area-card diario-company-card">
      <span class="kicker">Diário de bordo</span>
      <h2>Horas, atividades e saldo</h2>
      <p>Controle as horas contratadas, registre atividades realizadas e acompanhe automaticamente o saldo da consultoria.</p>
      <div class="mini-stats left">
        <span>${minutesToHourLabel(summary.contratadasMin)} contratadas</span>
        <span>${minutesToHourLabel(summary.usadasMin)} utilizadas</span>
        <span>${minutesToHourLabel(Math.abs(summary.restantesMin))} ${summary.restantesMin < 0 ? 'excedidas' : 'restantes'}</span>
      </div>
      <button class="btn btn-primary" type="button" id="abrirDiarioEmpresa">Abrir diário</button>
    </article>
  `);

  document.getElementById('abrirDiarioEmpresa')?.addEventListener('click', () => renderDiarioModal(empresaId, true));
}

async function injectContextButton(perfil) {
  if (!isAdminPerfil(perfil)) return;
  const empresaId = getCurrentAdminEmpresaId();
  const actions = document.querySelector('.main > section.actions');
  if (!empresaId || !actions || document.getElementById('abrirDiarioContexto')) return;
  if (document.getElementById('abrirDiarioEmpresa')) return;
  actions.insertAdjacentHTML('beforeend', `<button class="btn btn-primary" id="abrirDiarioContexto" type="button">Diário de bordo</button>`);
  document.getElementById('abrirDiarioContexto')?.addEventListener('click', () => renderDiarioModal(empresaId, true));
}

async function injectClientNav(perfil) {
  if (!perfil || perfil.tipo !== 'cliente' || !perfil.empresaId) return;
  const nav = document.querySelector('.nav-group');
  if (!nav || document.getElementById('clienteDiarioNav')) return;
  const btn = document.createElement('button');
  btn.className = 'nav-btn';
  btn.id = 'clienteDiarioNav';
  btn.type = 'button';
  btn.innerHTML = '<span>◷</span>Diário de bordo';
  btn.addEventListener('click', () => renderDiarioModal(perfil.empresaId, false));
  const arquivosBtn = nav.querySelector('[data-page="cliente-arquivos"]');
  if (arquivosBtn) arquivosBtn.insertAdjacentElement('afterend', btn);
  else nav.appendChild(btn);
}

function injectDiarioStyles() {
  if (document.getElementById('diarioBordoStyles')) return;
  const style = document.createElement('style');
  style.id = 'diarioBordoStyles';
  style.textContent = `
    .diario-backdrop{position:fixed;inset:0;background:rgba(5,24,36,.58);z-index:2200;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto}
    .diario-modal{width:min(1180px,100%);background:linear-gradient(180deg,#fff,#f7fbfd);border:1px solid rgba(10,88,128,.18);border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.22);padding:22px}
    .diario-header,.diario-section-head,.diario-activity-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
    .diario-header{padding-bottom:16px;border-bottom:1px solid var(--line,#d8e7ee);margin-bottom:18px}
    .diario-header h2,.diario-section-head h3{margin:4px 0;color:var(--primary-dark,#073f5a)}
    .diario-header p,.diario-section-head p{margin:0;color:var(--muted,#627986)}
    .diario-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:16px}
    .diario-stat,.diario-card{background:#fff;border:1px solid var(--line,#d8e7ee);border-radius:18px;padding:16px}
    .diario-stat span,.diario-stat small{display:block;color:var(--muted,#627986)}
    .diario-stat strong{display:block;font-size:30px;color:var(--primary-dark,#073f5a);margin:4px 0}
    .diario-stat.danger strong{color:#b42318}
    .diario-stat.ok strong{color:#0f766e}
    .diario-progress{height:13px;border-radius:999px;background:#e8f1f5;overflow:hidden}
    .diario-progress span{display:block;height:100%;background:linear-gradient(90deg,#073f5a,#d6a842);border-radius:999px}
    .diario-grid-2{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.4fr);gap:16px;margin:16px 0}
    .diario-lunch-box{border:1px dashed var(--line-strong,#bad4df);background:#f8fbfd;border-radius:16px;padding:12px;margin:12px 0}
    .diario-lunch-box strong,.diario-lunch-box small{display:block}
    .diario-lunch-box small{color:var(--muted,#627986)}
    .diario-preview{border-radius:14px;background:#f2f7fa;border:1px solid var(--line,#d8e7ee);padding:12px;margin:12px 0;color:var(--muted,#627986)}
    .diario-preview strong{color:var(--primary-dark,#073f5a)}
    .diario-preview span{display:block;margin-top:4px}
    .diario-timeline{display:grid;gap:12px;margin-top:12px}
    .diario-activity{display:grid;grid-template-columns:44px minmax(0,1fr);gap:12px;background:#fff;border:1px solid var(--line,#d8e7ee);border-radius:16px;padding:14px}
    .diario-activity-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:#eef7fb;font-size:22px}
    .diario-activity-body strong,.diario-activity-body span{display:block}
    .diario-activity-body p{margin:8px 0;color:#2c4755}
    .diario-activity-body span,.diario-activity-meta{color:var(--muted,#627986);font-size:13px}
    .diario-activity-hours{font-weight:900;color:var(--primary-dark,#073f5a);background:#eef7fb;border-radius:999px;padding:8px 12px;white-space:nowrap}
    .diario-activity-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
    .diario-activity-meta span{background:#f2f7fa;border:1px solid var(--line,#d8e7ee);border-radius:999px;padding:5px 9px}
    .diario-activity-actions{margin-top:10px}
    .diario-empty{padding:22px;text-align:center;background:#f8fbfd;border:1px dashed var(--line-strong,#bad4df);border-radius:16px}
    .diario-company-card{border-color:rgba(214,168,66,.45)!important}
    @media(max-width:900px){.diario-backdrop{padding:10px}.diario-modal{padding:16px;border-radius:18px}.diario-summary-grid,.diario-grid-2{grid-template-columns:1fr}.diario-header,.diario-section-head,.diario-activity-head{flex-direction:column}.diario-activity{grid-template-columns:1fr}.diario-activity-icon{width:40px;height:40px}}
  `;
  document.head.appendChild(style);
}

let enhancing = false;
async function enhanceDiario() {
  if (enhancing) return;
  enhancing = true;
  try {
    injectDiarioStyles();
    const perfil = await getPerfilAtual();
    if (!perfil) return;
    await injectAdminCompanyCard(perfil);
    await injectContextButton(perfil);
    await injectClientNav(perfil);
  } catch (error) {
    console.warn('Diário de bordo não pôde ser aplicado agora:', error);
  } finally {
    enhancing = false;
  }
}

const observer = new MutationObserver(() => {
  window.requestAnimationFrame(enhanceDiario);
});
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('load', enhanceDiario);
document.addEventListener('click', () => setTimeout(enhanceDiario, 180));
setInterval(enhanceDiario, 2500);

console.info(`Excellence System® diário de bordo ${DIARIO_VERSION} carregado.`);
