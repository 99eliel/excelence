(function () {
  const V = '20260821-93';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const text = (el) => String(el?.textContent || '').replace(/\s+/g, ' ').trim();
  const norm = (v = '') => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const esc = (v = '') => String(v ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const REPORT_NAMES = {
    geral: 'Relatório geral de treinamentos',
    treinamento: 'Relatório do treinamento',
    funcionario: 'Dossiê por funcionário',
    matriz: 'Matriz de competências',
    pendencias: 'Pendências e atrasados',
    eficacia: 'Relatório de eficácia',
    evidencias: 'Evidências de treinamentos',
    auditoria: 'Dossiê de auditoria'
  };

  function num(v) {
    const raw = String(v ?? '').trim().replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function percent(a, b) {
    return b ? Math.round((a / b) * 100) : 0;
  }

  function dateInput(v = '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return v || '';
    const [y, m, d] = v.split('-');
    return `${d}/${m}/${y}`;
  }

  function selected(selector, fallback = 'Todos') {
    const el = $(selector);
    if (!el) return fallback;
    if (el.tagName === 'SELECT') return text(el.selectedOptions?.[0]) || fallback;
    return String(el.value || '').trim() || fallback;
  }

  function context() {
    const from = dateInput($('[data-r-from]')?.value || '');
    const to = dateInput($('[data-r-to]')?.value || '');
    const type = $('[data-r-type]')?.value || 'geral';
    return {
      company: text($('.tr-hero h1')) || 'Empresa',
      type,
      typeName: REPORT_NAMES[type] || 'Relatório de treinamentos',
      training: selected('[data-r-training]', 'Todos os treinamentos'),
      employee: selected('[data-r-employee]', 'Todos'),
      sector: selected('[data-r-sector]', 'Todos'),
      status: selected('[data-r-status]', 'Todos'),
      period: from || to ? `${from || 'Início'} até ${to || 'Hoje'}` : 'Todo o período'
    };
  }

  function validRows(table) {
    if (!table) return [];
    return $$('tbody tr', table).filter((row) => {
      const t = norm(text(row));
      return $$('td', row).length &&
        !t.includes('sem dados') &&
        !t.includes('nenhum') &&
        !t.includes('publico ainda nao definido');
    });
  }

  function collect(preview, type) {
    const out = {
      trainings: 0,
      total: 0,
      completed: 0,
      effective: 0,
      pending: 0,
      evidence: $$('.tr-evidence', preview).length,
      late: 0,
      trainingRows: []
    };

    const legacy = {};
    $$('.tr-report-kpi', preview).forEach((card) => {
      legacy[norm(text($('small', card)))] = num(text($('strong', card)));
    });

    if (type === 'geral') {
      const rows = validRows($('.tr-report-block .tr-table', preview));
      out.trainings = rows.length;
      rows.forEach((row) => {
        const c = $$('td', row);
        if (c.length < 7) return;
        const item = {
          name: text(c[0]),
          stage: text(c[1]),
          date: text(c[2]),
          total: num(text(c[3])),
          completed: num(text(c[4])),
          effective: num(text(c[5])),
          pending: num(text(c[6]))
        };
        out.trainingRows.push(item);
        out.total += item.total;
        out.completed += item.completed;
        out.effective += item.effective;
        out.pending += item.pending;
      });
      out.evidence = legacy.evidencias || out.evidence;
      return out;
    }

    if (type === 'treinamento') {
      const blocks = $$('.tr-report-block', preview);
      out.trainings = blocks.length;
      blocks.forEach((block) => {
        const rows = validRows($('.tr-table', block));
        const item = {
          name: text($('h3', block)) || 'Treinamento',
          stage: 'Treinamento',
          date: '-',
          total: rows.length,
          completed: 0,
          effective: 0,
          pending: 0
        };
        rows.forEach((row) => {
          const c = $$('td', row);
          const st = norm(text(c[2]));
          const ef = norm(text(c[4]));
          if (st.includes('concluido')) item.completed++;
          if (ef.includes('eficaz') && !ef.includes('ineficaz')) item.effective++;
        });
        item.pending = Math.max(0, item.total - item.completed);
        out.trainingRows.push(item);
        out.total += item.total;
        out.completed += item.completed;
        out.effective += item.effective;
        out.pending += item.pending;
      });
      return out;
    }

    if (type === 'funcionario') {
      const set = new Set();
      $$('.tr-report-block .tr-table', preview).flatMap(validRows).forEach((row) => {
        const c = $$('td', row);
        out.total++;
        set.add(text(c[0]));
        if (norm(text(c[1])).includes('concluido')) out.completed++;
        const ef = norm(text(c[3]));
        if (ef.includes('eficaz') && !ef.includes('ineficaz')) out.effective++;
      });
      out.trainings = set.size;
      out.pending = Math.max(0, out.total - out.completed);
      return out;
    }

    if (type === 'pendencias') {
      const rows = validRows($('.tr-table', preview));
      out.total = out.pending = rows.length;
      out.late = rows.filter((r) => norm(text(r)).includes('atrasado')).length;
      out.trainings = new Set(rows.map((r) => text($$('td', r)[1]))).size;
      return out;
    }

    if (type === 'eficacia') {
      const rows = validRows($('.tr-table', preview));
      out.total = rows.length;
      out.trainings = new Set(rows.map((r) => text($$('td', r)[1]))).size;
      rows.forEach((row) => {
        const ef = norm(text($$('td', row)[3]));
        if (ef.includes('eficaz') && !ef.includes('ineficaz')) out.effective++;
        if (ef.includes('ineficaz')) out.pending++;
      });
      out.completed = out.effective;
      return out;
    }

    if (type === 'matriz') {
      const table = $('.tr-table', preview);
      out.trainings = Math.max(0, $$('thead th', table).length - 1);
      validRows(table).forEach((row) => {
        $$('td', row).slice(1).forEach((cell) => {
          const v = norm(text(cell));
          if (!v || v === '—' || v === '-') return;
          out.total++;
          if (v.includes('concluido')) out.completed++;
          if (v.includes('eficaz') && !v.includes('ineficaz')) out.effective++;
        });
      });
      out.pending = Math.max(0, out.total - out.completed);
      return out;
    }

    if (type === 'evidencias') {
      out.trainings = new Set($$('.tr-evidence strong', preview).map(text)).size;
      return out;
    }

    if (type === 'auditoria') {
      out.trainings = legacy.treinamentos || 0;
      out.total = legacy.competencias || 0;
      out.completed = legacy.concluidas || 0;
      out.effective = legacy.eficazes || 0;
      out.evidence = legacy.evidencias || out.evidence;
      out.pending = Math.max(0, out.total - out.completed);
      return out;
    }

    return out;
  }

  function injectCss() {
    if ($('#tr93-style')) return;
    const style = document.createElement('style');
    style.id = 'tr93-style';
    style.textContent = `
      .tr-report-preview.tr93{padding:0!important;overflow:hidden!important;background:#f4f8fa!important;border:0!important;border-radius:20px!important}
      .tr93-head{background:linear-gradient(135deg,#073F5A,#0B607F);color:#fff;padding:20px 22px;display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
      .tr93-brand{display:flex;gap:12px;align-items:center}.tr93-logo{width:50px;height:50px;object-fit:contain;background:#fff;border-radius:12px;padding:4px}
      .tr93-head small{display:block;color:#bfdae4;font-size:10px;font-weight:900;letter-spacing:.08em}.tr93-head h2{margin:4px 0!important;color:#fff!important;font-size:24px!important}.tr93-head p{margin:0;color:#deedf2}
      .tr93-meta{text-align:right;background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.2);padding:10px 12px;border-radius:12px}.tr93-meta strong{display:block}.tr93-meta span{font-size:11px;color:#d7e9ef}
      .tr93-filters{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr 1fr;background:#dbe8ed;gap:1px}.tr93-filter{background:#f8fbfc;padding:9px 11px;min-width:0}.tr93-filter small{display:block;font-size:9px;color:#607788;text-transform:uppercase;font-weight:900}.tr93-filter strong{display:block;margin-top:3px;color:#073F5A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .tr93-exec{padding:16px 18px 9px}.tr93-section-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px}.tr93-section-title h3{margin:0!important;color:#073F5A!important;font-size:18px!important}.tr93-section-title span{font-size:11px;color:#607788}
      .tr93-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.tr93-kpi{background:#fff;border:1px solid #d8e5e9;border-radius:12px;padding:10px}.tr93-kpi small{display:block;color:#607788;font-size:9px;text-transform:uppercase;font-weight:900}.tr93-kpi strong{display:block;color:#073F5A;font-size:22px;margin-top:2px}.tr93-kpi.good strong{color:#2d7c4d}.tr93-kpi.warn strong{color:#9a6b0a}
      .tr93-bars{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.tr93-bar{background:#fff;border:1px solid #d8e5e9;border-radius:11px;padding:9px}.tr93-bar-top{display:flex;justify-content:space-between;font-size:11px;font-weight:850;margin-bottom:5px}.tr93-track{height:7px;border-radius:999px;overflow:hidden;background:#e8eff2}.tr93-track i{display:block;height:100%;background:linear-gradient(90deg,#0B607F,#16A0CE)}.tr93-bar.good .tr93-track i{background:linear-gradient(90deg,#3b965f,#59b978)}
      .tr93-overview{padding:0 18px 12px}.tr93-overview h3{margin:0 0 8px!important;color:#073F5A!important}.tr93-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tr93-card{background:#fff;border:1px solid #d8e5e9;border-radius:12px;padding:10px}.tr93-card-top{display:flex;justify-content:space-between;gap:8px}.tr93-card-top strong{color:#073F5A}.tr93-card small{color:#607788}.tr93-mini{height:5px;background:#e8eff2;border-radius:999px;overflow:hidden;margin-top:6px}.tr93-mini i{display:block;height:100%;background:#3b965f}
      .tr93 .tr-report-kpis{display:none!important}.tr93>.tr-report-title{display:none!important}.tr93>.tr-report-block,.tr93>.tr-table-wrap,.tr93>.tr-evidence-list,.tr93>.tr-audit-cover,.tr93>.tr-report-note{margin-left:18px!important;margin-right:18px!important}
      .tr93 .tr-report-block{background:#fff;border:1px solid #d8e5e9;border-radius:13px;padding:12px;margin-top:8px}.tr93 .tr-report-block h3{color:#073F5A!important}.tr93 .tr-table{border:1px solid #d8e5e9;border-radius:10px;overflow:hidden}.tr93 .tr-table th{background:#edf4f7!important}.tr93 .tr-table tbody tr:nth-child(even){background:#fbfdfe}
      .tr93-footer{display:flex;justify-content:space-between;gap:15px;margin:14px 18px 0;padding:11px 0 16px;border-top:1px solid #d8e5e9;color:#607788;font-size:11px}.tr93-footer strong{color:#073F5A}
      @media(max-width:900px){.tr93-kpis{grid-template-columns:repeat(3,1fr)}.tr93-filters,.tr93-bars,.tr93-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:650px){.tr93-head{flex-direction:column}.tr93-meta{text-align:left;width:100%}.tr93-kpis,.tr93-filters,.tr93-bars,.tr93-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function logoUrl() {
    try { return new URL('logo.png', window.location.href).href; }
    catch (_) { return 'logo.png'; }
  }

  function kpi(label, value, cls = '') {
    return `<div class="tr93-kpi ${cls}"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`;
  }

  function executive(stats, ctx) {
    const completion = percent(stats.completed, stats.total);
    const efficacy = percent(stats.effective, stats.total);
    const cards = [kpi('Treinamentos', stats.trainings)];

    if (ctx.type !== 'evidencias') cards.push(kpi(ctx.type === 'pendencias' ? 'Pendências' : 'Público obrigatório', stats.total));
    if (!['pendencias', 'evidencias'].includes(ctx.type)) {
      cards.push(kpi('Concluídos', stats.completed, 'good'));
      cards.push(kpi('Eficazes', stats.effective, 'good'));
    }
    if (ctx.type !== 'evidencias') {
      cards.push(kpi(ctx.type === 'pendencias' ? 'Atrasados' : 'Pendências', ctx.type === 'pendencias' ? stats.late : stats.pending, (stats.pending || stats.late) ? 'warn' : ''));
    }
    cards.push(kpi('Evidências', stats.evidence));

    const bars = stats.total && !['pendencias', 'evidencias'].includes(ctx.type)
      ? `<div class="tr93-bars">
           <div class="tr93-bar"><div class="tr93-bar-top"><span>Conclusão do público</span><strong>${completion}%</strong></div><div class="tr93-track"><i style="width:${completion}%"></i></div></div>
           <div class="tr93-bar good"><div class="tr93-bar-top"><span>Eficácia validada</span><strong>${efficacy}%</strong></div><div class="tr93-track"><i style="width:${efficacy}%"></i></div></div>
         </div>` : '';

    return `<section class="tr93-exec">
      <div class="tr93-section-title"><h3>Resumo executivo</h3><span>Visão gerencial do filtro selecionado</span></div>
      <div class="tr93-kpis">${cards.join('')}</div>${bars}
    </section>`;
  }

  function overview(rows) {
    if (!rows?.length) return '';
    return `<section class="tr93-overview"><h3>Panorama por treinamento</h3><div class="tr93-grid">${
      rows.map((x) => {
        const completion = percent(x.completed, x.total);
        return `<div class="tr93-card"><div class="tr93-card-top"><strong>${esc(x.name)}</strong><small>${esc(x.stage)}</small></div>
          <small>Previsão ${esc(x.date || '-')} • ${x.completed}/${x.total} concluídos • ${x.effective} eficazes • ${x.pending} pendentes</small>
          <div class="tr93-mini"><i style="width:${completion}%"></i></div></div>`;
      }).join('')
    }</div></section>`;
  }

  function filters(ctx, cls = 'tr93-filters') {
    const items = [
      ['Treinamento', ctx.training],
      ['Período', ctx.period],
      ['Funcionário', ctx.employee],
      ['Setor', ctx.sector],
      ['Status', ctx.status]
    ];
    return `<div class="${cls}">${items.map(([l, v]) => `<div class="tr93-filter"><small>${esc(l)}</small><strong>${esc(v)}</strong></div>`).join('')}</div>`;
  }

  function brandedHeader(ctx) {
    return `<div class="tr93-head">
      <div class="tr93-brand"><img class="tr93-logo" src="${esc(logoUrl())}" alt="Excellence System"><div>
        <small>EXCELLENCE SYSTEM® • MP CONSULTORIA</small>
        <h2>${esc(ctx.typeName)}</h2>
        <p>${esc(ctx.company)}</p>
      </div></div>
      <div class="tr93-meta"><strong>${esc(ctx.training)}</strong><span>${new Date().toLocaleString('pt-BR')} • ${V}</span></div>
    </div>`;
  }

  function brandedFooter() {
    return `<div class="tr93-footer"><div><strong>Excellence System®</strong><br>Gestão da Qualidade e Desenvolvimento</div><div><strong>MP Consultoria</strong><br>Relatório gerado automaticamente</div></div>`;
  }

  function enhance(preview) {
    if (!preview || preview.dataset.v93 === '1') return;
    preview.dataset.v93 = '1';
    preview.classList.add('tr93');

    const ctx = context();
    const stats = collect(preview, ctx.type);
    const wrap = document.createElement('div');
    wrap.innerHTML = `${brandedHeader(ctx)}${filters(ctx)}${executive(stats, ctx)}${['geral', 'treinamento'].includes(ctx.type) ? overview(stats.trainingRows) : ''}`;
    Array.from(wrap.children).reverse().forEach((el) => preview.prepend(el));
    preview.insertAdjacentHTML('beforeend', brandedFooter());
  }

  function print(preview) {
    enhance(preview);
    const ctx = context();
    const stats = collect(preview, ctx.type);
    const clone = preview.cloneNode(true);

    $$('.tr93-head,.tr93-filters,.tr93-exec,.tr93-overview,.tr93-footer', clone).forEach((el) => el.remove());
    $$('.tr-report-title,.tr-report-kpis', clone).forEach((el) => el.remove());
    $$('button,.tr-btn', clone).forEach((el) => el.remove());

    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);

    const d = frame.contentDocument;
    const w = frame.contentWindow;
    const completion = percent(stats.completed, stats.total);
    const efficacy = percent(stats.effective, stats.total);
    const cards = [
      ['Treinamentos', stats.trainings],
      [ctx.type === 'pendencias' ? 'Pendências' : 'Público obrigatório', stats.total],
      ['Concluídos', stats.completed],
      ['Eficazes', stats.effective],
      [ctx.type === 'pendencias' ? 'Atrasados' : 'Pendências', ctx.type === 'pendencias' ? stats.late : stats.pending],
      ['Evidências', stats.evidence]
    ];

    d.open();
    d.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(ctx.typeName)}</title><style>
      @page{size:A4 landscape;margin:5mm}
      *{box-sizing:border-box}
      body{margin:0;font-family:Arial,sans-serif;color:#173846;font-size:7.3px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .header{display:flex;align-items:center;justify-content:space-between;gap:15px;padding-bottom:5px;border-bottom:2px solid #073F5A}
      .brand{display:flex;align-items:center;gap:8px}.brand img{width:31px;height:31px;object-fit:contain}.brand h1{margin:0;color:#073F5A;font-size:13px}.brand small{display:block;color:#607788;font-size:5.4px}
      .stamp{text-align:right;color:#607788;font-size:5.5px}.stamp strong{display:block;color:#073F5A;font-size:7px}
      .band{margin-top:4px;background:#073F5A;color:#fff;padding:5px 7px;border-radius:5px;display:flex;justify-content:space-between;align-items:center}.band small{font-size:4.8px;color:#bfdae4}.band h2{margin:1px 0 0;font-size:10px}.band span{font-size:5.5px}
      .filters{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr 1fr;gap:3px;margin-top:4px}.filter{border:1px solid #d5e2e7;border-radius:4px;padding:3px 5px;background:#f8fbfc}.filter small{display:block;color:#607788;text-transform:uppercase;font-size:4px;font-weight:bold}.filter strong{display:block;color:#073F5A;font-size:5.4px;margin-top:1px}
      .section-title{margin:5px 0 3px;color:#073F5A;font-size:7px;font-weight:bold}
      .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:3px}.kpi{border:1px solid #d5e2e7;border-radius:4px;padding:3px 5px;background:#fbfdfe}.kpi small{display:block;color:#607788;text-transform:uppercase;font-size:4px}.kpi strong{display:block;color:#073F5A;font-size:9px;margin-top:1px}
      .bars{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:4px}.bar{border:1px solid #d5e2e7;border-radius:4px;padding:3px 5px}.bar-top{display:flex;justify-content:space-between;font-size:4.7px;font-weight:bold}.track{height:3.5px;background:#e7eef1;border-radius:99px;overflow:hidden;margin-top:2px}.track i{display:block;height:100%;background:#0B607F}.bar.good .track i{background:#3b965f}
      .overview{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px;margin-top:3px}.overview-card{border:1px solid #d5e2e7;border-radius:4px;padding:3px 5px}.overview-card strong{color:#073F5A;font-size:5.5px}.overview-card small{display:block;color:#607788;font-size:4.3px;margin-top:1px}
      .detail{margin-top:5px;border-top:1px solid #dbe5e9;padding-top:3px}
      .tr-report-block{margin-top:4px}.tr-report-block h3{margin:0 0 2px;color:#073F5A;font-size:6.5px}.tr-report-note{font-size:4.7px;color:#607788}
      .tr-table{width:100%;border-collapse:collapse;min-width:0!important;font-size:5px}.tr-table th,.tr-table td{border:1px solid #d6e2e7;padding:2.2px 3px;text-align:left;vertical-align:top}.tr-table th{background:#edf4f7;color:#536f7a;font-size:4.3px;text-transform:uppercase}.tr-table thead{display:table-header-group}.tr-table tr{break-inside:avoid}
      .tr-badge{display:inline-block;border:1px solid #c8d9df;border-radius:99px;padding:1px 3px;font-size:4.2px;background:#f4f8fa}.tr-evidence-list{display:grid;grid-template-columns:1fr 1fr;gap:3px}.tr-evidence{border:1px solid #d6e2e7;border-radius:4px;padding:3px}.tr-audit-cover{border:1px solid #073F5A;padding:4px}
      .signatures{display:grid;grid-template-columns:1fr 1fr;gap:45px;margin-top:10px}.signatures div{border-top:1px solid #718893;text-align:center;padding-top:3px;color:#607788;font-size:4.8px}
      .footer{margin-top:5px;padding-top:3px;border-top:1px solid #dbe5e9;display:flex;justify-content:space-between;color:#738891;font-size:4.3px}
    </style></head><body>
      <div class="header"><div class="brand"><img src="${esc(logoUrl())}"><div><h1>Excellence System®</h1><small>MP Consultoria • Gestão da Qualidade e Desenvolvimento</small></div></div><div class="stamp"><strong>${esc(ctx.company)}</strong>${new Date().toLocaleString('pt-BR')} • ${V}</div></div>
      <div class="band"><div><small>TREINAMENTOS E DESENVOLVIMENTO</small><h2>${esc(ctx.typeName)}</h2></div><span>${esc(ctx.training)}</span></div>
      <div class="filters">${[
        ['Treinamento', ctx.training], ['Período', ctx.period], ['Funcionário', ctx.employee], ['Setor', ctx.sector], ['Status', ctx.status]
      ].map(([l,v]) => `<div class="filter"><small>${esc(l)}</small><strong>${esc(v)}</strong></div>`).join('')}</div>
      <div class="section-title">Resumo executivo</div>
      <div class="kpis">${cards.map(([l,v]) => `<div class="kpi"><small>${esc(l)}</small><strong>${esc(v)}</strong></div>`).join('')}</div>
      ${stats.total && !['pendencias','evidencias'].includes(ctx.type) ? `<div class="bars">
        <div class="bar"><div class="bar-top"><span>Conclusão do público</span><strong>${completion}%</strong></div><div class="track"><i style="width:${completion}%"></i></div></div>
        <div class="bar good"><div class="bar-top"><span>Eficácia validada</span><strong>${efficacy}%</strong></div><div class="track"><i style="width:${efficacy}%"></i></div></div>
      </div>` : ''}
      ${stats.trainingRows.length ? `<div class="section-title">Panorama por treinamento</div><div class="overview">${stats.trainingRows.map((x) => `<div class="overview-card"><strong>${esc(x.name)}</strong><small>${esc(x.stage)} • ${x.completed}/${x.total} concluídos • ${x.effective} eficazes • ${x.pending} pendentes</small></div>`).join('')}</div>` : ''}
      <div class="detail">${clone.innerHTML}</div>
      <div class="signatures"><div>Responsável pelo treinamento / RH</div><div>Responsável pela empresa</div></div>
      <div class="footer"><span>Relatório gerado automaticamente pelo Excellence System®</span><span>MP Consultoria • ${new Date().toLocaleString('pt-BR')}</span></div>
    </body></html>`);
    d.close();

    const images = Array.from(d.images);
    const ready = images.length ? Promise.all(images.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => {
      img.onload = img.onerror = resolve;
    }))) : Promise.resolve();

    ready.then(() => setTimeout(() => {
      w.focus();
      w.print();
      setTimeout(() => frame.remove(), 1200);
    }, 180));
  }

  function run() {
    requestAnimationFrame(() => {
      injectCss();
      enhance($('[data-report-preview]'));
    });
  }

  document.addEventListener('click', (event) => {
    const btn = event.target.closest?.('[data-r-print]');
    if (!btn || !btn.closest('.tr-root')) return;
    const preview = $('[data-report-preview]');
    if (!preview) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    print(preview);
  }, true);

  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', run);
  run();
  console.info(`Excellence System® relatórios de Treinamentos ${V} carregados.`);
})();
