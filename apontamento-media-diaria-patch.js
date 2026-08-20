(function () {
  const V = '20260820-74';
  const STYLE_ID = 'apontamento-media-diaria-v74-css';

  const txt = el => String(el?.textContent || '').replace(/\s+/g, ' ').trim();
  const esc = (v = '') => String(v ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const fmt = (v, digits = 1) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: digits });
  const pct = v => `${v >= 0 ? '+' : ''}${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

  function brNumber(value) {
    const raw = String(value ?? '').trim().replace(/\s/g, '');
    if (!raw) return 0;
    const normalized = raw.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function parseDateBR(value) {
    const m = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const [, d, mo, y] = m;
    const date = new Date(Number(y), Number(mo) - 1, Number(d));
    if (Number.isNaN(date.getTime())) return null;
    return {
      date,
      iso: `${y}-${mo}-${d}`,
      monthKey: `${y}-${mo}`
    };
  }

  function monthLabel(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    const mon = date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
    return `${mon.charAt(0).toUpperCase()}${mon.slice(1)}/${String(y).slice(-2)}`;
  }

  function monthLongLabel(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    const mon = date.toLocaleString('pt-BR', { month: 'long' });
    return `${mon.charAt(0).toUpperCase()}${mon.slice(1)} de ${y}`;
  }

  function filterDate(selector) {
    const value = String(document.querySelector(selector)?.value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  }

  function daysInMonth(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }

  function isPartialMonth(monthKey) {
    const start = filterDate('[data-r-start]');
    const end = filterDate('[data-r-end]');
    const [y, m] = monthKey.split('-').map(Number);
    const current = new Date();
    if (current.getFullYear() === y && current.getMonth() + 1 === m) return true;
    if (start && start.startsWith(monthKey) && Number(start.slice(-2)) > 1) return true;
    if (end && end.startsWith(monthKey) && Number(end.slice(-2)) < daysInMonth(monthKey)) return true;
    return false;
  }

  function calcTrend(root) {
    const daily = new Map();

    Array.from(root.querySelectorAll('.v68-table tbody tr')).forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 4) return;
      const parsed = parseDateBR(txt(cells[0]));
      const quantity = brNumber(txt(cells[3]));
      if (!parsed || quantity <= 0) return;
      const existing = daily.get(parsed.iso) || { date: parsed.date, monthKey: parsed.monthKey, quantity: 0 };
      existing.quantity += quantity;
      daily.set(parsed.iso, existing);
    });

    const monthlyMap = new Map();
    Array.from(daily.values()).forEach(day => {
      const existing = monthlyMap.get(day.monthKey) || { monthKey: day.monthKey, total: 0, days: 0 };
      existing.total += day.quantity;
      existing.days += 1;
      monthlyMap.set(day.monthKey, existing);
    });

    const months = Array.from(monthlyMap.values())
      .map(item => ({
        ...item,
        average: item.days ? item.total / item.days : 0,
        partial: isPartialMonth(item.monthKey)
      }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    months.forEach((item, index) => {
      const prev = months[index - 1];
      item.changePrev = prev?.average ? ((item.average / prev.average) - 1) * 100 : null;
    });

    const latest = months[months.length - 1] || null;
    const historyBase = months.length > 1 ? months.slice(0, -1) : months;
    const historicalAverage = historyBase.length
      ? historyBase.reduce((sum, item) => sum + item.average, 0) / historyBase.length
      : 0;
    const changeHistorical = latest && historicalAverage
      ? ((latest.average / historicalAverage) - 1) * 100
      : 0;

    return { months, latest, historicalAverage, changeHistorical, productiveDays: daily.size };
  }

  function css() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      .v74-daily{border:1px solid var(--line,#d8e5ea);border-radius:22px;padding:18px;background:linear-gradient(180deg,#fff,#f9fcfd);box-shadow:0 14px 32px rgba(5,36,55,.07);display:grid;gap:16px}
      .v74-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}.v74-head h3{margin:3px 0 4px;color:#073F5A;font-size:22px}.v74-head p{margin:0;color:var(--muted,#607788);max-width:760px}.v74-note{padding:8px 12px;border-radius:999px;background:rgba(7,63,90,.08);color:#073F5A;font-weight:900;font-size:12px;white-space:nowrap}
      .v74-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.v74-kpi{border:1px solid #d8e5ea;border-radius:16px;background:#fff;padding:13px 14px}.v74-kpi small{display:block;color:#607788;font-weight:900;text-transform:uppercase;letter-spacing:.04em;font-size:10px;margin-bottom:5px}.v74-kpi strong{display:block;color:#073F5A;font-size:21px;line-height:1.15}.v74-kpi span{display:block;color:#607788;font-size:12px;margin-top:4px}.v74-kpi.accent{background:linear-gradient(135deg,#073F5A,#0b5678);border-color:#073F5A}.v74-kpi.accent small,.v74-kpi.accent span{color:rgba(255,255,255,.78)}.v74-kpi.accent strong{color:#f0b23e;font-size:28px}
      .v74-chart-card{border:1px solid #d8e5ea;border-radius:18px;background:#fff;padding:16px}.v74-chart-title{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:12px}.v74-chart-title h4{margin:0;color:#073F5A;font-size:17px}.v74-chart-title span{color:#607788;font-size:12px;font-weight:800}.v74-chart-scroll{overflow-x:auto;padding-bottom:4px}.v74-bars-chart{height:285px;display:flex;align-items:stretch;gap:12px;min-width:max-content;padding:14px 8px 0;border-bottom:1px solid #d8e5ea;position:relative}.v74-bars-chart:before,.v74-bars-chart:after{content:'';position:absolute;left:0;right:0;border-top:1px dashed #e1eaee}.v74-bars-chart:before{top:33%}.v74-bars-chart:after{top:66%}
      .v74-month{width:78px;display:grid;grid-template-rows:1fr auto;gap:8px;position:relative;z-index:1}.v74-bar-area{display:flex;align-items:flex-end;justify-content:center;height:235px;position:relative}.v74-bar{width:44px;border-radius:9px 9px 3px 3px;background:linear-gradient(180deg,#2786a8,#0b6f93);min-height:3px;position:relative;box-shadow:0 5px 12px rgba(7,63,90,.12)}.v74-month.latest .v74-bar{background:linear-gradient(180deg,#f2b43d,#d69218)}.v74-value{position:absolute;left:50%;transform:translateX(-50%);top:-25px;color:#153847;font-weight:900;font-size:12px;white-space:nowrap}.v74-month-label{text-align:center;color:#425f6d;font-weight:900;font-size:12px}.v74-month-label small{display:block;margin-top:2px;color:#8a6415;font-size:9px;text-transform:uppercase}
      .v74-table-wrap{overflow:auto;border:1px solid #d8e5ea;border-radius:16px}.v74-table{width:100%;min-width:680px;border-collapse:collapse;background:#fff}.v74-table th,.v74-table td{padding:10px 12px;border-bottom:1px solid #e4eef2;text-align:left}.v74-table th{background:#f3f8fb;color:#073F5A;font-size:11px;text-transform:uppercase;letter-spacing:.03em}.v74-table td:nth-child(n+2),.v74-table th:nth-child(n+2){text-align:right;white-space:nowrap}.v74-pos{color:#0d7d5a;font-weight:900}.v74-neg{color:#b34d45;font-weight:900}.v74-neutral{color:#607788;font-weight:800}
      @media(max-width:950px){.v74-kpis{grid-template-columns:1fr 1fr}}@media(max-width:620px){.v74-kpis{grid-template-columns:1fr}.v74-head h3{font-size:19px}.v74-month{width:70px}}
      @media print{.v74-chart-scroll{overflow:visible}.v74-bars-chart{min-width:0;gap:7px}.v74-month{flex:1;width:auto;min-width:42px}.v74-kpis{grid-template-columns:repeat(4,1fr)}}
    `;
    document.head.appendChild(st);
  }

  function trendSection(data) {
    const { months, latest, historicalAverage, changeHistorical } = data;
    if (!months.length || !latest) return '';
    const maxAverage = Math.max(...months.map(x => x.average), 1);
    const variationClass = changeHistorical > 0 ? 'v74-pos' : changeHistorical < 0 ? 'v74-neg' : 'v74-neutral';
    return `<section class="v74-daily" data-v74-daily>
      <div class="v74-head"><div><span class="kicker">Resultados de produção</span><h3>Evolução da produção média diária</h3><p>Média diária calculada pela produção total de cada mês dividida pelos dias que tiveram produção registrada no período filtrado.</p></div><span class="v74-note">${months.length} mês(es) com dados</span></div>
      <div class="v74-kpis">
        <div class="v74-kpi"><small>Média histórica</small><strong>${fmt(historicalAverage)} peças/dia</strong><span>${months.length > 1 ? 'Meses anteriores ao último período.' : 'Base disponível no filtro atual.'}</span></div>
        <div class="v74-kpi"><small>Último mês com dados</small><strong>${fmt(latest.average)} peças/dia</strong><span>${monthLongLabel(latest.monthKey)} • ${latest.days} dia(s) produtivo(s)${latest.partial ? ' • parcial' : ''}</span></div>
        <div class="v74-kpi accent"><small>Evolução vs. média histórica</small><strong>${pct(changeHistorical)}</strong><span>${changeHistorical >= 0 ? 'Acima' : 'Abaixo'} da média dos meses anteriores.</span></div>
        <div class="v74-kpi"><small>Produção do último mês</small><strong>${fmt(latest.total, 0)} peças</strong><span>Volume somado em ${latest.days} dia(s) com apontamento.</span></div>
      </div>
      <div class="v74-chart-card"><div class="v74-chart-title"><h4>Média de peças produzidas por dia</h4><span>Último período destacado</span></div><div class="v74-chart-scroll"><div class="v74-bars-chart">
        ${months.map((item, index) => {
          const h = Math.max(3, Math.min(100, item.average / maxAverage * 100));
          return `<div class="v74-month ${index === months.length - 1 ? 'latest' : ''}"><div class="v74-bar-area"><div class="v74-bar" style="height:${h.toFixed(2)}%"><span class="v74-value">${fmt(item.average)}</span></div></div><div class="v74-month-label">${monthLabel(item.monthKey)}${item.partial ? '<small>parcial</small>' : ''}</div></div>`;
        }).join('')}
      </div></div></div>
      <div class="v74-table-wrap"><table class="v74-table"><thead><tr><th>Mês</th><th>Produção total</th><th>Dias produtivos</th><th>Média/dia</th><th>Variação vs. mês anterior</th></tr></thead><tbody>
        ${months.map(item => `<tr><td><strong>${monthLongLabel(item.monthKey)}</strong>${item.partial ? ' <small>(parcial)</small>' : ''}</td><td>${fmt(item.total,0)}</td><td>${item.days}</td><td><strong>${fmt(item.average)}</strong></td><td class="${item.changePrev == null ? 'v74-neutral' : item.changePrev >= 0 ? 'v74-pos' : 'v74-neg'}">${item.changePrev == null ? '—' : pct(item.changePrev)}</td></tr>`).join('')}
      </tbody></table></div>
    </section>`;
  }

  function enhance(root) {
    if (!root || root.querySelector('[data-v74-daily]')) return;
    const result = root.querySelector('.v68-card');
    if (!result) return;
    const data = calcTrend(root);
    if (!data.months.length) return;
    result.insertAdjacentHTML('beforebegin', trendSection(data));
  }

  function enhanceAll() {
    document.querySelectorAll('[data-report]').forEach(enhance);
  }

  function selectedText(selector) {
    const el = document.querySelector(selector);
    if (!el) return 'Todos';
    if (el.tagName === 'SELECT') return txt(el.selectedOptions?.[0]) || 'Todos';
    const value = String(el.value || '').trim();
    if (!value) return 'Todos';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y,m,d] = value.split('-');
      return `${d}/${m}/${y}`;
    }
    return value;
  }

  function companyName() {
    const value = txt(document.querySelector('.v68-hero .v68-pill.light')).replace(/^Empresa:\s*/i, '').trim();
    return value || 'Empresa';
  }

  function printReport(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll('button,input,select,textarea').forEach(el => el.remove());
    clone.querySelectorAll('.v68-table-wrap,.v73-mix-table-wrap,.v74-table-wrap,.v74-chart-scroll').forEach(el => el.style.overflow = 'visible');
    const generated = new Date().toLocaleString('pt-BR');
    const styles = Array.from(document.querySelectorAll('style')).map(el => el.outerHTML).join('\n');
    const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(el => el.outerHTML).join('\n');
    const periodStart = selectedText('[data-r-start]');
    const periodEnd = selectedText('[data-r-end]');
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Apontamento</title>${cssLinks}${styles}<style>
      @page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{margin:0;background:#fff!important;color:#153847;font-family:Arial,Helvetica,sans-serif}.print-wrap{padding:0}.print-header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #073F5A;padding-bottom:10px;margin-bottom:12px}.print-header h1{margin:0;color:#073F5A;font-size:24px}.print-header p{margin:4px 0 0;color:#607788}.print-meta{text-align:right;color:#607788;font-weight:700;line-height:1.5}.v68-metrics{grid-template-columns:repeat(4,1fr)!important}.v68-card,.v73-mix,.v74-daily{box-shadow:none!important;page-break-inside:avoid}.v68-table{min-width:0!important;font-size:9px}.v68-table th,.v68-table td{padding:6px!important}.v73-mix{margin-top:10px}.v74-daily{margin-bottom:10px}.v74-bars-chart{height:220px}.v74-bar-area{height:175px}.v74-month{min-width:45px}.v74-kpi strong{font-size:16px}.v74-kpi.accent strong{font-size:22px}.v73-bar{grid-template-columns:minmax(120px,1.1fr) minmax(130px,2.6fr) 65px}.v73-mix-table,.v74-table{min-width:0!important;font-size:9px}button{display:none!important}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body><main class="print-wrap"><header class="print-header"><div><h1>Excellence System®</h1><p>Relatório Gerencial de Apontamento • ${esc(companyName())}</p></div><div class="print-meta">Período: ${esc(periodStart)} até ${esc(periodEnd)}<br>Gerado em ${esc(generated)}<br>Versão ${V}</div></header>${clone.outerHTML}</main></body></html>`);
    doc.close();
    const win = iframe.contentWindow;
    const cleanup = () => setTimeout(() => iframe.remove(), 1200);
    win.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(() => {
      try { win.focus(); win.print(); }
      catch (error) { console.error('Erro ao imprimir relatório gerencial:', error); iframe.remove(); }
    }, 500);
  }

  css();
  enhanceAll();

  const observer = new MutationObserver(() => enhanceAll());
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', event => {
    const btn = event.target.closest?.('[data-print]');
    if (!btn) return;
    const root = btn.closest('[data-report]');
    if (!root || !root.querySelector('[data-v74-daily]')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    printReport(root);
  }, true);

  console.info(`Excellence System® média diária mensal do apontamento ${V} carregada.`);
})();
