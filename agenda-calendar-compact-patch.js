(function () {
  const PATCH_VERSION = '20260801-53';
  const CALENDAR_SELECTOR = '[data-agenda-mini-calendar], .agenda-mini-calendar';

  function injectStyles() {
    if (document.getElementById('agenda-calendar-compact-styles')) return;
    const style = document.createElement('style');
    style.id = 'agenda-calendar-compact-styles';
    style.textContent = `
      .agenda-panel { position: relative; }
      .agenda-calendar-dock {
        display: flex;
        justify-content: flex-end;
        align-items: flex-start;
        margin: -2px 0 14px;
      }
      .agenda-calendar-dock .agenda-mini-calendar {
        width: min(318px, 100%);
        margin: 0 !important;
        padding: 10px !important;
        border-radius: 16px !important;
        box-shadow: 0 14px 30px rgba(5,36,55,.08);
      }
      .agenda-calendar-dock .agenda-mini-head {
        gap: 8px !important;
        margin-bottom: 8px !important;
        align-items: center !important;
      }
      .agenda-calendar-dock .agenda-mini-head .kicker {
        font-size: 10px;
        letter-spacing: .04em;
      }
      .agenda-calendar-dock .agenda-mini-head h3 {
        font-size: 15px !important;
        line-height: 1.1;
        margin: 1px 0 0 !important;
      }
      .agenda-calendar-dock .agenda-mini-actions {
        gap: 4px !important;
      }
      .agenda-calendar-dock .agenda-mini-actions .btn {
        min-height: 28px;
        padding: 5px 8px;
        font-size: 11px;
        border-radius: 999px;
      }
      .agenda-calendar-dock .agenda-mini-weekdays,
      .agenda-calendar-dock .agenda-mini-grid {
        gap: 4px !important;
      }
      .agenda-calendar-dock .agenda-mini-weekdays span {
        font-size: 10px !important;
      }
      .agenda-calendar-dock .agenda-mini-day {
        min-height: 34px !important;
        border-radius: 10px !important;
        font-size: 12px;
        line-height: 1;
        isolation: isolate;
      }
      .agenda-calendar-dock .agenda-mini-day span {
        position: relative;
        z-index: 2;
      }
      .agenda-calendar-dock .agenda-mini-day.has-events::after {
        width: 5px !important;
        height: 5px !important;
      }
      .agenda-calendar-dock .agenda-mini-count {
        top: 2px !important;
        right: 2px !important;
        min-width: 15px !important;
        height: 15px !important;
        font-size: 9px !important;
      }
      .agenda-calendar-dock .agenda-mini-status {
        margin-top: 8px !important;
        padding: 7px 9px !important;
        font-size: 11px;
        border-radius: 11px !important;
      }
      .agenda-calendar-dock .agenda-mini-status strong,
      .agenda-calendar-dock .agenda-mini-status span {
        line-height: 1.25;
      }
      .agenda-mini-day.selected {
        animation: agendaSelectedPulse 1.25s ease-in-out infinite !important;
        box-shadow: 0 0 0 3px rgba(214,168,66,.22), 0 12px 22px rgba(7,63,90,.22) !important;
        transform: scale(1.04);
      }
      .agenda-mini-day.selected::before {
        content: '';
        position: absolute;
        inset: -4px;
        border: 2px solid rgba(214,168,66,.70);
        border-radius: inherit;
        animation: agendaSelectedRing 1.25s ease-in-out infinite;
        z-index: 1;
        pointer-events: none;
      }
      @keyframes agendaSelectedPulse {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.12); }
      }
      @keyframes agendaSelectedRing {
        0% { opacity: .9; transform: scale(.96); }
        70% { opacity: 0; transform: scale(1.16); }
        100% { opacity: 0; transform: scale(1.16); }
      }
      @media (min-width: 980px) {
        .agenda-panel .section-head {
          margin-bottom: 4px;
        }
        .agenda-calendar-dock {
          margin-top: -6px;
        }
      }
      @media (max-width: 720px) {
        .agenda-calendar-dock {
          justify-content: stretch;
          margin: 8px 0 14px;
        }
        .agenda-calendar-dock .agenda-mini-calendar {
          width: 100%;
        }
        .agenda-calendar-dock .agenda-mini-head {
          align-items: stretch !important;
        }
        .agenda-calendar-dock .agenda-mini-actions {
          justify-content: flex-start !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function compactAgendaCalendar() {
    const panel = document.querySelector('.agenda-panel');
    const calendar = panel?.querySelector(CALENDAR_SELECTOR);
    if (!panel || !calendar) return;

    injectStyles();

    let dock = panel.querySelector('[data-agenda-calendar-dock]');
    if (!dock) {
      dock = document.createElement('div');
      dock.className = 'agenda-calendar-dock';
      dock.setAttribute('data-agenda-calendar-dock', PATCH_VERSION);
      const sectionHead = panel.querySelector('.section-head');
      if (sectionHead) sectionHead.insertAdjacentElement('afterend', dock);
      else panel.prepend(dock);
    }

    if (calendar.parentElement !== dock) {
      dock.appendChild(calendar);
    }

    calendar.classList.add('agenda-mini-calendar-compact');
  }

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(compactAgendaCalendar);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', compactAgendaCalendar);
  document.addEventListener('click', () => setTimeout(compactAgendaCalendar, 80));
  setInterval(compactAgendaCalendar, 1200);

  console.info(`Excellence System® agenda compact calendar ${PATCH_VERSION} carregado.`);
})();
