(function () {
  const PATCH_VERSION = '20260801-55';

  function injectStyles() {
    if (document.getElementById('agenda-layout-stable-styles')) return;
    const style = document.createElement('style');
    style.id = 'agenda-layout-stable-styles';
    style.textContent = `
      .agenda-panel { position: relative !important; overflow: visible !important; }

      .agenda-v55-shell {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 312px !important;
        gap: 18px !important;
        align-items: start !important;
        margin-top: 18px !important;
        width: 100% !important;
      }

      .agenda-v55-main {
        min-width: 0 !important;
        display: grid !important;
        gap: 14px !important;
      }

      .agenda-v55-side {
        width: 312px !important;
        max-width: 100% !important;
        justify-self: end !important;
        align-self: start !important;
        position: sticky !important;
        top: 14px !important;
      }

      .agenda-v55-side .agenda-mini-calendar,
      .agenda-v55-side [data-agenda-mini-calendar] {
        width: 100% !important;
        max-width: 312px !important;
        min-width: 0 !important;
        margin: 0 !important;
        padding: 12px !important;
        border-radius: 18px !important;
        border: 1px solid var(--line) !important;
        background: linear-gradient(180deg,#fff,#f8fbfd) !important;
        box-shadow: 0 12px 28px rgba(5,36,55,.08) !important;
        box-sizing: border-box !important;
      }

      .agenda-v55-side .agenda-mini-head {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 8px !important;
        margin-bottom: 10px !important;
      }

      .agenda-v55-side .agenda-mini-head h3 {
        font-size: 17px !important;
        line-height: 1.1 !important;
        margin: 2px 0 0 !important;
      }

      .agenda-v55-side .agenda-mini-actions {
        display: grid !important;
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        gap: 5px !important;
      }

      .agenda-v55-side .agenda-mini-actions .btn {
        min-height: 30px !important;
        padding: 6px 7px !important;
        font-size: 10px !important;
        border-radius: 999px !important;
        white-space: nowrap !important;
      }

      .agenda-v55-side .agenda-mini-weekdays,
      .agenda-v55-side .agenda-mini-grid {
        gap: 5px !important;
      }

      .agenda-v55-side .agenda-mini-weekdays span {
        font-size: 10px !important;
      }

      .agenda-v55-side .agenda-mini-day {
        min-height: 34px !important;
        border-radius: 10px !important;
        font-size: 12px !important;
        padding: 0 !important;
        transform: none !important;
      }

      .agenda-v55-side .agenda-mini-day:hover {
        transform: translateY(-1px) !important;
      }

      .agenda-v55-side .agenda-mini-day.selected {
        background: var(--primary) !important;
        color: #fff !important;
        border-color: var(--primary) !important;
        animation: agendaV55Pulse 1.35s ease-out infinite !important;
      }

      .agenda-v55-side .agenda-mini-count {
        top: -5px !important;
        right: -4px !important;
        min-width: 15px !important;
        height: 15px !important;
        font-size: 9px !important;
      }

      .agenda-v55-side .agenda-mini-status {
        margin-top: 10px !important;
        padding: 10px !important;
        border-radius: 12px !important;
        display: grid !important;
        gap: 4px !important;
        font-size: 12px !important;
      }

      .agenda-v55-main .agenda-day-detail {
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 18px !important;
        border-radius: 20px !important;
        box-sizing: border-box !important;
      }

      .agenda-v55-main .agenda-day-detail-head {
        display: flex !important;
        align-items: flex-start !important;
        justify-content: space-between !important;
        gap: 14px !important;
      }

      .agenda-v55-main .agenda-day-detail-head h3 {
        font-size: 22px !important;
        line-height: 1.15 !important;
      }

      .agenda-v55-main .agenda-day-detail-list {
        display: grid !important;
        gap: 12px !important;
      }

      .agenda-v55-main .agenda-day-clone {
        width: 100% !important;
        box-sizing: border-box !important;
      }

      .agenda-v55-main .agenda-groups {
        width: 100% !important;
        display: grid !important;
        gap: 14px !important;
      }

      .agenda-calendar-dock:empty { display: none !important; }

      @keyframes agendaV55Pulse {
        0% { box-shadow: 0 0 0 0 rgba(214,168,66,.55), 0 8px 18px rgba(5,36,55,.09); }
        70% { box-shadow: 0 0 0 7px rgba(214,168,66,0), 0 8px 18px rgba(5,36,55,.09); }
        100% { box-shadow: 0 0 0 0 rgba(214,168,66,0), 0 8px 18px rgba(5,36,55,.09); }
      }

      @media (max-width: 980px) {
        .agenda-v55-shell { grid-template-columns: 1fr !important; }
        .agenda-v55-side { width: 100% !important; max-width: 420px !important; justify-self: stretch !important; position: static !important; order: -1 !important; }
        .agenda-v55-side .agenda-mini-calendar { max-width: 420px !important; }
      }

      @media (max-width: 560px) {
        .agenda-v55-side { max-width: 100% !important; }
        .agenda-v55-side .agenda-mini-calendar { max-width: 100% !important; }
        .agenda-v55-side .agenda-mini-actions { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .agenda-v55-main .agenda-day-detail-head { flex-direction: column !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureShell(panel) {
    let shell = panel.querySelector('.agenda-v55-shell');
    if (shell) return shell;

    shell = document.createElement('section');
    shell.className = 'agenda-v55-shell';
    shell.innerHTML = '<div class="agenda-v55-main"></div><aside class="agenda-v55-side"></aside>';

    const calendar = panel.querySelector('[data-agenda-mini-calendar], .agenda-mini-calendar');
    const detail = panel.querySelector('[data-agenda-day-detail], .agenda-day-detail');
    const groups = panel.querySelector('.agenda-groups');
    const anchor = calendar?.closest('.agenda-calendar-dock') || calendar || detail || groups || panel.lastElementChild;

    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(shell, anchor);
    else panel.appendChild(shell);
    return shell;
  }

  function normalizeAgenda() {
    injectStyles();

    const panel = document.querySelector('.agenda-panel');
    if (!panel) return;

    const calendar = panel.querySelector('[data-agenda-mini-calendar], .agenda-mini-calendar');
    const groups = panel.querySelector('.agenda-groups');
    const details = Array.from(panel.querySelectorAll('[data-agenda-day-detail], .agenda-day-detail'));

    if (!calendar && !groups && !details.length) return;

    const shell = ensureShell(panel);
    const main = shell.querySelector('.agenda-v55-main');
    const side = shell.querySelector('.agenda-v55-side');

    if (calendar && !side.contains(calendar)) side.appendChild(calendar);

    details.forEach((detail, index) => {
      if (index === 0) {
        if (!main.contains(detail)) main.prepend(detail);
      } else {
        detail.remove();
      }
    });

    if (groups && !main.contains(groups)) main.appendChild(groups);

    panel.querySelectorAll('.agenda-calendar-dock').forEach(dock => {
      if (!dock.querySelector('.agenda-mini-calendar') && dock.children.length === 0) dock.remove();
    });
  }

  const observer = new MutationObserver(() => window.requestAnimationFrame(normalizeAgenda));
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', normalizeAgenda);
  document.addEventListener('click', () => setTimeout(normalizeAgenda, 80));
  setInterval(normalizeAgenda, 1200);

  console.info(`Excellence System® agenda layout stable ${PATCH_VERSION} carregado.`);
})();
