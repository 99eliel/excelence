(function () {
  const STYLE_ID = 'login-password-toggle-style';

  function eyeIcon(visible) {
    if (visible) {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9.5 4.7 10.5 6.1a3.2 3.2 0 0 1 0 3.8 16.5 16.5 0 0 1-3.1 3.4M6.2 6.2A16.4 16.4 0 0 0 1.5 10.1a3.2 3.2 0 0 0 0 3.8C2.5 15.3 6.5 20 12 20a10.8 10.8 0 0 0 4.1-.8" />
        </svg>`;
    }

    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>`;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .login-password-field {
        position: relative;
        width: 100%;
      }

      .login-password-field > input {
        width: 100%;
        padding-right: 50px !important;
      }

      .login-password-toggle {
        position: absolute;
        top: 50%;
        right: 8px;
        transform: translateY(-50%);
        width: 38px;
        height: 38px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: #52616b;
        cursor: pointer;
        transition: background .18s ease, color .18s ease, transform .18s ease;
      }

      .login-password-toggle:hover {
        background: rgba(7, 63, 90, .08);
        color: #073F5A;
      }

      .login-password-toggle:active {
        transform: translateY(-50%) scale(.94);
      }

      .login-password-toggle:focus-visible {
        outline: 2px solid #073F5A;
        outline-offset: 2px;
      }

      .login-password-toggle svg {
        width: 21px;
        height: 21px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.9;
        stroke-linecap: round;
        stroke-linejoin: round;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  function enhancePasswordField() {
    const input = document.getElementById('password');
    if (!input || input.dataset.passwordToggleReady === 'true') return;

    input.dataset.passwordToggleReady = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'login-password-field';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'login-password-toggle';
    button.setAttribute('aria-label', 'Mostrar senha');
    button.setAttribute('aria-pressed', 'false');
    button.title = 'Mostrar senha';
    button.innerHTML = eyeIcon(false);

    button.addEventListener('click', () => {
      const showPassword = input.type === 'password';
      input.type = showPassword ? 'text' : 'password';
      button.setAttribute('aria-label', showPassword ? 'Ocultar senha' : 'Mostrar senha');
      button.setAttribute('aria-pressed', String(showPassword));
      button.title = showPassword ? 'Ocultar senha' : 'Mostrar senha';
      button.innerHTML = eyeIcon(showPassword);
      input.focus({ preventScroll: true });
    });

    wrapper.appendChild(button);
  }

  injectStyles();
  enhancePasswordField();

  const observer = new MutationObserver(() => enhancePasswordField());
  observer.observe(document.body, { childList: true, subtree: true });
})();
