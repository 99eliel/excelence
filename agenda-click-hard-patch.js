(function () {
  const PATCH_VERSION = '20260801-52';
  const DAY_SELECTOR = '[data-agenda-mini-day]';
  let lastTouch = { iso: '', at: 0 };

  function escapeHTML(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatDate(iso = '') {
    const [year, month, day] = String(iso).split('-').map(Number);
    if (!year || !month || !day) return 'Dia selecionado';
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  function cardISO(card, selectedISO = '') {
    const text = card.querySelector('.agenda-event-time strong')?.textContent || card.textContent || '';
    const match = String(text).match(/(\d{2})\/(\d{2})(?:\/(\d{2,4}))?/);
    if (!match) return '';
    const selectedYear = Number(String(selectedISO).slice(0, 4)) || new Date().getFullYear();
    const yearRaw = match[3] || String(selectedYear);
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return `${year}-${match[2]}-${match[1]}`;
  }

  function getPanelFromElement(el) {
    return el?.closest?.('.agenda-panel') || document.querySelector('.agenda-panel');
  }

  function injectStyles() {
    if (document.getElementById('agenda-click-hard-style')) return;
    const style = document.createElement('style');
    style.id = 'agenda-click-hard-style';
    style.textContent = `
      .agenda-mini-day { pointer-events:auto !important; touch-action:manipulation !important; user-select:none !important; position:relative; z-index:3; }
      .agenda-mini-day * { pointer-events:none !important; }
      .agenda-mini-day.agenda-hard-active, .agenda-mini-day.selected { background:var(--primary) !important; color:#fff !important; border-color:var(--primary) !important; }
      .agenda-selected-day-panel { margin:16px 0 18px; border:1px solid rgba(6,86,121,.22); border-radius:20px; background:linear-gradient(180deg,#fff,#f7fbfd); padding:16px; box-shadow:0 14px 32px rgba(5,36,55,.08); }
      .agenda-selected-day-head { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:12px; }
      .agenda-selected-day-head h3 { margin:3px 0; color:var(--primary-dark); text-transform:capitalize; }
      .agenda-selected-day-head p { margin:0; color:var(--muted); }
      .agenda-selected-day-list { display:grid; gap:10px; }
      .agenda-selected-day-list .agenda-event-card { margin:0; }
      .agenda-original-filtered { opacity:.38; }
      @media (max-width:720px){ .agenda-selected-day-head{flex-direction:column;} .agenda-selected-day-panel{padding:12px;} }
    `;
    document.head.appendChild(style);
  }

  function removePanel(panel) {
    panel?.querySelector('[data-agenda-selected-day-panel]')?.remove();
  }

  function showAll(panel) {
    if (!panel) return;
    removePanel(panel);
    panel.querySelectorAll(DAY_SELECTOR).forEach(btn => {
      btn.classList.remove('agenda-hard-active', 'selected');
      btn.removeAttribute('aria-pressed');
    });
    panel.querySelectorAll('.agenda-day-group, .agenda-event-card').forEach(el => {
      el.style.display = '';
      el.classList.remove('agenda-original-filtered');
    });
    const status = panel.querySelector('.agenda-mini-status');
    if (status) {
      const total = panel.querySelectorAll('.agenda-event-card').length;
      status.innerHTML = `<strong>Todos os compromissos do período</strong><span>${total} compromisso(s) carregado(s)</span>`;
    }
  }

  function selectDay(panel, iso, options = {}) {
    if (!panel || !iso) return false;
    injectStyles();

    const allCards = Array.from(panel.querySelectorAll('.agenda-event-card'));
    const matched = allCards.filter(card => cardISO(card, iso) === iso);

    panel.querySelectorAll(DAY_SELECTOR).forEach(btn => {
      const active = btn.dataset.agendaMiniDay === iso;
      btn.classList.toggle('agenda-hard-active', active);
      btn.classList.toggle('selected', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    panel.querySelectorAll('.agenda-day-group').forEach(group => {
      let groupHasMatch = false;
      group.querySelectorAll('.agenda-event-card').forEach(card => {
        const isMatch = cardISO(card, iso) === iso;
        card.style.display = isMatch ? '' : 'none';
        card.classList.toggle('agenda-original-filtered', !isMatch);
        if (isMatch) groupHasMatch = true;
      });
      group.style.display = groupHasMatch ? '' : 'none';
    });

    removePanel(panel);
    const detail = document.createElement('section');
    detail.className = 'agenda-selected-day-panel';
    detail.setAttribute('data-agenda-selected-day-panel', PATCH_VERSION);
    detail.innerHTML = `
      <div class="agenda-selected-day-head">
        <div>
          <span class="kicker">Dia selecionado</span>
          <h3>${escapeHTML(formatDate(iso))}</h3>
          <p>${matched.length ? `${matched.length} compromisso(s) encontrado(s) neste dia.` : 'Nenhum compromisso encontrado neste dia.'}</p>
        </div>
        <button class="btn btn-small btn-soft" type="button" data-agenda-hard-show-all>Ver todos</button>
      </div>
      <div class="agenda-selected-day-list">
        ${matched.length ? matched.map(card => `<article class="agenda-event-card">${card.innerHTML}</article>`).join('') : '<div class="empty-state-card"><h2>Nenhum compromisso</h2><p>Não há eventos cadastrados nesse dia dentro do período carregado.</p></div>'}
      </div>
    `;

    const calendar = panel.querySelector('[data-agenda-mini-calendar]') || panel.querySelector('.agenda-mini-calendar');
    if (calendar) calendar.insertAdjacentElement('afterend', detail);
    else panel.prepend(detail);

    detail.querySelector('[data-agenda-hard-show-all]')?.addEventListener('click', () => showAll(panel));

    const status = panel.querySelector('.agenda-mini-status');
    if (status) {
      status.innerHTML = `<strong>${escapeHTML(formatDate(iso))}</strong><span>${matched.length} compromisso(s) neste dia</span>`;
    }

    if (!options.noScroll) detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  function prepareButtons() {
    document.querySelectorAll(DAY_SELECTOR).forEach(btn => {
      if (btn.dataset.hardClickReady === PATCH_VERSION) return;
      btn.dataset.hardClickReady = PATCH_VERSION;
      btn.style.pointerEvents = 'auto';
      btn.style.touchAction = 'manipulation';
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('onclick', 'return window.__agendaHardSelectDay && window.__agendaHardSelectDay(this, event);');
      btn.setAttribute('onpointerdown', 'return window.__agendaHardSelectDay && window.__agendaHardSelectDay(this, event);');
    });
  }

  window.__agendaHardSelectDay = function (btn, event) {
    const iso = btn?.dataset?.agendaMiniDay || '';
    const panel = getPanelFromElement(btn);
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
    const now = Date.now();
    if (lastTouch.iso === iso && now - lastTouch.at < 250) return false;
    lastTouch = { iso, at: now };
    selectDay(panel, iso);
    return false;
  };

  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(type => {
    document.addEventListener(type, event => {
      const btn = event.target.closest?.(DAY_SELECTOR);
      if (!btn) return;
      if (type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
      window.__agendaHardSelectDay(btn, event);
    }, true);
  });

  document.addEventListener('click', event => {
    const panel = getPanelFromElement(event.target);
    if (!panel) return;
    if (event.target.closest('[data-agenda-mini-clear]')) {
      setTimeout(() => showAll(panel), 20);
    }
    if (event.target.closest('[data-agenda-mini-today]')) {
      setTimeout(() => selectDay(panel, todayISO()), 80);
    }
  }, true);

  const observer = new MutationObserver(() => {
    injectStyles();
    prepareButtons();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', () => { injectStyles(); prepareButtons(); });
  document.addEventListener('click', () => setTimeout(prepareButtons, 120));
  injectStyles();
  prepareButtons();

  console.info(`Excellence System® agenda hard click ${PATCH_VERSION} carregado.`);
})();
