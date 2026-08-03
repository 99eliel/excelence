(function () {
  const PATCH_VERSION = '20260801-50';
  const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  let selectedDateISO = '';
  let visibleMonth = null;

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function toISO(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseAgendaDate(text = '') {
    const match = String(text).match(/(\d{2})\/(\d{2})(?:\/(\d{2,4}))?/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const now = new Date();
    let year = match[3] ? Number(match[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    if (!match[3] && now.getMonth() === 11 && month === 0) year += 1;
    if (!match[3] && now.getMonth() === 0 && month === 11) year -= 1;
    const date = new Date(year, month, day);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  function formatMonthTitle(date) {
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  function formatSelectedTitle(iso) {
    if (!iso) return 'Todos os compromissos do período selecionado';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  function injectStyles() {
    if (document.getElementById('agendaMiniCalendarStyles')) return;
    const style = document.createElement('style');
    style.id = 'agendaMiniCalendarStyles';
    style.textContent = `
      .agenda-mini-calendar { margin: 16px 0 18px; border:1px solid var(--line); border-radius:20px; background:linear-gradient(180deg,#fff,#f8fbfd); padding:16px; }
      .agenda-mini-head { display:flex; justify-content:space-between; align-items:center; gap:14px; margin-bottom:14px; }
      .agenda-mini-head h3 { margin:2px 0 0; color:var(--primary-dark); text-transform:capitalize; }
      .agenda-mini-actions { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
      .agenda-mini-weekdays, .agenda-mini-grid { display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:8px; }
      .agenda-mini-weekdays span { text-align:center; font-size:12px; font-weight:800; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
      .agenda-mini-day { min-height:48px; border:1px solid var(--line); border-radius:14px; background:#fff; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; font-weight:900; color:var(--primary-dark); transition:.18s ease; position:relative; }
      .agenda-mini-day:hover { transform:translateY(-1px); border-color:var(--primary); box-shadow:0 10px 20px rgba(5,36,55,.07); }
      .agenda-mini-day.muted { opacity:.34; pointer-events:none; }
      .agenda-mini-day.today { border-color:rgba(214,168,66,.9); box-shadow:0 0 0 2px rgba(214,168,66,.12) inset; }
      .agenda-mini-day.selected { background:var(--primary); color:#fff; border-color:var(--primary); }
      .agenda-mini-day.has-events::after { content:''; width:7px; height:7px; border-radius:999px; background:var(--gold); display:block; }
      .agenda-mini-day.selected.has-events::after { background:#fff; }
      .agenda-mini-count { position:absolute; top:5px; right:6px; min-width:18px; height:18px; padding:0 5px; border-radius:999px; background:rgba(214,168,66,.16); color:#8a6415; font-size:11px; display:grid; place-items:center; }
      .agenda-mini-day.selected .agenda-mini-count { background:rgba(255,255,255,.18); color:#fff; }
      .agenda-mini-status { margin-top:12px; padding:11px 13px; border-radius:14px; background:#eef7fb; color:var(--primary-dark); display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
      .agenda-mini-empty { margin-top:14px; padding:18px; border:1px dashed var(--line-strong); border-radius:16px; background:#fff; text-align:center; color:var(--muted); }
      @media (max-width:720px){ .agenda-mini-head{flex-direction:column; align-items:stretch;} .agenda-mini-actions{justify-content:flex-start;} .agenda-mini-weekdays,.agenda-mini-grid{gap:5px;} .agenda-mini-day{min-height:42px; border-radius:12px;} }
    `;
    document.head.appendChild(style);
  }

  function getEntries(panel) {
    return Array.from(panel.querySelectorAll('.agenda-event-card')).map(card => {
      const timeText = card.querySelector('.agenda-event-time strong')?.textContent || '';
      const date = parseAgendaDate(timeText);
      return {
        card,
        group: card.closest('.agenda-day-group'),
        date,
        iso: date ? toISO(date) : ''
      };
    }).filter(entry => entry.date && entry.iso);
  }

  function eventCountByDay(entries) {
    const map = new Map();
    entries.forEach(entry => map.set(entry.iso, (map.get(entry.iso) || 0) + 1));
    return map;
  }

  function getInitialMonth(entries) {
    const now = new Date();
    const selected = selectedDateISO ? entries.find(entry => entry.iso === selectedDateISO)?.date : null;
    const firstEvent = entries[0]?.date;
    return new Date((selected || firstEvent || now).getFullYear(), (selected || firstEvent || now).getMonth(), 1);
  }

  function renderCalendar(panel) {
    const entries = getEntries(panel);
    const counts = eventCountByDay(entries);
    if (!visibleMonth) visibleMonth = getInitialMonth(entries);

    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
    const startOffset = first.getDay();
    const todayISO = toISO(new Date());

    const cells = [];
    for (let i = 0; i < startOffset; i += 1) {
      cells.push('<button class="agenda-mini-day muted" type="button" disabled></button>');
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
      const iso = toISO(date);
      const count = counts.get(iso) || 0;
      const classes = [
        'agenda-mini-day',
        count ? 'has-events' : '',
        iso === todayISO ? 'today' : '',
        iso === selectedDateISO ? 'selected' : ''
      ].filter(Boolean).join(' ');
      cells.push(`
        <button class="${classes}" type="button" data-agenda-mini-day="${iso}" title="${count ? `${count} compromisso(s)` : 'Nenhum compromisso'}">
          <span>${day}</span>
          ${count ? `<small class="agenda-mini-count">${count}</small>` : ''}
        </button>
      `);
    }

    let calendar = panel.querySelector('[data-agenda-mini-calendar]');
    if (!calendar) {
      calendar = document.createElement('div');
      calendar.className = 'agenda-mini-calendar';
      calendar.setAttribute('data-agenda-mini-calendar', PATCH_VERSION);
      const target = panel.querySelector('.agenda-groups') || panel.querySelector('.empty-state-card') || panel.lastElementChild;
      target?.insertAdjacentElement('beforebegin', calendar);
    }

    calendar.innerHTML = `
      <div class="agenda-mini-head">
        <div>
          <span class="kicker">Selecionar dia</span>
          <h3>${formatMonthTitle(visibleMonth)}</h3>
        </div>
        <div class="agenda-mini-actions">
          <button class="btn btn-small btn-soft" type="button" data-agenda-mini-prev>← Mês</button>
          <button class="btn btn-small btn-soft" type="button" data-agenda-mini-today>Hoje</button>
          <button class="btn btn-small btn-soft" type="button" data-agenda-mini-clear>Todos</button>
          <button class="btn btn-small btn-soft" type="button" data-agenda-mini-next>Mês →</button>
        </div>
      </div>
      <div class="agenda-mini-weekdays">${WEEKDAYS.map(day => `<span>${day}</span>`).join('')}</div>
      <div class="agenda-mini-grid">${cells.join('')}</div>
      <div class="agenda-mini-status">
        <strong>${formatSelectedTitle(selectedDateISO)}</strong>
        <span>${selectedDateISO ? `${counts.get(selectedDateISO) || 0} compromisso(s) neste dia` : `${entries.length} compromisso(s) no período carregado`}</span>
      </div>
    `;

    bindCalendar(panel, calendar);
    applyFilter(panel);
  }

  function applyFilter(panel) {
    const entries = getEntries(panel);
    const groups = Array.from(panel.querySelectorAll('.agenda-day-group'));
    panel.querySelector('.agenda-mini-empty')?.remove();

    if (!selectedDateISO) {
      groups.forEach(group => {
        group.style.display = '';
        group.querySelectorAll('.agenda-event-card').forEach(card => card.style.display = '');
      });
      return;
    }

    let visible = 0;
    groups.forEach(group => {
      let groupVisible = false;
      group.querySelectorAll('.agenda-event-card').forEach(card => {
        const entry = entries.find(item => item.card === card);
        const show = entry?.iso === selectedDateISO;
        card.style.display = show ? '' : 'none';
        if (show) {
          groupVisible = true;
          visible += 1;
        }
      });
      group.style.display = groupVisible ? '' : 'none';
    });

    if (!visible) {
      const empty = document.createElement('div');
      empty.className = 'agenda-mini-empty';
      empty.textContent = 'Nenhum compromisso encontrado neste dia.';
      const calendar = panel.querySelector('[data-agenda-mini-calendar]');
      calendar?.insertAdjacentElement('afterend', empty);
    }
  }

  function bindCalendar(panel, calendar) {
    calendar.querySelector('[data-agenda-mini-prev]')?.addEventListener('click', () => {
      visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
      renderCalendar(panel);
    });
    calendar.querySelector('[data-agenda-mini-next]')?.addEventListener('click', () => {
      visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
      renderCalendar(panel);
    });
    calendar.querySelector('[data-agenda-mini-clear]')?.addEventListener('click', () => {
      selectedDateISO = '';
      renderCalendar(panel);
    });
    calendar.querySelector('[data-agenda-mini-today]')?.addEventListener('click', () => {
      const today = new Date();
      selectedDateISO = toISO(today);
      visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      renderCalendar(panel);
    });
    calendar.querySelectorAll('[data-agenda-mini-day]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedDateISO = btn.dataset.agendaMiniDay || '';
        renderCalendar(panel);
      });
    });
  }

  function enhanceAgenda() {
    const panel = document.querySelector('.agenda-panel');
    if (!panel) return;
    injectStyles();
    renderCalendar(panel);
  }

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(enhanceAgenda);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', enhanceAgenda);
  document.addEventListener('click', () => setTimeout(enhanceAgenda, 180));

  console.info(`Excellence System® agenda mini calendar ${PATCH_VERSION} carregado.`);
})();
