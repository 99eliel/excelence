(function () {
  const PATCH_VERSION = '20260801-51';
  const SELECTOR_DAY = '[data-agenda-mini-day]';

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function escapeHTML(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDateBR(iso = '') {
    if (!iso) return 'Dia selecionado';
    const [year, month, day] = String(iso).split('-').map(Number);
    if (!year || !month || !day) return iso;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  function parseCardDate(card, selectedISO = '') {
    const timeText = card.querySelector('.agenda-event-time strong')?.textContent || card.textContent || '';
    const match = String(timeText).match(/(\d{2})\/(\d{2})(?:\/(\d{2,4}))?/);
    if (!match) return '';
    const selectedYear = Number(String(selectedISO).slice(0, 4)) || new Date().getFullYear();
    const yearText = match[3] || String(selectedYear);
    const year = Number(yearText.length === 2 ? `20${yearText}` : yearText);
    return `${year}-${match[2]}-${match[1]}`;
  }

  function getCards(panel) {
    return Array.from(panel.querySelectorAll('.agenda-event-card'));
  }

  function removeDetail(panel) {
    panel.querySelector('[data-agenda-day-detail]')?.remove();
  }

  function resetFilter(panel) {
    removeDetail(panel);
    panel.querySelectorAll('.agenda-day-group').forEach(group => {
      group.style.display = '';
      group.querySelectorAll('.agenda-event-card').forEach(card => { card.style.display = ''; });
    });
    panel.querySelectorAll(SELECTOR_DAY).forEach(btn => btn.classList.remove('selected'));
    const status = panel.querySelector('.agenda-mini-status');
    if (status) {
      const total = getCards(panel).length;
      status.innerHTML = `<strong>Todos os compromissos</strong><span>${total} compromisso(s) no período carregado</span>`;
    }
  }

  function buildDetailCard(panel, iso, cards) {
    removeDetail(panel);
    const detail = document.createElement('section');
    detail.className = 'agenda-day-detail';
    detail.setAttribute('data-agenda-day-detail', PATCH_VERSION);
    detail.innerHTML = `
      <div class="agenda-day-detail-head">
        <div>
          <span class="kicker">Dia selecionado</span>
          <h3>${escapeHTML(formatDateBR(iso))}</h3>
          <p>${cards.length ? `${cards.length} compromisso(s) encontrado(s) neste dia.` : 'Nenhum compromisso encontrado neste dia.'}</p>
        </div>
        <button class="btn btn-small btn-soft" type="button" data-agenda-day-close>Ver todos</button>
      </div>
      <div class="agenda-day-detail-list">
        ${cards.length ? cards.map(card => `<div class="agenda-day-clone">${card.innerHTML}</div>`).join('') : '<div class="empty-state-card compact-empty"><h2>Nenhum compromisso</h2><p>Não há eventos cadastrados nesse dia dentro do período carregado.</p></div>'}
      </div>
    `;

    const calendar = panel.querySelector('[data-agenda-mini-calendar]') || panel.querySelector('.agenda-mini-calendar');
    if (calendar) calendar.insertAdjacentElement('afterend', detail);
    else panel.prepend(detail);

    detail.querySelector('[data-agenda-day-close]')?.addEventListener('click', () => resetFilter(panel));
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function selectDay(panel, iso) {
    if (!panel || !iso) return;
    const cards = getCards(panel);
    const selectedCards = cards.filter(card => parseCardDate(card, iso) === iso);

    panel.querySelectorAll(SELECTOR_DAY).forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.agendaMiniDay === iso);
    });

    const status = panel.querySelector('.agenda-mini-status');
    if (status) {
      status.innerHTML = `<strong>${escapeHTML(formatDateBR(iso))}</strong><span>${selectedCards.length} compromisso(s) neste dia</span>`;
    }

    // Mantém a lista original disponível, mas destaca visualmente o resultado em um bloco claro.
    panel.querySelectorAll('.agenda-day-group').forEach(group => { group.style.display = ''; });
    panel.querySelectorAll('.agenda-event-card').forEach(card => { card.style.display = ''; });
    buildDetailCard(panel, iso, selectedCards);
  }

  function injectStyles() {
    if (document.getElementById('agenda-day-click-style')) return;
    const style = document.createElement('style');
    style.id = 'agenda-day-click-style';
    style.textContent = `
      .agenda-mini-day { cursor: pointer !important; }
      .agenda-mini-day:active { transform: scale(.96); }
      .agenda-day-detail { margin: 16px 0; border: 1px solid var(--line); border-radius: 18px; background: linear-gradient(180deg,#ffffff,#f8fbfd); padding: 16px; box-shadow: 0 14px 30px rgba(5,36,55,.07); }
      .agenda-day-detail-head { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:12px; }
      .agenda-day-detail-head h3 { margin: 3px 0; color: var(--primary-dark); }
      .agenda-day-detail-head p { margin: 0; color: var(--muted); }
      .agenda-day-detail-list { display:grid; gap:10px; }
      .agenda-day-clone { border:1px solid var(--line); border-radius:14px; background:#fff; padding: 12px; }
      .agenda-day-clone .agenda-event-time { margin-bottom:8px; }
      @media (max-width:720px){ .agenda-day-detail-head{ flex-direction:column; } .agenda-day-detail{ padding:12px; } }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('click', (event) => {
    const dayBtn = event.target.closest(SELECTOR_DAY);
    const panel = event.target.closest('.agenda-panel');
    if (dayBtn && panel) {
      event.preventDefault();
      event.stopPropagation();
      selectDay(panel, dayBtn.dataset.agendaMiniDay || '');
      return;
    }

    const clearBtn = event.target.closest('[data-agenda-mini-clear]');
    if (clearBtn && panel) {
      setTimeout(() => resetFilter(panel), 30);
      return;
    }

    const todayBtn = event.target.closest('[data-agenda-mini-today]');
    if (todayBtn && panel) {
      setTimeout(() => selectDay(panel, todayISO()), 60);
    }
  }, true);

  injectStyles();
  console.info(`Excellence System® agenda day click patch ${PATCH_VERSION} carregado.`);
})();
