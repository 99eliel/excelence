(function () {
  const PATCH_VERSION = '20260815-70';

  function esc(value = '') {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function text(el) {
    return String(el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function moneyText(value) {
    const txt = String(value || '').trim();
    return txt || 'R$ 0,00';
  }

  function dateBR(value) {
    const raw = String(value || '').trim();
    if (!raw) return 'Todos';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-');
      return `${d}/${m}/${y}`;
    }
    return raw;
  }

  function selectedText(selector) {
    const el = document.querySelector(selector);
    if (!el) return 'Todos';
    if (el.tagName === 'SELECT') {
      return text(el.selectedOptions?.[0]) || 'Todos';
    }
    return el.value ? dateBR(el.value) : 'Todos';
  }

  function logoUrl() {
    try {
      return new URL(`logo.png?v=${PATCH_VERSION}`, window.location.href).href;
    } catch (_) {
      return `logo.png?v=${PATCH_VERSION}`;
    }
  }

  function getCompanyName() {
    const pill = document.querySelector('.v68-hero .v68-pill.light');
    const fromPill = text(pill).replace(/^Empresa:\s*/i, '').trim();
    if (fromPill) return fromPill;
    const heroP = text(document.querySelector('.v68-hero p'));
    if (heroP.includes('—')) return heroP.split('—')[0].trim();
    return 'Empresa';
  }

  function getPeriodText() {
    const start = selectedText('[data-r-start]');
    const end = selectedText('[data-r-end]');
    if (start === 'Todos' && end === 'Todos') return 'Todos os períodos';
    return `${start} até ${end}`;
  }

  function collectMetrics(reportRoot) {
    const source = reportRoot.querySelector('.v68-metrics') || document.querySelector('.v68-metrics');
    if (!source) return [];
    return Array.from(source.querySelectorAll('.v68-metric')).map(card => ({
      label: text(card.querySelector('small')),
      value: text(card.querySelector('strong'))
    })).filter(item => item.label || item.value);
  }

  function cloneReportTable(reportRoot) {
    const table = reportRoot.querySelector('.v68-table');
    if (!table) {
      return '<div class="empty-box">Nenhum lançamento encontrado para o filtro selecionado.</div>';
    }
    const clone = table.cloneNode(true);
    clone.classList.add('print-table');
    clone.querySelectorAll('button, input, select, textarea').forEach(el => el.remove());
    clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
    return clone.outerHTML;
  }

  function cloneTotals(reportRoot) {
    const total = reportRoot.querySelector('.v68-total');
    if (!total) return '';
    const clone = total.cloneNode(true);
    clone.className = 'total-box';
    clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
    return clone.outerHTML;
  }

  function buildHTML(reportRoot) {
    const company = getCompanyName();
    const generatedAt = new Date().toLocaleString('pt-BR');
    const process = selectedText('[data-r-prod]');
    const team = selectedText('[data-r-eq]');
    const worker = selectedText('[data-r-func]');
    const metrics = collectMetrics(reportRoot);
    const table = cloneReportTable(reportRoot);
    const totals = cloneTotals(reportRoot);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Apontamento</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #0d2d3d;
      background: #fff;
      font-size: 11px;
    }
    .report-page { width: 100%; }
    .report-header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 18px;
      align-items: center;
      border-bottom: 3px solid #073F5A;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand img {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      object-fit: contain;
      background: #073F5A;
      box-shadow: 0 8px 20px rgba(7, 63, 90, .20);
    }
    .brand small {
      display: block;
      margin-top: 2px;
      color: #607788;
      font-weight: 700;
    }
    .brand h1 {
      margin: 0;
      font-size: 24px;
      color: #073F5A;
      line-height: 1.05;
    }
    .doc-meta {
      text-align: right;
      color: #607788;
      font-weight: 700;
      line-height: 1.45;
    }
    .hero {
      background: linear-gradient(135deg, #073F5A, #0b5678);
      color: #fff;
      border-radius: 18px;
      padding: 14px 16px;
      margin-bottom: 12px;
    }
    .hero .kicker {
      display: block;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-size: 10px;
      opacity: .86;
      font-weight: 900;
      margin-bottom: 4px;
    }
    .hero h2 {
      margin: 0 0 4px;
      font-size: 20px;
      color: #fff;
    }
    .hero p { margin: 0; opacity: .9; }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .info-card, .metric-card {
      border: 1px solid #d8e5ea;
      border-radius: 12px;
      padding: 9px 10px;
      background: #f8fbfc;
      min-height: 50px;
    }
    .info-card small, .metric-card small {
      display: block;
      color: #607788;
      font-weight: 900;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .04em;
      margin-bottom: 4px;
    }
    .info-card strong, .metric-card strong {
      display: block;
      color: #073F5A;
      font-size: 12px;
      line-height: 1.25;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .metric-card {
      background: #fff;
      border-color: #cfe0e7;
    }
    .metric-card strong {
      font-size: 18px;
    }
    .section-title {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 12px;
      margin: 12px 0 8px;
    }
    .section-title h3 {
      margin: 0;
      font-size: 15px;
      color: #073F5A;
    }
    .section-title span {
      color: #607788;
      font-weight: 800;
    }
    table.print-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #d8e5ea;
      border-radius: 12px;
      overflow: hidden;
      font-size: 10px;
    }
    .print-table th {
      background: #073F5A;
      color: #fff;
      padding: 8px 7px;
      text-align: left;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .03em;
    }
    .print-table td {
      padding: 7px;
      border-bottom: 1px solid #e4eef2;
      vertical-align: top;
    }
    .print-table tr:nth-child(even) td { background: #f8fbfc; }
    .total-box {
      border: 1px solid rgba(214,168,66,.55);
      border-radius: 14px;
      background: rgba(214,168,66,.09);
      padding: 10px 12px;
      margin-top: 12px;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .total-box .v68-line {
      display: grid;
      gap: 3px;
      font-weight: 900;
    }
    .total-box span {
      color: #8a6415;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .total-box b { color: #073F5A; font-size: 13px; }
    .empty-box {
      border: 1px dashed #cfe0e7;
      border-radius: 14px;
      padding: 22px;
      text-align: center;
      color: #607788;
      font-weight: 800;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
      margin-top: 34px;
      page-break-inside: avoid;
    }
    .signature-line {
      border-top: 1px solid #9fb5bf;
      padding-top: 6px;
      text-align: center;
      color: #607788;
      font-weight: 800;
    }
    .footer {
      margin-top: 16px;
      border-top: 1px solid #d8e5ea;
      padding-top: 8px;
      color: #607788;
      font-size: 9px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .report-page { page-break-after: auto; }
    }
  </style>
</head>
<body>
  <main class="report-page">
    <header class="report-header">
      <div class="brand">
        <img src="${esc(logoUrl())}" alt="Excellence System®">
        <div>
          <h1>Excellence System®</h1>
          <small>MP Consultoria • Sistema de Gestão da Qualidade</small>
        </div>
      </div>
      <div class="doc-meta">
        Relatório de Apontamento<br>
        Gerado em ${esc(generatedAt)}<br>
        Versão ${PATCH_VERSION}
      </div>
    </header>

    <section class="hero">
      <span class="kicker">Apontamento de produção</span>
      <h2>Relatório de produção, horas e rendimento</h2>
      <p>Resumo consolidado conforme os filtros aplicados no sistema.</p>
    </section>

    <section class="info-grid">
      <div class="info-card"><small>Empresa</small><strong>${esc(company)}</strong></div>
      <div class="info-card"><small>Período</small><strong>${esc(getPeriodText())}</strong></div>
      <div class="info-card"><small>Processo</small><strong>${esc(process)}</strong></div>
      <div class="info-card"><small>Equipe/célula</small><strong>${esc(team)}</strong></div>
      <div class="info-card"><small>Funcionário</small><strong>${esc(worker)}</strong></div>
      <div class="info-card"><small>Origem</small><strong>Excellence System®</strong></div>
    </section>

    <section class="metric-grid">
      ${metrics.map(m => `<div class="metric-card"><small>${esc(m.label)}</small><strong>${esc(moneyText(m.value))}</strong></div>`).join('')}
    </section>

    <section>
      <div class="section-title">
        <h3>Lançamentos do período</h3>
        <span>${esc(company)}</span>
      </div>
      ${table}
      ${totals}
    </section>

    <section class="signatures">
      <div class="signature-line">Responsável pela empresa</div>
      <div class="signature-line">MP Consultoria</div>
    </section>

    <footer class="footer">
      <span>Relatório gerado automaticamente pelo Excellence System®.</span>
      <span>Documento para conferência interna.</span>
    </footer>
  </main>
</body>
</html>`;
  }

  function printHTML(html) {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Relatório de apontamento');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = win.document;
    doc.open();
    doc.write(html);
    doc.close();

    const cleanup = () => setTimeout(() => iframe.remove(), 1200);
    win.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch (error) {
        console.error('Erro ao imprimir relatório de apontamento:', error);
        iframe.remove();
        window.print();
      }
    }, 350);
  }

  document.addEventListener('click', event => {
    const btn = event.target.closest?.('[data-print]');
    if (!btn) return;

    const reportRoot = btn.closest('[data-report]');
    const apontamentoAberto = btn.closest('.v68') || document.querySelector('[data-v68]');
    if (!reportRoot || !apontamentoAberto) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    printHTML(buildHTML(reportRoot));
  }, true);

  console.info(`Excellence System® impressão caprichada do apontamento ${PATCH_VERSION} carregada.`);
})();
