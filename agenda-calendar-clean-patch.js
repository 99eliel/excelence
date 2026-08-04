(function () {
  const PATCH_VERSION = '20260801-54';

  function injectStyles() {
    if (document.getElementById('agenda-calendar-clean-styles')) return;
    const style = document.createElement('style');
    style.id = 'agenda-calendar-clean-styles';
    style.textContent = `
      @keyframes agendaSelectedPulseClean {
        0% { box-shadow: 0 0 0 0 rgba(214,168,66,.56), 0 10px 20px rgba(5,36,55,.10); }
        70% { box-shadow: 0 0 0 8px rgba(214,168,66,0), 0 10px 20px rgba(5,36,55,.10); }
        100% { box-shadow: 0 0 0 0 rgba(214,168,66,0), 0 10px 20px rgba(5,36,55,.10); }
      }

      .agenda-panel { position: relative !important; }

      .agenda-calendar-dock {
        width: 292px !important;
        max-width: 100% !important;
        margin: 8px 0 16px auto !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        justify-content: flex-start !important;
        gap: 10px !important;
      }

      .agenda-calendar-dock .agenda-mini-calendar {
        width: 100% !important;
        max-width: 292px !important;
        margin: 0 !important;
        padding: 10px !important;
        border-radius: 16px !important;
      }

      .agenda-calendar-dock .agenda-mini-head {
        display: grid !important;
        grid-template-columns: 1fr !important;
        align-items: start !important;
        gap: 8px !important;
        margin-bottom: 8px !important;
      }

      .agenda-calendar-dock .agenda-mini-head h3 {
        font-size: 16px !important;
        line-height: 1.05 !important;
        margin: 1px 0 0 !important;
      }

      .agenda-calendar-dock .agenda-mini-actions {
        display: grid !important;
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        gap: 5px !important;
        width: 100% !important;
      }

      .agenda-calendar-dock .agenda-mini-actions .btn {
        min-height: 28px !important;
        padding: 5px 6px !important;
        font-size: 10px !important;
        border-radius: 999px !important;
        white-space: nowrap !important;
      }

      .agenda-calendar-dock .agenda-mini-weekdays,
      .agenda-calendar-dock .agenda-mini-grid {
        grid-template-columns: repeat(7, 1fr) !important;
        gap: 4px !important;
      }

      .agenda-calendar-dock .agenda-mini-weekdays span {
        font-size: 9px !important;
        letter-spacing: .02em !important;
      }

      .agenda-calendar-dock .agenda-mini-day {
        min-height: 32px !important;
        height: 32px !important;
        border-radius: 9px !important;
        font-size: 12px !important;
        padding: 0 !important;
        cursor: pointer !important;
      }

      .agenda-calendar-dock .agenda-mini-count {
        top: -4px !important;
        right: -4px !important;
        min-width: 14px !important;
        height: 14px !important;
        padding: 0 3px !important;
        font-size: 8px !important;
        border: 1px solid #fff !important;
      }

      .agenda-calendar-dock .agenda-mini-day.has-events::after {
        width: 5px !important;
        height: 5px !important;
      }

      .agenda-calendar-dock .agenda-mini-day.selected,
      .agenda-mini-day.selected {
        background: var(--primary) !important;
        color: #fff !important;
        border-color: var(--gold) !important;
        animation: agendaSelectedPulseClean 1.15s ease-out infinite !important;
        transform: translateY(-1px) !important;
      }

      .agenda-calendar-dock .agenda-mini-status {
        margin-top: 8px !important;
        padding: 8px 9px !important;
        border-radius: 12px !important;
        display: grid !important;
        gap: 2px !important;
        font-size: 11px !important;
      }

      .agenda-calendar-dock .agenda-day-detail {
        width: 100% !important;
        max-width: 292px !important;
        margin: 0 !important;
        padding: 10px !important;
        border-radius: 16px !important;
        box-shadow: 0 14px 28px rgba(5,36,55,.08) !important;
      }

      .agenda-calendar-dock .agenda-day-detail-head {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 8px !important;
        padding-bottom: 8px !important;
        margin-bottom: 8px !important;
      }

      .agenda-calendar-dock .agenda-day-detail-head h3 {
        font-size: 15px !important;
        line-height: 1.12 !important;
        margin: 2px 0 !important;
      }

      .agenda-calendar-dock .agenda-day-detail-head p {
        font-size: 12px !important;
      }

      .agenda-calendar-dock .agenda-day-detail-head .btn {
        justify-self: start !important;
        min-height: 30px !important;
        padding: 6px 10px !important;
      }

      .agenda-calendar-dock .agenda-day-detail-list {
        gap: 7px !important;
        max-height: 260px !important;
        overflow: auto !important;
        padding-right: 2px !important;
      }

      .agenda-calendar-dock .agenda-day-clone {
        padding: 8px !important;
        border-radius: 12px !important;
      }

      .agenda-calendar-dock .agenda-day-clone strong {
        font-size: 12px !important;
      }

      .agenda-calendar-dock .agenda-day-clone p,
      .agenda-calendar-dock .agenda-day-clone span,
      .agenda-calendar-dock .agenda-day-clone small {
        font-size: 11px !important;
        line-height: 1.25 !important;
      }

      .agenda-calendar-dock .agenda-day-clone .agenda-event-card,
      .agenda-calendar-dock .agenda-day-clone .agenda-event-body,
      .agenda-calendar-dock .agenda-day-clone .agenda-event-time {
        min-width: 0 !important;
      }

      .agenda-calendar-dock .agenda-mini-empty {
        width: 100% !important;
        max-width: 292px !important;
        margin: 0 !important;
        padding: 10px !important;
        border-radius: 14px !important;
      }

      @media (max-width: 900px) {
        .agenda-calendar-dock {
          width: 100% !important;
          margin-left: 0 !important;
        }
        .agenda-calendar-dock .agenda-mini-calendar,
        .agenda-calendar-dock .agenda-day-detail,
        .agenda-calendar-dock .agenda-mini-empty {
          max-width: 100% !important;
        }
        .agenda-calendar-dock .agenda-mini-day {
          min-height: 38px !important;
          height: 38px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeAgendaLayout() {
    injectStyles();
    const panel = document.querySelector('.agenda-panel');
    if (!panel) return;

    const calendar = panel.querySelector('[data-agenda-mini-calendar], .agenda-mini-calendar');
    if (!calendar) return;

    let dock = calendar.closest('.agenda-calendar-dock');
    if (!dock) {
      dock = document.createElement('div');
      dock.className = 'agenda-calendar-dock';
      calendar.insertAdjacentElement('beforebegin', dock);
      dock.appendChild(calendar);
    }

    const detail = panel.querySelector('[data-agenda-day-detail], .agenda-day-detail');
    if (detail && detail.parentElement !== dock) {
      dock.appendChild(detail);
    }

    const empty = panel.querySelector('.agenda-mini-empty');
    if (empty && empty.parentElement !== dock) {
      dock.appendChild(empty);
    }
  }

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(normalizeAgendaLayout);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', normalizeAgendaLayout);
  document.addEventListener('click', () => setTimeout(normalizeAgendaLayout, 80), true);
  setInterval(normalizeAgendaLayout, 1200);

  console.info(`Excellence System® agenda clean layout ${PATCH_VERSION} carregado.`);
})();
