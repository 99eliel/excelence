(function () {
  const PATCH_VERSION = '20260820-73';
  const STYLE_ID = 'apontamento-mix-report-v73-css';

  const esc = (value = '') => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const text = el => String(el?.textContent || '').replace(/\s+/g, ' ').trim();

  function parseBRNumber(value) {
    const raw = String(value ?? '').trim().replace(/\s/g, '');
    if (!raw) return 0;
    const normalized = raw.includes(',')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/[^0-9.-]/g, '');
    const number = Number(normalized.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(number) ? number : 0;
  }

  function formatNumber(value, max = 2) {
    return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: max });
  }

  function formatPercent(value) {
    return `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .v73-mix-section {
        border: 1px solid var(--line, #d8e5ea);
        border-radius: 22px;
        padding: 18px;
        background: linear-gradient(180deg, #ffffff, #fbfdfe);
        box-shadow: 0 14px 32px rgba(5, 36, 55, .07);
        display: grid;
        gap: 16px;
      }

      .v73-mix-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
      }

      .v73-mix-header h3 {
        margin: 3px 0 4px;
        color: #073F5A;
        font-size: 21px;
      }

      .v73-mix-header p {
        margin: 0;
        color: var(--muted, #607788);
      }

      .v73-mix-total {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(214, 168, 66, .14);
        color: #8a6415;
        font-weight: 900;
        white-space: nowrap;
      }

      .v73-mix-kpis {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .v73-mix-kpi {
        border: 1px solid #d8e5ea;
        border-radius: 16px;
        background: #fff;
        padding: 12px 14px;
      }

      .v73-mix-kpi small {
        display: block;
        color: #607788;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .04em;
        font-size: 10px;
        margin-bottom: 4px;
      }

      .v73-mix-kpi strong {
        display: block;
        color: #073F5A;
        font-size: 18px;
        line-height: 1.2;
      }

      .v73-mix-kpi span {
        display: block;
        margin-top: 3px;
        color: #607788;
        font-size: 12px;
      }

      .v73-chart-card {
        border: 1px solid #d8e5ea;
        border-radius: 18px;
        background: #fff;
        padding: 16px;
      }

      .v73-chart-title {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      .v73-chart-title h4 {
        margin: 0;
        color: #073F5A;
        font-size: 16px;
      }

      .v73-chart-title span {
        color: #607788;
        font-size: 12px;
        font-weight: 800;
      }

      .v73-bars {
        display: grid;
        gap: 11px;
      }

      .v73-bar-row {
        display: grid;
        grid-template-columns: minmax(150px, 1.2fr) minmax(180px, 3fr) 82px;
        gap: 12px;
        align-items: center;
      }

      .v73-bar-name {
        min-width: 0;
      }

      .v73-bar-name strong {
        display: block;
        color: #153847;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .v73-bar-name small {
        color: #607788;
        font-weight: 800;
      }

      .v73-bar-track {
        height: 15px;
        border-radius: 999px;
        background: #eaf1f4;
        overflow: hidden;
        box-shadow: inset 0 1px 2px rgba(5, 36, 55, .06);
      }

      .v73-bar-fill {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #073F5A, #0c719b);
        min-width: 3px;
      }

      .v73-bar-row:first-child .v73-bar-fill {
        background: linear-gradient(90deg, #b88518, #d6a842);
      }

      .v73-bar-percent {
        text-align: right;
        color: #073F5A;
        font-size: 14px;
        font-weight: 900;
      }

      .v73-mix-table-wrap {
        overflow: auto;
        border: 1px solid #d8e5ea;
        border-radius: 16px;
      }

      .v73-mix-table {
        width: 100%;
        border-collapse: collapse;
        background: #fff;
        min-width: 560px;
      }

      .v73-mix-table th,
      .v73-mix-table td {
        padding: 10px 12px;
        border-bottom: 1px solid #e4eef2;
        text-align: left;
      }

      .v73-mix-table th {
        background: #f3f8fb;
        color: #073F5A;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: .03em;
      }

      .v73-mix-table td:nth-child(1),
      .v73-mix-table th:nth-child(1) {
        width: 54px;
        text-align: center;
      }

      .v73-mix-table td:nth-child(3),
      .v73-mix-table td:nth-child(4),
      .v73-mix-table th:nth-child(3),
      .v73-mix-table th:nth-child(4) {
        text-align: right;
        white-space: nowrap;
      }

      .v73-share-badge {
        display: inline-flex;
        justify-content: center;
        min-width: 66px;
        padding: 5px 8px;
        border-radius: 999px;
        background: rgba(7, 63, 90, .08);
        color: #073F5A;
        font-weight: 900;
      }

      @media (max-width: 800px) {
        .v73-mix-kpis { grid-template-columns: 1fr; }
        .v73-bar-row { grid-template-columns: 1fr 70px; gap: 6px 10px; }
        .v73-bar-track { grid-column: 1 / -1; grid-row: 2; }
        .v73-bar-percent { grid-column: 2; grid-row: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  function collectMix(reportRoot) {
    const rows = Array.from(reportRoot.querySelectorAll('.v68-table tbody tr'));
    const grouped = new Map();

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 4) return;
      const name = text(cells[1]) || 'Peça sem identificação';
      const quantity = parseBRNumber(text(cells[3]));
      if (!(quantity > 0)) return;
      grouped.set(name, (grouped.get(name) || 0) + quantity);
    });

    const total = Array.from(grouped.values()).reduce((sum, value) => sum + value, 0);
    const entries = Array.from(grouped.entries())
      .map(([name, quantity]) => ({
        name,
        quantity,
        percentage: total > 0 ? (quantity / total) * 100 : 0
      }))
      .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'pt-BR'));

    return { total, entries };
  }

  function mixHTML(entries, total) {
    if (!entries.length || !(total > 0)) return '';

    const leader = entries[0];
    const top3 = entries.slice(0, 3).reduce((sum, item) => sum + item.percentage, 0);

    return `
      <section class="v73-mix-section" data-v73-mix>
        <div class="v73-mix-header">
          <div>
            <span class="kicker">Visão empresarial</span>
            <h3>Mix de produção por peça</h3>
            <p>Todas as peças produzidas no período e quanto cada uma representa do volume total filtrado.</p>
          </div>
          <span class="v73-mix-total">${formatNumber(total)} peças no total</span>
        </div>

        <div class="v73-mix-kpis">
          <div class="v73-mix-kpi">
            <small>Peças/modelos diferentes</small>
            <strong>${entries.length}</strong>
            <span>Itens que tiveram produção no filtro atual.</span>
          </div>
          <div class="v73-mix-kpi">
            <small>Maior participação</small>
            <strong>${esc(leader.name)}</strong>
            <span>${formatNumber(leader.quantity)} peças • ${formatPercent(leader.percentage)}</span>
          </div>
          <div class="v73-mix-kpi">
            <small>Concentração Top 3</small>
            <strong>${formatPercent(top3)}</strong>
            <span>Participação conjunta das três peças mais produzidas.</span>
          </div>
        </div>

        <div class="v73-chart-card">
          <div class="v73-chart-title">
            <h4>Participação no volume produzido</h4>
            <span>Percentual sobre ${formatNumber(total)} peças</span>
          </div>
          <div class="v73-bars">
            ${entries.map((item, index) => `
              <div class="v73-bar-row">
                <div class="v73-bar-name">
                  <strong title="${esc(item.name)}">${index + 1}. ${esc(item.name)}</strong>
                  <small>${formatNumber(item.quantity)} peça(s)</small>
                </div>
                <div class="v73-bar-track" aria-label="${esc(item.name)}: ${formatPercent(item.percentage)}">
                  <div class="v73-bar-fill" style="width:${Math.max(0, Math.min(100, item.percentage)).toFixed(3)}%"></div>
                </div>
                <div class="v73-bar-percent">${formatPercent(item.percentage)}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="v73-mix-table-wrap">
          <table class="v73-mix-table">
            <thead>
              <tr><th>#</th><th>Peça / produto</th><th>Quantidade</th><th>Participação</th></tr>
            </thead>
            <tbody>
              ${entries.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${esc(item.name)}</strong></td>
                  <td>${formatNumber(item.quantity)}</td>
                  <td><span class="v73-share-badge">${formatPercent(item.percentage)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function enhanceReport(reportRoot) {
    if (!reportRoot || reportRoot.querySelector('[data-v73-mix]')) return;
    const { entries, total } = collectMix(reportRoot);
    if (!entries.length) return;

    const resultCard = reportRoot.querySelector('.v68-card');
    if (!resultCard) return;

    resultCard.insertAdjacentHTML('beforebegin', mixHTML(entries, total));
  }

  function enhanceAllReports() {
    document.querySelectorAll('[data-report]').forEach(enhanceReport);
  }

  function selectedText(selector) {
    const el = document.querySelector(selector);
    if (!el) return 'Todos';
    if (el.tagName === 'SELECT') return text(el.selectedOptions?.[0]) || 'Todos';
    const value = String(el.value || '').trim();
    if (!value) return 'Todos';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-');
      return `${day}/${month}/${year}`;
    }
    return value;
  }

  function companyName() {
    const pill = document.querySelector('.v68-hero .v68-pill.light');
    const fromPill = text(pill).replace(/^Empresa:\s*/i, '').trim();
    if (fromPill) return fromPill;
    return 'Empresa';
  }

  function periodText() {
    const start = selectedText('[data-r-start]');
    const end = selectedText('[data-r-end]');
    if (start === 'Todos' && end === 'Todos') return 'Todos os períodos';
    return `${start} até ${end}`;
  }

  function logoUrl() {
    try {
      return new URL(`logo.png?v=${PATCH_VERSION}`, window.location.href).href;
    } catch (_) {
      return `logo.png?v=${PATCH_VERSION}`;
    }
  }

  function collectMetrics(reportRoot) {
    const source = reportRoot.querySelector('.v68-metrics');
    if (!source) return [];
    return Array.from(source.querySelectorAll('.v68-metric')).map(card => ({
      label: text(card.querySelector('small')),
      value: text(card.querySelector('strong'))
    })).filter(item => item.label || item.value);
  }

  function cloneLaunchTable(reportRoot) {
    const table = reportRoot.querySelector('.v68-table');
    if (!table) return '<div class="empty">Nenhum lançamento encontrado.</div>';
    const clone = table.cloneNode(true);
    clone.className = 'launch-table';
    clone.querySelectorAll('button, input, select, textarea').forEach(el => el.remove());
    clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
    return clone.outerHTML;
  }

  function cloneTotals(reportRoot) {
    const total = reportRoot.querySelector('.v68-total');
    if (!total) return '';
    const clone = total.cloneNode(true);
    clone.className = 'totals';
    clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
    return clone.outerHTML;
  }

  function printMixHTML(entries, total) {
    if (!entries.length) return '';
    const leader = entries[0];
    const top3 = entries.slice(0, 3).reduce((sum, item) => sum + item.percentage, 0);

    return `
      <section class="mix-section">
        <div class="section-head">
          <div>
            <span class="eyebrow">Visão empresarial</span>
            <h3>Mix de produção por peça</h3>
            <p>Todas as peças produzidas e a participação de cada uma no volume total do período.</p>
          </div>
          <strong class="total-pill">${formatNumber(total)} peças</strong>
        </div>

        <div class="mix-kpis">
          <div><small>Peças/modelos</small><strong>${entries.length}</strong></div>
          <div><small>Líder do período</small><strong>${esc(leader.name)}</strong><span>${formatPercent(leader.percentage)}</span></div>
          <div><small>Top 3</small><strong>${formatPercent(top3)}</strong><span>do volume produzido</span></div>
        </div>

        <div class="mix-layout">
          <div class="bars">
            ${entries.map((item, index) => `
              <div class="bar-row">
                <div class="bar-label"><strong>${index + 1}. ${esc(item.name)}</strong><small>${formatNumber(item.quantity)} peça(s)</small></div>
                <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, item.percentage)).toFixed(3)}%"></div></div>
                <b>${formatPercent(item.percentage)}</b>
              </div>
            `).join('')}
          </div>

          <table class="mix-table">
            <thead><tr><th>#</th><th>Peça / produto</th><th>Qtd.</th><th>%</th></tr></thead>
            <tbody>${entries.map((item, index) => `<tr><td>${index + 1}</td><td>${esc(item.name)}</td><td>${formatNumber(item.quantity)}</td><td>${formatPercent(item.percentage)}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function buildPrintHTML(reportRoot) {
    const { entries, total } = collectMix(reportRoot);
    const metrics = collectMetrics(reportRoot);
    const generatedAt = new Date().toLocaleString('pt-BR');
    const company = companyName();

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Apontamento - ${esc(company)}</title>
  <style>
    @page { size: A4 landscape; margin: 9mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #153847; background: #fff; font-size: 10px; }
    .page { width: 100%; }
    .header { display: flex; justify-content: space-between; gap: 20px; align-items: center; border-bottom: 3px solid #073F5A; padding-bottom: 10px; margin-bottom: 12px; }
    .brand { display: flex; gap: 11px; align-items: center; }
    .brand img { width: 50px; height: 50px; object-fit: contain; border-radius: 14px; background: #073F5A; }
    .brand h1 { margin: 0; color: #073F5A; font-size: 22px; }
    .brand small { color: #607788; font-weight: 700; }
    .doc-meta { text-align: right; color: #607788; font-weight: 700; line-height: 1.45; }
    .hero { background: linear-gradient(135deg, #073F5A, #0b5678); color: #fff; border-radius: 16px; padding: 12px 15px; margin-bottom: 10px; }
    .hero h2 { margin: 2px 0 4px; color: #fff; font-size: 18px; }
    .hero p { margin: 0; opacity: .9; }
    .eyebrow { display: block; font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; opacity: .82; }
    .filters { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 7px; margin-bottom: 10px; }
    .filter, .metric { border: 1px solid #d8e5ea; border-radius: 10px; padding: 8px 9px; background: #f8fbfc; }
    .filter small, .metric small, .mix-kpis small { display: block; color: #607788; font-weight: 900; text-transform: uppercase; font-size: 8px; letter-spacing: .04em; margin-bottom: 3px; }
    .filter strong { color: #073F5A; font-size: 10px; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin-bottom: 11px; }
    .metric { background: #fff; }
    .metric strong { display: block; color: #073F5A; font-size: 16px; }
    .mix-section { border: 1px solid #cfe0e7; border-radius: 14px; padding: 11px; margin: 11px 0 13px; background: #fbfdfe; }
    .section-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 8px; }
    .section-head h3 { margin: 2px 0 2px; color: #073F5A; font-size: 15px; }
    .section-head p { margin: 0; color: #607788; }
    .total-pill { padding: 6px 9px; border-radius: 999px; background: #f7ecd0; color: #8a6415; white-space: nowrap; }
    .mix-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-bottom: 9px; }
    .mix-kpis > div { border: 1px solid #d8e5ea; border-radius: 9px; padding: 7px 8px; background: #fff; }
    .mix-kpis strong { display: block; color: #073F5A; font-size: 12px; }
    .mix-kpis span { color: #607788; font-size: 8px; }
    .mix-layout { display: grid; grid-template-columns: 1.35fr .9fr; gap: 10px; align-items: start; }
    .bars { display: grid; gap: 5px; }
    .bar-row { display: grid; grid-template-columns: minmax(110px, 1.15fr) minmax(150px, 2.6fr) 44px; gap: 6px; align-items: center; page-break-inside: avoid; }
    .bar-label { min-width: 0; }
    .bar-label strong { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 8.5px; }
    .bar-label small { color: #607788; font-size: 7.5px; }
    .bar-track { height: 9px; background: #eaf1f4; border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; min-width: 2px; border-radius: inherit; background: linear-gradient(90deg, #073F5A, #0c719b); }
    .bar-row:first-child .bar-fill { background: linear-gradient(90deg, #b88518, #d6a842); }
    .bar-row > b { text-align: right; color: #073F5A; font-size: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #073F5A; color: #fff; padding: 6px; text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: .03em; }
    td { padding: 5.5px 6px; border-bottom: 1px solid #e4eef2; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fbfc; }
    .mix-table { font-size: 8px; border: 1px solid #d8e5ea; }
    .mix-table th:nth-child(1), .mix-table td:nth-child(1) { width: 28px; text-align: center; }
    .mix-table th:nth-child(3), .mix-table td:nth-child(3), .mix-table th:nth-child(4), .mix-table td:nth-child(4) { text-align: right; white-space: nowrap; }
    .launch-title { display: flex; justify-content: space-between; align-items: end; margin: 11px 0 6px; }
    .launch-title h3 { margin: 0; color: #073F5A; font-size: 13px; }
    .launch-title span { color: #607788; font-weight: 800; }
    .launch-table { border: 1px solid #d8e5ea; font-size: 8px; }
    .totals { margin-top: 8px; padding: 8px 10px; border: 1px solid #e6c77f; border-radius: 10px; background: #fcf7ea; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
    .totals .v68-line { display: grid; gap: 2px; }
    .totals span { color: #8a6415; text-transform: uppercase; font-size: 7px; font-weight: 900; }
    .totals b { color: #073F5A; font-size: 11px; }
    .footer { margin-top: 12px; padding-top: 7px; border-top: 1px solid #d8e5ea; display: flex; justify-content: space-between; color: #607788; font-size: 8px; }
    .empty { padding: 16px; border: 1px dashed #cfe0e7; text-align: center; color: #607788; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div class="brand">
        <img src="${esc(logoUrl())}" alt="Excellence System®">
        <div><h1>Excellence System®</h1><small>MP Consultoria • Relatório gerencial de produção</small></div>
      </div>
      <div class="doc-meta">Relatório de Apontamento<br>${esc(company)}<br>Gerado em ${esc(generatedAt)}</div>
    </header>

    <section class="hero">
      <span class="eyebrow">Produção e composição</span>
      <h2>Apontamento de produção</h2>
      <p>Visão consolidada de volume, horas, rendimento e participação de cada peça no período selecionado.</p>
    </section>

    <section class="filters">
      <div class="filter"><small>Período</small><strong>${esc(periodText())}</strong></div>
      <div class="filter"><small>Processo</small><strong>${esc(selectedText('[data-r-prod]'))}</strong></div>
      <div class="filter"><small>Equipe/célula</small><strong>${esc(selectedText('[data-r-eq]'))}</strong></div>
      <div class="filter"><small>Funcionário</small><strong>${esc(selectedText('[data-r-func]'))}</strong></div>
      <div class="filter"><small>Empresa</small><strong>${esc(company)}</strong></div>
    </section>

    <section class="metrics">
      ${metrics.map(item => `<div class="metric"><small>${esc(item.label)}</small><strong>${esc(item.value)}</strong></div>`).join('')}
    </section>

    ${printMixHTML(entries, total)}

    <div class="launch-title"><h3>Lançamentos detalhados do período</h3><span>${entries.length} peça(s)/modelo(s) no mix</span></div>
    ${cloneLaunchTable(reportRoot)}
    ${cloneTotals(reportRoot)}

    <footer class="footer">
      <span>Relatório gerado automaticamente pelo Excellence System®.</span>
      <span>Mix calculado sobre a quantidade total produzida nos filtros selecionados.</span>
    </footer>
  </main>
</body>
</html>`;
  }

  function printReport(reportRoot) {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Relatório gerencial de apontamento');
    Object.assign(iframe.style, {
      position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', opacity: '0'
    });
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = win.document;
    doc.open();
    doc.write(buildPrintHTML(reportRoot));
    doc.close();

    const cleanup = () => setTimeout(() => iframe.remove(), 1200);
    win.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch (error) {
        console.error('Erro ao imprimir relatório gerencial do apontamento:', error);
        iframe.remove();
      }
    }, 350);
  }

  injectStyles();

  const observer = new MutationObserver(() => enhanceAllReports());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhanceAllReports();

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-print]');
    if (!button) return;
    const reportRoot = button.closest('[data-report]');
    if (!reportRoot || !button.closest('.v68')) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    enhanceReport(reportRoot);
    printReport(reportRoot);
  }, true);

  console.info(`Excellence System® mix gerencial do apontamento ${PATCH_VERSION} carregado.`);
})();
