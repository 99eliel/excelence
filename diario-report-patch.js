import { auth, db } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const DIARIO_REPORT_VERSION = '20260801-48';
const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const PERFIL_CACHE = { uid: '', value: null };

function escapeHTML(value = '') {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toastReport(message, type = 'success') {
  const existing = document.querySelector('.toast-diario-report');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = `notice ${type} toast-diario-report`;
  el.style.position = 'fixed';
  el.style.right = '18px';
  el.style.bottom = '18px';
  el.style.zIndex = '3000';
  el.style.maxWidth = '440px';
  el.innerHTML = escapeHTML(message);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function safeNumber(value) {
  const n = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
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

function formatNowBR() {
  return new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function safeFileName(value = 'empresa') {
  return String(value || 'empresa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'empresa';
}

function getIntervalMinutes(item = {}) {
  return Number(item.intervaloMinutos ?? item.almocoMinutos ?? 0);
}

function getActivityUsedMinutes(item = {}) {
  return Number(item.minutosDescontados || 0);
}

function getActivityGrossMinutes(item = {}) {
  return Number(item.minutosBrutos || 0);
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

function getCurrentAdminEmpresaId() {
  const meta = window.history.state?.meta || {};
  const view = meta.adminView || {};
  if (view.empresaId) return view.empresaId;
  const key = window.history.state?.key || '';
  const match = String(key).match(/admin:empresa:([^:]+)/);
  return match ? match[1] : '';
}

async function resolveEmpresaId() {
  const perfil = await getPerfilAtual();
  if (perfil?.tipo === 'cliente' && perfil.empresaId) return perfil.empresaId;
  return getCurrentAdminEmpresaId();
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
      return da.localeCompare(dbb);
    });

  return { config, atividades };
}

function reportSummary(config = {}, atividades = []) {
  const contratadasMin = Math.round(safeNumber(config.horasContratadas) * 60);
  const usadasMin = atividades.reduce((sum, item) => sum + getActivityUsedMinutes(item), 0);
  const brutoMin = atividades.reduce((sum, item) => sum + getActivityGrossMinutes(item), 0);
  const intervaloMin = atividades.reduce((sum, item) => sum + getIntervalMinutes(item), 0);
  const restantesMin = contratadasMin - usadasMin;
  const percentual = contratadasMin > 0 ? Math.round((usadasMin / contratadasMin) * 100) : 0;
  return { contratadasMin, usadasMin, brutoMin, intervaloMin, restantesMin, percentual };
}

function reportRowsHTML(atividades = []) {
  if (!atividades.length) {
    return '<tr><td colspan="8" class="empty-row">Nenhuma atividade lançada no diário de bordo.</td></tr>';
  }

  return atividades.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHTML(formatDateBR(item.data))}</td>
      <td>
        <strong>${escapeHTML(item.titulo || 'Atividade')}</strong>
        ${item.descricao ? `<small>${escapeHTML(item.descricao)}</small>` : ''}
      </td>
      <td>${escapeHTML(item.inicio || '-')}</td>
      <td>${escapeHTML(item.fim || '-')}</td>
      <td>${minutesToHourLabel(getActivityGrossMinutes(item))}</td>
      <td>${minutesToHourLabel(getIntervalMinutes(item))}</td>
      <td><strong>${minutesToHourLabel(getActivityUsedMinutes(item))}</strong></td>
    </tr>
  `).join('');
}

function buildPrintReportHTML({ empresa, config, atividades, perfil }) {
  const summary = reportSummary(config, atividades);
  const restanteNegativo = summary.restantesMin < 0;
  const empresaNome = empresa?.nome || 'Empresa';
  const geradoPor = perfil?.nome || auth.currentUser?.email || '-';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Diário de bordo - ${escapeHTML(empresaNome)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #123142; margin: 0; background: #fff; }
  .report { max-width: 1100px; margin: 0 auto; }
  .cover { border: 2px solid #073F5A; border-radius: 18px; padding: 22px; margin-bottom: 18px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; border-bottom: 1px solid #d8e7ee; padding-bottom: 16px; }
  .brand { display: flex; gap: 14px; align-items: center; }
  .logo { width: 78px; height: 78px; object-fit: contain; border-radius: 14px; border: 1px solid #d8e7ee; padding: 8px; }
  .brand h1 { margin: 0; font-size: 24px; color: #073F5A; }
  .brand p { margin: 4px 0 0; color: #5f7684; font-size: 13px; }
  .doc-title { text-align: right; }
  .doc-title strong { display: block; font-size: 18px; color: #073F5A; }
  .doc-title span { display: block; color: #5f7684; font-size: 12px; margin-top: 4px; }
  .company { margin-top: 18px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 18px; }
  .company div { border: 1px solid #d8e7ee; border-radius: 12px; padding: 10px 12px; background: #f7fbfd; }
  .company small { display: block; color: #5f7684; text-transform: uppercase; font-size: 10px; letter-spacing: .06em; }
  .company strong { display: block; margin-top: 3px; color: #123142; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 18px 0; }
  .stat { border-radius: 16px; padding: 14px; border: 1px solid #d8e7ee; background: #f7fbfd; }
  .stat span { display: block; font-size: 11px; color: #5f7684; text-transform: uppercase; letter-spacing: .05em; }
  .stat strong { display: block; font-size: 23px; color: #073F5A; margin-top: 6px; }
  .stat.danger strong { color: #b42318; }
  .progress { height: 12px; background: #e8f1f5; border-radius: 999px; overflow: hidden; margin: 8px 0 16px; }
  .progress span { display: block; height: 100%; background: linear-gradient(90deg, #073F5A, #D6A842); width: ${Math.max(0, Math.min(summary.percentual, 100))}%; }
  h2 { color: #073F5A; margin: 22px 0 8px; font-size: 18px; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #d8e7ee; border-radius: 12px; overflow: hidden; }
  thead { background: #073F5A; color: #fff; }
  th, td { padding: 9px 8px; border-bottom: 1px solid #d8e7ee; text-align: left; vertical-align: top; font-size: 12px; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  tbody tr:nth-child(even) { background: #f7fbfd; }
  td small { display: block; color: #5f7684; margin-top: 4px; line-height: 1.35; }
  .empty-row { text-align: center; color: #5f7684; padding: 22px; }
  .footer { display: flex; justify-content: space-between; gap: 14px; margin-top: 22px; padding-top: 14px; border-top: 1px solid #d8e7ee; color: #5f7684; font-size: 11px; }
  .signature { display: grid; grid-template-columns: repeat(2, 1fr); gap: 34px; margin-top: 44px; }
  .signature div { border-top: 1px solid #123142; text-align: center; padding-top: 8px; font-size: 12px; color: #123142; }
  .no-print { display: flex; justify-content: flex-end; gap: 10px; margin: 0 0 14px; }
  .no-print button { border: 0; border-radius: 999px; padding: 10px 16px; font-weight: 700; cursor: pointer; }
  .primary { background: #073F5A; color: #fff; }
  .soft { background: #e8f1f5; color: #073F5A; }
  @media print { .no-print { display: none; } .cover { border-radius: 0; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="report">
    <div class="no-print">
      <button class="primary" onclick="window.print()">Imprimir / salvar PDF</button>
      <button class="soft" onclick="window.close()">Fechar</button>
    </div>
    <section class="cover">
      <div class="header">
        <div class="brand">
          <img class="logo" src="./logo.png" alt="MP Consultoria" />
          <div>
            <h1>Excellence System®</h1>
            <p>MPEDRO Consultoria e Treinamentos • Gestão da Qualidade • ISO 9001:2015</p>
          </div>
        </div>
        <div class="doc-title">
          <strong>Relatório do Diário de Bordo</strong>
          <span>Gerado em ${escapeHTML(formatNowBR())}</span>
          <span>Versão do relatório: ${DIARIO_REPORT_VERSION}</span>
        </div>
      </div>

      <div class="company">
        <div><small>Empresa</small><strong>${escapeHTML(empresaNome)}</strong></div>
        <div><small>CNPJ</small><strong>${escapeHTML(empresa?.cnpj || '-')}</strong></div>
        <div><small>Responsável</small><strong>${escapeHTML(empresa?.responsavel || empresa?.responsavelNome || '-')}</strong></div>
        <div><small>Gerado por</small><strong>${escapeHTML(geradoPor)}</strong></div>
      </div>

      <div class="summary">
        <div class="stat"><span>Horas contratadas</span><strong>${minutesToHourLabel(summary.contratadasMin)}</strong></div>
        <div class="stat"><span>Horas utilizadas</span><strong>${minutesToHourLabel(summary.usadasMin)}</strong></div>
        <div class="stat"><span>Intervalos</span><strong>${minutesToHourLabel(summary.intervaloMin)}</strong></div>
        <div class="stat ${restanteNegativo ? 'danger' : ''}"><span>${restanteNegativo ? 'Horas excedidas' : 'Saldo restante'}</span><strong>${minutesToHourLabel(Math.abs(summary.restantesMin))}</strong></div>
      </div>
      <div class="progress"><span></span></div>
      <p><strong>Progresso:</strong> ${summary.percentual}% das horas contratadas utilizadas. Período bruto registrado: ${minutesToHourLabel(summary.brutoMin)}. Intervalos/pausas sem desconto: ${minutesToHourLabel(summary.intervaloMin)}.</p>
    </section>

    <h2>Histórico completo de atividades</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Data</th>
          <th>Atividade / descrição</th>
          <th>Início</th>
          <th>Fim</th>
          <th>Bruto</th>
          <th>Intervalo</th>
          <th>Descontado</th>
        </tr>
      </thead>
      <tbody>${reportRowsHTML(atividades)}</tbody>
    </table>

    <div class="signature">
      <div>MPEDRO Consultoria e Treinamentos</div>
      <div>${escapeHTML(empresaNome)}</div>
    </div>

    <div class="footer">
      <span>Excellence System® • Relatório gerado automaticamente</span>
      <span>${escapeHTML(formatNowBR())}</span>
    </div>
  </div>
  <script>setTimeout(() => window.print(), 450);</script>
</body>
</html>`;
}

async function getReportPayload() {
  const empresaId = await resolveEmpresaId();
  if (!empresaId) throw new Error('Não foi possível identificar a empresa para gerar o relatório.');
  const [empresa, diario, perfil] = await Promise.all([
    getEmpresa(empresaId),
    getDiarioData(empresaId),
    getPerfilAtual()
  ]);
  return {
    empresa: empresa || { id: empresaId, nome: 'Empresa' },
    config: diario.config,
    atividades: diario.atividades,
    perfil
  };
}

async function printDiarioReport() {
  const payload = await getReportPayload();
  const html = buildPrintReportHTML(payload);
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800');
  if (!printWindow) {
    throw new Error('O navegador bloqueou a janela de impressão. Libere pop-ups para este sistema.');
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function loadJsPdf() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-jspdf-loader]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.jspdf.jsPDF), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = JSPDF_URL;
    script.async = true;
    script.dataset.jspdfLoader = 'true';
    script.onload = () => window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('Biblioteca PDF não carregou.'));
    script.onerror = () => reject(new Error('Não foi possível carregar o gerador de PDF.'));
    document.head.appendChild(script);
  });
}

function addFooter(doc, pageNumber, totalPages) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(216, 231, 238);
  doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
  doc.setFontSize(8);
  doc.setTextColor(95, 118, 132);
  doc.text('Excellence System® • MPEDRO Consultoria e Treinamentos', 14, pageHeight - 9);
  doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - 14, pageHeight - 9, { align: 'right' });
}

function ensurePdfPage(doc, y, needed = 20, footerState) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed <= pageHeight - 22) return y;
  doc.addPage();
  footerState.page += 1;
  return 18;
}

function writeWrapped(doc, text, x, y, width, lineHeight = 5) {
  const lines = doc.splitTextToSize(String(text || '-'), width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

async function downloadDiarioPDF() {
  const payload = await getReportPayload();
  const { empresa, config, atividades, perfil } = payload;
  const summary = reportSummary(config, atividades);
  const jsPDF = await loadJsPdf();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const footerState = { page: 1 };

  doc.setFillColor(7, 63, 90);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Excellence System®', margin, 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('MPEDRO Consultoria e Treinamentos • ISO 9001:2015', margin, 23);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório do Diário de Bordo', pageWidth - margin, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em ${formatNowBR()}`, pageWidth - margin, 23, { align: 'right' });

  let y = 45;
  doc.setTextColor(7, 63, 90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(empresa?.nome || 'Empresa', margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(45, 71, 85);
  const empresaInfo = [
    `CNPJ: ${empresa?.cnpj || '-'}`,
    `Responsável: ${empresa?.responsavel || empresa?.responsavelNome || '-'}`,
    `Gerado por: ${perfil?.nome || auth.currentUser?.email || '-'}`
  ];
  empresaInfo.forEach(line => { doc.text(line, margin, y); y += 5; });
  y += 4;

  const cardW = (pageWidth - margin * 2 - 9) / 4;
  const cards = [
    ['Horas contratadas', minutesToHourLabel(summary.contratadasMin)],
    ['Horas utilizadas', minutesToHourLabel(summary.usadasMin)],
    ['Intervalos', minutesToHourLabel(summary.intervaloMin)],
    [summary.restantesMin < 0 ? 'Horas excedidas' : 'Saldo restante', minutesToHourLabel(Math.abs(summary.restantesMin))]
  ];
  cards.forEach((card, idx) => {
    const x = margin + idx * (cardW + 3);
    doc.setDrawColor(216, 231, 238);
    doc.setFillColor(247, 251, 253);
    doc.roundedRect(x, y, cardW, 22, 3, 3, 'FD');
    doc.setTextColor(95, 118, 132);
    doc.setFontSize(7.5);
    doc.text(card[0].toUpperCase(), x + 3, y + 7);
    doc.setTextColor(idx === 3 && summary.restantesMin < 0 ? 180 : 7, idx === 3 && summary.restantesMin < 0 ? 35 : 63, idx === 3 && summary.restantesMin < 0 ? 24 : 90);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(card[1], x + 3, y + 16);
    doc.setFont('helvetica', 'normal');
  });
  y += 32;

  doc.setTextColor(45, 71, 85);
  doc.setFontSize(9);
  const resumoText = `Progresso: ${summary.percentual}% das horas contratadas utilizadas. Período bruto registrado: ${minutesToHourLabel(summary.brutoMin)}. Intervalos/pausas sem desconto: ${minutesToHourLabel(summary.intervaloMin)}.`;
  y = writeWrapped(doc, resumoText, margin, y, pageWidth - margin * 2, 5) + 4;

  doc.setTextColor(7, 63, 90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Histórico completo de atividades', margin, y);
  y += 7;

  const tableX = margin;
  const tableW = pageWidth - margin * 2;
  const col = {
    n: 8,
    data: 20,
    hora: 28,
    bruto: 19,
    intervalo: 22,
    desc: 24
  };
  col.atividade = tableW - col.n - col.data - col.hora - col.bruto - col.intervalo - col.desc;

  function drawHeader() {
    doc.setFillColor(7, 63, 90);
    doc.rect(tableX, y, tableW, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    let x = tableX + 2;
    doc.text('#', x, y + 5.5); x += col.n;
    doc.text('Data', x, y + 5.5); x += col.data;
    doc.text('Atividade', x, y + 5.5); x += col.atividade;
    doc.text('Horário', x, y + 5.5); x += col.hora;
    doc.text('Bruto', x, y + 5.5); x += col.bruto;
    doc.text('Intervalo', x, y + 5.5); x += col.intervalo;
    doc.text('Descontado', x, y + 5.5);
    y += 8;
  }

  if (!atividades.length) {
    doc.setTextColor(95, 118, 132);
    doc.setFontSize(10);
    doc.text('Nenhuma atividade lançada no diário de bordo.', margin, y + 8);
    y += 20;
  } else {
    drawHeader();
    atividades.forEach((item, idx) => {
      const activityTitle = item.titulo || 'Atividade';
      const desc = item.descricao ? ` - ${item.descricao}` : '';
      const textLines = doc.splitTextToSize(`${activityTitle}${desc}`, col.atividade - 3);
      const rowH = Math.max(12, 5 + textLines.length * 4.2);
      y = ensurePdfPage(doc, y, rowH + 8, footerState);
      if (y === 18) drawHeader();

      doc.setFillColor(idx % 2 === 0 ? 255 : 247, idx % 2 === 0 ? 255 : 251, idx % 2 === 0 ? 255 : 253);
      doc.setDrawColor(216, 231, 238);
      doc.rect(tableX, y, tableW, rowH, 'FD');
      doc.setTextColor(45, 71, 85);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      let x = tableX + 2;
      doc.text(String(idx + 1), x, y + 5); x += col.n;
      doc.text(formatDateBR(item.data), x, y + 5); x += col.data;
      doc.text(textLines, x, y + 5); x += col.atividade;
      doc.text(`${item.inicio || '--:--'} às ${item.fim || '--:--'}`, x, y + 5); x += col.hora;
      doc.text(minutesToHourLabel(getActivityGrossMinutes(item)), x, y + 5); x += col.bruto;
      doc.text(minutesToHourLabel(getIntervalMinutes(item)), x, y + 5); x += col.intervalo;
      doc.setFont('helvetica', 'bold');
      doc.text(minutesToHourLabel(getActivityUsedMinutes(item)), x, y + 5);
      doc.setFont('helvetica', 'normal');
      y += rowH;
    });
  }

  y = ensurePdfPage(doc, y, 36, footerState);
  y += 14;
  doc.setDrawColor(18, 49, 66);
  doc.line(margin + 8, y, margin + 72, y);
  doc.line(pageWidth - margin - 72, y, pageWidth - margin - 8, y);
  doc.setFontSize(8.5);
  doc.setTextColor(45, 71, 85);
  doc.text('MPEDRO Consultoria e Treinamentos', margin + 40, y + 5, { align: 'center' });
  doc.text(empresa?.nome || 'Empresa', pageWidth - margin - 40, y + 5, { align: 'center' });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  const fileName = `diario-bordo-${safeFileName(empresa?.nome || 'empresa')}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

async function handleReportAction(type, button) {
  const original = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.innerHTML = type === 'pdf' ? 'Gerando PDF...' : 'Preparando impressão...';
  }

  try {
    if (type === 'pdf') await downloadDiarioPDF();
    else await printDiarioReport();
  } catch (error) {
    console.warn(error);
    if (type === 'pdf') {
      toastReport('Não consegui baixar o PDF direto. Vou abrir a versão de impressão para salvar como PDF.', 'error');
      await printDiarioReport();
    } else {
      toastReport(error?.message || 'Não foi possível imprimir o relatório agora.', 'error');
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = original;
    }
  }
}

function injectReportButtons() {
  const modal = document.querySelector('.diario-modal');
  if (!modal || modal.querySelector('#diarioReportActions')) return;
  const header = modal.querySelector('.diario-header');
  const closeBtn = modal.querySelector('[data-diario-close]');
  if (!header || !closeBtn) return;

  const actions = document.createElement('div');
  actions.id = 'diarioReportActions';
  actions.className = 'diario-report-actions';
  actions.innerHTML = `
    <button class="btn btn-small btn-soft" type="button" data-diario-print-report>Imprimir relatório</button>
    <button class="btn btn-small btn-gold" type="button" data-diario-download-pdf>Baixar PDF</button>
  `;
  closeBtn.insertAdjacentElement('beforebegin', actions);

  actions.querySelector('[data-diario-print-report]')?.addEventListener('click', (event) => {
    handleReportAction('print', event.currentTarget);
  });
  actions.querySelector('[data-diario-download-pdf]')?.addEventListener('click', (event) => {
    handleReportAction('pdf', event.currentTarget);
  });
}

function injectReportStyles() {
  if (document.getElementById('diarioReportStyles')) return;
  const style = document.createElement('style');
  style.id = 'diarioReportStyles';
  style.textContent = `
    .diario-report-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end;margin-left:auto}
    @media(max-width:900px){.diario-report-actions{width:100%;justify-content:flex-start}.diario-header .btn[data-diario-close]{align-self:flex-start}}
  `;
  document.head.appendChild(style);
}

function enhanceReports() {
  injectReportStyles();
  injectReportButtons();
}

const observer = new MutationObserver(() => window.requestAnimationFrame(enhanceReports));
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('load', enhanceReports);
document.addEventListener('click', () => setTimeout(enhanceReports, 120));

console.info(`Excellence System® relatório do diário ${DIARIO_REPORT_VERSION} carregado.`);
