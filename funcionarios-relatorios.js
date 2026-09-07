import { auth, db } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const VERSION = '20260907-100';
const COMPANY_SESSION = 'excellence-employees-company';
let enhancing = false;
let timer = null;

const esc = (value = '') => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const norm = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const digits = (value = '') => String(value || '').replace(/\D/g, '');

function toast(message, error = false) {
  document.querySelector('[data-employee-report-toast]')?.remove();
  const el = document.createElement('div');
  el.dataset.employeeReportToast = '1';
  el.textContent = message;
  el.style.cssText = `position:fixed;right:18px;bottom:18px;z-index:140000;max-width:440px;padding:12px 15px;border-radius:14px;color:#fff;font-weight:850;background:${error ? '#9f2e2e' : '#073F5A'};box-shadow:0 18px 42px rgba(5,36,55,.25)`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function dateBr(value = '') {
  if (!value) return '-';
  const d = value?.toDate ? value.toDate() : new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR');
}

function cpfMask(value = '') {
  const d = digits(value).slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function age(value = '') {
  if (!value) return '-';
  const born = new Date(`${value}T12:00:00`);
  if (Number.isNaN(born.getTime())) return '-';
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) years--;
  return years >= 0 ? `${years} anos` : '-';
}

async function currentAdmin() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'usuarios', user.uid));
  if (!snap.exists()) return null;
  const perfil = { id: snap.id, ...snap.data() };
  return perfil.tipo === 'admin' && perfil.ativo === true ? perfil : null;
}

async function companyRows(name, empresaId) {
  const snap = await getDocs(query(collection(db, name), where('empresaId', '==', empresaId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function modalEmployeeIdentity(modal) {
  const name = String(modal.querySelector('.emp-modal-head p')?.textContent || '').trim();
  let cpf = '';
  modal.querySelectorAll('.emp-info').forEach(card => {
    const label = norm(card.querySelector('small')?.textContent || '');
    if (label === 'cpf') cpf = digits(card.querySelector('strong')?.textContent || '');
  });
  return { name, cpf };
}

async function resolveEmployee(modal) {
  const empresaId = sessionStorage.getItem(COMPANY_SESSION) || '';
  if (!empresaId) throw new Error('Empresa não identificada para gerar o relatório.');

  const identity = modalEmployeeIdentity(modal);
  const employees = await companyRows('empresa_funcionarios', empresaId);
  const employee = employees.find(item => identity.cpf && digits(item.cpf) === identity.cpf)
    || employees.find(item => norm(item.nome) === norm(identity.name));

  if (!employee) throw new Error('Não foi possível localizar este funcionário na base central.');
  return { empresaId, employee };
}

async function reportData(modal) {
  const admin = await currentAdmin();
  if (!admin) throw new Error('Somente o administrador pode gerar este relatório.');

  const { empresaId, employee } = await resolveEmployee(modal);
  const legacyId = employee.treinamentoColaboradorId || employee.id;

  const [empresaSnap, matrix, plans] = await Promise.all([
    getDoc(doc(db, 'empresas', empresaId)),
    companyRows('empresa_matriz_competencias', empresaId),
    companyRows('empresa_treinamentos', empresaId)
  ]);

  const empresa = empresaSnap.exists() ? { id: empresaSnap.id, ...empresaSnap.data() } : { id: empresaId, nome: 'Empresa' };
  const planMap = new Map(plans.map(plan => [plan.id, plan]));
  const employeeRows = matrix.filter(row => row.colaboradorId === legacyId || row.colaboradorId === employee.id);

  const performed = employeeRows
    .filter(row => row.ultimaRealizacaoData || norm(row.status) === 'concluido')
    .map(row => ({ ...row, plan: planMap.get(row.treinamentoId) || null }))
    .sort((a, b) => String(b.ultimaRealizacaoData || '').localeCompare(String(a.ultimaRealizacaoData || '')));

  return { empresa, employee, employeeRows, performed };
}

function statusClass(value = '') {
  const n = norm(value);
  if (['concluido', 'eficaz', 'aprovado'].includes(n)) return 'ok';
  if (['ineficaz', 'reprovado', 'atrasado'].includes(n)) return 'bad';
  return 'warn';
}

function reportHTML({ empresa, employee, employeeRows, performed }) {
  const completed = employeeRows.filter(row => norm(row.status) === 'concluido').length;
  const effective = employeeRows.filter(row => norm(row.eficaciaStatus) === 'eficaz').length;
  const generatedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const appBase = new URL('./', window.location.href).href;
  const logoUrl = `${appBase}icon-512.png`;

  const trainingRows = performed.length ? performed.map(row => {
    const plan = row.plan || {};
    const trainingName = row.treinamentoNome || plan.titulo || 'Treinamento';
    const realization = dateBr(row.ultimaRealizacaoData);
    const workload = plan.cargaHoraria || '-';
    const instructor = plan.instrutor || '-';
    const result = row.status || 'Realizado';
    const efficacy = row.eficaciaStatus || 'Pendente';
    const evaluator = row.eficaciaAvaliador || '-';
    return `
      <tr>
        <td><strong>${esc(trainingName)}</strong></td>
        <td>${esc(realization)}</td>
        <td>${esc(workload)}</td>
        <td>${esc(instructor)}</td>
        <td><span class="badge ${statusClass(result)}">${esc(result)}</span></td>
        <td><span class="badge ${statusClass(efficacy)}">${esc(efficacy)}</span></td>
        <td>${esc(evaluator)}</td>
      </tr>`;
  }).join('') : '<tr><td colspan="7" class="empty">Nenhum treinamento realizado registrado para este funcionário.</td></tr>';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório individual - ${esc(employee.nome || 'Funcionário')}</title>
<style>
  *{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#183847;background:#fff}
  body{padding:0;font-size:11px}.page{width:100%;margin:0 auto}.header{background:linear-gradient(135deg,#073F5A,#0b607f);color:#fff;border-radius:14px;padding:14px 16px;display:grid;grid-template-columns:56px 1fr auto;gap:13px;align-items:center}
  .logo{width:54px;height:54px;border-radius:12px;object-fit:contain;background:#fff;padding:4px}.brand small{display:block;font-size:9px;font-weight:700;letter-spacing:.12em;opacity:.82}.brand h1{margin:3px 0 2px;font-size:20px}.brand p{margin:0;color:#dcecf2}.header-meta{text-align:right;font-size:9px;line-height:1.5;color:#dcecf2}.header-meta strong{display:block;color:#fff;font-size:11px}
  .employee{margin-top:12px;border:1px solid #d7e5ea;border-radius:14px;padding:12px;display:grid;grid-template-columns:96px 1fr;gap:14px;align-items:center;background:#fbfdfe}.photo{width:92px;height:112px;border-radius:14px;overflow:hidden;background:#e9f2f5;display:grid;place-items:center;color:#073F5A;font-size:26px;font-weight:800}.photo img{width:100%;height:100%;object-fit:cover;display:block}.employee h2{margin:0 0 8px;color:#073F5A;font-size:18px}.info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.info{border:1px solid #e2eaee;border-radius:9px;padding:7px;background:#fff}.info span{display:block;font-size:8px;font-weight:700;text-transform:uppercase;color:#728791;letter-spacing:.04em}.info strong{display:block;margin-top:3px;font-size:10px;color:#173846}
  .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.kpi{border:1px solid #dce7eb;border-radius:10px;padding:8px 10px;background:#f8fbfc}.kpi span{display:block;text-transform:uppercase;font-size:8px;color:#68808b;font-weight:700}.kpi strong{display:block;color:#073F5A;font-size:19px;margin-top:2px}
  .section{margin-top:11px}.section-title{display:flex;align-items:end;justify-content:space-between;border-bottom:2px solid #073F5A;padding-bottom:5px;margin-bottom:7px}.section-title h3{margin:0;color:#073F5A;font-size:13px}.section-title span{font-size:9px;color:#657d88}
  table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border-bottom:1px solid #e2eaee;padding:6px 5px;text-align:left;vertical-align:top;word-wrap:break-word}th{background:#f0f6f8;color:#496570;text-transform:uppercase;font-size:7.5px;letter-spacing:.03em}td{font-size:9px}th:nth-child(1){width:24%}th:nth-child(2){width:11%}th:nth-child(3){width:9%}th:nth-child(4){width:15%}th:nth-child(5){width:12%}th:nth-child(6){width:12%}th:nth-child(7){width:17%}
  .badge{display:inline-block;padding:3px 6px;border-radius:999px;font-size:7.5px;font-weight:700;background:#eef4f6;color:#315a69}.badge.ok{background:#e6f5ea;color:#25643b}.badge.warn{background:#fff3d4;color:#7d5d10}.badge.bad{background:#fde8e8;color:#922626}.empty{text-align:center;color:#71858e;padding:16px}
  .notes{border:1px solid #e1eaee;border-radius:10px;padding:8px 10px;background:#fbfdfe;white-space:pre-wrap;min-height:34px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:22px}.signature{border-top:1px solid #78909a;padding-top:5px;text-align:center;color:#536c77;font-size:9px}.footer{margin-top:14px;padding-top:6px;border-top:1px solid #dfe8ec;display:flex;justify-content:space-between;color:#71858e;font-size:8px}
  @page{size:A4 portrait;margin:9mm}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:auto}.header,.employee,.kpi,.section{break-inside:avoid}tr{break-inside:avoid}}
</style>
</head>
<body>
<div class="page">
  <header class="header">
    <img class="logo" src="${esc(logoUrl)}" alt="Excellence System">
    <div class="brand"><small>EXCELLENCE SYSTEM • MP CONSULTORIA</small><h1>Relatório Individual de Capacitação</h1><p>${esc(empresa.nome || 'Empresa')}</p></div>
    <div class="header-meta"><strong>Ficha do funcionário</strong>Gerado em ${esc(generatedAt)}</div>
  </header>

  <section class="employee">
    <div class="photo">${employee.fotoUrl ? `<img src="${esc(employee.fotoUrl)}" alt="Foto de ${esc(employee.nome || 'funcionário')}">` : esc(String(employee.nome || '').trim().split(/\s+/).filter(Boolean).map(x => x[0]).slice(0,2).join('').toUpperCase() || '•')}</div>
    <div>
      <h2>${esc(employee.nome || 'Funcionário')}</h2>
      <div class="info-grid">
        <div class="info"><span>CPF</span><strong>${esc(cpfMask(employee.cpf) || '-')}</strong></div>
        <div class="info"><span>Nascimento</span><strong>${esc(dateBr(employee.dataNascimento))} • ${esc(age(employee.dataNascimento))}</strong></div>
        <div class="info"><span>Admissão</span><strong>${esc(dateBr(employee.admissao))}</strong></div>
        <div class="info"><span>Cargo / Função</span><strong>${esc(employee.cargo || employee.funcao || '-')}</strong></div>
        <div class="info"><span>Setor</span><strong>${esc(employee.setor || '-')}</strong></div>
        <div class="info"><span>Situação</span><strong>${employee.ativo === false ? 'Inativo' : 'Ativo'}</strong></div>
      </div>
    </div>
  </section>

  <section class="summary">
    <div class="kpi"><span>Treinamentos vinculados</span><strong>${employeeRows.length}</strong></div>
    <div class="kpi"><span>Já realizados</span><strong>${performed.length}</strong></div>
    <div class="kpi"><span>Concluídos</span><strong>${completed}</strong></div>
    <div class="kpi"><span>Eficazes</span><strong>${effective}</strong></div>
  </section>

  <section class="section">
    <div class="section-title"><h3>Treinamentos realizados</h3><span>Histórico vinculado à ficha central</span></div>
    <table>
      <thead><tr><th>Treinamento</th><th>Realização</th><th>Carga</th><th>Instrutor</th><th>Status</th><th>Eficácia</th><th>Avaliador</th></tr></thead>
      <tbody>${trainingRows}</tbody>
    </table>
  </section>

  ${employee.observacoes ? `<section class="section"><div class="section-title"><h3>Observações da ficha</h3></div><div class="notes">${esc(employee.observacoes)}</div></section>` : ''}

  <div class="signatures">
    <div class="signature">Responsável pela empresa / RH</div>
    <div class="signature">Responsável pela consultoria</div>
  </div>

  <footer class="footer"><span>Excellence System • MP Consultoria</span><span>Relatório individual de capacitação</span></footer>
</div>
</body>
</html>`;
}

async function printEmployeeReport(modal, button) {
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = 'Gerando...';

  try {
    const data = await reportData(modal);
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(frame);

    const docFrame = frame.contentDocument;
    docFrame.open();
    docFrame.write(reportHTML(data));
    docFrame.close();

    const images = Array.from(docFrame.images || []);
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 1800);
      });
    }));

    await new Promise(resolve => setTimeout(resolve, 120));
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 2500);
  } catch (error) {
    console.error('Relatório do funcionário:', error);
    toast(error?.message || 'Não foi possível gerar o relatório do funcionário.', true);
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
}

function enhanceModal(modal) {
  if (!modal || modal.dataset.employeeReport === VERSION) return;
  const title = norm(modal.querySelector('.emp-modal-head h2')?.textContent || '');
  if (title !== 'ficha do funcionario') return;

  modal.dataset.employeeReport = VERSION;
  const head = modal.querySelector('.emp-modal-head');
  const close = head?.querySelector('[data-close]');
  if (!head || !close) return;

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end';
  const report = document.createElement('button');
  report.type = 'button';
  report.className = 'emp-btn primary';
  report.dataset.employeeReportButton = '1';
  report.textContent = 'Gerar relatório / PDF';
  report.addEventListener('click', () => printEmployeeReport(modal, report));

  close.parentNode.insertBefore(actions, close);
  actions.appendChild(report);
  actions.appendChild(close);
}

function enhance() {
  if (enhancing) return;
  enhancing = true;
  try {
    document.querySelectorAll('.emp-modal').forEach(enhanceModal);
  } finally {
    enhancing = false;
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(enhance, 60);
}

new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
window.addEventListener('load', schedule);
schedule();
console.info(`Excellence System • relatório individual de funcionário ${VERSION} carregado.`);
