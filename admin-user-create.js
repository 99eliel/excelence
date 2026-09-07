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

const VERSION = '20260907-102';
const alterarSenhaUsuario = httpsCallable(functions, 'alterarSenhaUsuario');

const normalizeEmail = value => String(value || '').trim().toLowerCase();
const inviteIdFromEmail = email => normalizeEmail(email).replace(/\//g, '_');

function toast(message, error = false) {
  document.querySelector('[data-admin-create-toast]')?.remove();
  const el = document.createElement('div');
  el.dataset.adminCreateToast = '1';
  el.textContent = message;
  el.style.cssText = `position:fixed;right:18px;bottom:18px;z-index:130000;max-width:460px;padding:12px 15px;border-radius:13px;color:#fff;font-weight:850;background:${error ? '#9f2e2e' : '#073F5A'};box-shadow:0 18px 42px rgba(5,36,55,.25)`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4300);
}

function readableError(error) {
  const code = String(error?.code || '');
  if (code.includes('auth/weak-password')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (code.includes('auth/invalid-email')) return 'Informe um e-mail válido.';
  if (code.includes('permission-denied')) return 'Sem permissão para criar ou atualizar este acesso.';
  if (code.includes('unauthenticated')) return 'Sua sessão expirou. Faça login novamente.';
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
  if (target) setTimeout(() => target.click(), 120);
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
        throw new Error('Este e-mail já existe no Firebase Authentication, mas não possui um perfil vinculado que o sistema consiga atualizar. Remova o acesso antigo no Firebase Authentication ou vincule o perfil antes de cadastrar novamente.');
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

function enhanceForm() {
  const form = document.getElementById('usuarioForm');
  if (!form || form.dataset.adminCreateEnhanced === VERSION) return;
  form.dataset.adminCreateEnhanced = VERSION;

  const password = form.querySelector('input[name="senha"]');
  const label = password?.closest('.form-group')?.querySelector('label');
  if (label) label.textContent = 'Senha de acesso';

  const intro = form.querySelector('.section-title-row p');
  if (intro) intro.textContent = 'A senha informada pelo administrador será a senha válida do usuário. Se o e-mail já tiver um acesso vinculado, a senha será atualizada automaticamente.';
}

new MutationObserver(enhanceForm).observe(document.documentElement, { childList: true, subtree: true });
enhanceForm();
console.info(`Excellence System • criação segura de usuários ${VERSION} carregada.`);
