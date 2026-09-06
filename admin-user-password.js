import { functions } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";

const VERSION = '20260906-96';
const alterarSenhaUsuario = httpsCallable(functions, 'alterarSenhaUsuario');

function injectStyle() {
  if (document.getElementById('admin-password-style')) return;
  const style = document.createElement('style');
  style.id = 'admin-password-style';
  style.textContent = `
    .admin-password-backdrop{position:fixed;inset:0;z-index:120000;background:rgba(3,26,38,.62);display:flex;align-items:center;justify-content:center;padding:18px}
    .admin-password-modal{width:min(520px,100%);background:#fff;border-radius:20px;box-shadow:0 28px 80px rgba(0,0,0,.30);overflow:hidden;color:#173846}
    .admin-password-head{background:linear-gradient(135deg,#073F5A,#0B607F);color:#fff;padding:20px;display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
    .admin-password-head small{display:block;color:#c7e0e9;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}
    .admin-password-head h2{margin:4px 0 0;font-size:22px;color:#fff}
    .admin-password-close{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:10px;padding:8px 10px;font-weight:850;cursor:pointer}
    .admin-password-body{padding:20px}
    .admin-password-user{background:#f4f8fa;border:1px solid #d9e6eb;border-radius:13px;padding:12px 14px;margin-bottom:14px}
    .admin-password-user strong{display:block;color:#073F5A;font-size:16px}.admin-password-user span{display:block;color:#607788;margin-top:3px;font-size:13px}
    .admin-password-field{margin-top:12px}.admin-password-field label{display:block;font-weight:850;color:#466572;font-size:13px;margin-bottom:5px}
    .admin-password-field input{width:100%;border:1px solid #cfdfe5;border-radius:11px;padding:11px 12px;font-size:15px;color:#173846;background:#fff;outline:none}
    .admin-password-field input:focus{border-color:#0B6F93;box-shadow:0 0 0 3px rgba(11,111,147,.10)}
    .admin-password-help{font-size:12px;color:#607788;margin-top:6px}
    .admin-password-options{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px}
    .admin-password-options label{display:flex;align-items:center;gap:7px;font-size:13px;color:#466572;cursor:pointer}.admin-password-options input{width:16px;height:16px}
    .admin-password-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px;padding-top:15px;border-top:1px solid #e3ecef}
    .admin-password-btn{border:0;border-radius:11px;padding:10px 14px;font-weight:850;cursor:pointer}.admin-password-btn.soft{background:#eef5f7;color:#073F5A}.admin-password-btn.primary{background:#073F5A;color:#fff}.admin-password-btn:disabled{opacity:.5;cursor:not-allowed}
    .admin-password-error{display:none;margin-top:12px;background:#fff0ee;border:1px solid #e8c1ba;color:#8f2c22;border-radius:11px;padding:10px 12px;font-size:13px}.admin-password-error.show{display:block}
  `;
  document.head.appendChild(style);
}

function toast(message, type = 'ok') {
  document.querySelector('[data-admin-password-toast]')?.remove();
  const el = document.createElement('div');
  el.dataset.adminPasswordToast = '1';
  el.textContent = message;
  el.style.cssText = `position:fixed;right:18px;bottom:18px;z-index:130000;padding:12px 15px;border-radius:13px;font-weight:850;color:#fff;max-width:430px;box-shadow:0 18px 42px rgba(5,36,55,.25);background:${type === 'err' ? '#9f2e2e' : '#073F5A'}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function readableError(error) {
  const code = String(error?.code || '');
  if (code.includes('unauthenticated')) return 'Sua sessão expirou. Faça login novamente.';
  if (code.includes('permission-denied')) return 'Somente administradores ativos podem alterar senhas.';
  if (code.includes('not-found')) return 'O usuário não foi encontrado no Firebase Authentication.';
  if (code.includes('invalid-argument')) return error?.message?.replace(/^FirebaseError:\s*/i, '') || 'Confira a nova senha.';
  if (code.includes('unavailable')) return 'Serviço temporariamente indisponível. Tente novamente.';
  return 'Não foi possível alterar a senha agora.';
}

function userInfo(button) {
  const row = button.closest('tr');
  const cells = row ? Array.from(row.querySelectorAll('td')) : [];
  return {
    id: button.dataset.resetUser || '',
    name: cells[0]?.textContent?.trim() || 'Usuário',
    email: cells[1]?.textContent?.trim() || ''
  };
}

function randomPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%&*!';
  const all = upper + lower + digits + symbols;
  const pick = chars => chars[Math.floor(Math.random() * chars.length)];
  let out = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
  while (out.length < 10) out += pick(all);
  return out.split('').sort(() => Math.random() - .5).join('');
}

function openPasswordModal(button) {
  injectStyle();
  document.querySelector('.admin-password-backdrop')?.remove();

  const user = userInfo(button);
  if (!user.id) return toast('Não foi possível identificar o usuário.', 'err');

  const backdrop = document.createElement('div');
  backdrop.className = 'admin-password-backdrop';
  backdrop.innerHTML = `
    <section class="admin-password-modal" role="dialog" aria-modal="true" aria-labelledby="adminPasswordTitle">
      <header class="admin-password-head">
        <div><small>Administração de acesso</small><h2 id="adminPasswordTitle">Alterar senha agora</h2></div>
        <button class="admin-password-close" type="button" data-password-close>Fechar</button>
      </header>
      <form class="admin-password-body" data-password-form>
        <div class="admin-password-user"><strong>${escapeHtml(user.name)}</strong>${user.email ? `<span>${escapeHtml(user.email)}</span>` : ''}</div>
        <div class="admin-password-field"><label>Nova senha</label><input type="password" name="password" minlength="6" maxlength="128" autocomplete="new-password" required autofocus></div>
        <div class="admin-password-field"><label>Confirmar nova senha</label><input type="password" name="confirmPassword" minlength="6" maxlength="128" autocomplete="new-password" required></div>
        <div class="admin-password-help">A nova senha passa a valer imediatamente para o próximo login do usuário.</div>
        <div class="admin-password-options">
          <label><input type="checkbox" data-show-password> Mostrar senha</label>
          <button class="admin-password-btn soft" type="button" data-generate-password>Gerar senha segura</button>
        </div>
        <div class="admin-password-error" data-password-error></div>
        <div class="admin-password-actions"><button class="admin-password-btn soft" type="button" data-password-close>Cancelar</button><button class="admin-password-btn primary" type="submit" data-password-save>Alterar senha</button></div>
      </form>
    </section>`;

  const close = () => backdrop.remove();
  const form = backdrop.querySelector('[data-password-form]');
  const password = form.elements.password;
  const confirmPassword = form.elements.confirmPassword;
  const errorBox = backdrop.querySelector('[data-password-error]');
  const saveButton = backdrop.querySelector('[data-password-save]');

  backdrop.querySelectorAll('[data-password-close]').forEach(btn => btn.addEventListener('click', close));
  backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });

  backdrop.querySelector('[data-show-password]').addEventListener('change', event => {
    const type = event.target.checked ? 'text' : 'password';
    password.type = type;
    confirmPassword.type = type;
  });

  backdrop.querySelector('[data-generate-password]').addEventListener('click', () => {
    const generated = randomPassword();
    password.value = generated;
    confirmPassword.value = generated;
    password.type = 'text';
    confirmPassword.type = 'text';
    backdrop.querySelector('[data-show-password]').checked = true;
    password.focus();
    password.select();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorBox.classList.remove('show');
    errorBox.textContent = '';

    if (password.value.length < 6) {
      errorBox.textContent = 'A senha precisa ter pelo menos 6 caracteres.';
      errorBox.classList.add('show');
      return;
    }
    if (password.value !== confirmPassword.value) {
      errorBox.textContent = 'As duas senhas não são iguais.';
      errorBox.classList.add('show');
      return;
    }

    const original = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = 'Alterando...';

    try {
      await alterarSenhaUsuario({ userId: user.id, novaSenha: password.value });
      close();
      toast(`Senha de ${user.name} alterada com sucesso.`);
    } catch (error) {
      console.error('Alteração de senha:', error);
      errorBox.textContent = readableError(error);
      errorBox.classList.add('show');
      saveButton.disabled = false;
      saveButton.textContent = original;
    }
  });

  document.body.appendChild(backdrop);
  setTimeout(() => password.focus(), 30);
}

function escapeHtml(value = '') {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function updateButtons(root = document) {
  root.querySelectorAll?.('[data-reset-user]').forEach(button => {
    if (button.dataset.passwordImmediate === '1') return;
    button.dataset.passwordImmediate = '1';
    button.textContent = 'Alterar senha';
    button.title = 'Definir uma nova senha imediatamente';
  });
}

document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-reset-user]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openPasswordModal(button);
}, true);

const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
    if (node.nodeType === 1) updateButtons(node);
  }));
});

injectStyle();
updateButtons();
observer.observe(document.documentElement, { childList: true, subtree: true });
console.info(`Excellence System • alteração imediata de senha ${VERSION} carregada.`);
