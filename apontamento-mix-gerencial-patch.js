(function () {
  const V = '20260820-73';
  const STYLE_ID = 'apontamento-mix-gerencial-v73-css';

  const esc = (v = '') => String(v ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const txt = el => String(el?.textContent || '').replace(/\s+/g, ' ').trim();
  const fmt = v => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const pct = v => `${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

  function brNumber(value) {
    const raw = String(value ?? '').trim().replace(/\s/g, '');
    if (!raw) return 0;
    const normalized = raw.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function css() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      .v73-mix{border:1px solid var(--line,#d8e5ea);border-radius:22px;padding:18px;background:linear-gradient(180deg,#fff,#fbfdfe);box-shadow:0 14px 32px rgba(5,36,55,.07);display:grid;gap:15px}
      .v73-mix-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}.v73-mix-head h3{margin:3px 0 4px;color:#073F5A;font-size:21px}.v73-mix-head p{margin:0;color:var(--muted,#607788)}
      .v73-total-pill{padding:8px 12px;border-radius:999px;background:rgba(214,168,66,.15);color:#8a6415;font-weight:900;white-space:nowrap}
      .v73-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.v73-kpi{border:1px solid #d8e5ea;border-radius:16px;background:#fff;padding:12px 14px}.v73-kpi small{display:block;color:#607788;font-weight:900;text-transform:uppercase;letter-spacing:.04em;font-size:10px;margin-bottom:4px}.v73-kpi strong{display:block;color:#073F5A;font-size:18px;line-height:1.2}.v73-kpi span{display:block;color:#607788;font-size:12px;margin-top:3px}
      .v73-chart{border:1px solid #d8e5ea;border-radius:18px;background:#fff;padding:16px}.v73-chart-title{display:flex;justify-content:space-between;gap:12px;align-items:end;margin-bottom:14px}.v73-chart-title h4{margin:0;color:#073F5A;font-size:16px}.v73-chart-title span{color:#607788;font-size:12px;font-weight:800}
      .v73-bars{display:grid;gap:11px}.v73-bar{display:grid;grid-template-columns:minmax(150px,1.2fr) minmax(180px,3fr) 82px;gap:12px;align-items:center}.v73-bar-label{min-width:0}.v73-bar-label strong{display:block;color:#153847;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v73-bar-label small{color:#607788;font-weight:800}.v73-track{height:15px;border-radius:999px;background:#eaf1f4;overflow:hidden}.v73-fill{height:100%;min-width:3px;border-radius:inherit;background:linear-gradient(90deg,#073F5A,#0c719b)}.v73-bar:first-child .v73-fill{background:linear-gradient(90deg,#b88518,#d6a842)}.v73-bar-pct{text-align:right;color:#073F5A;font-size:14px;font-weight:900}
      .v73-mix-table-wrap{overflow:auto;border:1px solid #d8e5ea;border-radius:16px}.v73-mix-table{width:100%;min-width:560px;border-collapse:collapse;background:#fff}.v73-mix-table th,.v73-mix-table td{padding:10px 12px;border-bottom:1px solid #e4eef2;text-align:left}.v73-mix-table th{background:#f3f8fb;color:#073F5A;font-size:11px;text-transform:uppercase;letter-spacing:.03em}.v73-mix-table th:first-child,.v73-mix-table td:first-child{width:54px;text-align:center}.v73-mix-table th:nth-child(3),.v73-mix-table td:nth-child(3),.v73-mix-table th:nth-child(4),.v73-mix-table td:nth-child(4){text-align:right;white-space:nowrap}.v73-share{display:inline-flex;justify-content:center;min-width:66px;padding:5px 8px;border-radius:999px;background:rgba(7,63,90,.08);color:#073F5A;font-weight:900}
      @media(max-width:800px){.v73-kpis{grid-template-columns:1fr}.v73-bar{grid-template-columns:1fr 70px;gap:6px 10px}.v73-track{grid-column:1/-1;grid-row:2}.v73-bar-pct{grid-column:2;grid-row:1}}
    `;
    document.head.appendChild(st);
  }

  function mix(root) {
    const map = new Map();
    Array.from(root.querySelectorAll('.v68-table tbody tr')).forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 4) return;
      const name = txt(cells[1]) || 'Peça sem identificação';
      const quantity = brNumber(txt(cells[3]));
      if (quantity <= 0) return;
      map.set(name, (map.get(name) || 0) + quantity);
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    const items = Array.from(map, ([name, quantity]) => ({
      name, quantity, share: total ? quantity / total * 100 : 0
    })).sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'pt-BR'));
    return { total, items };
  }

  function mixSection(items, total) {
    if (!items.length || total <= 0) return '';
    const leader = items[0];
    const top3 = items.slice(0, 3).reduce((s, x) => s + x.share, 0);
    return `<section class="v73-mix" data-v73-mix>
      <div class="v73-mix-head"><div><span class="kicker">Visão empresarial</span><h3>Mix de produção por peça</h3><p>Todas as peças produzidas no período e quanto cada uma representa do volume total filtrado.</p></div><span class="v73-total-pill">${fmt(total)} peças no total</span></div>
      <div class="v73-kpis">
        <div class="v73-kpi"><small>Peças/modelos diferentes</small><strong>${items.length}</strong><span>Itens que tiveram produção no filtro atual.</span></div>
        <div class="v73-kpi"><small>Maior participação</small><strong>${esc(leader.name)}</strong><span>${fmt(leader.quantity)} peças • ${pct(leader.share)}</span></div>
        <div class="v73-kpi"><small>Concentração Top 3</small><strong>${pct(top3)}</strong><span>Participação conjunta das três peças mais produzidas.</span></div>
      </div>
      <div class="v73-chart"><div class="v73-chart-title"><h4>Participação no volume produzido</h4><span>Percentual sobre ${fmt(total)} peças</span></div><div class="v73-bars">
        ${items.map((x, i) => `<div class="v73-bar"><div class="v73-bar-label"><strong title="${esc(x.name)}">${i + 1}. ${esc(x.name)}</strong><small>${fmt(x.quantity)} peça(s)</small></div><div class="v73-track"><div class="v73-fill" style="width:${Math.max(0, Math.min(100, x.share)).toFixed(3)}%"></div></div><div class="v73-bar-pct">${pct(x.share)}</div></div>`).join('')}
      </div></div>
      <div class="v73-mix-table-wrap"><table class="v73-mix-table"><thead><tr><th>#</th><th>Peça / produto</th><th>Quantidade</th><th>Participação</th></tr></thead><tbody>
        ${items.map((x, i) => `<tr><td>${i + 1}</td><td><strong>${esc(x.name)}</strong></td><td>${fmt(x.quantity)}</td><td><span class="v73-share">${pct(x.share)}</span></td></tr>`).join('')}
      </tbody></table></div>
    </section>`;
  }

  function enhance(root) {
    if (!root || root.querySelector('[data-v73-mix]')) return;
    const result = root.querySelector('.v68-card');
    if (!result) return;
    const { items, total } = mix(root);
    if (!items.length) return;
    result.insertAdjacentHTML('beforebegin', mixSection(items, total));
  }

  function enhanceAll() { document.querySelectorAll('[data-report]').forEach(enhance); }

  function selected(selector) {
    const el = document.querySelector(selector);
    if (!el) return 'Todos';
    if (el.tagName === 'SELECT') return txt(el.selectedOptions?.[0]) || 'Todos';
    const value = String(el.value || '').trim();
    if (!value) return 'Todos';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      return `${d}/${m}/${y}`;
    }
    return value;
  }

  function company() {
    const value = txt(document.querySelector('.v68-hero .v68-pill.light')).replace(/^Empresa:\s*/i, '').trim();
    return value || 'Empresa';
  }

  function period() {
    const a = selected('[data-r-start]'), b = selected('[data-r-end]');
    return a === 'Todos' && b === 'Todos' ? 'Todos os períodos' : `${a} até ${b}`;
  }

  function metrics(root) {
    return Array.from(root.querySelectorAll('.v68-metrics .v68-metric')).map(card => ({
      label: txt(card.querySelector('small')), value: txt(card.querySelector('strong'))
    })).filter(x => x.label || x.value);
  }

  function launchTable(root) {
    const table = root.querySelector('.v68-table');
    if (!table) return '<div class="empty">Nenhum lançamento encontrado.</div>';
    const clone = table.cloneNode(true);
    clone.className = 'launch-table';
    clone.querySelectorAll('button,input,select,textarea').forEach(el => el.remove());
    clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
    return clone.outerHTML;
  }

  function totals(root) {
    const box = root.querySelector('.v68-total');
    if (!box) return '';
    const clone = box.cloneNode(true);
    clone.className = 'totals';
    clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
    return clone.outerHTML;
  }

  function logo() {
    try { return new URL(`logo.png?v=${V}`, location.href).href; }
    catch (_) { return `logo.png?v=${V}`; }
  }

  function printMix(items, total) {
    if (!items.length) return '';
    const leader = items[0], top3 = items.slice(0, 3).reduce((s, x) => s + x.share, 0);
    return `<section class="mix-print"><div class="section-head"><div><span class="eyebrow">Visão empresarial</span><h3>Mix de produção por peça</h3><p>Todas as peças produzidas e a participação de cada uma no volume total filtrado.</p></div><b class="total-pill">${fmt(total)} peças</b></div>
      <div class="mix-kpis"><div><small>Peças/modelos</small><strong>${items.length}</strong></div><div><small>Líder</small><strong>${esc(leader.name)}</strong><span>${pct(leader.share)}</span></div><div><small>Top 3</small><strong>${pct(top3)}</strong><span>do volume</span></div></div>
      <div class="mix-grid"><div class="bars">${items.map((x, i) => `<div class="bar"><div class="bar-label"><strong>${i + 1}. ${esc(x.name)}</strong><small>${fmt(x.quantity)} peça(s)</small></div><div class="track"><div class="fill" style="width:${Math.max(0, Math.min(100, x.share)).toFixed(3)}%"></div></div><b>${pct(x.share)}</b></div>`).join('')}</div>
      <table class="mix-table"><thead><tr><th>#</th><th>Peça / produto</th><th>Qtd.</th><th>%</th></tr></thead><tbody>${items.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${fmt(x.quantity)}</td><td>${pct(x.share)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function printHTML(root) {
    const { items, total } = mix(root);
    const met = metrics(root);
    const generated = new Date().toLocaleString('pt-BR');
    const empresa = company();
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Apontamento</title><style>
      @page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#153847;background:#fff;font-size:10px}.page{width:100%}
      .header{display:flex;justify-content:space-between;align-items:center;gap:20px;border-bottom:3px solid #073F5A;padding-bottom:10px;margin-bottom:12px}.brand{display:flex;align-items:center;gap:11px}.brand img{width:50px;height:50px;object-fit:contain;border-radius:14px;background:#073F5A}.brand h1{margin:0;color:#073F5A;font-size:22px}.brand small,.meta{color:#607788;font-weight:700}.meta{text-align:right;line-height:1.45}
      .hero{background:linear-gradient(135deg,#073F5A,#0b5678);color:#fff;border-radius:16px;padding:12px 15px;margin-bottom:10px}.hero h2{margin:2px 0 4px;font-size:18px;color:#fff}.hero p{margin:0;opacity:.9}.eyebrow{display:block;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;opacity:.82}
      .filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-bottom:10px}.filter,.metric{border:1px solid #d8e5ea;border-radius:10px;padding:8px 9px;background:#f8fbfc}.filter small,.metric small,.mix-kpis small{display:block;color:#607788;font-weight:900;text-transform:uppercase;font-size:8px;letter-spacing:.04em;margin-bottom:3px}.filter strong{color:#073F5A;font-size:10px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-bottom:11px}.metric{background:#fff}.metric strong{display:block;color:#073F5A;font-size:16px}
      .mix-print{border:1px solid #cfe0e7;border-radius:14px;padding:11px;margin:11px 0 13px;background:#fbfdfe}.section-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:8px}.section-head h3{margin:2px 0;color:#073F5A;font-size:15px}.section-head p{margin:0;color:#607788}.total-pill{padding:6px 9px;border-radius:999px;background:#f7ecd0;color:#8a6415;white-space:nowrap}.mix-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:9px}.mix-kpis>div{border:1px solid #d8e5ea;border-radius:9px;padding:7px 8px;background:#fff}.mix-kpis strong{display:block;color:#073F5A;font-size:12px}.mix-kpis span{color:#607788;font-size:8px}.mix-grid{display:grid;grid-template-columns:1.35fr .9fr;gap:10px;align-items:start}.bars{display:grid;gap:5px}.bar{display:grid;grid-template-columns:minmax(110px,1.15fr) minmax(150px,2.6fr) 44px;gap:6px;align-items:center;page-break-inside:avoid}.bar-label{min-width:0}.bar-label strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:8.5px}.bar-label small{color:#607788;font-size:7.5px}.track{height:9px;background:#eaf1f4;border-radius:999px;overflow:hidden}.fill{height:100%;min-width:2px;border-radius:inherit;background:linear-gradient(90deg,#073F5A,#0c719b)}.bar:first-child .fill{background:linear-gradient(90deg,#b88518,#d6a842)}.bar>b{text-align:right;color:#073F5A;font-size:8px}
      table{width:100%;border-collapse:collapse}th{background:#073F5A;color:#fff;padding:6px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.03em}td{padding:5.5px 6px;border-bottom:1px solid #e4eef2;vertical-align:top}tr:nth-child(even) td{background:#f8fbfc}.mix-table{font-size:8px;border:1px solid #d8e5ea}.mix-table th:first-child,.mix-table td:first-child{width:28px;text-align:center}.mix-table th:nth-child(3),.mix-table td:nth-child(3),.mix-table th:nth-child(4),.mix-table td:nth-child(4){text-align:right;white-space:nowrap}
      .launch-title{display:flex;justify-content:space-between;align-items:end;margin:11px 0 6px}.launch-title h3{margin:0;color:#073F5A;font-size:13px}.launch-title span{color:#607788;font-weight:800}.launch-table{border:1px solid #d8e5ea;font-size:8px}.totals{margin-top:8px;padding:8px 10px;border:1px solid #e6c77f;border-radius:10px;background:#fcf7ea;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.totals .v68-line{display:grid;gap:2px}.totals span{color:#8a6415;text-transform:uppercase;font-size:7px;font-weight:900}.totals b{color:#073F5A;font-size:11px}.footer{margin-top:12px;padding-top:7px;border-top:1px solid #d8e5ea;display:flex;justify-content:space-between;color:#607788;font-size:8px}.empty{padding:16px;border:1px dashed #cfe0e7;text-align:center;color:#607788}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body><main class="page">
      <header class="header"><div class="brand"><img src="${esc(logo())}" alt="Excellence System"><div><h1>Excellence System®</h1><small>MP Consultoria • Relatório gerencial de produção</small></div></div><div class="meta">Relatório de Apontamento<br>${esc(empresa)}<br>Gerado em ${esc(generated)}</div></header>
      <section class="hero"><span class="eyebrow">Produção e composição</span><h2>Apontamento de produção</h2><p>Visão consolidada de volume, horas, rendimento e participação de cada peça no período selecionado.</p></section>
      <section class="filters"><div class="filter"><small>Período</small><strong>${esc(period())}</strong></div><div class="filter"><small>Processo</small><strong>${esc(selected('[data-r-prod]'))}</strong></div><div class="filter"><small>Equipe/célula</small><strong>${esc(selected('[data-r-eq]'))}</strong></div><div class="filter"><small>Funcionário</small><strong>${esc(selected('[data-r-func]'))}</strong></div><div class="filter"><small>Empresa</small><strong>${esc(empresa)}</strong></div></section>
      <section class="metrics">${met.map(x => `<div class="metric"><small>${esc(x.label)}</small><strong>${esc(x.value)}</strong></div>`).join('')}</section>
      ${printMix(items,total)}
      <div class="launch-title"><h3>Lançamentos detalhados do período</h3><span>${items.length} peça(s)/modelo(s) no mix</span></div>${launchTable(root)}${totals(root)}
      <footer class="footer"><span>Relatório gerado automaticamente pelo Excellence System®.</span><span>Percentuais calculados sobre a quantidade total produzida nos filtros selecionados.</span></footer>
    </main></body></html>`;
  }

  function print(root) {
    const iframe = document.createElement('iframe');
    iframe.title = 'Relatório gerencial de apontamento';
    Object.assign(iframe.style, { position:'fixed', right:'0', bottom:'0', width:'0', height:'0', border:'0', opacity:'0' });
    document.body.appendChild(iframe);
    const w = iframe.contentWindow, d = w.document;
    d.open(); d.write(printHTML(root)); d.close();
    w.addEventListener('afterprint', () => setTimeout(() => iframe.remove(), 1200), { once:true });
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) { console.error(e); iframe.remove(); } }, 350);
  }

  css();
  new MutationObserver(enhanceAll).observe(document.documentElement, { childList:true, subtree:true });
  enhanceAll();

  document.addEventListener('click', event => {
    const btn = event.target.closest?.('[data-print]');
    if (!btn) return;
    const root = btn.closest('[data-report]');
    if (!root || !btn.closest('.v68')) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    enhance(root); print(root);
  }, true);

  console.info(`Excellence System® mix gerencial ${V} carregado.`);
})();
