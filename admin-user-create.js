import { auth, secondaryAuth, db, functions } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";

const VERSION = '20260907-103';
const alterarSenhaUsuario = httpsCallable(functions, 'alterarSenhaUsuario');
const ativarAcessoPendente = httpsCallable(functions, 'ativarAcessoPendente');

const normalizeEmail = value => String(value || '').trim().toLowerCase();
const inviteIdFromEmail = email => normalizeEmail(email).replace(/\//g, '_');

function toast(message, error = false) {
  document.querySelector('[data-admin-create-toast]')?.remove();
  const el = document.createElement('div');
  el.dataset.adminCreateToast = '1';
  el.textContent = message;
  el.style.cssText = `position:fixed;right:18px;bottom:18px;z-index:130000;max-width:500px;padding:12px 15px;border-radius:13px;color:#fff;font-weight:850;background:${error ? '#9f2e2e' : '#073F5A'};box-shadow:0 18px 42px rgba(5,36,55,.25)`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function readableError(error) {
  const code = String(error?.code || '');
  if (code.includes('auth/weak-password') || code.includes('invalid-argument')) return error?.message?.replace(/^FirebaseError:\s*/i, '') || 'A senha precisa ter pelo menos 6 caracteres.';
  if (code.includes('auth/invalid-email')) return 'Informe um e-mail válido.';
  if (code.includes('permission-denied')) return 'Somente um administrador ativo pode concluir este acesso.';
  if (code.includes('unauthenticated')) return 'Sua sessão expirou. Faça login novamente.';
  if (code.includes('not-found')) return 'O convite ou usuário não foi encontrado.';
  if (code.includes('failed-precondition')) return error?.message?.replace(/^FirebaseError:\s*/i, '') || 'Este convite não pode ser ativado.';
  return error?.message?.replace(/^FirebaseError:\s*/i, '') || 'Não foi possível concluir o cadastro.';
}

async function findExistingProfile(email) {
  const snap = await getDocs(query(collection(db, 'usuarios'), where('email', '==', email)));
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };

  const inviteSnap = await getDoc(doc(db, 'convites_acesso', inviteIdFromEmail(email)));
  if (inviteSnap.exists()) {
    const invite = inviteSnap.data();
    if (invite.vinculadoUid) {
      const profileSnap = await getDoc(doc(db, 'usuarios', invite.vinculadoUid));
      if (profileSnap.exists()) return { id: profileSnap.id, ...profileSnap.data() };
    }
  }

  return null;
}

async function saveProfile(userId, data) {
  await setDoc(doc(db, 'usuarios', userId), {
    nome: data.nome,
    email: data.email,
    tipo: data.tipo,
    empresaId: data.empresaId,
    ativo: true,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: auth.currentUser?.uid || '',
    credencialDefinidaPeloAdmin: true
  }, { merge: true });

  await setDoc(doc(db, 'convites_acesso', inviteIdFromEmail(data.email)), {
    nome: data.nome,
    email: data.email,
    tipo: data.tipo,
    empresaId: data.empresaId,
    ativo: true,
    usado: true,
    vinculadoUid: userId,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: auth.currentUser?.uid || ''
  }, { merge: true });
}

function refreshUsersView() {
  const buttons = [...document.querySelectorAll('#sidebar .nav-btn,.sidebar .nav-btn')];
  const target = buttons.find(button => String(button.textContent || '').trim().toLowerCase().includes('usuário'));
  if (target) setTimeout(() => target.click(), 150);
  else setTimeout(() => location.reload(), 250);
}

async function handleCreate(form, submitButton) {
  const data = new FormData(form);
  const nome = String(data.get('nome') || '').trim();
  const email = normalizeEmail(data.get('email'));
  const senha = String(data.get('senha') || '');
  const tipo = String(data.get('tipo') || 'cliente');
  const empresaId = tipo === 'cliente' ? String(data.get('empresaId') || '') : '';

  if (!nome) throw new Error('Informe o nome do usuário.');
  if (!email) throw new Error('Informe o e-mail do usuário.');
  if (senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
  if (tipo === 'cliente' && !empresaId) throw new Error('Selecione a empresa do cliente.');

  const oldText = submitButton?.textContent || 'Criar usuário';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Criando acesso...';
  }

  try {
    let userId = '';
    let reused = false;

    try {
      const credential = await createUserWithEmailAndPassword(secondaryAuth, email, senha);
      userId = credential.user.uid;
      await signOut(secondaryAuth).catch(() => null);
    } catch (authError) {
      await signOut(secondaryAuth).catch(() => null);
      if (!String(authError?.code || '').includes('auth/email-already-in-use')) throw authError;

      const existing = await findExistingProfile(email);
      if (!existing?.id) {
        throw new Error('Este e-mail já existe no Firebase Authentication e está sem perfil completo. Use o botão “Ativar acesso” na seção Acessos pendentes para definir a senha e concluir o vínculo.');
      }

      await alterarSenhaUsuario({ userId: existing.id, novaSenha: senha });
      userId = existing.id;
      reused = true;
    }

    await saveProfile(userId, { nome, email, tipo, empresaId });
    form.reset();
    toast(reused
      ? 'Acesso existente atualizado. A senha digitada agora é a senha válida do usuário.'
      : 'Usuário criado. A senha digitada já está válida para login.');
    refreshUsersView();
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = oldText;
    }
  }
}

function randomPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const nums = '23456789';
  const symbols = '@#$%&*!';
  const all = upper + lower + nums + symbols;
  const pick = chars => chars[Math.floor(Math.random() * chars.length)];
  let value = pick(upper) + pick(lower) + pick(nums) + pick(symbols);
  while (value.length < 10) value += pick(all);
  return value.split('').sort(() => Math.random() - .5).join('');
}

function ensurePendingStyle() {
  if (document.getElementById('pending-access-style')) return;
  const style = document.createElement('style');
  style.id = 'pending-access-style';
  style.textContent = `
    .pending-access-backdrop{position:fixed;inset:0;z-index:135000;background:rgba(3,26,38,.62);display:flex;align-items:center;justify-content:center;padding:18px}
    .pending-access-modal{width:min(520px,100%);background:#fff;border-radius:20px;box-shadow:0 28px 80px rgba(0,0,0,.3);overflow:hidden;color:#173846}
    .pending-access-head{background:linear-gradient(135deg,#073F5A,#0B607F);color:#fff;padding:20px;display:flex;justify-content:space-between;gap:12px}.pending-access-head h2{margin:3px 0 0;color:#fff}.pending-access-head small{font-weight:900;letter-spacing:.06em;color:#c7e0e9}.pending-access-close{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:10px;padding:8px 10px;font-weight:850;cursor:pointer}
    .pending-access-body{padding:20px}.pending-access-user{padding:12px 14px;border:1px solid #d9e6eb;border-radius:13px;background:#f4f8fa;margin-bottom:14px}.pending-access-user strong,.pending-access-user span{display:block}.pending-access-user strong{color:#073F5A}.pending-access-user span{color:#607788;margin-top:3px;font-size:13px}
    .pending-access-field{margin-top:12px}.pending-access-field label{display:block;font-size:13px;font-weight:850;color:#466572;margin-bottom:5px}.pending-access-field input{width:100%;border:1px solid #cfdfe5;border-radius:11px;padding:11px 12px;font-size:15px}.pending-access-options{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}.pending-access-options label{display:flex;align-items:center;gap:7px}.pending-access-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px;padding-top:15px;border-top:1px solid #e3ecef}.pending-access-actions button,.pending-access-generate{border:0;border-radius:11px;padding:10px 14px;font-weight:850;cursor:pointer}.pending-access-primary{background:#073F5A;color:#fff}.pending-access-soft{background:#eef5f7;color:#073F5A}.pending-access-error{display:none;margin-top:12px;padding:10px 12px;border-radius:11px;background:#fff0ee;border:1px solid #e8c1ba;color:#8f2c22}.pending-access-error.show{display:block}
  `;
  document.head.appendChild(style);
}

function pendingInfo(button) {
  const row = button.closest('tr');
  const first = row?.querySelector('td:first-child');
  const strong = first?.querySelector('strong')?.textContent?.trim() || 'Usuário';
  const muted = first?.querySelector('.muted')?.textContent?.trim() || '';
  const company = row?.querySelector('td:nth-child(3)')?.textContent?.trim() || '';
  return { id: button.dataset.activateInvite || '', name: strong, email: muted, company };
}

function openPendingModal(button) {
  ensurePendingStyle();
  document.querySelector('.pending-access-backdrop')?.remove();
  const info = pendingInfo(button);
  if (!info.id) return toast('Não foi possível identificar o convite.', true);

  const bg = document.createElement('div');
  bg.className = 'pending-access-backdrop';
  bg.innerHTML = `
    <section class="pending-access-modal" role="dialog" aria-modal="true">
      <header class="pending-access-head"><div><small>ACESSO PENDENTE</small><h2>Ativar acesso</h2></div><button class="pending-access-close" type="button" data-pending-close>Fechar</button></header>
      <form class="pending-access-body" data-pending-form>
        <div class="pending-access-user"><strong>${escapeHtml(info.name)}</strong><span>${escapeHtml(info.email)}</span>${info.company ? `<span>${escapeHtml(info.company)}</span>` : ''}</div>
        <div class="pending-access-field"><label>Senha de acesso</label><input type="password" name="password" minlength="6" maxlength="128" autocomplete="new-password" required></div>
        <div class="pending-access-field"><label>Confirmar senha</label><input type="password" name="confirmPassword" minlength="6" maxlength="128" autocomplete="new-password" required></div>
        <div class="pending-access-options"><label><input type="checkbox" data-pending-show> Mostrar senha</label><button class="pending-access-generate pending-access-soft" type="button" data-pending-generate>Gerar senha segura</button></div>
        <div class="pending-access-error" data-pending-error></div>
        <div class="pending-access-actions"><button class="pending-access-soft" type="button" data-pending-close>Cancelar</button><button class="pending-access-primary" type="submit" data-pending-save>Ativar acesso</button></div>
      </form>
    </section>`;

  const form = bg.querySelector('[data-pending-form]');
  const password = form.elements.password;
  const confirmPassword = form.elements.confirmPassword;
  const errorBox = bg.querySelector('[data-pending-error]');
  const save = bg.querySelector('[data-pending-save]');
  const close = () => bg.remove();

  bg.querySelectorAll('[data-pending-close]').forEach(el => el.addEventListener('click', close));
  bg.addEventListener('click', event => { if (event.target === bg) close(); });
  bg.querySelector('[data-pending-show]').addEventListener('change', event => {
    const type = event.target.checked ? 'text' : 'password';
    password.type = type; confirmPassword.type = type;
  });
  bg.querySelector('[data-pending-generate]').addEventListener('click', () => {
    const generated = randomPassword();
    password.value = generated; confirmPassword.value = generated;
    password.type = 'text'; confirmPassword.type = 'text';
    bg.querySelector('[data-pending-show]').checked = true;
    password.focus(); password.select();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorBox.classList.remove('show');
    if (password.value.length < 6) {
      errorBox.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; errorBox.classList.add('show'); return;
    }
    if (password.value !== confirmPassword.value) {
      errorBox.textContent = 'As duas senhas não são iguais.'; errorBox.classList.add('show'); return;
    }

    const old = save.textContent; save.disabled = true; save.textContent = 'Ativando...';
    try {
      await ativarAcessoPendente({ conviteId: info.id, novaSenha: password.value });
      close();
      toast(`Acesso de ${info.name} ativado. A senha definida já está válida para login.`);
      refreshUsersView();
    } catch (error) {
      console.error('Ativação de acesso pendente:', error);
      errorBox.textContent = readableError(error); errorBox.classList.add('show');
      save.disabled = false; save.textContent = old;
    }
  });

  document.body.appendChild(bg);
  setTimeout(() => password.focus(), 30);
}

function escapeHtml(value = '') {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

document.addEventListener('submit', event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'usuarioForm') return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  handleCreate(form, event.submitter).catch(error => {
    console.error('Cadastro administrativo de usuário:', error);
    toast(readableError(error), true);
  });
}, true);

document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-activate-invite]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openPendingModal(button);
}, true);

function enhancePendingRows(root = document) {
  root.querySelectorAll?.('[data-delete-invite]').forEach(deleteButton => {
    const actions = deleteButton.parentElement;
    if (!actions || actions.querySelector('[data-activate-invite]')) return;
    const activate = document.createElement('button');
    activate.type = 'button';
    activate.className = 'btn btn-small btn-blue';
    activate.dataset.activateInvite = deleteButton.dataset.deleteInvite || '';
    activate.textContent = 'Ativar acesso';
    activate.title = 'Definir senha e concluir o acesso deste usuário';
    actions.insertBefore(activate, deleteButton);
  });
}

function enhanceForm() {
  const form = document.getElementById('usuarioForm');
  if (form && form.dataset.adminCreateEnhanced !== VERSION) {
    form.dataset.adminCreateEnhanced = VERSION;
    const password = form.querySelector('input[name="senha"]');
    const label = password?.closest('.form-group')?.querySelector('label');
    if (label) label.textContent = 'Senha de acesso';
    const intro = form.querySelector('.section-title-row p');
    if (intro) intro.textContent = 'A senha informada pelo administrador será a senha válida do usuário. Se houver um acesso antigo sem perfil, conclua pela seção Acessos pendentes.';
  }
  enhancePendingRows();
}

new MutationObserver(enhanceForm).observe(document.documentElement, { childList: true, subtree: true });
enhanceForm();
console.info(`Excellence System • criação e ativação segura de usuários ${VERSION} carregada.`);
