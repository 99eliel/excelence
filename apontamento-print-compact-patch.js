(function () {
  const V = '20260820-77';

  const text = el => String(el?.textContent || '').replace(/\s+/g, ' ').trim();
  const esc = (value = '') => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function brNumber(value) {
    const raw = String(value ?? '').trim().replace(/\s/g, '');
    if (!raw) return 0;
    const normalized = raw.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

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

  function collectMetrics(root) {
    return Array.from(root.querySelectorAll('.v68-metrics .v68-metric')).map(card => ({
      label: text(card.querySelector('small')),
      value: text(card.querySelector('strong'))
    })).filter(x => x.label || x.value).slice(0, 4);
  }

  function collectMonthly(root) {
    const rows = Array.from(root.querySelectorAll('.v74-table tbody tr')).map(row => {
      const cells = Array.from(row.querySelectorAll('td')).map(text);
      if (cells.length < 5) return null;
      return {
        month: cells[0],
        total: cells[1],
        days: cells[2],
        average: cells[3],
        averageN: brNumber(cells[3]),
        variation: cells[4]
      };
    }).filter(Boolean);

    const kpis = Array.from(root.querySelectorAll('.v74-kpi')).map(card => ({
      label: text(card.querySelector('small')),
      value: text(card.querySelector('strong')),
      note: text(card.querySelector('span'))
    })).filter(x => x.label || x.value);

    return { rows, kpis };
  }

  function collectMix(root) {
    const rows = Array.from(root.querySelectorAll('.v73-mix-table tbody tr')).map(row => {
      const cells = Array.from(row.querySelectorAll('td')).map(text);
      if (cells.length < 4) return null;
      return {
        rank: cells[0],
        name: cells[1],
        quantity: cells[2],
        share: cells[3],
        shareN: brNumber(cells[3])
      };
    }).filter(Boolean);

    const kpis = Array.from(root.querySelectorAll('.v73-kpi')).map(card => ({
      label: text(card.querySelector('small')),
      value: text(card.querySelector('strong')),
      note: text(card.querySelector('span'))
    })).filter(x => x.label || x.value);

    return { rows, kpis };
  }

  function collectLaunches(root) {
    const table = root.querySelector('.v68-table');
    if (!table) return { headers: [], rows: [] };
    const headers = Array.from(table.querySelectorAll('thead th')).map(text);
    const rows = Array.from(table.querySelectorAll('tbody tr')).map(row =>
      Array.from(row.querySelectorAll('td')).map(text)
    ).filter(cells => cells.length === headers.length && cells.length > 1);
    return { headers, rows };
  }

  function collectTotals(root) {
    return Array.from(root.querySelectorAll('.v68-total .v68-line')).map(line => ({
      label: text(line.querySelector('span')),
      value: text(line.querySelector('b'))
    })).filter(x => x.label || x.value);
  }

  function metricStrip(metrics) {
    return `<div class="metric-strip">${metrics.map(m => `<div class="metric"><small>${esc(m.label)}</small><strong>${esc(m.value)}</strong></div>`).join('')}</div>`;
  }

  function monthlyBlock(monthly) {
    if (!monthly.rows.length) return '<section class="panel"><h3>Evolução da produção média diária</h3><div class="empty">Sem dados mensais para o filtro atual.</div></section>';
    const max = Math.max(...monthly.rows.map(r => r.averageN), 1);
    return `<section class="panel monthly-panel">
      <div class="panel-head"><div><span>RESULTADOS DE PRODUÇÃO</span><h3>Evolução da produção média diária</h3></div><b>${monthly.rows.length} mês(es)</b></div>
      <div class="mini-kpis">${monthly.kpis.slice(0,4).map((k,i) => `<div class="mini-kpi ${i===2?'accent':''}"><small>${esc(k.label)}</small><strong>${esc(k.value)}</strong>${k.note?`<em>${esc(k.note)}</em>`:''}</div>`).join('')}</div>
      <div class="month-chart">${monthly.rows.map((r,i) => {
        const h = Math.max(8, Math.min(100, r.averageN / max * 100));
        return `<div class="month-col ${i===monthly.rows.length-1?'latest':''}"><div class="bar-box"><span>${esc(r.average)}</span><i style="height:${h.toFixed(2)}%"></i></div><b>${esc(r.month.replace(/\s*\(parcial\)/i,''))}</b></div>`;
      }).join('')}</div>
      <table class="mini-table monthly-table"><thead><tr><th>Mês</th><th>Produção</th><th>Dias</th><th>Média/dia</th><th>Variação</th></tr></thead><tbody>${monthly.rows.map(r => `<tr><td>${esc(r.month)}</td><td>${esc(r.total)}</td><td>${esc(r.days)}</td><td><strong>${esc(r.average)}</strong></td><td>${esc(r.variation)}</td></tr>`).join('')}</tbody></table>
    </section>`;
  }

  function mixBlock(mix) {
    if (!mix.rows.length) return '<section class="panel"><h3>Mix de produção por peça</h3><div class="empty">Sem peças produzidas para o filtro atual.</div></section>';
    return `<section class="panel mix-panel">
      <div class="panel-head"><div><span>VISÃO EMPRESARIAL</span><h3>Mix de produção por peça</h3></div><b>${mix.rows.length} item(ns)</b></div>
      <div class="mix-kpis">${mix.kpis.slice(0,3).map(k => `<div><small>${esc(k.label)}</small><strong>${esc(k.value)}</strong>${k.note?`<em>${esc(k.note)}</em>`:''}</div>`).join('')}</div>
      <div class="mix-bars">${mix.rows.map(r => `<div class="mix-row"><div class="mix-name"><b>${esc(r.rank)}. ${esc(r.name)}</b><small>${esc(r.quantity)} peça(s)</small></div><div class="mix-track"><i style="width:${Math.max(2,Math.min(100,r.shareN)).toFixed(2)}%"></i></div><strong>${esc(r.share)}</strong></div>`).join('')}</div>
      <table class="mini-table mix-table"><thead><tr><th>#</th><th>Peça / produto</th><th>Qtd.</th><th>Participação</th></tr></thead><tbody>${mix.rows.map(r => `<tr><td>${esc(r.rank)}</td><td>${esc(r.name)}</td><td>${esc(r.quantity)}</td><td><strong>${esc(r.share)}</strong></td></tr>`).join('')}</tbody></table>
    </section>`;
  }

  function launchesBlock(data, totals) {
    if (!data.headers.length) return '';
    return `<section class="detail-panel">
      <div class="detail-head"><div><span>DETALHAMENTO</span><h3>Lançamentos do período</h3></div><b>${data.rows.length} lançamento(s)</b></div>
      <table class="detail-table"><thead><tr>${data.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${data.rows.length ? data.rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${data.headers.length}">Nenhum lançamento encontrado.</td></tr>`}</tbody></table>
      <div class="totals">${totals.map(t => `<div><small>${esc(t.label)}</small><strong>${esc(t.value)}</strong></div>`).join('')}</div>
    </section>`;
  }

  function buildHTML(root) {
    const company = companyName();
    const generated = new Date().toLocaleString('pt-BR');
    const metrics = collectMetrics(root);
    const monthly = collectMonthly(root);
    const mix = collectMix(root);
    const launches = collectLaunches(root);
    const totals = collectTotals(root);

    const filters = [
      ['Período', `${selectedText('[data-r-start]')} até ${selectedText('[data-r-end]')}`],
      ['Processo', selectedText('[data-r-prod]')],
      ['Equipe / célula', selectedText('[data-r-eq]')],
      ['Funcionário', selectedText('[data-r-func]')]
    ];

    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Gerencial de Apontamento</title><style>
      @page{size:A4 landscape;margin:6mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}body{font-family:Arial,Helvetica,sans-serif;color:#173846;font-size:8px;line-height:1.18;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:100%}
      .header{display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:2px solid #073F5A;padding-bottom:5px;margin-bottom:5px}.brand{display:flex;align-items:center;gap:8px}.brand img{width:34px;height:34px;object-fit:contain;border-radius:8px;background:#073F5A}.brand h1{margin:0;color:#073F5A;font-size:16px;line-height:1}.brand small{display:block;margin-top:2px;color:#607788;font-weight:700;font-size:6.4px}.meta{text-align:right;color:#607788;font-size:6.2px;font-weight:700;line-height:1.35}
      .titlebar{display:flex;justify-content:space-between;align-items:center;background:#073F5A;color:#fff;border-radius:7px;padding:5px 8px;margin-bottom:5px}.titlebar h2{margin:0;color:#fff;font-size:11.5px}.titlebar span{font-size:6.5px;color:#d8edf4;font-weight:800}
      .filters{display:grid;grid-template-columns:1.35fr 1fr 1fr 1fr;gap:4px;margin-bottom:5px}.filter{border:1px solid #d6e3e8;border-radius:6px;padding:4px 6px;background:#f8fbfc}.filter small,.metric small,.mini-kpi small,.mix-kpis small,.totals small{display:block;color:#607788;font-size:5.6px;font-weight:900;text-transform:uppercase;letter-spacing:.035em;margin-bottom:1px}.filter strong{display:block;color:#073F5A;font-size:7px}
      .metric-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:6px}.metric{border:1px solid #d6e3e8;border-radius:6px;padding:4px 6px;background:#fff}.metric strong{display:block;color:#073F5A;font-size:11px;line-height:1.05}
      .executive-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:6px;align-items:start;margin-bottom:6px}.panel{border:1px solid #cfdfe5;border-radius:8px;padding:6px;background:#fff;break-inside:avoid}.panel-head,.detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px}.panel-head span,.detail-head span{display:block;color:#0b6f93;font-size:5.4px;font-weight:900;letter-spacing:.05em}.panel-head h3,.detail-head h3{margin:1px 0 0;color:#073F5A;font-size:9.5px}.panel-head>b,.detail-head>b{padding:2px 5px;border-radius:999px;background:#eef5f7;color:#466572;font-size:5.8px;white-space:nowrap}
      .mini-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-bottom:4px}.mini-kpi{border:1px solid #dce7eb;border-radius:5px;padding:3px 4px;min-height:31px}.mini-kpi strong{display:block;color:#073F5A;font-size:7.4px;line-height:1.05}.mini-kpi em,.mix-kpis em{display:block;margin-top:1px;color:#607788;font-size:4.9px;font-style:normal;line-height:1.12}.mini-kpi.accent{background:#073F5A;border-color:#073F5A}.mini-kpi.accent small,.mini-kpi.accent em{color:#c8dfe8}.mini-kpi.accent strong{color:#f0b23e;font-size:9px}
      .month-chart{height:82px;display:flex;align-items:flex-end;gap:4px;border-bottom:1px solid #d7e4e9;padding:12px 4px 2px;margin-bottom:4px}.month-col{flex:1;min-width:24px;text-align:center}.bar-box{height:58px;display:flex;align-items:flex-end;justify-content:center;position:relative}.bar-box>span{position:absolute;top:-8px;font-size:5.5px;font-weight:900;color:#173846}.bar-box>i{display:block;width:min(28px,70%);background:#197a9c;border-radius:4px 4px 1px 1px;min-height:3px}.month-col.latest .bar-box>i{background:#e6a62d}.month-col>b{display:block;margin-top:2px;font-size:5.2px;color:#466572;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .mix-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-bottom:5px}.mix-kpis>div{border:1px solid #dce7eb;border-radius:5px;padding:3px 4px}.mix-kpis strong{display:block;color:#073F5A;font-size:7px}.mix-bars{display:grid;grid-template-columns:1fr 1fr;gap:3px 7px;margin-bottom:4px}.mix-row{display:grid;grid-template-columns:minmax(72px,1.2fr) minmax(55px,2fr) 31px;gap:4px;align-items:center;min-height:17px}.mix-name{min-width:0}.mix-name>b{display:block;font-size:5.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#173846}.mix-name>small{display:block;font-size:4.8px;color:#607788}.mix-track{height:6px;border-radius:999px;background:#e8f0f3;overflow:hidden}.mix-track i{display:block;height:100%;background:#0b6f93;border-radius:999px}.mix-row:first-child .mix-track i{background:#d6a842}.mix-row>strong{text-align:right;font-size:5.5px;color:#073F5A}
      .mini-table,.detail-table{width:100%;border-collapse:collapse}.mini-table{font-size:5.4px}.mini-table th,.mini-table td{padding:2px 3px;border-bottom:1px solid #e5edef;text-align:left}.mini-table th{background:#eef5f7;color:#073F5A;font-size:4.9px;text-transform:uppercase}.monthly-table th:nth-child(n+2),.monthly-table td:nth-child(n+2),.mix-table th:nth-child(n+3),.mix-table td:nth-child(n+3){text-align:right}
      .detail-panel{border:1px solid #cfdfe5;border-radius:8px;padding:5px 6px;background:#fff;break-inside:auto}.detail-table{font-size:5.5px;table-layout:auto}.detail-table thead{display:table-header-group}.detail-table tr{break-inside:avoid}.detail-table th,.detail-table td{padding:2.2px 3px;border-bottom:1px solid #e5edef;vertical-align:top}.detail-table th{background:#073F5A;color:#fff;font-size:4.8px;text-transform:uppercase}.totals{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:4px}.totals>div{border-top:1px solid #dbe6ea;padding-top:3px}.totals strong{display:block;color:#073F5A;font-size:7.5px}
      .signatures{display:grid;grid-template-columns:1fr 1fr;gap:42px;margin-top:8px}.signature{border-top:1px solid #8fa8b3;text-align:center;padding-top:3px;color:#607788;font-size:5.7px;font-weight:800}.footer{display:flex;justify-content:space-between;gap:10px;margin-top:5px;padding-top:3px;border-top:1px solid #e0e8eb;color:#8299a3;font-size:4.9px}.empty{padding:8px;text-align:center;color:#607788;border:1px dashed #d6e3e8;border-radius:5px}
      @media print{body{zoom:1}.panel{break-inside:avoid}.detail-panel{break-inside:auto}}
    </style></head><body><main class="page">
      <header class="header"><div class="brand"><img src="${esc(logoUrl())}" alt="Excellence System®"><div><h1>Excellence System®</h1><small>MP Consultoria • Gestão da Qualidade e Produção</small></div></div><div class="meta">Relatório Gerencial de Apontamento<br>${esc(company)} • ${esc(generated)}<br>Versão ${V}</div></header>
      <section class="titlebar"><div><span>APONTAMENTO DE PRODUÇÃO</span><h2>Visão executiva + detalhamento completo</h2></div><strong>${esc(company)}</strong></section>
      <section class="filters">${filters.map(([l,v])=>`<div class="filter"><small>${esc(l)}</small><strong>${esc(v)}</strong></div>`).join('')}</section>
      ${metricStrip(metrics)}
      <section class="executive-grid">${monthlyBlock(monthly)}${mixBlock(mix)}</section>
      ${launchesBlock(launches, totals)}
      <section class="signatures"><div class="signature">Responsável pela empresa</div><div class="signature">MP Consultoria</div></section>
      <footer class="footer"><span>Relatório gerado automaticamente pelo Excellence System®.</span><span>Todos os dados do filtro foram preservados.</span></footer>
    </main></body></html>`;
  }

  function printHTML(html) {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
    iframe.setAttribute('title', 'Relatório gerencial de apontamento');
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    win.document.open();
    win.document.write(html);
    win.document.close();
    const cleanup = () => setTimeout(() => iframe.remove(), 1200);
    win.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(() => {
      try { win.focus(); win.print(); }
      catch (error) { console.error(error); iframe.remove(); }
    }, 300);
  }

  document.addEventListener('click', event => {
    const btn = event.target.closest?.('[data-print]');
    if (!btn) return;
    const root = btn.closest('[data-report]');
    if (!root) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    printHTML(buildHTML(root));
  }, true);

  console.info(`Excellence System® impressão executiva compacta ${V} carregada.`);
})();