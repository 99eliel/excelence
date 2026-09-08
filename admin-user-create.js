import { functions } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";

const VERSION = '20260908-104';
const cadastrarUsuarioAdmin = httpsCallable(functions, 'cadastrarUsuarioAdmin');

function toast(message, error = false) {
  document.querySelector('[data-admin-create-toast]')?.remove();
  const el = document.createElement('div');
  el.dataset.adminCreateToast = '1';
  el.textContent = message;
  el.style.cssText = `position:fixed;right:18px;bottom:18px;z-index:130000;max-width:520px;padding:12px 15px;border-radius:13px;color:#fff;font-weight:850;background:${error ? '#9f2e2e' : '#073F5A'};box-shadow:0 18px 42px rgba(5,36,55,.25)`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4600);
}

function readableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').replace(/^FirebaseError:\s*/i, '');
  if (code.includes('unauthenticated')) return 'Sua sessão expirou. Faça login novamente.';
  if (code.includes('permission-denied')) return 'Somente um administrador ativo pode cadastrar usuários.';
  if (code.includes('invalid-argument')) return message || 'Confira os dados do usuário.';
  if (code.includes('not-found')) return message || 'A empresa selecionada não foi encontrada.';
  if (code.includes('already-exists')) return message || 'Este e-mail já possui um acesso. Tente salvar novamente.';
  if (code.includes('unavailable')) return 'Serviço temporariamente indisponível. Tente novamente.';
  return message || 'Não foi possível cadastrar o usuário.';
}

function refreshUsersView() {
  const buttons = [...document.querySelectorAll('#sidebar .nav-btn,.sidebar .nav-btn')];
  const target = buttons.find(button => String(button.textContent || '').trim().toLowerCase().includes('usuário'));
  if (target) setTimeout(() => target.click(), 120);
  else setTimeout(() => location.reload(), 220);
}

async function handleCreate(form, submitButton) {
  const data = new FormData(form);
  const nome = String(data.get('nome') || '').trim();
  const email = String(data.get('email') || '').trim().toLowerCase();
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
    const result = await cadastrarUsuarioAdmin({ nome, email, senha, tipo, empresaId });
    if (result?.data?.readyToLogin !== true) throw new Error('O servidor não confirmou o acesso para login.');

    form.reset();
    toast('Usuário salvo com sucesso. O e-mail e a senha definidos já podem ser usados para entrar agora.');
    refreshUsersView();
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = oldText;
    }
  }
}

function enhanceForm() {
  const form = document.getElementById('usuarioForm');
  if (form && form.dataset.adminCreateEnhanced !== VERSION) {
    form.dataset.adminCreateEnhanced = VERSION;

    const password = form.querySelector('input[name="senha"]');
    const label = password?.closest('.form-group')?.querySelector('label');
    if (label) label.textContent = 'Senha de acesso';

    const intro = form.querySelector('.section-title-row p');
    if (intro) intro.textContent = 'Ao salvar, o acesso já fica pronto. O usuário entra imediatamente com este e-mail e esta senha, sem ativação posterior.';

    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = 'Criar acesso';
  }

  document.querySelectorAll('[data-activate-invite]').forEach(button => button.remove());

  const pendingSection = [...document.querySelectorAll('section.card')].find(section => {
    const title = section.querySelector('h2');
    return String(title?.textContent || '').toLowerCase().includes('convites e acessos pendentes');
  });

  if (pendingSection) {
    const title = pendingSection.querySelector('h2');
    if (title) title.textContent = 'Cadastros antigos incompletos';
    const description = pendingSection.querySelector('p.muted');
    if (description) description.textContent = 'Esta lista é apenas de cadastros antigos que ficaram incompletos. Para corrigir um deles, cadastre novamente o mesmo e-mail acima e defina a senha desejada; o acesso será concluído imediatamente.';

    pendingSection.querySelectorAll('.badge.orange').forEach(badge => {
      if (String(badge.textContent || '').trim() === 'Aguardando login') badge.textContent = 'Cadastro antigo incompleto';
    });
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

const observer = new MutationObserver(() => enhanceForm());
observer.observe(document.documentElement, { childList: true, subtree: true });
enhanceForm();
console.info(`Excellence System • cadastro direto de usuários ${VERSION} carregado.`);
