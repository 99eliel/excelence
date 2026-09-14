import { functions } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";

const VERSION = '20260914-109';
const cadastrarUsuarioAdmin = httpsCallable(functions, 'cadastrarUsuarioAdmin', { timeout: 30000 });
let enhanceTimer = null;

function toast(message, error = false) {
  document.querySelector('[data-admin-create-toast]')?.remove();
  const el = document.createElement('div');
  el.dataset.adminCreateToast = '1';
  el.textContent = message;
  el.style.cssText = `position:fixed;right:18px;bottom:18px;z-index:130000;max-width:560px;padding:12px 15px;border-radius:13px;color:#fff;font-weight:850;background:${error ? '#9f2e2e' : '#073F5A'};box-shadow:0 18px 42px rgba(5,36,55,.25)`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), error ? 6500 : 4600);
}

function readableError(error) {
  const code = String(error?.code || '');
  const rawMessage = String(error?.message || '').replace(/^FirebaseError:\s*/i, '').trim();
  const message = rawMessage && !['internal', 'INTERNAL'].includes(rawMessage) ? rawMessage : '';

  if (code.includes('unauthenticated')) return 'Sua sessão expirou. Faça login novamente.';
  if (code.includes('permission-denied')) return 'Somente um administrador ativo pode cadastrar usuários.';
  if (code.includes('invalid-argument')) return message || 'Confira o e-mail e a senha informados.';
  if (code.includes('not-found')) return message || 'A empresa selecionada não foi encontrada.';
  if (code.includes('already-exists')) return message || 'Este e-mail já existe. Salve novamente para atualizar a senha e concluir o perfil.';
  if (code.includes('failed-precondition')) return message || 'O Firebase ainda não está preparado para concluir este cadastro.';
  if (code.includes('deadline-exceeded')) return 'O cadastro demorou mais que o esperado. Tente novamente em alguns segundos.';
  if (code.includes('unavailable')) return 'Serviço temporariamente indisponível. Tente novamente.';
  if (code.includes('internal')) return message || 'O servidor não conseguiu concluir o cadastro. Confira se a função cadastrarUsuarioAdmin está publicada.';
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

  const oldText = submitButton?.textContent || 'Criar acesso';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Criando acesso...';
  }

  try {
    const result = await cadastrarUsuarioAdmin({ nome, email, senha, tipo, empresaId });
    if (result?.data?.readyToLogin !== true || !result?.data?.userId) {
      throw new Error('O servidor não confirmou o acesso para login.');
    }

    form.reset();
    toast(`Acesso de ${email} criado com sucesso. Este e-mail e a senha definida já podem ser usados para entrar agora.`);
    refreshUsersView();
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = oldText;
    }
  }
}

function enhanceManagementCopy() {
  const management = [...document.querySelectorAll('section.card')].find(section => {
    return String(section.querySelector('h2')?.textContent || '').trim().toLowerCase() === 'gerenciamento';
  });
  if (!management || management.dataset.adminCreateCopy === VERSION) return;

  management.dataset.adminCreateCopy = VERSION;
  const description = management.querySelector('h2 + p');
  const descriptionText = 'Gerencie usuários, bloqueie acessos, troque a empresa vinculada e altere senhas quando necessário.';
  if (description && description.textContent !== descriptionText) description.textContent = descriptionText;

  const notice = management.querySelector('.notice');
  const noticeHtml = '<strong>Acesso direto:</strong> ao cadastrar um usuário, o e-mail e a senha definidos pelo administrador já ficam válidos imediatamente no Firebase Authentication. A alteração de senha também pode ser feita diretamente pelo administrador.';
  if (notice && notice.innerHTML !== noticeHtml) notice.innerHTML = noticeHtml;
}

function enhancePendingSection() {
  const pendingSection = [...document.querySelectorAll('section.card')].find(section => {
    const title = section.querySelector('h2');
    const text = String(title?.textContent || '').toLowerCase();
    return text.includes('convites e acessos pendentes') || text.includes('cadastros antigos incompletos');
  });
  if (!pendingSection || pendingSection.dataset.adminCreatePending === VERSION) return;

  pendingSection.dataset.adminCreatePending = VERSION;
  const title = pendingSection.querySelector('h2');
  if (title && title.textContent !== 'Cadastros antigos incompletos') title.textContent = 'Cadastros antigos incompletos';

  const description = pendingSection.querySelector('p.muted');
  const descriptionText = 'Somente registros antigos podem aparecer aqui. Cadastros novos já saem prontos para login e não passam por convite.';
  if (description && description.textContent !== descriptionText) description.textContent = descriptionText;

  pendingSection.querySelectorAll('.badge.orange').forEach(badge => {
    if (String(badge.textContent || '').trim() === 'Aguardando login') badge.textContent = 'Cadastro antigo incompleto';
  });
}

function enhanceForm() {
  const form = document.getElementById('usuarioForm');
  if (form && form.dataset.adminCreateEnhanced !== VERSION) {
    form.dataset.adminCreateEnhanced = VERSION;

    const password = form.querySelector('input[name="senha"]');
    const label = password?.closest('.form-group')?.querySelector('label');
    if (label && label.textContent !== 'Senha de acesso') label.textContent = 'Senha de acesso';

    const intro = form.querySelector('.section-title-row p');
    const introText = 'Ao salvar, o Firebase cria ou atualiza a conta e o perfil na mesma operação. O usuário entra imediatamente com este e-mail e esta senha.';
    if (intro && intro.textContent !== introText) intro.textContent = introText;

    const submit = form.querySelector('button[type="submit"]');
    if (submit && submit.textContent !== 'Criar acesso') submit.textContent = 'Criar acesso';
  }

  document.querySelectorAll('[data-activate-invite]').forEach(button => button.remove());
  enhanceManagementCopy();
  enhancePendingSection();
}

function scheduleEnhance() {
  clearTimeout(enhanceTimer);
  enhanceTimer = setTimeout(enhanceForm, 60);
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

const observer = new MutationObserver(scheduleEnhance);
observer.observe(document.documentElement, { childList: true, subtree: true });
enhanceForm();
console.info(`Excellence System • cadastro direto de usuários ${VERSION} carregado.`);
