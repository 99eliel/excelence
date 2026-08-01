(function () {
  const PATCH_VERSION = '20260801-44';

  function injectStyles() {
    if (document.getElementById('ecosystem-v44-styles')) return;
    const style = document.createElement('style');
    style.id = 'ecosystem-v44-styles';
    style.textContent = `
      .ecosystem-v44-search { display:flex; gap:10px; align-items:center; margin: 4px 0 16px; }
      .ecosystem-v44-search input { flex:1; min-height:44px; border:1px solid var(--line); border-radius:999px; padding:0 16px; background:#fff; font-weight:700; color:var(--text); }
      .ecosystem-v44-search input:focus { outline:none; border-color:var(--primary); box-shadow:0 0 0 4px rgba(6,86,121,.10); }
      .ecosystem-v44-layout { display:grid; grid-template-columns:320px minmax(0,1fr); gap:18px; align-items:start; }
      .ecosystem-v44-sidebar, .ecosystem-v44-main { border:1px solid var(--line); border-radius:18px; background:linear-gradient(180deg,#fff,#f8fbfd); padding:16px; }
      .ecosystem-v44-sidebar { position:sticky; top:16px; }
      .ecosystem-v44-sidebar-title { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:12px; }
      .ecosystem-v44-sidebar-title h3 { margin:2px 0 0; color:var(--primary-dark); }
      .ecosystem-v44-nav { display:grid; gap:10px; margin-top:12px; }
      .ecosystem-v44-folder-btn { width:100%; text-align:left; display:flex; gap:12px; align-items:center; padding:12px 14px; border-radius:14px; border:1px solid var(--line); background:#fff; cursor:pointer; transition:.18s ease; }
      .ecosystem-v44-folder-btn:hover { border-color:var(--primary); transform:translateY(-1px); }
      .ecosystem-v44-folder-btn.active { border-color:var(--primary); background:rgba(10,88,128,.08); box-shadow:0 0 0 1px rgba(10,88,128,.08) inset; }
      .ecosystem-v44-folder-btn strong, .ecosystem-v44-folder-btn small { display:block; }
      .ecosystem-v44-folder-btn small { color:var(--muted); margin-top:3px; }
      .ecosystem-v44-folder-icon { font-size:22px; line-height:1; }
      .ecosystem-v44-card { display:none; border:0 !important; background:transparent !important; padding:0 !important; box-shadow:none !important; }
      .ecosystem-v44-card.active { display:block; }
      .ecosystem-v44-card .folder-card-header { padding-bottom:14px; border-bottom:1px solid var(--line); }
      .ecosystem-v44-card .folder-icon { display:none; }
      .ecosystem-v44-card .folder-card-header strong { font-size:22px; }
      .ecosystem-v44-card .ecosystem-add-resource { border-style:dashed; background:#fff; }
      .ecosystem-v44-card .ecosystem-add-resource summary { list-style:none; display:inline-flex; align-items:center; gap:8px; border-radius:999px; background:var(--primary); color:#fff; padding:10px 14px; }
      .ecosystem-v44-card .ecosystem-add-resource summary::-webkit-details-marker { display:none; }
      .ecosystem-v44-card .ecosystem-resource-list { margin-top:14px; }
      .ecosystem-v44-card .ecosystem-resource-item { align-items:center; transition:.18s ease; }
      .ecosystem-v44-card .ecosystem-resource-item:hover { transform:translateY(-1px); border-color:rgba(6,86,121,.35); box-shadow:0 14px 28px rgba(5,36,55,.07); }
      .ecosystem-v44-resource-icon { width:44px; height:44px; border-radius:14px; display:grid; place-items:center; flex:0 0 auto; background:linear-gradient(135deg, rgba(6,86,121,.11), rgba(205,166,84,.13)); font-size:22px; border:1px solid var(--line); }
      .ecosystem-v44-empty { padding:20px; border:1px dashed var(--line-strong); border-radius:18px; text-align:center; color:var(--muted); background:#fff; }
      @media (max-width:980px){ .ecosystem-v44-layout{ grid-template-columns:1fr; } .ecosystem-v44-sidebar{ position:static; } }
      @media (max-width:720px){ .ecosystem-v44-search{ flex-direction:column; align-items:stretch; } .ecosystem-v44-resource-icon{ width:38px; height:38px; } }
    `;
    document.head.appendChild(style);
  }

  function textOf(el, selector) {
    return (el.querySelector(selector)?.textContent || '').trim();
  }

  function iconForResource(item) {
    const text = (item.textContent || '').toLowerCase();
    if (text.includes('vídeo') || text.includes('video') || text.includes('youtube')) return '🎥';
    if (text.includes('slide') || text.includes('apresenta')) return '📊';
    if (text.includes('word') || text.includes('.doc')) return '📝';
    if (text.includes('pdf') || item.querySelector('[data-pdf-preview]')) return '📄';
    if (text.includes('link') || item.querySelector('a[href]')) return '🔗';
    return '📌';
  }

  function enhanceResourceCards(card) {
    card.querySelectorAll('.ecosystem-resource-item').forEach(item => {
      if (!item.querySelector('.ecosystem-v44-resource-icon')) {
        const icon = document.createElement('div');
        icon.className = 'ecosystem-v44-resource-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = iconForResource(item);
        item.prepend(icon);
      }
    });
  }

  function enhancePanel(panel) {
    if (!panel || panel.dataset.v44Explorer === PATCH_VERSION) return;
    const grid = panel.querySelector('.ecosystem-folder-grid');
    if (!grid) return;

    const cards = Array.from(grid.children).filter(el => el.classList.contains('ecosystem-folder-card'));
    if (!cards.length) return;

    injectStyles();
    panel.dataset.v44Explorer = PATCH_VERSION;

    const searchWrap = document.createElement('div');
    searchWrap.className = 'ecosystem-v44-search';
    searchWrap.innerHTML = `
      <input type="search" placeholder="Buscar pasta, PDF, Word, vídeo, slide ou link..." aria-label="Buscar no ecossistema" />
      <button class="btn btn-small btn-soft" type="button" data-v44-clear-search>Limpar</button>
    `;
    const summary = panel.querySelector('.ecosystem-summary');
    if (summary) summary.insertAdjacentElement('afterend', searchWrap);
    else panel.prepend(searchWrap);

    const layout = document.createElement('div');
    layout.className = 'ecosystem-v44-layout';

    const sidebar = document.createElement('aside');
    sidebar.className = 'ecosystem-v44-sidebar';
    sidebar.innerHTML = `
      <div class="ecosystem-v44-sidebar-title">
        <div><span class="kicker">Pastas</span><h3>Explorador</h3></div>
      </div>
    `;

    const toolbar = panel.querySelector('.ecosystem-folder-toolbar');
    const pastaForm = panel.querySelector('#empresaPastaForm');
    if (toolbar) sidebar.appendChild(toolbar);
    if (pastaForm) sidebar.appendChild(pastaForm);

    const nav = document.createElement('div');
    nav.className = 'ecosystem-v44-nav';
    sidebar.appendChild(nav);

    const main = document.createElement('main');
    main.className = 'ecosystem-v44-main';

    const buttons = [];
    const entries = cards.map((card, index) => {
      card.classList.add('ecosystem-v44-card');
      enhanceResourceCards(card);
      const title = textOf(card, '.folder-card-header strong') || `Pasta ${index + 1}`;
      const count = textOf(card, '.folder-card-header small') || '';
      const description = textOf(card, '.folder-card-header p');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ecosystem-v44-folder-btn';
      btn.innerHTML = `
        <span class="ecosystem-v44-folder-icon">📁</span>
        <span><strong>${title}</strong><small>${count || description || 'Abrir pasta'}</small></span>
      `;
      btn.addEventListener('click', () => selectCard(card, btn));
      nav.appendChild(btn);
      main.appendChild(card);
      buttons.push(btn);
      return { card, btn, text: `${title} ${count} ${description} ${card.textContent || ''}`.toLowerCase() };
    });

    layout.appendChild(sidebar);
    layout.appendChild(main);
    grid.replaceWith(layout);

    function selectCard(card, btn) {
      entries.forEach(entry => {
        entry.card.classList.toggle('active', entry.card === card);
        entry.btn.classList.toggle('active', entry.btn === btn);
      });
    }

    selectCard(entries[0].card, entries[0].btn);

    const input = searchWrap.querySelector('input');
    const clear = searchWrap.querySelector('[data-v44-clear-search]');

    input.addEventListener('input', () => {
      const term = input.value.trim().toLowerCase();
      let firstVisible = null;
      entries.forEach(entry => {
        const show = !term || entry.text.includes(term);
        entry.btn.style.display = show ? '' : 'none';
        entry.card.dataset.v44Filtered = show ? 'show' : 'hide';
        if (!show) entry.card.classList.remove('active');
        if (show && !firstVisible) firstVisible = entry;
      });
      if (firstVisible && !entries.some(entry => entry.card.classList.contains('active') && entry.card.dataset.v44Filtered === 'show')) {
        selectCard(firstVisible.card, firstVisible.btn);
      }
      if (!firstVisible) {
        if (!main.querySelector('.ecosystem-v44-empty')) {
          const empty = document.createElement('div');
          empty.className = 'ecosystem-v44-empty';
          empty.textContent = 'Nenhuma pasta ou item encontrado para esta busca.';
          main.appendChild(empty);
        }
      } else {
        main.querySelector('.ecosystem-v44-empty')?.remove();
      }
    });

    clear.addEventListener('click', () => {
      input.value = '';
      input.dispatchEvent(new Event('input'));
      input.focus();
    });
  }

  function enhanceAll() {
    document.querySelectorAll('.company-ecosystem-panel').forEach(enhancePanel);
  }

  const observer = new MutationObserver(() => enhanceAll());
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', enhanceAll);
  document.addEventListener('click', () => setTimeout(enhanceAll, 120));

  console.info(`Excellence System® ecosystem patch ${PATCH_VERSION} carregado.`);
})();
