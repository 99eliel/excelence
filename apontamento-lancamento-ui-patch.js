(function () {
  const V = '20260820-75';
  const STYLE_ID = 'apontamento-lancamento-ui-v75-css';

  function normalize(value = '') {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function css() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .v75-launch-card{padding:22px!important;overflow:visible}.v75-launch-card>h3{font-size:22px;margin:4px 0 5px;color:#073F5A}.v75-launch-card>p{max-width:900px;margin-bottom:0;color:var(--muted,#607788)}
      .v75-flow{display:flex;gap:8px;flex-wrap:wrap;margin:15px 0 18px}.v75-flow span{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border:1px solid #d8e5ea;border-radius:999px;background:#f7fbfc;color:#365664;font-size:12px;font-weight:900}.v75-flow b{display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#073F5A;color:#fff;font-size:10px}
      .v75-form-layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px;align-items:start}.v75-main{display:grid;gap:13px}.v75-section{border:1px solid #d8e5ea;border-radius:18px;background:#fff;overflow:hidden}.v75-section-head{display:flex;align-items:center;gap:11px;padding:13px 15px;border-bottom:1px solid #e5eef2;background:linear-gradient(180deg,#fbfdfe,#f5f9fb)}.v75-step{display:inline-flex;align-items:center;justify-content:center;flex:0 0 30px;width:30px;height:30px;border-radius:10px;background:#073F5A;color:#fff;font-weight:900;font-size:13px}.v75-section-head h4{margin:0;color:#073F5A;font-size:15px}.v75-section-head p{margin:2px 0 0;color:#607788;font-size:11px}.v75-section-body{padding:15px;display:grid;grid-template-columns:minmax(0,1fr) minmax(170px,.38fr);gap:12px}.v75-span-all{grid-column:1/-1}.v75-section-body>div>label:first-child,.v75-section-body details label:first-child{display:block;margin-bottom:6px;color:#274b5a;font-weight:900;font-size:12px}.v75-launch-card input,.v75-launch-card select,.v75-launch-card textarea{border-color:#cddde4!important;background:#fff!important;transition:border-color .15s ease,box-shadow .15s ease}.v75-launch-card input:not([type=checkbox]),.v75-launch-card select{min-height:44px}.v75-launch-card input:focus,.v75-launch-card select:focus,.v75-launch-card textarea:focus{outline:none;border-color:#0b6f93!important;box-shadow:0 0 0 3px rgba(11,111,147,.10)}
      .v75-launch-card .v68-team-grid{grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:9px}.v75-launch-card .v68-team-choice{border-radius:13px;padding:11px 12px;background:#fbfdfe}.v75-launch-card .v68-team-choice:has(input:checked){border-color:#d6a842;background:rgba(214,168,66,.11);box-shadow:0 0 0 2px rgba(214,168,66,.09)}
      .v75-launch-card .v68-list{margin-top:7px;gap:8px}.v75-launch-card .v68-worker{grid-template-columns:auto minmax(0,1fr) 125px;border-radius:13px;padding:10px 11px;background:#fbfdfe}.v75-launch-card .v68-worker:has(input[type=checkbox]:checked){border-color:#0b6f93;background:rgba(11,111,147,.055)}.v75-launch-card .v68-worker span>b{color:#153847}.v75-launch-card .v68-worker .muted{display:block;margin-top:2px;color:#607788;font-size:11px}.v75-launch-card .v68-worker input[type=number]{min-height:38px;text-align:right;font-weight:900;color:#073F5A}
      .v75-optional{grid-column:1/-1;border:1px dashed #c8d9e0;border-radius:13px;background:#fbfdfe;padding:0}.v75-optional summary{cursor:pointer;list-style:none;padding:11px 13px;color:#466572;font-weight:900;font-size:12px}.v75-optional summary::-webkit-details-marker{display:none}.v75-optional summary:before{content:'＋';display:inline-block;margin-right:7px;color:#0b6f93}.v75-optional[open] summary:before{content:'−'}.v75-optional .v75-optional-body{padding:0 12px 12px}
      .v75-summary-side{position:sticky;top:16px;border-radius:19px;padding:17px;background:linear-gradient(155deg,#073F5A,#082f43);color:#fff;box-shadow:0 16px 34px rgba(5,36,55,.18)}.v75-summary-side .v75-summary-kicker{display:block;color:#91cada;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.07em}.v75-summary-side h4{margin:4px 0 4px;color:#fff;font-size:18px}.v75-summary-side>p{margin:0 0 15px;color:rgba(255,255,255,.72);font-size:11px;line-height:1.45}.v75-summary-side [data-prev]{margin:0 0 14px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important}.v75-summary-side [data-prev] .v68-line{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.13);align-items:center}.v75-summary-side [data-prev] .v68-line:first-child{padding-top:2px}.v75-summary-side [data-prev] .v68-line span{color:rgba(255,255,255,.75);font-size:11px;font-weight:800}.v75-summary-side [data-prev] .v68-line b{color:#fff;text-align:right;font-size:13px}.v75-summary-side [data-prev] .v68-line:first-child b{color:#f0b23e;font-size:18px}.v75-save{width:100%;min-height:45px;border-radius:13px!important;font-size:13px!important;box-shadow:0 8px 20px rgba(214,168,66,.18)}.v75-summary-help{display:flex;align-items:center;gap:7px;margin-top:10px;color:rgba(255,255,255,.62);font-size:10px}.v75-summary-help:before{content:'✓';display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,.12);color:#f0b23e;font-weight:900}
      .v75-history{margin-top:4px}.v75-history>.v68-top{padding-bottom:8px;border-bottom:1px solid #e5eef2}.v75-history>.v68-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.v75-history .v68-item{margin:0;border-radius:14px;padding:12px;background:#fbfdfe}.v75-history .v68-item .v68-meta{font-size:11px}.v75-history .v68-item .btn-danger{padding:6px 9px}.v75-history.v75-collapsed>.v68-list>.v68-item:nth-child(n+7){display:none}.v75-history-toggle{margin-left:auto}.v75-history-count{display:inline-flex;align-items:center;padding:6px 9px;border-radius:999px;background:#eef5f7;color:#41616e;font-size:11px;font-weight:900}
      @media(max-width:1100px){.v75-form-layout{grid-template-columns:1fr}.v75-summary-side{position:static}.v75-section-body{grid-template-columns:1fr 1fr}.v75-history>.v68-list{grid-template-columns:1fr}}
      @media(max-width:700px){.v75-launch-card{padding:15px!important}.v75-section-body{grid-template-columns:1fr}.v75-span-all,.v75-optional{grid-column:1}.v75-launch-card .v68-worker{grid-template-columns:auto 1fr}.v75-launch-card .v68-worker input[type=number]{grid-column:1/-1}.v75-flow{gap:6px}.v75-flow span{font-size:11px}.v75-section-head{align-items:flex-start}}
    `;
    document.head.appendChild(style);
  }

  function fieldByName(form, name) {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return null;
    let el = input.parentElement;
    while (el && el !== form) {
      if (el.parentElement?.classList?.contains('v68-form')) return el;
      el = el.parentElement;
    }
    return input.parentElement;
  }

  function fieldByLabel(form, phrase) {
    const grid = form.querySelector('.v68-form');
    if (!grid) return null;
    return Array.from(grid.children).find(child => {
      const label = child.querySelector('label');
      return normalize(label?.textContent).includes(normalize(phrase));
    }) || null;
  }

  function relabel(wrapper, labelText) {
    const label = wrapper?.querySelector('label');
    if (label) label.childNodes.length ? label.childNodes[0].nodeValue = labelText : label.textContent = labelText;
  }

  function makeSection(step, title, subtitle) {
    const section = document.createElement('section');
    section.className = 'v75-section';
    section.innerHTML = `<div class="v75-section-head"><span class="v75-step">${step}</span><div><h4>${title}</h4><p>${subtitle}</p></div></div><div class="v75-section-body"></div>`;
    return section;
  }

  function enhanceLaunch(form) {
    if (!form || form.dataset.v75Enhanced === 'true') return;
    const oldGrid = form.querySelector('.v68-form');
    const preview = form.querySelector('[data-prev]');
    const saveButton = form.querySelector('button[type="submit"]');
    if (!oldGrid || !preview || !saveButton) return;

    const product = fieldByName(form, 'produtoId');
    const quantity = fieldByName(form, 'quantidade');
    const date = fieldByName(form, 'data');
    const teams = fieldByLabel(form, 'equipes / células');
    const cell = fieldByName(form, 'celula');
    const workers = fieldByLabel(form, 'funcionários e minutos reais');
    const observations = fieldByName(form, 'observacoes');
    if (!product || !quantity || !date || !teams || !workers || !observations) return;

    form.dataset.v75Enhanced = 'true';
    const card = form.closest('.v68-card');
    card?.classList.add('v75-launch-card');

    const title = card?.querySelector(':scope > h3');
    const intro = card?.querySelector(':scope > p');
    if (title) title.textContent = 'Registrar apontamento de produção';
    if (intro) intro.textContent = 'Preencha na ordem abaixo. O resumo é calculado automaticamente antes de salvar.';

    const flow = document.createElement('div');
    flow.className = 'v75-flow';
    flow.innerHTML = '<span><b>1</b>Produção</span><span><b>2</b>Equipe e tempo</span><span><b>3</b>Observações</span><span><b>4</b>Conferir e salvar</span>';
    intro?.insertAdjacentElement('afterend', flow);

    relabel(product, 'Peça / processo produzido');
    relabel(quantity, 'Quantidade produzida');
    relabel(teams, 'Equipe / célula responsável');
    relabel(workers, 'Participantes e minutos trabalhados');
    relabel(observations, 'Observações do lançamento (opcional)');

    product.classList.add('v75-span-all');
    teams.classList.add('v75-span-all');
    workers.classList.add('v75-span-all');
    observations.classList.add('v75-span-all');

    const section1 = makeSection('1', 'O que foi produzido', 'Escolha a peça ou processo, informe a quantidade e confirme a data.');
    const body1 = section1.querySelector('.v75-section-body');
    body1.append(product, quantity, date);

    const section2 = makeSection('2', 'Quem produziu e por quanto tempo', 'Selecione a equipe e confira os participantes e os minutos reais trabalhados.');
    const body2 = section2.querySelector('.v75-section-body');
    body2.append(teams);

    if (cell) {
      const details = document.createElement('details');
      details.className = 'v75-optional';
      details.innerHTML = '<summary>Adicionar célula avulsa / informação extra da célula</summary><div class="v75-optional-body"></div>';
      details.querySelector('.v75-optional-body').append(cell);
      body2.append(details);
    }
    body2.append(workers);

    const section3 = makeSection('3', 'Observações', 'Use apenas quando houver ocorrência, retrabalho, produção parcial ou alguma informação importante.');
    section3.querySelector('.v75-section-body').append(observations);

    const main = document.createElement('div');
    main.className = 'v75-main';
    main.append(section1, section2, section3);

    const aside = document.createElement('aside');
    aside.className = 'v75-summary-side';
    aside.innerHTML = '<span class="v75-summary-kicker">Etapa 4</span><h4>Resumo do lançamento</h4><p>Confira os números calculados antes de registrar a produção.</p>';
    saveButton.classList.add('v75-save');
    saveButton.textContent = 'Salvar apontamento';
    aside.append(preview, saveButton);
    const helper = document.createElement('div');
    helper.className = 'v75-summary-help';
    helper.textContent = 'Os indicadores atualizam conforme você preenche.';
    aside.append(helper);

    const layout = document.createElement('div');
    layout.className = 'v75-form-layout';
    layout.append(main, aside);

    oldGrid.insertAdjacentElement('beforebegin', layout);
    oldGrid.remove();
  }

  function enhanceHistory() {
    document.querySelectorAll('.v68-card').forEach(card => {
      if (card.classList.contains('v75-history')) return;
      const kicker = card.querySelector(':scope > .v68-top .kicker');
      if (!kicker || normalize(kicker.textContent) !== 'histórico') return;

      card.classList.add('v75-history');
      const items = card.querySelectorAll(':scope > .v68-list > .v68-item');
      const countPill = card.querySelector(':scope > .v68-top .v68-pill');
      if (countPill) {
        countPill.classList.remove('v68-pill');
        countPill.classList.add('v75-history-count');
      }

      if (items.length > 6) {
        card.classList.add('v75-collapsed');
        const top = card.querySelector(':scope > .v68-top');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-soft btn-small v75-history-toggle';
        button.textContent = `Ver todos (${items.length})`;
        button.addEventListener('click', () => {
          const collapsed = card.classList.toggle('v75-collapsed');
          button.textContent = collapsed ? `Ver todos (${items.length})` : 'Mostrar menos';
        });
        top?.append(button);
      }
    });
  }

  function enhanceAll() {
    document.querySelectorAll('form[data-lancar]').forEach(enhanceLaunch);
    enhanceHistory();
  }

  css();
  enhanceAll();

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhanceAll();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  console.info(`Excellence System® interface de lançamento do apontamento ${V} carregada.`);
})();
