(function () {
  const V = '20260820-76';

  const text = el => String(el?.textContent || '').replace(/\s+/g, ' ').trim();
  const esc = (value = '') => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function selectedText(selector) {
    const el = document.querySelector(selector);
    if (!el) return 'Todos';
    if (el.tagName === 'SELECT') return text(el.selectedOptions?.[0]) || 'Todos';
    const value = String(el.value || '').trim();
    if (!value) return 'Todos';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      return `${d}/${m}/${y}`;
    }
    return value;
  }

  function companyName() {
    const pill = document.querySelector('.v68-hero .v68-pill.light');
    const value = text(pill).replace(/^Empresa:\s*/i, '').trim();
    if (value) return value;
    const hero = text(document.querySelector('.v68-hero p'));
    return hero.includes('—') ? hero.split('—')[0].trim() : 'Empresa';
  }

  function logoUrl() {
    try { return new URL(`logo.png?v=${V}`, location.href).href; }
    catch (_) { return `logo.png?v=${V}`; }
  }

  function cloneReport(root) {
    const clone = root.cloneNode(true);
    clone.classList.add('compact-root');
    clone.querySelectorAll('button,input,select,textarea').forEach(el => el.remove());
    clone.querySelectorAll('.v73-mix-table-wrap').forEach(el => el.remove());

    // Mantém as barras e percentuais, mas elimina sombras/transições irrelevantes na impressão.
    clone.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style') || '';
      if (!/width\s*:|height\s*:/i.test(style)) el.removeAttribute('style');
    });

    const resultCard = clone.querySelector('.v68-card');
    if (resultCard) resultCard.classList.add('compact-detail-card');
    return clone.outerHTML;
  }

  function buildHTML(root) {
    const company = companyName();
    const generated = new Date().toLocaleString('pt-BR');
    const filters = [
      ['Período', `${selectedText('[data-r-start]')} até ${selectedText('[data-r-end]')}`],
      ['Processo', selectedText('[data-r-prod]')],
      ['Equipe / célula', selectedText('[data-r-eq]')],
      ['Funcionário', selectedText('[data-r-func]')]
    ];

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Relatório Gerencial de Apontamento</title>
<style>
  @page { size: A4 landscape; margin: 5mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Arial, Helvetica, sans-serif; color: #173846; font-size: 7.4px; line-height: 1.18; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 100%; }

  .print-head { display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:2px solid #073F5A; padding:0 0 5px; margin-bottom:5px; }
  .brand { display:flex; align-items:center; gap:7px; }
  .brand img { width:32px; height:32px; object-fit:contain; border-radius:8px; background:#073F5A; }
  .brand h1 { margin:0; font-size:15px; color:#073F5A; line-height:1; }
  .brand small { display:block; color:#607788; font-weight:700; margin-top:2px; font-size:6.6px; }
  .meta { text-align:right; color:#607788; font-weight:700; font-size:6.5px; line-height:1.3; }

  .report-title { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:5px 7px; border-radius:8px; background:#073F5A; color:#fff; margin-bottom:5px; }
  .report-title h2 { margin:0; font-size:12px; color:#fff; }
  .report-title span { color:#d9edf4; font-weight:800; font-size:6.7px; }

  .filter-strip { display:grid; grid-template-columns:1.35fr 1fr 1fr 1fr; gap:4px; margin-bottom:5px; }
  .filter { border:1px solid #d7e4e9; border-radius:6px; padding:3px 5px; min-height:26px; background:#f8fbfc; }
  .filter small { display:block; color:#607788; text-transform:uppercase; font-weight:900; font-size:5.7px; letter-spacing:.03em; margin-bottom:1px; }
  .filter strong { display:block; color:#073F5A; font-size:7px; white-space:normal; }

  /* Estrutura geral do relatório clonado */
  .compact-root { display:grid !important; gap:5px !important; }
  .compact-root .kicker { font-size:5.8px !important; letter-spacing:.05em !important; }
  .compact-root p { margin:1px 0 !important; font-size:6.4px !important; line-height:1.18 !important; }

  /* KPIs gerais */
  .compact-root .v68-metrics { display:grid !important; grid-template-columns:repeat(4,1fr) !important; gap:4px !important; margin:0 !important; }
  .compact-root .v68-metric { border:1px solid #d7e4e9 !important; border-radius:6px !important; padding:4px 6px !important; min-height:31px !important; background:#fff !important; box-shadow:none !important; }
  .compact-root .v68-metric small { display:block !important; color:#607788 !important; font-size:5.8px !important; font-weight:900 !important; margin-bottom:1px !important; }
  .compact-root .v68-metric strong { color:#073F5A !important; font-size:11px !important; line-height:1 !important; }

  /* Média diária mensal */
  .compact-root .v74-daily { display:grid !important; gap:4px !important; padding:6px !important; border:1px solid #cfdfe5 !important; border-radius:8px !important; background:#fbfdfe !important; box-shadow:none !important; break-inside:auto; }
  .compact-root .v74-head { display:flex !important; justify-content:space-between !important; align-items:flex-start !important; gap:8px !important; }
  .compact-root .v74-head h3 { margin:0 !important; font-size:10px !important; color:#073F5A !important; }
  .compact-root .v74-note { padding:3px 6px !important; border-radius:999px !important; font-size:6px !important; background:#eef5f7 !important; color:#073F5A !important; }
  .compact-root .v74-kpis { display:grid !important; grid-template-columns:repeat(4,1fr) !important; gap:3px !important; }
  .compact-root .v74-kpi { padding:4px 5px !important; min-height:34px !important; border-radius:6px !important; border:1px solid #d7e4e9 !important; box-shadow:none !important; }
  .compact-root .v74-kpi small { font-size:5.3px !important; margin-bottom:1px !important; }
  .compact-root .v74-kpi strong { font-size:9px !important; line-height:1 !important; }
  .compact-root .v74-kpi span { font-size:5.7px !important; margin-top:2px !important; }
  .compact-root .v74-kpi.accent { background:#073F5A !important; }
  .compact-root .v74-kpi.accent strong { color:#f0b23e !important; font-size:12px !important; }

  .compact-root .v74-chart-card { padding:4px 5px !important; border:1px solid #d7e4e9 !important; border-radius:6px !important; box-shadow:none !important; }
  .compact-root .v74-chart-title { display:flex !important; justify-content:space-between !important; margin:0 0 2px !important; }
  .compact-root .v74-chart-title h4 { margin:0 !important; font-size:7.5px !important; color:#073F5A !important; }
  .compact-root .v74-chart-title span { font-size:5.5px !important; }
  .compact-root .v74-chart-scroll { overflow:visible !important; padding:0 !important; }
  .compact-root .v74-bars-chart { height:105px !important; min-width:0 !important; padding:8px 3px 0 !important; gap:3px !important; display:flex !important; border-bottom:1px solid #d7e4e9 !important; }
  .compact-root .v74-month { flex:1 1 0 !important; width:auto !important; min-width:28px !important; display:grid !important; grid-template-rows:1fr auto !important; gap:2px !important; }
  .compact-root .v74-bar-area { height:82px !important; }
  .compact-root .v74-bar { width:24px !important; border-radius:4px 4px 1px 1px !important; box-shadow:none !important; }
  .compact-root .v74-value { top:-12px !important; font-size:5.8px !important; }
  .compact-root .v74-month-label { font-size:5.8px !important; }
  .compact-root .v74-month-label small { font-size:4.8px !important; margin-top:0 !important; }

  .compact-root .v74-table-wrap { overflow:visible !important; border:1px solid #d7e4e9 !important; border-radius:5px !important; }
  .compact-root .v74-table { min-width:0 !important; width:100% !important; border-collapse:collapse !important; font-size:5.8px !important; }
  .compact-root .v74-table th, .compact-root .v74-table td { padding:2px 4px !important; line-height:1.12 !important; border-bottom:1px solid #e4ecef !important; }
  .compact-root .v74-table th { font-size:5.2px !important; background:#edf5f7 !important; }

  /* Mix de produção - mantém todos os itens no gráfico, elimina apenas a tabela duplicada */
  .compact-root .v73-mix { display:grid !important; gap:4px !important; padding:6px !important; border:1px solid #cfdfe5 !important; border-radius:8px !important; background:#fff !important; box-shadow:none !important; }
  .compact-root .v73-mix-head { display:flex !important; align-items:flex-start !important; justify-content:space-between !important; gap:8px !important; }
  .compact-root .v73-mix-head h3 { margin:0 !important; font-size:10px !important; color:#073F5A !important; }
  .compact-root .v73-total-pill { padding:3px 6px !important; font-size:6px !important; border-radius:999px !important; }
  .compact-root .v73-kpis { display:grid !important; grid-template-columns:repeat(3,1fr) !important; gap:3px !important; }
  .compact-root .v73-kpi { padding:4px 5px !important; border-radius:6px !important; min-height:31px !important; box-shadow:none !important; }
  .compact-root .v73-kpi small { font-size:5.3px !important; margin-bottom:1px !important; }
  .compact-root .v73-kpi strong { font-size:8px !important; line-height:1 !important; }
  .compact-root .v73-kpi span { font-size:5.6px !important; margin-top:1px !important; }
  .compact-root .v73-chart { padding:4px 5px !important; border-radius:6px !important; border:1px solid #d7e4e9 !important; }
  .compact-root .v73-chart-title { margin:0 0 3px !important; }
  .compact-root .v73-chart-title h4 { font-size:7.5px !important; }
  .compact-root .v73-chart-title span { font-size:5.5px !important; }
  .compact-root .v73-bars { display:grid !important; grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:2px 8px !important; }
  .compact-root .v73-bar { display:grid !important; grid-template-columns:minmax(72px,1.15fr) minmax(55px,2fr) 34px !important; gap:4px !important; align-items:center !important; min-height:16px !important; }
  .compact-root .v73-bar-label strong { font-size:5.8px !important; line-height:1.05 !important; }
  .compact-root .v73-bar-label small { font-size:5px !important; }
  .compact-root .v73-track { height:6px !important; }
  .compact-root .v73-bar-pct { font-size:5.8px !important; }

  /* Lançamentos detalhados */
  .compact-root .compact-detail-card { padding:5px !important; border:1px solid #cfdfe5 !important; border-radius:7px !important; background:#fff !important; box-shadow:none !important; break-inside:auto !important; }
  .compact-root .compact-detail-card > .v68-top { margin-bottom:3px !important; }
  .compact-root .compact-detail-card h3 { margin:0 !important; font-size:8px !important; color:#073F5A !important; }
  .compact-root .v68-table-wrap { overflow:visible !important; border:1px solid #d7e4e9 !important; border-radius:4px !important; }
  .compact-root .v68-table { min-width:0 !important; width:100% !important; border-collapse:collapse !important; table-layout:auto !important; font-size:5.5px !important; }
  .compact-root .v68-table thead { display:table-header-group; }
  .compact-root .v68-table tr { break-inside:avoid; page-break-inside:avoid; }
  .compact-root .v68-table th, .compact-root .v68-table td { padding:2px 3px !important; line-height:1.08 !important; border-bottom:1px solid #e5ecef !important; vertical-align:top !important; }
  .compact-root .v68-table th { background:#073F5A !important; color:#fff !important; font-size:4.9px !important; text-transform:uppercase !important; }
  .compact-root .v68-total { display:grid !important; grid-template-columns:repeat(4,1fr) !important; gap:3px !important; margin:3px 0 0 !important; padding:4px 5px !important; border-radius:5px !important; }
  .compact-root .v68-total .v68-line { display:grid !important; gap:1px !important; padding:0 !important; font-size:5.5px !important; }
  .compact-root .v68-total .v68-line span { color:#8a6415 !important; }
  .compact-root .v68-total .v68-line b { color:#073F5A !important; font-size:7px !important; }
  .compact-root br { display:none; }

  .signatures { display:grid; grid-template-columns:1fr 1fr; gap:45px; margin-top:9px; break-inside:avoid; }
  .signature { border-top:1px solid #9bb0ba; padding-top:2px; text-align:center; color:#607788; font-weight:700; font-size:5.8px; }
  .footer { display:flex; justify-content:space-between; gap:10px; margin-top:5px; padding-top:3px; border-top:1px solid #d7e4e9; color:#7a909a; font-size:5.4px; }

  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .compact-root .v74-daily, .compact-root .v73-mix { page-break-inside:auto; }
  }
</style>
</head>
<body>
<main class="page">
  <header class="print-head">
    <div class="brand">
      <img src="${esc(logoUrl())}" alt="Excellence System®">
      <div><h1>Excellence System®</h1><small>MP Consultoria • Gestão da Qualidade e Produção</small></div>
    </div>
    <div class="meta">Relatório Gerencial de Apontamento<br>${esc(company)} • ${esc(generated)}<br>Versão ${V}</div>
  </header>

  <section class="report-title"><div><span>APONTAMENTO DE PRODUÇÃO</span><h2>Visão executiva + detalhamento completo</h2></div><strong>${esc(company)}</strong></section>

  <section class="filter-strip">
    ${filters.map(([label, value]) => `<div class="filter"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('')}
  </section>

  ${cloneReport(root)}

  <section class="signatures"><div class="signature">Responsável pela empresa</div><div class="signature">MP Consultoria</div></section>
  <footer class="footer"><span>Relatório gerado automaticamente pelo Excellence System®.</span><span>Todos os dados do filtro foram preservados; a impressão usa layout compacto.</span></footer>
</main>
</body>
</html>`;
  }

  function printCompact(root) {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Relatório compacto de apontamento');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = win.document;
    doc.open();
    doc.write(buildHTML(root));
    doc.close();

    const cleanup = () => setTimeout(() => iframe.remove(), 1500);
    win.addEventListener('afterprint', cleanup, { once: true });

    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch (error) {
        console.error('Erro ao imprimir relatório compacto:', error);
        iframe.remove();
      }
    }, 450);
  }

  document.addEventListener('click', event => {
    const btn = event.target.closest?.('[data-print]');
    if (!btn) return;
    const root = btn.closest('[data-report]');
    if (!root) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    printCompact(root);
  }, true);

  console.info(`Excellence System® impressão compacta do apontamento ${V} carregada.`);
})();
