import { auth, secondaryAuth, db, storage, functions } from './firebase-config.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getCountFromServer,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";
import {
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";

const appEl = document.getElementById('app');

import { ISO_SECTIONS } from './iso-data.js';



const state = {
  user: null,
  perfil: null,
  empresas: [],
  usuarios: [],
  convites: [],
  agenda: null,
  agendaAtualizadaEm: null,
  page: 'dashboard',
  mobileMenuOpen: false,
  currentAdminView: null,
  currentClientView: null,
  appHistoryInitialized: false,
  historyKey: '',
  handlingPop: false
};


const installState = {
  deferredPrompt: null,
  installed: false
};


function appDefaultViewKey() {
  return state.perfil?.tipo === 'admin' ? 'admin:dashboard' : 'cliente:home';
}

function currentHistoryMeta() {
  return {
    page: state.page,
    adminView: state.currentAdminView || null,
    clientView: state.currentClientView || null
  };
}

function pushAppHistory(viewKey, meta = {}) {
  if (!state.user || !state.perfil) return;

  const key = viewKey || appDefaultViewKey();
  const entry = {
    excellenceApp: true,
    key,
    role: state.perfil.tipo,
    meta: { ...currentHistoryMeta(), ...meta }
  };

  state.historyKey = key;

  if (!state.appHistoryInitialized) {
    history.replaceState({ excellenceApp: true, key: 'guard', guard: true, role: state.perfil.tipo }, '', location.href);
    history.pushState(entry, '', location.href);
    state.appHistoryInitialized = true;
    return;
  }

  if (state.handlingPop) {
    history.replaceState(entry, '', location.href);
    return;
  }

  const current = history.state;
  if (current?.excellenceApp && current.key === key) {
    history.replaceState(entry, '', location.href);
  } else {
    history.pushState(entry, '', location.href);
  }
}

function pushModalHistory(modalName = 'modal') {
  if (!state.user || !state.perfil || !state.appHistoryInitialized) return;
  const key = `${state.historyKey || appDefaultViewKey()}:${modalName}`;
  history.pushState({
    excellenceApp: true,
    modal: modalName,
    key,
    role: state.perfil.tipo,
    meta: currentHistoryMeta()
  }, '', location.href);
}

function closeTopOverlayIfOpen() {
  const modal = document.querySelector('.modal-backdrop');
  if (modal) {
    modal.remove();
    return true;
  }

  if (state.mobileMenuOpen) {
    state.mobileMenuOpen = false;
    document.getElementById('sidebar')?.classList.remove('open');
    return true;
  }

  return false;
}

async function restoreHistoryState(entry) {
  if (!state.user || !state.perfil) return;

  if (closeTopOverlayIfOpen()) return;

  if (!entry?.excellenceApp || entry.guard === true) {
    pushAppHistory(state.historyKey || appDefaultViewKey());
    toast('Use o botão Sair para encerrar o acesso.', 'success');
    return;
  }

  const meta = entry.meta || {};
  state.handlingPop = true;

  try {
    if (entry.key === 'quem-somos' || meta.page === 'quem-somos') {
      await renderQuemSomos();
      return;
    }

    if (state.perfil.tipo === 'admin') {
      const adminView = meta.adminView || {};
      if (adminView.type === 'adminRequirement' && adminView.empresaId && adminView.reqId) {
        await renderAdminRequirement(adminView.empresaId, adminView.reqId);
      } else if (adminView.type === 'empresaDetalhe' && adminView.empresaId) {
        await renderEmpresaDetalhe(adminView.empresaId);
      } else if (adminView.type === 'empresaIso' && adminView.empresaId) {
        await renderEmpresaIso(adminView.empresaId);
      } else if (adminView.type === 'empresaEcossistema' && adminView.empresaId) {
        await renderEmpresaEcossistemaAdmin(adminView.empresaId);
      } else if (adminView.type === 'materiais') {
        await renderMateriais(adminView.reqId || '', adminView.empresaId || '');
      } else if (meta.page === 'usuarios') {
        await renderUsuarios();
      } else if (meta.page === 'empresas') {
        await renderEmpresas();
      } else if (meta.page === 'materiais') {
        await renderMateriais();
      } else if (meta.page === 'agenda') {
        await renderAgenda();
      } else {
        await renderAdminDashboard();
      }
      return;
    }

    const clientView = meta.clientView || {};
    if (clientView.type === 'requirement' && clientView.reqId) {
      await renderClienteRequirement(clientView.reqId);
    } else if (clientView.type === 'isoCompleta') {
      await renderClienteIsoCompleta();
    } else if (clientView.type === 'isoTopicos') {
      await renderClienteIsoTopicos();
    } else if (clientView.type === 'diagnosticoInicial') {
      await renderClienteDiagnosticoInicial();
    } else if (clientView.type === 'ecossistema' || meta.page === 'cliente-ecossistema') {
      await renderClienteEcossistema();
    } else if (clientView.type === 'arquivos' || meta.page === 'cliente-arquivos') {
      await renderClienteArquivos();
    } else {
      await renderClienteHome();
    }
  } finally {
    state.handlingPop = false;
  }
}

window.addEventListener('popstate', (event) => {
  restoreHistoryState(event.state).catch(error => {
    console.error(error);
    pushAppHistory(state.historyKey || appDefaultViewKey());
  });
});

function isIOSDevice() {
  const ua = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform || '';
  return /iphone|ipad|ipod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isAndroidDevice() {
  return /android/i.test(window.navigator.userAgent || '');
}

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || installState.installed;
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installState.deferredPrompt = event;
  refreshInstallButtons();
});

window.addEventListener('appinstalled', () => {
  installState.deferredPrompt = null;
  installState.installed = true;
  refreshInstallButtons();
  toast('Aplicativo instalado com sucesso.', 'success');
});

const requirementMap = new Map();
const sectionMap = new Map();
ISO_SECTIONS.forEach(section => {
  sectionMap.set(section.id, section);
  section.requirements.forEach(req => requirementMap.set(req.id, { ...req, section }));
});

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '-';
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function statusLabel(status = 'pendente') {
  const labels = {
    pendente: 'Pendente',
    em_analise: 'Em análise',
    ajustar: 'Ajustar',
    aprovado: 'Concluído',
    concluido: 'Concluído'
  };
  return labels[status] || 'Pendente';
}

function statusBadge(status = 'pendente') {
  const color = {
    pendente: 'orange',
    em_analise: 'blue',
    ajustar: 'red',
    aprovado: 'green',
    concluido: 'green'
  }[status] || 'orange';
  return `<span class="badge ${color}">${statusLabel(status)}</span>`;
}

function toast(message, type = 'success') {
  const existing = document.querySelector('.toast-message');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = `notice ${type} toast-message`;
  el.style.position = 'fixed';
  el.style.right = '18px';
  el.style.bottom = '18px';
  el.style.zIndex = '100';
  el.style.maxWidth = '420px';
  el.innerHTML = escapeHTML(message);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4300);
}

function normalizeError(error) {
  const code = error?.code || '';
  if (code.includes('permission-denied')) return 'Sem permissão no Firebase. Atualize os arquivos do GitHub e publique as regras novas. Se for cliente, confira se ele está vinculado a uma empresa ativa.';
  if (code.includes('auth/wrong-password') || code.includes('auth/invalid-credential')) return 'E-mail ou senha inválidos.';
  if (code.includes('auth/user-not-found')) return 'Usuário não encontrado.';
  if (code.includes('auth/email-already-in-use')) return 'Este e-mail já existe no Authentication.';
  if (code.includes('auth/weak-password')) return 'A senha precisa ter pelo menos 6 caracteres.';
  return error?.message || 'Ocorreu um erro inesperado.';
}



function normalizarEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

function conviteIdFromEmail(email = '') {
  return normalizarEmail(email).replace(/\//g, '_');
}

function isEmailAlreadyInUse(error) {
  return String(error?.code || '').includes('auth/email-already-in-use');
}

async function criarConviteAcesso({ nome, email, tipo = 'cliente', empresaId = '', empresaNome = '', acessoPrincipal = false }) {
  const emailNormalizado = normalizarEmail(email);
  if (!emailNormalizado) throw new Error('Informe o e-mail do usuário.');

  await setDoc(doc(db, 'convites_acesso', conviteIdFromEmail(emailNormalizado)), {
    nome: nome || emailNormalizado,
    email: emailNormalizado,
    tipo,
    empresaId: empresaId || '',
    empresaNome: empresaNome || '',
    ativo: true,
    usado: false,
    acessoPrincipal: acessoPrincipal === true,
    criadoEm: serverTimestamp(),
    criadoPor: state.user?.uid || ''
  }, { merge: true });

  return emailNormalizado;
}

async function ativarPerfilPorConvite(user) {
  const emailNormalizado = normalizarEmail(user?.email);
  if (!user || !emailNormalizado) return null;

  const conviteRef = doc(db, 'convites_acesso', conviteIdFromEmail(emailNormalizado));
  const conviteSnap = await getDoc(conviteRef);
  if (!conviteSnap.exists()) return null;

  const convite = conviteSnap.data();
  if (convite.ativo !== true) return null;

  await setDoc(doc(db, 'usuarios', user.uid), {
    nome: convite.nome || user.displayName || emailNormalizado,
    email: emailNormalizado,
    tipo: convite.tipo || 'cliente',
    empresaId: convite.empresaId || '',
    ativo: true,
    criadoEm: serverTimestamp(),
    criadoPor: convite.criadoPor || 'convite',
    acessoPrincipal: convite.acessoPrincipal === true,
    conviteId: conviteSnap.id,
    ativadoAutomaticamente: true
  }, { merge: true });

  await updateDoc(conviteRef, {
    usado: true,
    usadoEm: serverTimestamp(),
    vinculadoUid: user.uid
  }).catch(() => null);

  const perfilSnap = await getDoc(doc(db, 'usuarios', user.uid));
  return perfilSnap.exists() ? { id: perfilSnap.id, ...perfilSnap.data() } : null;
}

function setLoading(button, isLoading, text = 'Salvando...') {
  if (!button) return;
  if (isLoading) {
    button.dataset.oldText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = text;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.oldText || button.innerHTML;
  }
}


function installButtonLabel() {
  if (isStandaloneApp()) return 'App instalado';
  if (isIOSDevice()) return 'Instalar no iPhone/iPad';
  if (isAndroidDevice()) return 'Instalar app';
  return installState.deferredPrompt ? 'Instalar app' : 'Como instalar';
}

function installButtonHTML(extraClass = '') {
  if (isStandaloneApp()) {
    return `<span class="install-status ${extraClass}">✓ App instalado</span>`;
  }
  return `<button class="btn btn-install ${extraClass}" type="button" data-install-app>${installButtonLabel()}</button>`;
}

function installHelpText() {
  if (isIOSDevice()) {
    return 'No iPhone/iPad, a instalação é feita pelo Safari usando Compartilhar > Adicionar à Tela de Início.';
  }
  if (isAndroidDevice()) {
    return 'No Android, toque em Instalar app para adicionar o Excellence System® à tela inicial.';
  }
  return 'Você pode instalar o sistema como aplicativo quando o navegador oferecer suporte ao PWA.';
}

function refreshInstallButtons() {
  document.querySelectorAll('[data-install-app]').forEach(btn => {
    btn.textContent = installButtonLabel();
    btn.disabled = isStandaloneApp();
  });
  document.querySelectorAll('[data-install-help]').forEach(el => {
    el.textContent = installHelpText();
  });
}

async function runDeferredInstall() {
  if (!installState.deferredPrompt) {
    showInstallModal(isIOSDevice() ? 'ios' : isAndroidDevice() ? 'android' : 'generic');
    return;
  }

  const promptEvent = installState.deferredPrompt;
  installState.deferredPrompt = null;
  promptEvent.prompt();

  try {
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') toast('Instalação iniciada.', 'success');
    else toast('Instalação cancelada. Você pode instalar depois pelo mesmo botão.', 'error');
  } catch (error) {
    showInstallModal(isAndroidDevice() ? 'android' : 'generic');
  } finally {
    refreshInstallButtons();
  }
}

function showInstallModal(mode = 'generic') {
  const existing = document.querySelector('.modal-backdrop');
  if (existing) existing.remove();

  const currentMode = mode === 'generic' && isIOSDevice() ? 'ios' : mode;
  const isIOS = currentMode === 'ios';
  const isAndroid = currentMode === 'android';

  const title = isIOS ? 'Instalar no iPhone ou iPad' : isAndroid ? 'Instalar no Android' : 'Instalar como aplicativo';
  const intro = isIOS
    ? 'No iOS, a instalação precisa ser feita pelo Safari. Siga os passos abaixo:'
    : isAndroid
      ? 'No Android, o sistema pode ser instalado como PWA e aberto como aplicativo.'
      : 'Instale o Excellence System® como aplicativo para acessar pela tela inicial do dispositivo.';

  const steps = isIOS ? [
    'Abra este site pelo navegador Safari.',
    'Toque no botão de compartilhamento do Safari.',
    'Escolha “Adicionar à Tela de Início”.',
    'Confirme em “Adicionar”.'
  ] : isAndroid ? [
    'Toque no botão “Instalar app” quando ele aparecer.',
    'Confirme a instalação na janela do navegador.',
    'Abra o Excellence System® pelo ícone criado na tela inicial.',
    'Caso o botão não apareça, abra o menu do Chrome e escolha “Instalar app” ou “Adicionar à tela inicial”.'
  ] : [
    'Use um navegador compatível com PWA, como Chrome ou Edge.',
    'Procure o ícone de instalação na barra de endereço ou no menu do navegador.',
    'Confirme a instalação para criar o atalho do aplicativo.'
  ];

  const installNowButton = !isIOS && installState.deferredPrompt
    ? '<button class="btn btn-primary" type="button" data-run-install>Instalar agora</button>'
    : '';

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal install-modal">
      <div class="actions" style="justify-content:space-between; margin-bottom:14px;">
        <strong>${title}</strong>
        <button class="btn btn-soft btn-small" type="button" data-install-close>Fechar</button>
      </div>
      <div class="install-content">
        <div class="install-icon">▣</div>
        <h2>Excellence System® como app</h2>
        <p>${intro}</p>
        <ol class="install-steps">
          ${steps.map(step => `<li>${step}</li>`).join('')}
        </ol>
        <div class="actions" style="margin-top:18px;">
          ${installNowButton}
          <button class="btn btn-soft" type="button" data-install-close>Entendi</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.addEventListener('click', async (event) => {
    if (event.target === backdrop || event.target.closest('[data-install-close]')) backdrop.remove();
    if (event.target.closest('[data-run-install]')) {
      backdrop.remove();
      await runDeferredInstall();
    }
  });
}

async function handleInstallClick() {
  if (isStandaloneApp()) {
    toast('O app já está instalado neste dispositivo.', 'success');
    return;
  }
  if (isIOSDevice()) {
    showInstallModal('ios');
    return;
  }
  if (installState.deferredPrompt) {
    await runDeferredInstall();
    return;
  }
  showInstallModal(isAndroidDevice() ? 'android' : 'generic');
}

function bindInstallButtons() {
  document.querySelectorAll('[data-install-app]').forEach(btn => {
    btn.addEventListener('click', handleInstallClick);
  });
  refreshInstallButtons();
}



const LINKEDIN_MARCIA = 'https://www.linkedin.com/in/marcia-pedro-108b4551/';

function aboutContentHTML(mode = 'page') {
  const compact = mode === 'modal';
  return `
    <section class="about-hero ${compact ? 'compact' : ''}">
      <div class="about-hero-text">
        <span class="kicker">Quem somos</span>
        <h2>Excellence System®</h2>
        <p>Um sistema integrado para apoiar indústrias do vestuário na organização da gestão da qualidade, respostas iniciais, documentos e acompanhamento das etapas baseadas na ISO 9001:2015 e na filosofia Lean Manufacturing.</p>
        <div class="about-actions">
          <a class="btn btn-primary" href="${LINKEDIN_MARCIA}" target="_blank" rel="noopener">Ver LinkedIn</a>
          <button class="btn btn-soft" type="button" data-about-close>Fechar</button>
        </div>
      </div>
      <div class="author-card">
        <div class="author-photo-box">
          <img class="author-photo" src="./autora-marcia-pedro.jpg?v=20260801-41" alt="Márcia Pedro" />
        </div>
        <div class="author-info">
          <span class="badge gold">Autora do projeto</span>
          <h3>Márcia Pedro</h3>
          <p>Idealizadora do Projeto Excellence System® e responsável pela estrutura consultiva voltada à gestão da qualidade nas indústrias do vestuário.</p>
        </div>
      </div>
    </section>

    <section class="grid grid-3 about-grid">
      <div class="card about-mini-card">
        <span class="about-icon">ISO</span>
        <h3>Gestão da Qualidade</h3>
        <p>Organização dos requisitos, documentos, respostas e etapas de acompanhamento do Sistema de Gestão da Qualidade.</p>
      </div>
      <div class="card about-mini-card">
        <span class="about-icon">Lean</span>
        <h3>Melhoria Contínua</h3>
        <p>Apoio à padronização, redução de desperdícios, clareza nos processos e evolução da rotina empresarial.</p>
      </div>
      <div class="card about-mini-card">
        <span class="about-icon">MP</span>
        <h3>Consultoria</h3>
        <p>Ambiente criado para aproximar a empresa da consultoria, facilitando análise, feedback, ecossistema documental e acompanhamento.</p>
      </div>
    </section>

    <section class="grid grid-2 about-details">
      <div class="card">
        <span class="kicker">Currículo profissional</span>
        <h2>Atuação e especialidades</h2>
        <ul class="clean-list">
          <li>Gestão da Qualidade aplicada às indústrias do vestuário.</li>
          <li>Estruturação de processos com base na ISO 9001:2015.</li>
          <li>Lean Manufacturing, melhoria contínua e padronização de rotinas.</li>
          <li>Organização de documentos, respostas, planos de ação e indicadores.</li>
          <li>Treinamentos, orientação consultiva e acompanhamento empresarial.</li>
        </ul>
      </div>
      <div class="card">
        <span class="kicker">Sobre o projeto</span>
        <h2>Propósito do Excellence System®</h2>
        <p>O Excellence System® foi pensado para transformar a implantação e manutenção da qualidade em um processo mais simples, visual e acompanhado. A empresa preenche o diagnóstico inicial, enquanto a administração organiza o cofre de materiais, o ecossistema documental e a análise das etapas ISO.</p>
        <p>Com uma estrutura baseada nos requisitos da ISO 9001:2015, o sistema fortalece a organização documental, a padronização dos processos e a melhoria contínua dentro das empresas atendidas.</p>
      </div>
    </section>
  `;
}

function showAboutModal() {
  const existing = document.querySelector('.modal-backdrop');
  if (existing) existing.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal about-modal">
      <div class="actions" style="justify-content:space-between; margin-bottom:14px;">
        <strong>Excellence System® • MP Consultoria</strong>
        <button class="btn btn-soft btn-small" type="button" data-about-close>Fechar</button>
      </div>
      ${aboutContentHTML('modal')}
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-about-close]')) backdrop.remove();
  });
}

function bindAboutButtons() {
  document.querySelectorAll('[data-about-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-backdrop');
      if (modal) modal.remove();
      else navigate(state.perfil?.tipo === 'admin' ? 'dashboard' : 'cliente-home');
    });
  });
}

async function renderQuemSomos() {
  state.page = 'quem-somos';
  state.currentAdminView = null;
  state.currentClientView = null;
  pushAppHistory('quem-somos', { page: 'quem-somos' });
  shell('Quem somos', 'Conheça a autora do projeto, a proposta do Excellence System® e a identidade da MP Consultoria.', `
    ${aboutContentHTML('page')}
  `);
  bindAboutButtons();
}

function renderLogin() {
  appEl.innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <div class="login-hero">
          <img class="login-logo" src="./logo.png" alt="MP Consultoria" />
          <h1>Excellence System®</h1>
          <p>Sistema Integrado de Gestão da Qualidade para Indústrias do Vestuário, estruturado pela ISO 9001:2015 e apoiado na filosofia Lean Manufacturing.</p>
          <div class="login-highlights">
            <span>ISO 9001:2015</span>
            <span>Lean Manufacturing</span>
            <span>Documentos e respostas</span>
            <span>Consultoria MP</span>
          </div>
          <div class="login-public-actions">
            <button class="btn btn-gold" type="button" id="aboutPublicBtn">Quem somos</button>
            ${installButtonHTML('login-install')}
            <a class="btn btn-soft" href="${LINKEDIN_MARCIA}" target="_blank" rel="noopener">LinkedIn da autora</a>
          </div>
          <div class="notice" style="margin-top:28px; background:rgba(255,255,255,.11); border-color:rgba(255,255,255,.20); color:#fff;">
            <strong>Autora:</strong> Márcia Pedro<br />
            <strong>Desenvolvimento Técnico:</strong> MPEDRO Consultoria e Treinamentos<br />
            <strong>Versão:</strong> 1.0
          </div>
        </div>
        <form class="login-form" id="loginForm">
          <h2>Acessar plataforma</h2>
          <p>Entre com o e-mail e senha liberados pela administração para acompanhar as etapas, materiais e documentos da empresa.</p>
          <div class="install-hint">
            <strong>Usar como aplicativo</strong>
            <span data-install-help>${installHelpText()}</span>
          </div>
          <div class="form-group">
            <label for="email">E-mail</label>
            <input id="email" type="email" autocomplete="email" placeholder="seuemail@empresa.com" required />
          </div>
          <div class="form-group">
            <label for="password">Senha</label>
            <input id="password" type="password" autocomplete="current-password" placeholder="Digite sua senha" required />
          </div>
          <button class="btn btn-primary btn-full" type="submit">Entrar no sistema</button>
          <div class="actions" style="justify-content:space-between; margin-top:18px;">
            <button class="text-button" type="button" id="resetPasswordBtn">Esqueci minha senha</button>
          </div>
          <div id="loginMsg" style="margin-top:18px;"></div>
        </form>
      </section>
    </main>
  `;

  document.getElementById('aboutPublicBtn')?.addEventListener('click', showAboutModal);
  bindInstallButtons();

  document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = event.submitter;
    const msg = document.getElementById('loginMsg');
    msg.innerHTML = '';
    setLoading(btn, true, 'Entrando...');
    try {
      const email = normalizarEmail(document.getElementById('email').value);
      const password = document.getElementById('password').value;
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      msg.innerHTML = `<div class="notice error">${escapeHTML(normalizeError(error))}</div>`;
    } finally {
      setLoading(btn, false);
    }
  });

  document.getElementById('resetPasswordBtn').addEventListener('click', async () => {
    const email = normalizarEmail(document.getElementById('email').value);
    if (!email) return toast('Digite seu e-mail primeiro para receber a recuperação de senha.', 'error');
    try {
      await sendPasswordResetEmail(auth, email);
      toast('E-mail de recuperação enviado. Confira também a caixa de spam.', 'success');
    } catch (error) {
      toast(normalizeError(error), 'error');
    }
  });
}

async function loadPerfil(user) {
  const snap = await getDoc(doc(db, 'usuarios', user.uid));
  if (snap.exists()) return { id: snap.id, ...snap.data() };

  // Se o admin criou o acesso, mas o perfil ainda não foi gravado em usuarios,
  // o próprio login ativa o perfil automaticamente usando a coleção convites_acesso.
  return ativarPerfilPorConvite(user);
}

async function loadEmpresas() {
  // Cliente não pode listar todas as empresas pelas regras do Firebase.
  // Ele deve buscar somente a própria empresa vinculada ao perfil.
  if (state.perfil?.tipo === 'cliente') {
    const empresaId = state.perfil?.empresaId || '';
    if (!empresaId) {
      state.empresas = [];
      return state.empresas;
    }

    const snap = await getDoc(doc(db, 'empresas', empresaId));
    state.empresas = snap.exists() ? [{ id: snap.id, ...snap.data() }] : [];
    return state.empresas;
  }

  const snap = await getDocs(collection(db, 'empresas'));
  state.empresas = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  return state.empresas;
}

async function loadUsuarios() {
  const snap = await getDocs(collection(db, 'usuarios'));
  state.usuarios = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  return state.usuarios;
}

async function loadConvites() {
  const snap = await getDocs(collection(db, 'convites_acesso'));
  state.convites = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.email || '').localeCompare(b.email || ''));
  return state.convites;
}

function getEmpresaNome(empresaId) {
  return state.empresas.find(e => e.id === empresaId)?.nome || '-';
}

function navButton(page, label, icon = '•') {
  return `<button class="nav-btn ${state.page === page ? 'active' : ''}" data-page="${page}"><span>${icon}</span>${label}</button>`;
}

function shell(title, subtitle, content, options = {}) {
  const isAdmin = state.perfil?.tipo === 'admin';
  const nav = isAdmin ? `
    ${navButton('dashboard', 'Painel geral', '⌂')}
    ${navButton('agenda', 'Agenda', '◷')}
    ${navButton('empresas', 'Empresas', '▣')}
    ${navButton('usuarios', 'Usuários', '◉')}
    ${navButton('materiais', 'Cofre de materiais', '◆')}
    ${navButton('quem-somos', 'Quem somos', 'ⓘ')}
  ` : `
    ${navButton('cliente-home', 'Estrutura ISO', '☑')}
    ${navButton('cliente-ecossistema', 'Ecossistema da empresa', '▣')}
    ${navButton('cliente-arquivos', 'Arquivos recebidos', '◆')}
    ${navButton('quem-somos', 'Quem somos', 'ⓘ')}
  `;

  appEl.innerHTML = `
    <div class="app-layout">
      <aside class="sidebar ${state.mobileMenuOpen ? 'open' : ''}" id="sidebar">
        <div class="brand">
          <img class="sidebar-logo" src="./logo.png" alt="MP Consultoria" />
          <div>
            <h2>Excellence System®</h2>
            <small>${isAdmin ? 'Painel administrativo' : 'Painel da empresa'} • MP Consultoria</small>
          </div>
        </div>
        <nav class="nav-group">${nav}</nav>
        <div class="sidebar-footer">
          <small>Usuário logado</small>
          <strong>${escapeHTML(state.perfil?.nome || state.user?.email || '')}</strong>
          <small>${escapeHTML(state.user?.email || '')}</small>
          <button class="btn btn-soft" id="logoutBtn">Sair</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <button class="btn btn-soft mobile-menu" id="mobileMenuBtn" type="button">☰ Menu</button>
            <h1>${escapeHTML(title)}</h1>
            <p>${escapeHTML(subtitle || '')}</p>
          </div>
          <div class="topbar-actions">
            ${options.action || ''}
            ${installButtonHTML('topbar-install')}
          </div>
        </header>
        ${content}
      </main>
    </div>
  `;

  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mobileMenuOpen = false;
      navigate(btn.dataset.page);
    });
  });
  document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth));
  bindInstallButtons();
  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    state.mobileMenuOpen = !state.mobileMenuOpen;
    document.getElementById('sidebar')?.classList.toggle('open', state.mobileMenuOpen);
  });
}

async function navigate(page) {
  state.page = page;
  if (page === 'quem-somos') return renderQuemSomos();

  if (state.perfil?.tipo === 'admin') {
    if (page === 'dashboard') return renderAdminDashboard();
    if (page === 'agenda') return renderAgenda();
    if (page === 'empresas') return renderEmpresas();
    if (page === 'usuarios') return renderUsuarios();
    if (page === 'iso-admin') return renderEmpresas();
    if (page === 'materiais') return renderMateriais();
    return renderAdminDashboard();
  }

  if (page === 'cliente-ecossistema') return renderClienteEcossistema();
  if (page === 'cliente-arquivos') return renderClienteArquivos();
  return renderClienteHome();
}

async function renderAdminDashboard() {
  state.page = 'dashboard';
  state.currentAdminView = { type: 'dashboard' };
  state.currentClientView = null;
  pushAppHistory('admin:dashboard', { page: 'dashboard', adminView: state.currentAdminView });
  await Promise.all([loadEmpresas(), loadUsuarios()]);
  const [respostasCountSnap, pendentesCountSnap, arquivosCountSnap] = await Promise.all([
    getCountFromServer(collection(db, 'respostas_iso')),
    getCountFromServer(query(collection(db, 'respostas_iso'), where('status', 'in', ['pendente', 'em_analise', 'ajustar']))),
    getCountFromServer(collection(db, 'arquivos'))
  ]);
  const respostasCount = respostasCountSnap.data().count || 0;
  const pendentes = pendentesCountSnap.data().count || 0;
  const arquivosCount = arquivosCountSnap.data().count || 0;

  shell('Painel geral', 'Visão estratégica do Excellence System®: empresas, usuários, respostas, cofre de materiais e pendências.', `
    <section class="grid grid-4">
      <div class="stat-card"><strong>${state.empresas.length}</strong><span>Empresas</span></div>
      <div class="stat-card"><strong>${state.usuarios.length}</strong><span>Usuários</span></div>
      <div class="stat-card"><strong>${respostasCount}</strong><span>Respostas ISO</span></div>
      <div class="stat-card"><strong>${arquivosCount}</strong><span>Arquivos</span></div>
    </section>
    <section class="grid grid-2" style="margin-top:18px;">
      <div class="card">
        <span class="kicker">Fluxo principal</span>
        <h2>Como o sistema está organizado</h2>
        <p>O cliente acessa uma seção ISO, abre o requisito, consulta os materiais disponibilizados pela administração e preenche apenas as respostas necessárias em 4.1 e 4.2. Os arquivos são enviados pela administração dentro de cada etapa.</p>
      </div>
      <div class="card">
        <span class="kicker">Pendências</span>
        <h2>${pendentes} etapa(s) em acompanhamento</h2>
        <p>Abra a aba <strong>Empresas</strong>, entre na empresa desejada e escolha entre gestão ISO, ecossistema documental, dados e usuários.</p>
        <button class="btn btn-gold" data-page="empresas">Abrir empresas</button>
      </div>
    </section>
  `);
}


function formatAgendaDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function agendaPeriodLabel(period = '30') {
  const labels = {
    '7': 'Próximos 7 dias',
    '30': 'Próximos 30 dias',
    '60': 'Próximos 60 dias'
  };
  return labels[String(period)] || 'Próximos compromissos';
}

function agendaEventHTML(event = {}) {
  const title = event.title || 'Compromisso sem título';
  const start = formatAgendaDateTime(event.start);
  const end = event.end ? formatAgendaDateTime(event.end) : '';
  const details = [
    event.location ? `Local: ${event.location}` : '',
    event.description ? event.description : ''
  ].filter(Boolean);

  return `
    <article class="agenda-event-card">
      <div class="agenda-event-time">
        <strong>${escapeHTML(start)}</strong>
        ${end && end !== start ? `<span>até ${escapeHTML(end)}</span>` : ''}
      </div>
      <div class="agenda-event-body">
        <h3>${escapeHTML(title)}</h3>
        ${details.length ? `<p>${escapeHTML(details.join(' • '))}</p>` : '<p class="muted">Sem detalhes adicionais.</p>'}
      </div>
    </article>
  `;
}

function agendaListHTML(events = []) {
  if (!events.length) {
    return `
      <div class="empty-state-card">
        <h2>Nenhum compromisso encontrado</h2>
        <p>Não há eventos no período selecionado ou a função de agenda ainda não foi configurada.</p>
      </div>
    `;
  }

  const grouped = new Map();
  events.forEach(event => {
    const key = event.dayLabel || new Date(event.start).toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long'
    });
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(event);
  });

  return `<div class="agenda-groups">${Array.from(grouped.entries()).map(([day, items]) => `
    <section class="agenda-day-group">
      <div class="agenda-day-header">
        <strong>${escapeHTML(day)}</strong>
        <span>${items.length} ${items.length === 1 ? 'compromisso' : 'compromissos'}</span>
      </div>
      <div class="agenda-events">${items.map(agendaEventHTML).join('')}</div>
    </section>
  `).join('')}</div>`;
}

async function buscarAgendaMarcia(days = 30, force = false) {
  if (!force && state.agenda && state.agenda.days === Number(days)) return state.agenda;
  const callable = httpsCallable(functions, 'getAgendaMarcia');
  const result = await callable({ days: Number(days) || 30 });
  state.agenda = result.data || { events: [], days: Number(days) || 30 };
  state.agendaAtualizadaEm = new Date();
  return state.agenda;
}

async function renderAgenda(options = {}) {
  state.page = 'agenda';
  state.currentAdminView = { type: 'agenda' };
  state.currentClientView = null;
  pushAppHistory('admin:agenda', { page: 'agenda', adminView: state.currentAdminView });

  const days = Number(options.days || 30);
  let agenda = state.agenda && state.agenda.days === days ? state.agenda : null;
  let errorMessage = '';

  if (!agenda || options.force === true) {
    try {
      agenda = await buscarAgendaMarcia(days, options.force === true);
    } catch (error) {
      console.error(error);
      errorMessage = normalizeError(error);
      agenda = { events: [], days };
    }
  }

  const updated = state.agendaAtualizadaEm
    ? state.agendaAtualizadaEm.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'não atualizada';

  shell('Agenda', 'Compromissos da Márcia sincronizados com o Google Calendar. Acesso exclusivo da administração.', `
    <section class="card agenda-panel">
      <div class="section-head">
        <div>
          <span class="kicker">Agenda da Márcia</span>
          <h2>${escapeHTML(agendaPeriodLabel(days))}</h2>
          <p>Última atualização: ${escapeHTML(updated)}. Use o botão atualizar após alterar compromissos no Google Calendar.</p>
        </div>
        <div class="actions agenda-filter-actions">
          <button class="btn btn-small ${days === 7 ? 'btn-primary' : 'btn-soft'}" type="button" data-agenda-period="7">7 dias</button>
          <button class="btn btn-small ${days === 30 ? 'btn-primary' : 'btn-soft'}" type="button" data-agenda-period="30">30 dias</button>
          <button class="btn btn-small ${days === 60 ? 'btn-primary' : 'btn-soft'}" type="button" data-agenda-period="60">60 dias</button>
          <button class="btn btn-small btn-gold" type="button" data-agenda-refresh>Atualizar agenda</button>
        </div>
      </div>
      ${errorMessage ? `
        <div class="notice error" style="margin:14px 0;">
          ${escapeHTML(errorMessage)}<br>
          Se a função ainda não foi publicada, faça o deploy da pasta <strong>functions</strong> e configure o link iCal no arquivo <strong>functions/.env</strong>.
        </div>
      ` : ''}
      ${agendaListHTML(agenda.events || [])}
    </section>
  `);

  document.querySelectorAll('[data-agenda-period]').forEach(btn => {
    btn.addEventListener('click', () => renderAgenda({ days: Number(btn.dataset.agendaPeriod || 30) }));
  });

  document.querySelector('[data-agenda-refresh]')?.addEventListener('click', async (event) => {
    setLoading(event.currentTarget, true, 'Atualizando...');
    try {
      await renderAgenda({ days, force: true });
      toast('Agenda atualizada.', 'success');
    } catch (error) {
      toast(normalizeError(error), 'error');
    } finally {
      setLoading(event.currentTarget, false);
    }
  });
}

async function renderEmpresas() {
  state.page = 'empresas';
  state.currentAdminView = { type: 'empresas' };
  state.currentClientView = null;
  pushAppHistory('admin:empresas', { page: 'empresas', adminView: state.currentAdminView });
  await loadEmpresas();
  shell('Empresas', 'Entre na empresa para gerenciar usuários, estrutura ISO, respostas, arquivos disponibilizados pela administração.', `
    <section class="card clean-action-card">
      <div class="section-title-row no-margin">
        <div>
          <span class="kicker">Cadastro sob demanda</span>
          <h2>Empresas cadastradas</h2>
          <p class="muted">Para manter a tela limpa, o formulário de cadastro fica fechado. Use o botão abaixo apenas quando for criar uma nova empresa.</p>
        </div>
        <button class="btn btn-primary" type="button" id="toggleEmpresaForm">+ Cadastrar empresa</button>
      </div>

      <form class="company-access-form collapsible-panel hidden" id="empresaForm">
        <div class="section-title-row compact-row">
          <div>
            <span class="kicker">Nova empresa</span>
            <h2>Empresa + acesso do responsável</h2>
            <p>Ao salvar, o sistema cria a empresa no Firestore e também cria o login do responsável no Firebase Authentication.</p>
          </div>
          <button class="btn btn-soft btn-small" type="button" id="fecharEmpresaForm">Fechar</button>
        </div>

        <div class="form-block">
          <h3>Dados da empresa</h3>
          <div class="form-group"><label>Nome da empresa</label><input name="nome" required /></div>
          <div class="form-group"><label>CNPJ</label><input name="cnpj" placeholder="00.000.000/0000-00" /></div>
          <div class="form-group"><label>E-mail da empresa</label><input name="emailEmpresa" type="email" placeholder="contato@empresa.com" /></div>
          <div class="form-group"><label>Telefone/WhatsApp da empresa</label><input name="telefone" placeholder="(00) 00000-0000" /></div>
        </div>

        <div class="form-block access-box">
          <h3>Acesso principal do responsável</h3>
          <div class="notice">Este será o usuário cliente principal. Ele acessará apenas os dados desta empresa.</div>
          <div class="form-group"><label>Nome do responsável</label><input name="responsavelNome" required /></div>
          <div class="form-group"><label>E-mail de login do responsável</label><input name="responsavelEmail" type="email" required /></div>
          <div class="password-grid">
            <div class="form-group"><label>Senha provisória</label><input name="senha" id="senhaResponsavel" type="text" minlength="6" required /></div>
            <div class="form-group"><label>Confirmar senha</label><input name="senhaConfirmacao" id="senhaConfirmacaoResponsavel" type="text" minlength="6" required /></div>
          </div>
          <div class="actions" style="margin-top:-4px; margin-bottom:16px;">
            <button class="btn btn-soft btn-small" type="button" id="gerarSenhaResponsavel">Gerar senha provisória</button>
          </div>
        </div>

        <button class="btn btn-primary btn-full" type="submit">Cadastrar empresa e criar acesso</button>
      </form>
    </section>

    <section class="card" style="margin-top:20px;">
      <span class="kicker">Gestão por empresa</span>
      <h2>Lista de empresas</h2>
      <p>Abra a empresa primeiro. Lá dentro você escolhe se vai mexer na gestão ISO, no ecossistema documental, nos dados ou nos usuários vinculados.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Empresa</th><th>Responsável / acesso</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>
            ${state.empresas.map(e => `
              <tr>
                <td><strong>${escapeHTML(e.nome)}</strong><br><span class="muted">${escapeHTML(e.cnpj || '')}</span></td>
                <td>
                  <strong>${escapeHTML(e.responsavel || e.responsavelNome || '-')}</strong><br>
                  <span class="muted">${escapeHTML(e.responsavelEmail || e.email || '')}</span><br>
                  ${e.responsavelUid ? '<span class="badge green">Acesso criado</span>' : '<span class="badge orange">Convite/ativação pendente</span>'}
                </td>
                <td><span class="badge ${e.status === 'inativa' ? 'red' : 'green'}">${escapeHTML(e.status || 'ativa')}</span></td>
                <td>
                  <div class="actions table-actions">
                    <button class="btn btn-small btn-blue" type="button" data-open-empresa="${e.id}">Abrir</button>
                    <button class="btn btn-small btn-soft" type="button" data-edit-empresa="${e.id}">Editar</button>
                    <button class="btn btn-small btn-danger" type="button" data-delete-empresa="${e.id}">Excluir</button>
                  </div>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="4">Nenhuma empresa cadastrada.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `);

  document.querySelectorAll('[data-open-empresa]').forEach(btn => {
    btn.addEventListener('click', () => renderEmpresaDetalhe(btn.dataset.openEmpresa));
  });

  document.querySelectorAll('[data-edit-empresa]').forEach(btn => {
    btn.addEventListener('click', () => showEmpresaEditModal(btn.dataset.editEmpresa));
  });

  document.querySelectorAll('[data-delete-empresa]').forEach(btn => {
    btn.addEventListener('click', () => deleteEmpresa(btn.dataset.deleteEmpresa));
  });

  const empresaForm = document.getElementById('empresaForm');
  const toggleEmpresaForm = document.getElementById('toggleEmpresaForm');
  const fecharEmpresaForm = document.getElementById('fecharEmpresaForm');
  toggleEmpresaForm?.addEventListener('click', () => {
    empresaForm?.classList.toggle('hidden');
    toggleEmpresaForm.textContent = empresaForm?.classList.contains('hidden') ? '+ Cadastrar empresa' : 'Ocultar cadastro';
    if (!empresaForm?.classList.contains('hidden')) empresaForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  fecharEmpresaForm?.addEventListener('click', () => {
    empresaForm?.classList.add('hidden');
    if (toggleEmpresaForm) toggleEmpresaForm.textContent = '+ Cadastrar empresa';
  });

  document.getElementById('gerarSenhaResponsavel')?.addEventListener('click', () => {
    const senha = gerarSenhaProvisoria();
    document.getElementById('senhaResponsavel').value = senha;
    document.getElementById('senhaConfirmacaoResponsavel').value = senha;
    toast('Senha provisória gerada. Anote e envie ao responsável com segurança.', 'success');
  });

  document.getElementById('empresaForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = event.submitter;
    setLoading(btn, true, 'Criando empresa e acesso...');
    try {
      const form = new FormData(event.currentTarget);
      const nome = form.get('nome').trim();
      const cnpj = form.get('cnpj').trim();
      const emailEmpresa = normalizarEmail(form.get('emailEmpresa'));
      const telefone = form.get('telefone').trim();
      const responsavelNome = form.get('responsavelNome').trim();
      const responsavelEmail = normalizarEmail(form.get('responsavelEmail'));
      const senha = form.get('senha');
      const senhaConfirmacao = form.get('senhaConfirmacao');

      if (!nome) throw new Error('Informe o nome da empresa.');
      if (!responsavelNome) throw new Error('Informe o nome do responsável.');
      if (!responsavelEmail) throw new Error('Informe o e-mail de login do responsável.');
      if (!senha || senha.length < 6) throw new Error('A senha provisória precisa ter pelo menos 6 caracteres.');
      if (senha !== senhaConfirmacao) throw new Error('A confirmação de senha não confere.');

      const empresaRef = doc(collection(db, 'empresas'));
      await setDoc(empresaRef, {
        nome,
        cnpj,
        email: emailEmpresa,
        telefone,
        responsavel: responsavelNome,
        responsavelEmail,
        responsavelUid: '',
        status: 'ativa',
        criadoEm: serverTimestamp(),
        criadoPor: state.user.uid
      });

      await criarConviteAcesso({
        nome: responsavelNome,
        email: responsavelEmail,
        tipo: 'cliente',
        empresaId: empresaRef.id,
        empresaNome: nome,
        acessoPrincipal: true
      });

      try {
        const credential = await createUserWithEmailAndPassword(secondaryAuth, responsavelEmail, senha);
        const responsavelUid = credential.user.uid;

        await setDoc(doc(db, 'usuarios', responsavelUid), {
          nome: responsavelNome,
          email: responsavelEmail,
          tipo: 'cliente',
          empresaId: empresaRef.id,
          ativo: true,
          criadoEm: serverTimestamp(),
          criadoPor: state.user.uid,
          acessoPrincipal: true
        });

        await updateDoc(empresaRef, { responsavelUid });
        await signOut(secondaryAuth).catch(() => null);
        toast('Empresa cadastrada e acesso do responsável criado automaticamente.');
      } catch (authError) {
        await signOut(secondaryAuth).catch(() => null);
        if (!isEmailAlreadyInUse(authError)) throw authError;
        toast('Empresa cadastrada. O e-mail já existia no Authentication; o convite foi salvo e o perfil será ativado automaticamente quando esse usuário fizer login.', 'success');
      }

      renderEmpresas();
    } catch (error) {
      toast(normalizeError(error), 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

async function renderEmpresaDetalhe(empresaId) {
  state.page = 'empresas';
  state.currentAdminView = { type: 'empresaDetalhe', empresaId };
  state.currentClientView = null;
  pushAppHistory(`admin:empresa:${empresaId}`, { page: 'empresas', adminView: state.currentAdminView });
  await Promise.all([loadEmpresas(), loadUsuarios()]);
  const empresa = state.empresas.find(e => e.id === empresaId);
  if (!empresa) return renderEmpresas();

  const usuariosEmpresa = state.usuarios.filter(u => u.empresaId === empresaId);
  const respostas = await queryBy('respostas_iso', [['empresaId', '==', empresaId]]).catch(() => []);
  const pastasEcossistema = await safeQueryBy('empresa_pastas', [['empresaId', '==', empresaId]]);
  const recursosEcossistema = await safeQueryBy('empresa_recursos', [['empresaId', '==', empresaId]]);
  const aprovadas = respostas.filter(r => ['aprovado','concluido'].includes(r.status)).length;
  const ajustes = respostas.filter(r => r.status === 'ajustar').length;

  shell(`Empresa: ${empresa.nome || '-'}`, 'Escolha a área que deseja gerenciar. O ecossistema documental agora fica separado da análise ISO.', `
    <section class="actions" style="margin-bottom:18px;">
      <button class="btn btn-soft" id="voltarEmpresas">← Voltar para empresas</button>
      <button class="btn btn-soft" id="editarEmpresaAtual">Editar empresa</button>
      <button class="btn btn-danger" id="excluirEmpresaAtual">Excluir empresa</button>
    </section>

    <section class="grid grid-2" style="margin-bottom:18px;">
      <article class="card stack area-card">
        <span class="kicker">Gestão ISO</span>
        <h2>Arquivos, respostas e análise por etapa ISO</h2>
        <p>Acesse as seções 4.1, 4.2, 5.1 e demais tópicos para analisar respostas, marcar status e acompanhar o andamento da empresa.</p>
        <div class="mini-stats left">
          <span>${respostas.length} etapas movimentadas</span>
          <span>${aprovadas} concluídas</span>
          <span>${ajustes} ajustes</span>
        </div>
        <button class="btn btn-primary" type="button" id="abrirIsoEmpresa">Abrir gestão ISO</button>
      </article>

      <article class="card stack area-card">
        <span class="kicker">Ecossistema da empresa</span>
        <h2>Pastas, documentos e links</h2>
        <p>Organize o container documental da empresa em pastas internas, com PDF, Word e links de vídeos, slides ou materiais externos.</p>
        <div class="mini-stats left">
          <span>${pastasEcossistema.length} pastas</span>
          <span>${recursosEcossistema.length} itens</span>
        </div>
        <button class="btn btn-gold" type="button" id="abrirEcossistemaEmpresa">Abrir ecossistema</button>
      </article>

      <article class="card stack area-card">
        <span class="kicker">Acessos</span>
        <h2>Usuários vinculados</h2>
        <p>Veja e gerencie quem pode acessar os dados desta empresa. Clientes ficam restritos somente à empresa vinculada.</p>
        <div class="mini-stats left"><span>${usuariosEmpresa.length} usuário(s)</span></div>
        <button class="btn btn-blue" type="button" id="toggleUsuariosEmpresa">Ver usuários</button>
      </article>

      <article class="card stack area-card">
        <span class="kicker">Cadastro</span>
        <h2>Dados da empresa</h2>
        <p>Consulte as informações cadastrais, responsável, contato e status da empresa.</p>
        <div class="mini-stats left"><span>${escapeHTML(empresa.status || 'ativa')}</span></div>
        <button class="btn btn-soft" type="button" id="toggleDadosEmpresa">Ver dados</button>
      </article>
    </section>

    <section class="card collapsible-panel hidden" id="empresaDadosPanel">
      <div class="section-title-row compact-row">
        <div>
          <span class="kicker">Dados da empresa</span>
          <h2>${escapeHTML(empresa.nome || '-')}</h2>
          <p>Essas informações ficam recolhidas para não poluir a área principal de trabalho.</p>
        </div>
        <button class="btn btn-small btn-soft" type="button" id="fecharDadosEmpresa">Fechar</button>
      </div>
      <div class="file-logic-list">
        <div><strong>CNPJ</strong><span>${escapeHTML(empresa.cnpj || '-')}</span></div>
        <div><strong>E-mail</strong><span>${escapeHTML(empresa.email || '-')}</span></div>
        <div><strong>Telefone</strong><span>${escapeHTML(empresa.telefone || '-')}</span></div>
        <div><strong>Responsável</strong><span>${escapeHTML(empresa.responsavel || empresa.responsavelNome || '-')}</span></div>
        <div><strong>E-mail do responsável</strong><span>${escapeHTML(empresa.responsavelEmail || '-')}</span></div>
        <div><strong>Status</strong><span>${escapeHTML(empresa.status || 'ativa')}</span></div>
      </div>
    </section>

    <section class="card collapsible-panel hidden" id="empresaUsuariosPanel">
      <div class="section-title-row compact-row">
        <div>
          <span class="kicker">Acessos vinculados</span>
          <h2>Usuários desta empresa</h2>
          <p>Gerencie quais usuários podem acessar esta empresa.</p>
        </div>
        <button class="btn btn-small btn-soft" type="button" id="fecharUsuariosEmpresa">Fechar</button>
      </div>
      <div class="file-list">
        ${usuariosEmpresa.map(u => `
          <div class="file-item">
            <div>
              <strong>${escapeHTML(u.nome || u.email || '-')}</strong>
              <span>${escapeHTML(u.email || '')}</span>
              <span>${u.ativo ? 'Ativo' : 'Bloqueado'} • ${escapeHTML(u.tipo || 'cliente')}</span>
            </div>
            <button class="btn btn-small btn-blue" type="button" data-edit-user="${u.id}">Editar</button>
          </div>
        `).join('') || '<p class="muted">Nenhum usuário vinculado a esta empresa.</p>'}
      </div>
      <div class="actions" style="margin-top:16px;">
        <button class="btn btn-primary" type="button" id="irCadastroUsuarioEmpresa">Cadastrar/gerenciar usuários</button>
      </div>
    </section>
  `);

  const dadosPanel = document.getElementById('empresaDadosPanel');
  const usuariosPanel = document.getElementById('empresaUsuariosPanel');

  function togglePanel(panelToShow, panelToHide) {
    panelToShow?.classList.toggle('hidden');
    panelToHide?.classList.add('hidden');
    if (panelToShow && !panelToShow.classList.contains('hidden')) {
      panelToShow.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  document.getElementById('voltarEmpresas')?.addEventListener('click', renderEmpresas);
  document.getElementById('abrirIsoEmpresa')?.addEventListener('click', () => renderEmpresaIso(empresaId));
  document.getElementById('abrirEcossistemaEmpresa')?.addEventListener('click', () => renderEmpresaEcossistemaAdmin(empresaId));
  document.getElementById('toggleDadosEmpresa')?.addEventListener('click', () => togglePanel(dadosPanel, usuariosPanel));
  document.getElementById('toggleUsuariosEmpresa')?.addEventListener('click', () => togglePanel(usuariosPanel, dadosPanel));
  document.getElementById('fecharDadosEmpresa')?.addEventListener('click', () => dadosPanel?.classList.add('hidden'));
  document.getElementById('fecharUsuariosEmpresa')?.addEventListener('click', () => usuariosPanel?.classList.add('hidden'));
  document.getElementById('irCadastroUsuarioEmpresa')?.addEventListener('click', () => renderUsuarios());
  document.getElementById('editarEmpresaAtual')?.addEventListener('click', () => showEmpresaEditModal(empresaId));
  document.getElementById('excluirEmpresaAtual')?.addEventListener('click', () => deleteEmpresa(empresaId));
  document.querySelectorAll('[data-edit-user]').forEach(btn => {
    btn.addEventListener('click', () => showUserEditModal(btn.dataset.editUser));
  });
}

async function renderEmpresaIso(empresaId) {
  state.page = 'empresas';
  state.currentAdminView = { type: 'empresaIso', empresaId };
  state.currentClientView = null;
  pushAppHistory(`admin:empresa:${empresaId}:iso`, { page: 'empresas', adminView: state.currentAdminView });
  await loadEmpresas();
  const empresa = state.empresas.find(e => e.id === empresaId);
  if (!empresa) return renderEmpresas();

  const respostas = await queryBy('respostas_iso', [['empresaId', '==', empresaId]]).catch(() => []);
  const aprovadas = respostas.filter(r => ['aprovado','concluido'].includes(r.status)).length;
  const ajustes = respostas.filter(r => r.status === 'ajustar').length;

  shell(`ISO da empresa: ${empresa.nome || '-'}`, 'Área exclusiva para análise das respostas 4.1 e 4.2, status e acompanhamento por requisito ISO.', `
    <section class="actions" style="margin-bottom:18px;">
      <button class="btn btn-soft" id="voltarEmpresaDetalhe">← Voltar para a empresa</button>
      <button class="btn btn-gold" id="abrirEcossistemaPelaIso">Ecossistema documental</button>
    </section>

    <section class="card" style="margin-bottom:18px;">
      <div class="section-title-row no-margin">
        <div>
          <span class="kicker">Gerenciamento ISO</span>
          <h2>Respostas e análise por etapa</h2>
          <p>Abra um requisito para analisar as respostas da empresa, registrar comentários e marcar a etapa como pendente, em análise, ajustar ou concluída.</p>
        </div>
        <div class="mini-stats">
          <span>${respostas.length} etapas movimentadas</span>
          <span>${aprovadas} concluídas</span>
          <span>${ajustes} ajustes</span>
        </div>
      </div>
    </section>

    <section class="grid">
      ${isoAccordionHTML('empresaIso', true)}
    </section>
  `);

  document.getElementById('voltarEmpresaDetalhe')?.addEventListener('click', () => renderEmpresaDetalhe(empresaId));
  document.getElementById('abrirEcossistemaPelaIso')?.addEventListener('click', () => renderEmpresaEcossistemaAdmin(empresaId));
  bindIsoAccordion((reqId) => renderAdminRequirement(empresaId, reqId), 'empresaIso');
}

async function renderEmpresaEcossistemaAdmin(empresaId) {
  state.page = 'empresas';
  state.currentAdminView = { type: 'empresaEcossistema', empresaId };
  state.currentClientView = null;
  pushAppHistory(`admin:empresa:${empresaId}:ecossistema`, { page: 'empresas', adminView: state.currentAdminView });
  await loadEmpresas();
  const empresa = state.empresas.find(e => e.id === empresaId);
  if (!empresa) return renderEmpresas();

  const pastasEcossistema = await safeQueryBy('empresa_pastas', [['empresaId', '==', empresaId]]);
  const recursosEcossistema = await safeQueryBy('empresa_recursos', [['empresaId', '==', empresaId]]);

  shell(`Ecossistema: ${empresa.nome || '-'}`, 'Container documental separado da ISO: crie pastas e adicione PDF, Word ou links para a empresa.', `
    <section class="actions" style="margin-bottom:18px;">
      <button class="btn btn-soft" id="voltarEmpresaDetalhe">← Voltar para a empresa</button>
      <button class="btn btn-primary" id="abrirIsoPeloEcossistema">Gestão ISO</button>
    </section>
    ${empresaEcossistemaHTML(empresa, pastasEcossistema, recursosEcossistema, true, true)}
  `);

  document.getElementById('voltarEmpresaDetalhe')?.addEventListener('click', () => renderEmpresaDetalhe(empresaId));
  document.getElementById('abrirIsoPeloEcossistema')?.addEventListener('click', () => renderEmpresaIso(empresaId));
  document.getElementById('fecharEcossistemaEmpresa')?.addEventListener('click', () => renderEmpresaDetalhe(empresaId));
  bindEmpresaEcossistemaAdmin(empresaId);
}

function empresaEcossistemaHTML(empresa, pastas = [], recursos = [], adminMode = false, startOpen = false) {
  const sortedPastas = [...pastas].sort((a, b) => (a.ordem || 999) - (b.ordem || 999) || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
  const orphanResources = recursos.filter(r => !r.pastaId);
  const totalResources = recursos.length;
  const emptyFolders = !sortedPastas.length && !orphanResources.length;

  return `
    <section class="card company-ecosystem-panel ${adminMode ? 'collapsible-panel' : ''} ${adminMode && !startOpen ? 'hidden' : ''}" id="empresaEcossistemaPanel">
      <div class="section-title-row compact-row">
        <div>
          <span class="kicker">Ecossistema da empresa</span>
          <h2>Pastas, documentos e links</h2>
          <p>Organize os conteúdos da empresa como um container documental: pastas internas, arquivos PDF/Word e links de vídeos, apresentações ou materiais externos.</p>
        </div>
        ${adminMode ? '<button class="btn btn-small btn-soft" type="button" id="fecharEcossistemaEmpresa">Fechar</button>' : ''}
      </div>

      <div class="ecosystem-summary">
        <span><strong>${sortedPastas.length}</strong> pasta(s)</span>
        <span><strong>${totalResources}</strong> item(ns)</span>
        <span><strong>${escapeHTML(empresa?.nome || '-')}</strong></span>
      </div>

      ${adminMode ? `
        <div class="ecosystem-folder-toolbar">
          <button class="btn btn-primary" type="button" id="abrirFormularioPastaEmpresa">Criar pasta</button>
        </div>
        <form class="ecosystem-folder-form hidden" id="empresaPastaForm">
          <div class="section-title-row compact-row no-margin">
            <div>
              <span class="kicker">Nova pasta</span>
              <h2>Criar pasta</h2>
              <p>Informe os dados somente quando for criar uma nova pasta no ecossistema da empresa.</p>
            </div>
            <button class="btn btn-small btn-soft" type="button" id="fecharFormularioPastaEmpresa">Fechar</button>
          </div>
          <div class="form-grid-3">
            <div class="form-group"><label>Nome da pasta</label><input name="nome" required placeholder="Ex.: ISO 9000_25_CSC" /></div>
            <div class="form-group"><label>Descrição</label><input name="descricao" placeholder="Ex.: Documentos da ISO 9001:2015" /></div>
            <div class="form-group"><label>Ordem</label><input name="ordem" type="number" min="1" placeholder="Opcional" /></div>
          </div>
          <button class="btn btn-primary" type="submit">Salvar pasta</button>
        </form>
      ` : ''}

      ${emptyFolders ? `
        <div class="empty-state-card">
          <h2>Nenhuma pasta criada ainda</h2>
          <p>${adminMode ? 'Crie uma pasta para começar a adicionar arquivos ou links dentro desta empresa.' : 'A administração ainda não liberou documentos neste ecossistema.'}</p>
        </div>
      ` : `
        <div class="ecosystem-folder-grid">
          ${sortedPastas.map(pasta => empresaPastaCardHTML(pasta, recursos.filter(r => r.pastaId === pasta.id), adminMode)).join('')}
          ${orphanResources.length ? empresaPastaCardHTML({ id: '', nome: 'Arquivos sem pasta', descricao: 'Itens antigos ou sem classificação.' }, orphanResources, adminMode) : ''}
        </div>
      `}
    </section>
  `;
}

function empresaPastaCardHTML(pasta, recursos = [], adminMode = false) {
  return `
    <article class="ecosystem-folder-card">
      <div class="folder-card-header">
        <div>
          <span class="folder-icon">▣</span>
          <strong>${escapeHTML(pasta.nome || 'Pasta')}</strong>
          ${pasta.descricao ? `<p>${escapeHTML(pasta.descricao)}</p>` : ''}
          <small>${recursos.length} item(ns)</small>
        </div>
        ${adminMode && pasta.id ? `<button class="btn btn-small btn-danger" type="button" data-delete-pasta="${escapeHTML(pasta.id)}">Excluir pasta</button>` : ''}
      </div>

      ${adminMode && pasta.id ? `
        <details class="ecosystem-add-resource">
          <summary>+ Adicionar arquivo ou link nesta pasta</summary>
          <form data-empresa-recurso-form data-pasta-id="${escapeHTML(pasta.id)}">
            <div class="form-grid-2">
              <div class="form-group"><label>Título</label><input name="titulo" required placeholder="Ex.: Contrato, vídeo explicativo, apresentação..." /></div>
              <div class="form-group"><label>Tipo do link</label><select name="tipoLink"><option value="">Sem link</option><option value="video">Vídeo</option><option value="slide">Slide/apresentação</option><option value="outro">Outro link</option></select></div>
            </div>
            <div class="form-group"><label>Descrição/orientação</label><textarea name="descricao" placeholder="Explique para que serve este item."></textarea></div>
            <div class="form-group"><label>Link externo opcional</label><input name="linkUrl" type="url" placeholder="https://... vídeo, slide, página ou material externo" /></div>
            <div class="form-grid-2">
              <div class="form-group"><label>PDF opcional</label><input name="arquivoPdf" type="file" accept="application/pdf,.pdf" /></div>
              <div class="form-group"><label>Word opcional</label><input name="arquivoWord" type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /></div>
            </div>
            <button class="btn btn-gold" type="submit">Salvar item na pasta</button>
          </form>
        </details>
      ` : ''}

      <div class="ecosystem-resource-list">
        ${recursos.map(item => empresaRecursoItemHTML(item, adminMode)).join('') || '<p class="muted">Nenhum item nesta pasta.</p>'}
      </div>
    </article>
  `;
}

function empresaRecursoItemHTML(item, adminMode = false) {
  const meta = [
    item.tipoLink ? `Link: ${item.tipoLink}` : '',
    item.pdfNome ? `PDF: ${item.pdfNome}` : '',
    item.wordNome ? `Word: ${item.wordNome}` : ''
  ].filter(Boolean).join(' • ');

  return `
    <div class="ecosystem-resource-item">
      <div>
        <strong>${escapeHTML(item.titulo || item.pdfNome || item.wordNome || 'Item')}</strong>
        ${item.descricao ? `<span>${escapeHTML(item.descricao)}</span>` : ''}
        ${meta ? `<small>${escapeHTML(meta)}</small>` : '<small>Material disponível</small>'}
      </div>
      ${empresaRecursoActionsHTML(item, adminMode)}
    </div>
  `;
}

function empresaRecursoActionsHTML(item, adminMode = false) {
  const actions = [];
  if (item.pdfUrl) {
    actions.push(`<button class="btn btn-small btn-blue" type="button" data-pdf-preview="${escapeHTML(item.pdfUrl)}" data-pdf-title="${escapeHTML(item.titulo || item.pdfNome || 'PDF')}">Ver PDF</button>`);
    actions.push(`<a class="btn btn-small btn-soft" href="${escapeHTML(item.pdfUrl)}" download="${escapeHTML(item.pdfNome || 'documento.pdf')}" target="_blank" rel="noopener">Baixar PDF</a>`);
  }
  if (item.wordUrl) {
    actions.push(`<a class="btn btn-small btn-gold" href="${escapeHTML(item.wordUrl)}" download="${escapeHTML(item.wordNome || 'documento.docx')}" target="_blank" rel="noopener">Baixar Word</a>`);
  }
  if (item.linkUrl) {
    actions.push(`<a class="btn btn-small btn-primary" href="${escapeHTML(item.linkUrl)}" target="_blank" rel="noopener">Abrir link</a>`);
  }
  if (adminMode && item.id) {
    actions.push(`<button class="btn btn-small btn-danger" type="button" data-delete-recurso="${escapeHTML(item.id)}">Excluir</button>`);
  }
  return `<div class="file-actions">${actions.join('') || '<span class="muted">Sem ação disponível</span>'}</div>`;
}

async function uploadEmpresaRecursoArquivo(empresaId, pastaId, tipo, file) {
  if (!file || !file.name) return { url: '', nome: '', path: '' };
  const path = `empresas/${empresaId}/ecossistema/${pastaId || 'sem-pasta'}/${tipo}/${safeFileName(file.name)}`;
  const url = await uploadArquivoVersao(path, file);
  return { url, nome: file.name, path };
}

function normalizarUrlOpcional(url = '') {
  const clean = String(url || '').trim();
  if (!clean) return '';
  try {
    const parsed = new URL(clean);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('URL inválida');
    return parsed.toString();
  } catch (error) {
    throw new Error('Informe um link válido começando com https:// ou http://.');
  }
}

async function salvarEmpresaPasta(empresaId, form) {
  const nome = String(form.get('nome') || '').trim();
  if (!nome) throw new Error('Informe o nome da pasta.');
  await addDoc(collection(db, 'empresa_pastas'), {
    empresaId,
    nome,
    descricao: String(form.get('descricao') || '').trim(),
    ordem: Number(form.get('ordem') || 999),
    criadoEm: serverTimestamp(),
    criadoPor: state.user.uid,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: state.user.uid
  });
}

async function salvarEmpresaRecurso(empresaId, pastaId, form) {
  const titulo = String(form.get('titulo') || '').trim();
  const descricao = String(form.get('descricao') || '').trim();
  const tipoLink = String(form.get('tipoLink') || '').trim();
  const linkUrl = normalizarUrlOpcional(form.get('linkUrl'));
  const pdfFile = form.get('arquivoPdf');
  const wordFile = form.get('arquivoWord');

  if (!titulo) throw new Error('Informe o título do item.');
  if ((!pdfFile || !pdfFile.name) && (!wordFile || !wordFile.name) && !linkUrl) {
    throw new Error('Adicione pelo menos um PDF, um Word ou um link.');
  }

  const pdf = pdfFile && pdfFile.name ? await uploadEmpresaRecursoArquivo(empresaId, pastaId, 'pdf', pdfFile) : { url: '', nome: '', path: '' };
  const word = wordFile && wordFile.name ? await uploadEmpresaRecursoArquivo(empresaId, pastaId, 'word', wordFile) : { url: '', nome: '', path: '' };

  await addDoc(collection(db, 'empresa_recursos'), {
    empresaId,
    pastaId,
    titulo,
    descricao,
    tipoLink: linkUrl ? (tipoLink || 'outro') : '',
    linkUrl,
    pdfUrl: pdf.url,
    pdfNome: pdf.nome,
    pdfStoragePath: pdf.path,
    wordUrl: word.url,
    wordNome: word.nome,
    wordStoragePath: word.path,
    criadoEm: serverTimestamp(),
    criadoPor: state.user.uid,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: state.user.uid
  });
}

async function deleteEmpresaRecurso(recursoId) {
  if (state.perfil?.tipo !== 'admin') return toast('Apenas administradores podem excluir itens.', 'error');
  const snap = await getDoc(doc(db, 'empresa_recursos', recursoId));
  if (!snap.exists()) return toast('Item não encontrado.', 'error');
  const item = { id: snap.id, ...snap.data() };
  const ok = confirm(`Excluir definitivamente o item "${item.titulo || 'sem título'}"?`);
  if (!ok) return;
  await deleteStoragePathIfExists(item.pdfStoragePath);
  await deleteStoragePathIfExists(item.wordStoragePath);
  await deleteDoc(doc(db, 'empresa_recursos', recursoId));
  toast('Item excluído.');
  await refreshAdminFileContext();
}

async function deleteEmpresaPasta(pastaId) {
  if (state.perfil?.tipo !== 'admin') return toast('Apenas administradores podem excluir pastas.', 'error');
  const snap = await getDoc(doc(db, 'empresa_pastas', pastaId));
  if (!snap.exists()) return toast('Pasta não encontrada.', 'error');
  const pasta = { id: snap.id, ...snap.data() };
  const recursos = await safeQueryBy('empresa_recursos', [['pastaId', '==', pastaId]]);
  const ok = confirm(`Excluir a pasta "${pasta.nome || 'sem nome'}" e ${recursos.length} item(ns) dentro dela?`);
  if (!ok) return;
  for (const item of recursos) {
    await deleteStoragePathIfExists(item.pdfStoragePath);
    await deleteStoragePathIfExists(item.wordStoragePath);
    await deleteDoc(doc(db, 'empresa_recursos', item.id));
  }
  await deleteDoc(doc(db, 'empresa_pastas', pastaId));
  toast('Pasta excluída.');
  await refreshAdminFileContext();
}

function bindEmpresaEcossistemaAdmin(empresaId) {
  const pastaForm = document.getElementById('empresaPastaForm');
  document.getElementById('abrirFormularioPastaEmpresa')?.addEventListener('click', () => {
    pastaForm?.classList.remove('hidden');
    pastaForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('fecharFormularioPastaEmpresa')?.addEventListener('click', () => {
    pastaForm?.classList.add('hidden');
  });

  document.getElementById('empresaPastaForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = event.submitter;
    setLoading(btn, true, 'Criando pasta...');
    try {
      await salvarEmpresaPasta(empresaId, new FormData(event.currentTarget));
      toast('Pasta criada com sucesso.');
      await renderEmpresaEcossistemaAdmin(empresaId);
    } catch (error) {
      toast(normalizeError(error), 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  document.querySelectorAll('[data-empresa-recurso-form]').forEach(formEl => {
    formEl.addEventListener('submit', async (event) => {
      event.preventDefault();
      const btn = event.submitter;
      setLoading(btn, true, 'Salvando item...');
      try {
        await salvarEmpresaRecurso(empresaId, formEl.dataset.pastaId || '', new FormData(formEl));
        toast('Item salvo no ecossistema da empresa.');
        await renderEmpresaEcossistemaAdmin(empresaId);
      } catch (error) {
        toast(normalizeError(error), 'error');
      } finally {
        setLoading(btn, false);
      }
    });
  });

  document.querySelectorAll('[data-delete-recurso]').forEach(btn => {
    btn.addEventListener('click', () => deleteEmpresaRecurso(btn.dataset.deleteRecurso));
  });

  document.querySelectorAll('[data-delete-pasta]').forEach(btn => {
    btn.addEventListener('click', () => deleteEmpresaPasta(btn.dataset.deletePasta));
  });
}

async function renderClienteEcossistema() {
  state.page = 'cliente-ecossistema';
  state.currentAdminView = null;
  state.currentClientView = { type: 'ecossistema' };
  pushAppHistory('cliente:ecossistema', { page: 'cliente-ecossistema', clientView: state.currentClientView });
  await loadEmpresas();
  const empresaId = state.perfil?.empresaId || '';
  const empresa = state.empresas.find(e => e.id === empresaId);
  const [pastas, recursos] = await Promise.all([
    safeQueryBy('empresa_pastas', [['empresaId', '==', empresaId]]),
    safeQueryBy('empresa_recursos', [['empresaId', '==', empresaId]])
  ]);

  shell('Ecossistema da empresa', `Dentro da empresa: ${empresa?.nome || '-'}`, `
    <section class="actions" style="margin-bottom:18px;">
      <button class="btn btn-soft" id="voltarClienteHome">← Voltar</button>
    </section>
    ${empresaEcossistemaHTML(empresa, pastas, recursos, false)}
  `);

  document.getElementById('voltarClienteHome')?.addEventListener('click', renderClienteHome);
}


function showEmpresaEditModal(empresaId) {
  const empresa = state.empresas.find(e => e.id === empresaId);
  if (!empresa) return toast('Empresa não encontrada.', 'error');

  const existing = document.querySelector('.modal-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <form id="editEmpresaForm">
        <div class="actions" style="justify-content:space-between; margin-bottom:14px;">
          <strong>Editar empresa</strong>
          <button class="btn btn-soft btn-small" type="button" data-empresa-modal-close>Fechar</button>
        </div>
        <div class="form-group"><label>Nome da empresa</label><input name="nome" value="${escapeHTML(empresa.nome || '')}" required /></div>
        <div class="form-group"><label>CNPJ</label><input name="cnpj" value="${escapeHTML(empresa.cnpj || '')}" placeholder="00.000.000/0000-00" /></div>
        <div class="form-group"><label>E-mail da empresa</label><input name="email" type="email" value="${escapeHTML(empresa.email || '')}" /></div>
        <div class="form-group"><label>Telefone/WhatsApp</label><input name="telefone" value="${escapeHTML(empresa.telefone || '')}" /></div>
        <div class="form-group"><label>Responsável</label><input name="responsavel" value="${escapeHTML(empresa.responsavel || empresa.responsavelNome || '')}" /></div>
        <div class="form-group"><label>E-mail do responsável</label><input name="responsavelEmail" type="email" value="${escapeHTML(empresa.responsavelEmail || '')}" /></div>
        <div class="form-group">
          <label>Status</label>
          <select name="status">
            <option value="ativa" ${(empresa.status || 'ativa') === 'ativa' ? 'selected' : ''}>Ativa</option>
            <option value="inativa" ${empresa.status === 'inativa' ? 'selected' : ''}>Inativa</option>
          </select>
        </div>
        <div class="notice">A edição altera os dados da empresa no sistema. O e-mail de login do usuário responsável é gerenciado na aba Usuários.</div>
        <div class="actions" style="margin-top:18px;">
          <button class="btn btn-primary" type="submit">Salvar alterações</button>
          <button class="btn btn-soft" type="button" data-empresa-modal-close>Cancelar</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-empresa-modal-close]')) backdrop.remove();
  });

  document.getElementById('editEmpresaForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = event.submitter;
    setLoading(btn, true);
    try {
      const form = new FormData(event.currentTarget);
      const nome = form.get('nome').trim();
      if (!nome) throw new Error('Informe o nome da empresa.');

      await updateDoc(doc(db, 'empresas', empresaId), {
        nome,
        cnpj: form.get('cnpj').trim(),
        email: normalizarEmail(form.get('email')),
        telefone: form.get('telefone').trim(),
        responsavel: form.get('responsavel').trim(),
        responsavelEmail: normalizarEmail(form.get('responsavelEmail')),
        status: form.get('status'),
        atualizadoEm: serverTimestamp(),
        atualizadoPor: state.user.uid
      });

      backdrop.remove();
      toast('Empresa atualizada com sucesso.');
      await loadEmpresas();
      if (state.page === 'empresa-detalhe' || document.getElementById('voltarEmpresas')) {
        renderEmpresaDetalhe(empresaId);
      } else {
        renderEmpresas();
      }
    } catch (error) {
      toast(normalizeError(error), 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

async function deleteStorageFileByPath(storagePath) {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    // O arquivo pode já não existir no Storage ou ser legado sem caminho válido.
    console.warn('Não foi possível excluir arquivo do Storage:', storagePath, error);
  }
}

async function deleteEmpresa(empresaId) {
  const empresa = state.empresas.find(e => e.id === empresaId);
  if (!empresa) return toast('Empresa não encontrada.', 'error');

  const nome = empresa.nome || 'esta empresa';
  const ok = confirm(
    `Excluir ${nome}?\n\n` +
    'Isso removerá a empresa do sistema, usuários vinculados, respostas ISO, convites e registros de arquivos dessa empresa. ' +
    'Os usuários podem continuar aparecendo no Authentication do Firebase, mas sem perfil liberado no sistema eles não entram mais.\n\n' +
    'Essa ação não pode ser desfeita.'
  );
  if (!ok) return;

  const confirmacao = prompt(`Para confirmar, digite EXCLUIR`);
  if (confirmacao !== 'EXCLUIR') {
    return toast('Exclusão cancelada. A confirmação precisa ser exatamente EXCLUIR.', 'info');
  }

  try {
    toast('Excluindo empresa e dados vinculados...', 'info');

    const [usuariosEmpresa, respostas, arquivos, anexosLegados, materiaisLegados, convites, pastasEmpresa, recursosEmpresa] = await Promise.all([
      queryBy('usuarios', [['empresaId', '==', empresaId]]).catch(() => []),
      queryBy('respostas_iso', [['empresaId', '==', empresaId]]).catch(() => []),
      queryBy('arquivos', [['empresaId', '==', empresaId]]).catch(() => []),
      queryBy('anexos_empresa', [['empresaId', '==', empresaId]]).catch(() => []),
      queryBy('materiais_apoio', [['empresaId', '==', empresaId]]).catch(() => []),
      queryBy('convites_acesso', [['empresaId', '==', empresaId]]).catch(() => []),
      queryBy('empresa_pastas', [['empresaId', '==', empresaId]]).catch(() => []),
      queryBy('empresa_recursos', [['empresaId', '==', empresaId]]).catch(() => [])
    ]);

    const arquivosComStorage = [...arquivos, ...anexosLegados, ...materiaisLegados, ...recursosEmpresa];
    await Promise.all(arquivosComStorage.flatMap(a => [
      deleteStorageFileByPath(a.storagePath),
      deleteStorageFileByPath(a.pdfStoragePath),
      deleteStorageFileByPath(a.wordStoragePath)
    ]));

    await Promise.all([
      ...usuariosEmpresa.map(u => deleteDoc(doc(db, 'usuarios', u.id))),
      ...usuariosEmpresa
        .map(u => normalizarEmail(u.email))
        .filter(Boolean)
        .map(email => deleteDoc(doc(db, 'convites_acesso', conviteIdFromEmail(email))).catch(() => null)),
      ...respostas.map(r => deleteDoc(doc(db, 'respostas_iso', r.id))),
      ...arquivos.map(a => deleteDoc(doc(db, 'arquivos', a.id))),
      ...anexosLegados.map(a => deleteDoc(doc(db, 'anexos_empresa', a.id))),
      ...materiaisLegados.map(m => deleteDoc(doc(db, 'materiais_apoio', m.id))),
      ...recursosEmpresa.map(a => deleteDoc(doc(db, 'empresa_recursos', a.id))),
      ...pastasEmpresa.map(pasta => deleteDoc(doc(db, 'empresa_pastas', pasta.id))),
      ...convites.map(c => deleteDoc(doc(db, 'convites_acesso', c.id))),
      deleteDoc(doc(db, 'empresas', empresaId))
    ]);

    toast('Empresa excluída do sistema.', 'success');
    await Promise.all([loadEmpresas(), loadUsuarios(), loadConvites()]);
    renderEmpresas();
  } catch (error) {
    toast(normalizeError(error), 'error');
  }
}

async function renderUsuarios() {
  state.page = 'usuarios';
  state.currentAdminView = { type: 'usuarios' };
  state.currentClientView = null;
  pushAppHistory('admin:usuarios', { page: 'usuarios', adminView: state.currentAdminView });
  await Promise.all([loadEmpresas(), loadUsuarios(), loadConvites()]);

  const emailsComPerfil = new Set(state.usuarios.map(u => normalizarEmail(u.email)));
  const convitesPendentes = state.convites.filter(c => !emailsComPerfil.has(normalizarEmail(c.email)) || c.usado !== true);

  shell('Usuários', 'Crie, edite, bloqueie, redefina senha e remova acessos de clientes e administradores.', `
    <section class="card clean-action-card">
      <div class="section-title-row no-margin">
        <div>
          <span class="kicker">Gerenciamento de acessos</span>
          <h2>Usuários</h2>
          <p class="muted">A tela fica focada na lista e no gerenciamento. O formulário de novo acesso aparece somente quando você clicar em cadastrar.</p>
        </div>
        <button class="btn btn-primary" type="button" id="toggleUsuarioForm">+ Cadastrar usuário</button>
      </div>

      <form class="collapsible-panel hidden" id="usuarioForm">
        <div class="section-title-row compact-row">
          <div>
            <span class="kicker">Novo acesso</span>
            <h2>Novo usuário</h2>
            <p>O painel cria o acesso automaticamente. Se o e-mail já existir no Authentication, o sistema salva o convite e ativa o perfil no próximo login.</p>
          </div>
          <button class="btn btn-soft btn-small" type="button" id="fecharUsuarioForm">Fechar</button>
        </div>
        <div class="form-group"><label>Nome</label><input name="nome" required /></div>
        <div class="form-group"><label>E-mail</label><input name="email" type="email" required /></div>
        <div class="form-group"><label>Senha provisória</label><input name="senha" type="password" minlength="6" required /></div>
        <div class="form-group">
          <label>Tipo</label>
          <select name="tipo" id="tipoUsuario">
            <option value="cliente">Cliente</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="form-group" id="empresaUsuarioBox">
          <label>Empresa vinculada</label>
          <select name="empresaId">
            <option value="">Selecione uma empresa</option>
            ${state.empresas.map(e => `<option value="${e.id}">${escapeHTML(e.nome)}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" type="submit">Criar usuário</button>
      </form>
    </section>

    <section class="card" style="margin-top:20px;">
      <h2>Gerenciamento</h2>
      <p>Use esta área para limpar usuários de teste, bloquear acesso, trocar empresa vinculada e reenviar recuperação de senha.</p>
      <div class="notice">
        Por segurança do Firebase, a troca de senha de outro usuário é feita por e-mail de redefinição. A exclusão remove o acesso do sistema; para apagar também do Authentication é necessário usar o console Firebase ou uma Cloud Function administrativa.
      </div>
      <div class="stat-grid small-stats">
        <div class="stat-card"><strong>${state.usuarios.length}</strong><span>Perfis liberados</span></div>
        <div class="stat-card"><strong>${convitesPendentes.length}</strong><span>Convites/acessos pendentes</span></div>
      </div>
    </section>

    <section class="card" style="margin-top:20px;">
      <div class="section-title-row">
        <div>
          <h2>Usuários cadastrados</h2>
          <p class="muted">Perfis que já existem na coleção usuarios e conseguem acessar se estiverem ativos.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Usuário</th><th>Tipo</th><th>Empresa</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${state.usuarios.map(u => `
              <tr>
                <td><strong>${escapeHTML(u.nome || '-')}</strong><br><span class="muted">${escapeHTML(u.email || '')}</span></td>
                <td><span class="badge ${u.tipo === 'admin' ? 'gold' : 'blue'}">${escapeHTML(u.tipo || '-')}</span></td>
                <td>${escapeHTML(getEmpresaNome(u.empresaId))}</td>
                <td>${u.ativo ? '<span class="badge green">Ativo</span>' : '<span class="badge red">Inativo</span>'}</td>
                <td>
                  <div class="actions table-actions">
                    <button class="btn btn-small btn-blue" type="button" data-edit-user="${u.id}">Editar</button>
                    <button class="btn btn-small btn-soft" type="button" data-reset-user="${u.id}">Senha</button>
                    <button class="btn btn-small ${u.ativo ? 'btn-soft' : 'btn-blue'}" type="button" data-toggle-user="${u.id}">${u.ativo ? 'Bloquear' : 'Ativar'}</button>
                    <button class="btn btn-small btn-danger" type="button" data-delete-user="${u.id}">Excluir</button>
                  </div>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="5">Nenhum usuário cadastrado.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>

    <section class="card" style="margin-top:20px;">
      <h2>Convites e acessos pendentes</h2>
      <p class="muted">Aqui aparecem e-mails que foram liberados, mas ainda não têm perfil completo em usuarios, ou convites antigos de teste.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>E-mail</th><th>Tipo</th><th>Empresa</th><th>Situação</th><th>Ações</th></tr></thead>
          <tbody>
            ${convitesPendentes.map(c => `
              <tr>
                <td><strong>${escapeHTML(c.nome || '-')}</strong><br><span class="muted">${escapeHTML(c.email || c.id)}</span></td>
                <td><span class="badge ${c.tipo === 'admin' ? 'gold' : 'blue'}">${escapeHTML(c.tipo || '-')}</span></td>
                <td>${escapeHTML(c.empresaNome || getEmpresaNome(c.empresaId))}</td>
                <td>${c.ativo ? '<span class="badge orange">Aguardando login</span>' : '<span class="badge red">Inativo</span>'}</td>
                <td>
                  <div class="actions table-actions">
                    <button class="btn btn-small btn-danger" type="button" data-delete-invite="${escapeHTML(c.id)}">Excluir convite</button>
                  </div>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="5">Nenhum convite pendente.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `);

  const usuarioForm = document.getElementById('usuarioForm');
  const toggleUsuarioForm = document.getElementById('toggleUsuarioForm');
  const fecharUsuarioForm = document.getElementById('fecharUsuarioForm');
  toggleUsuarioForm?.addEventListener('click', () => {
    usuarioForm?.classList.toggle('hidden');
    toggleUsuarioForm.textContent = usuarioForm?.classList.contains('hidden') ? '+ Cadastrar usuário' : 'Ocultar cadastro';
    if (!usuarioForm?.classList.contains('hidden')) usuarioForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  fecharUsuarioForm?.addEventListener('click', () => {
    usuarioForm?.classList.add('hidden');
    if (toggleUsuarioForm) toggleUsuarioForm.textContent = '+ Cadastrar usuário';
  });

  const tipoSelect = document.getElementById('tipoUsuario');
  const empresaBox = document.getElementById('empresaUsuarioBox');
  tipoSelect?.addEventListener('change', () => {
    empresaBox?.classList.toggle('hidden', tipoSelect.value === 'admin');
  });

  document.querySelectorAll('[data-edit-user]').forEach(btn => {
    btn.addEventListener('click', () => showUserEditModal(btn.dataset.editUser));
  });

  document.querySelectorAll('[data-reset-user]').forEach(btn => {
    btn.addEventListener('click', () => resetUserPassword(btn.dataset.resetUser));
  });

  document.querySelectorAll('[data-toggle-user]').forEach(btn => {
    btn.addEventListener('click', () => toggleUserActive(btn.dataset.toggleUser));
  });

  document.querySelectorAll('[data-delete-user]').forEach(btn => {
    btn.addEventListener('click', () => deleteUserAccess(btn.dataset.deleteUser));
  });

  document.querySelectorAll('[data-delete-invite]').forEach(btn => {
    btn.addEventListener('click', () => deleteInvite(btn.dataset.deleteInvite));
  });

  document.getElementById('usuarioForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = event.submitter;
    setLoading(btn, true, 'Criando...');
    try {
      const form = new FormData(event.currentTarget);
      const nome = form.get('nome').trim();
      const email = normalizarEmail(form.get('email'));
      const senha = form.get('senha');
      const tipo = form.get('tipo');
      const empresaId = tipo === 'cliente' ? form.get('empresaId') : '';
      if (tipo === 'cliente' && !empresaId) throw new Error('Selecione a empresa do cliente.');

      const empresaNome = empresaId ? getEmpresaNome(empresaId) : '';
      await criarConviteAcesso({ nome, email, tipo, empresaId, empresaNome });

      try {
        const credential = await createUserWithEmailAndPassword(secondaryAuth, email, senha);
        await setDoc(doc(db, 'usuarios', credential.user.uid), {
          nome,
          email,
          tipo,
          empresaId,
          ativo: true,
          criadoEm: serverTimestamp(),
          criadoPor: state.user.uid
        });
        await signOut(secondaryAuth).catch(() => null);
        toast('Usuário criado automaticamente no Authentication e no Firestore.');
      } catch (authError) {
        await signOut(secondaryAuth).catch(() => null);
        if (!isEmailAlreadyInUse(authError)) throw authError;
        toast('Este e-mail já existia no Authentication. O convite foi criado e o perfil será ativado automaticamente no próximo login desse usuário.', 'success');
      }

      renderUsuarios();
    } catch (error) {
      toast(normalizeError(error), 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

function showUserEditModal(userId) {
  const usuario = state.usuarios.find(u => u.id === userId);
  if (!usuario) return toast('Usuário não encontrado.', 'error');

  const existing = document.querySelector('.modal-backdrop');
  if (existing) existing.remove();

  const tipo = usuario.tipo || 'cliente';
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <form id="editUserForm">
        <div class="actions" style="justify-content:space-between; margin-bottom:14px;">
          <strong>Editar usuário</strong>
          <button class="btn btn-soft btn-small" type="button" data-user-modal-close>Fechar</button>
        </div>
        <div class="form-group"><label>Nome</label><input name="nome" value="${escapeHTML(usuario.nome || '')}" required /></div>
        <div class="form-group"><label>E-mail de acesso</label><input value="${escapeHTML(usuario.email || '')}" disabled /></div>
        <div class="notice">O e-mail fica travado porque ele pertence ao Firebase Authentication. Para trocar o e-mail, crie um novo acesso e exclua este.</div>
        <div class="form-group">
          <label>Tipo</label>
          <select name="tipo" id="editTipoUsuario">
            <option value="cliente" ${tipo === 'cliente' ? 'selected' : ''}>Cliente</option>
            <option value="admin" ${tipo === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </div>
        <div class="form-group ${tipo === 'admin' ? 'hidden' : ''}" id="editEmpresaUsuarioBox">
          <label>Empresa vinculada</label>
          <select name="empresaId">
            <option value="">Selecione uma empresa</option>
            ${state.empresas.map(e => `<option value="${e.id}" ${usuario.empresaId === e.id ? 'selected' : ''}>${escapeHTML(e.nome)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select name="ativo">
            <option value="true" ${usuario.ativo !== false ? 'selected' : ''}>Ativo</option>
            <option value="false" ${usuario.ativo === false ? 'selected' : ''}>Inativo / bloqueado</option>
          </select>
        </div>
        <div class="actions" style="margin-top:18px;">
          <button class="btn btn-primary" type="submit">Salvar alterações</button>
          <button class="btn btn-soft" type="button" data-user-modal-close>Cancelar</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(backdrop);

  const editTipo = document.getElementById('editTipoUsuario');
  const editEmpresaBox = document.getElementById('editEmpresaUsuarioBox');
  editTipo.addEventListener('change', () => {
    editEmpresaBox.classList.toggle('hidden', editTipo.value === 'admin');
  });

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-user-modal-close]')) backdrop.remove();
  });

  document.getElementById('editUserForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = event.submitter;
    setLoading(btn, true);
    try {
      const form = new FormData(event.currentTarget);
      const novoTipo = form.get('tipo');
      const empresaId = novoTipo === 'cliente' ? form.get('empresaId') : '';
      if (novoTipo === 'cliente' && !empresaId) throw new Error('Selecione a empresa do cliente.');

      await updateDoc(doc(db, 'usuarios', userId), {
        nome: form.get('nome').trim(),
        tipo: novoTipo,
        empresaId,
        ativo: form.get('ativo') === 'true',
        atualizadoEm: serverTimestamp(),
        atualizadoPor: state.user.uid
      });

      const email = normalizarEmail(usuario.email);
      if (email) {
        await setDoc(doc(db, 'convites_acesso', conviteIdFromEmail(email)), {
          nome: form.get('nome').trim(),
          email,
          tipo: novoTipo,
          empresaId,
          empresaNome: empresaId ? getEmpresaNome(empresaId) : '',
          ativo: form.get('ativo') === 'true',
          atualizadoEm: serverTimestamp(),
          atualizadoPor: state.user.uid
        }, { merge: true });
      }

      backdrop.remove();
      toast('Usuário atualizado com sucesso.');
      renderUsuarios();
    } catch (error) {
      toast(normalizeError(error), 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

async function resetUserPassword(userId) {
  const usuario = state.usuarios.find(u => u.id === userId);
  if (!usuario?.email) return toast('Usuário sem e-mail cadastrado.', 'error');
  const ok = confirm(`Enviar e-mail de redefinição de senha para ${usuario.email}?`);
  if (!ok) return;
  try {
    await sendPasswordResetEmail(auth, usuario.email);
    toast('E-mail de redefinição enviado. Peça ao usuário para conferir também o spam.', 'success');
  } catch (error) {
    toast(normalizeError(error), 'error');
  }
}

async function toggleUserActive(userId) {
  const usuario = state.usuarios.find(u => u.id === userId);
  if (!usuario) return toast('Usuário não encontrado.', 'error');
  if (userId === state.user?.uid && usuario.ativo !== false) {
    return toast('Você não pode bloquear o próprio usuário logado.', 'error');
  }
  const novoStatus = usuario.ativo === false;
  try {
    await updateDoc(doc(db, 'usuarios', userId), {
      ativo: novoStatus,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: state.user.uid
    });
    const email = normalizarEmail(usuario.email);
    if (email) {
      await setDoc(doc(db, 'convites_acesso', conviteIdFromEmail(email)), {
        ativo: novoStatus,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: state.user.uid
      }, { merge: true });
    }
    toast(novoStatus ? 'Usuário ativado.' : 'Usuário bloqueado.');
    renderUsuarios();
  } catch (error) {
    toast(normalizeError(error), 'error');
  }
}

async function deleteUserAccess(userId) {
  const usuario = state.usuarios.find(u => u.id === userId);
  if (!usuario) return toast('Usuário não encontrado.', 'error');
  if (userId === state.user?.uid) return toast('Você não pode excluir o próprio usuário logado.', 'error');
  const ok = confirm(`Excluir o acesso de ${usuario.nome || usuario.email}?\n\nEle será removido do sistema e não conseguirá entrar. O registro do Authentication pode permanecer no Firebase e, se quiser apagar totalmente, precisa remover pelo Console ou Cloud Function.`);
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'usuarios', userId));
    const email = normalizarEmail(usuario.email);
    if (email) await deleteDoc(doc(db, 'convites_acesso', conviteIdFromEmail(email))).catch(() => null);
    toast('Acesso excluído do sistema.');
    renderUsuarios();
  } catch (error) {
    toast(normalizeError(error), 'error');
  }
}

async function deleteInvite(inviteId) {
  const convite = state.convites.find(c => c.id === inviteId);
  const ok = confirm(`Excluir convite${convite?.email ? ' de ' + convite.email : ''}?`);
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'convites_acesso', inviteId));
    toast('Convite excluído.');
    renderUsuarios();
  } catch (error) {
    toast(normalizeError(error), 'error');
  }
}

function isoAccordionHTML(prefix = 'req', expanded = false) {
  return ISO_SECTIONS.map(section => `
    <div class="iso-section">
      <button class="iso-header" type="button" data-toggle-section="${section.id}">
        <div>
          <span class="kicker">Seção ${escapeHTML(section.id)} da ISO 9001:2015</span>
          <strong>${escapeHTML(section.title)}</strong>
          <span>${escapeHTML(section.subtitle)}</span>
        </div>
        <span class="badge gold">${section.requirements.length} etapa(s)</span>
      </button>
      <div class="iso-requirements ${expanded ? '' : 'hidden'}" id="section-${prefix}-${section.id}">
        ${section.requirements.map(req => `
          <button class="req-btn ${req.manualType ? 'manual' : ''}" type="button" data-open-req="${req.id}">
            <div>
              <strong>${escapeHTML(req.number)} - ${escapeHTML(req.title)}</strong><br>
              <small>${req.manualType ? `Preenchimento manual: ${escapeHTML(req.manualLabel)}` : 'Sem preenchimento manual; arquivos disponibilizados pela administração'}</small>
            </div>
            <span>Abrir →</span>
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function bindIsoAccordion(onReqOpen, prefix = 'req') {
  document.querySelectorAll('[data-toggle-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = document.getElementById(`section-${prefix}-${btn.dataset.toggleSection}`);
      section?.classList.toggle('hidden');
    });
  });

  document.querySelectorAll('[data-open-req]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reqId = btn.dataset.openReq;
      if (!reqId) return;
      setLoading(btn, true, 'Abrindo...');
      try {
        await onReqOpen(reqId);
      } catch (error) {
        console.error('Erro ao abrir requisito ISO:', error);
        toast(normalizeError(error), 'error');
      } finally {
        setLoading(btn, false);
      }
    });
  });
}

async function renderIsoAdmin() {
  return renderEmpresas();
}

async function queryBy(collectionName, filters) {
  const q = query(collection(db, collectionName), ...filters.map(([field, op, value]) => where(field, op, value)));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function safeQueryBy(collectionName, filters, fallback = []) {
  try {
    return await queryBy(collectionName, filters);
  } catch (error) {
    console.warn(`Consulta ignorada em ${collectionName}:`, error);
    return fallback;
  }
}

async function loadRequirementData(empresaId, reqId, adminMode = false) {
  if (!empresaId) throw new Error('Usuário sem empresa vinculada. Verifique o cadastro do usuário.');

  const respostaId = `${empresaId}_${reqId}`;
  const respostaSnap = await getDoc(doc(db, 'respostas_iso', respostaId));
  const resposta = respostaSnap.exists() ? { id: respostaSnap.id, ...respostaSnap.data() } : null;

  // Importante para o perfil cliente: as regras do Firebase não permitem consultar
  // todos os materiais de apoio de uma vez. Para o cliente, buscamos somente
  // materiais públicos do tópico ISO; documentos específicos ficam no Ecossistema da empresa.
  const [arquivosDaEmpresa, materiaisPublicos] = await Promise.all([
    safeQueryBy('arquivos', [['empresaId', '==', empresaId]]),
    safeQueryBy('arquivos', [['categoria', '==', 'material_apoio'], ['publico', '==', true]])
  ]);

  const materiais = uniqueFiles([
    ...materiaisPublicos.filter(a => a.publico === true && a.requisitoId === reqId)
  ]);

  const arquivosConsultoria = arquivosDaEmpresa.filter(a => a.categoria === 'consultoria' && a.requisitoId === reqId);

  return { resposta, materiais, arquivosConsultoria };
}

function uniqueFiles(files) {
  const map = new Map();
  files.forEach(file => {
    const key = file.id || file.storagePath || file.arquivoUrl || `${file.categoria}-${file.titulo}-${file.arquivoNome}`;
    if (!map.has(key)) map.set(key, file);
  });
  return [...map.values()];
}

function isIsoCompletaFile(file = {}) {
  return file.categoria === 'material_apoio' && file.tipoMaterial === 'iso_completa';
}

function fileCategoryLabel(file) {
  if (file.categoria === 'material_apoio') {
    if (isIsoCompletaFile(file)) return 'Arquivo da ISO completa';
    if (file.tipoMaterial === 'avulso' || !file.requisitoId) return 'Material avulso do cofre';
    return file.publico ? 'Material de apoio ISO' : 'Material interno da administração';
  }
  if (file.categoria === 'empresa') return 'Documento enviado pela empresa';
  if (file.categoria === 'consultoria') return 'Arquivo enviado pela consultoria';
  return 'Arquivo';
}

function getRequirementInfoFromFile(file = {}) {
  if (isIsoCompletaFile(file)) {
    return {
      id: 'iso_completa',
      number: 'ISO completa',
      title: 'Arquivo completo',
      sectionTitle: 'Documento geral da ISO'
    };
  }

  if (file.categoria === 'material_apoio' && (file.tipoMaterial === 'avulso' || !file.requisitoId)) {
    return {
      id: 'avulso',
      number: 'Avulso',
      title: 'Material avulso',
      sectionTitle: 'Cofre de materiais'
    };
  }
  const req = requirementMap.get(file.requisitoId || file.requisito || '');
  const numberFromId = file.requisitoId ? String(file.requisitoId).replace('_', '.') : '';
  return {
    id: file.requisitoId || req?.id || '',
    number: file.requisitoNumero || req?.number || numberFromId,
    title: file.requisitoTitulo || req?.title || '',
    sectionTitle: file.secaoTitulo || req?.section?.title || ''
  };
}

function fileSectorLabel(file) {
  const info = getRequirementInfoFromFile(file);
  if (!info.number && !info.title) return 'Setor ISO não identificado';
  return `${info.number || 'Setor'}${info.title ? ` - ${info.title}` : ''}`;
}

function fileSectorShort(file) {
  const info = getRequirementInfoFromFile(file);
  return info.number || 'ISO';
}

function fileSectorHTML(file) {
  const info = getRequirementInfoFromFile(file);
  if (!info.number && !info.title) {
    return '<span class="file-sector"><strong>Setor ISO:</strong> não identificado</span>';
  }
  return `<span class="file-sector"><strong>Setor ISO:</strong> ${escapeHTML(fileSectorLabel(file))}</span>`;
}

function requirementSortScore(file) {
  const info = getRequirementInfoFromFile(file);
  const number = info.number || '999';
  const parts = String(number).split('.').map(part => parseInt(part, 10));
  return (parts[0] || 999) * 100 + (parts[1] || 0);
}

function arquivosRecebidosPorSetorHTML(files) {
  if (!files.length) return '<p class="muted">Nenhum arquivo enviado pela administração para sua empresa.</p>';

  const sorted = [...files].sort((a, b) => {
    const diff = requirementSortScore(a) - requirementSortScore(b);
    if (diff !== 0) return diff;
    return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
  });

  const groups = new Map();
  sorted.forEach(file => {
    const key = getRequirementInfoFromFile(file).id || fileSectorLabel(file);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  });

  return `<div class="sector-file-groups">${Array.from(groups.values()).map(group => {
    const first = group[0];
    const info = getRequirementInfoFromFile(first);
    const title = fileSectorLabel(first);
    return `
      <section class="sector-file-group">
        <div class="sector-file-header">
          <span class="sector-code">${escapeHTML(info.number || 'ISO')}</span>
          <div>
            <strong>${escapeHTML(title)}</strong>
            ${info.sectionTitle ? `<span>${escapeHTML(info.sectionTitle)}</span>` : ''}
          </div>
          <em>${group.length} ${group.length === 1 ? 'arquivo' : 'arquivos'}</em>
        </div>
        ${fileListHTML(group, 'Nenhum arquivo neste setor.', { showSector: false })}
      </section>
    `;
  }).join('')}</div>`;
}

function fileActionsHTML(file, options = {}) {
  const pdfUrl = file.pdfUrl || file.arquivoUrl || '';
  const wordUrl = file.wordUrl || '';
  const pdfNome = file.pdfNome || file.arquivoNome || 'documento.pdf';
  const wordNome = file.wordNome || 'documento-word.docx';
  const titulo = file.titulo || pdfNome || 'Documento PDF';
  const actions = [];

  if (pdfUrl) {
    actions.push(`<button class="btn btn-small btn-blue" type="button" data-pdf-preview="${escapeHTML(pdfUrl)}" data-pdf-title="${escapeHTML(titulo)}">Ver PDF</button>`);
    actions.push(`<a class="btn btn-small btn-soft" href="${escapeHTML(pdfUrl)}" download="${escapeHTML(pdfNome)}" target="_blank" rel="noopener">Baixar PDF</a>`);
  }

  if (wordUrl) {
    actions.push(`<a class="btn btn-small btn-gold" href="${escapeHTML(wordUrl)}" download="${escapeHTML(wordNome)}" target="_blank" rel="noopener">Baixar Word</a>`);
  }

  if (options.adminManage && state.perfil?.tipo === 'admin' && file.id && !file.origemLegada) {
    actions.push(`<button class="btn btn-small btn-blue" type="button" data-edit-arquivo="${escapeHTML(file.id)}">Editar</button>`);
    actions.push(`<button class="btn btn-small btn-danger" type="button" data-delete-arquivo="${escapeHTML(file.id)}">Excluir</button>`);
  }

  if (!actions.length) return '<span class="muted">Arquivo indisponível</span>';
  return `<div class="file-actions">${actions.join('')}</div>`;
}

function pdfViewerUrl(pdfUrl) {
  if (!pdfUrl) return '';
  const hash = '#toolbar=1&navpanes=0&scrollbar=1&view=FitH';
  return pdfUrl.includes('#') ? pdfUrl : `${pdfUrl}${hash}`;
}

function showPdfViewerModal(pdfUrl, title = 'Documento PDF') {
  if (!pdfUrl) return;
  document.querySelector('.pdf-viewer-backdrop')?.remove();

  const viewerUrl = pdfViewerUrl(pdfUrl);
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop pdf-viewer-backdrop';
  backdrop.innerHTML = `
    <div class="modal pdf-viewer-modal" role="dialog" aria-modal="true" aria-label="Visualizar PDF">
      <div class="pdf-viewer-header">
        <div>
          <span class="kicker">Visualização interna</span>
          <h2>${escapeHTML(title)}</h2>
        </div>
        <div class="actions">
          <button class="btn btn-small btn-blue" type="button" data-pdf-share data-share-url="${escapeHTML(pdfUrl)}" data-share-title="${escapeHTML(title)}">Compartilhar</button>
          <a class="btn btn-small btn-soft" href="${escapeHTML(pdfUrl)}" download target="_blank" rel="noopener">Baixar PDF</a>
          <button class="btn btn-small btn-primary" type="button" data-pdf-close>Fechar</button>
        </div>
      </div>
      <div class="pdf-viewer-frame-wrap">
        <iframe class="pdf-viewer-frame" src="${escapeHTML(viewerUrl)}" title="${escapeHTML(title)}"></iframe>
      </div>
      <div class="pdf-viewer-help">
        Se o PDF não aparecer neste dispositivo, use o botão <strong>Baixar PDF</strong>. Alguns navegadores do iPhone podem limitar a visualização interna.
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  pushModalHistory('pdf');

  backdrop.addEventListener('click', async (event) => {
    const shareButton = event.target.closest('[data-pdf-share]');
    if (shareButton) {
      event.preventDefault();
      await sharePdfLink(shareButton.dataset.shareUrl || pdfUrl, shareButton.dataset.shareTitle || title);
      return;
    }

    if (event.target === backdrop || event.target.closest('[data-pdf-close]')) {
      backdrop.remove();
    }
  });
}

async function sharePdfLink(pdfUrl, title = 'Documento PDF') {
  if (!pdfUrl) return;

  const shareData = {
    title,
    text: `Documento do Excellence System®: ${title}`,
    url: pdfUrl
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareData.text}\n${pdfUrl}`)}`;
    window.open(whatsappUrl, '_blank', 'noopener');
  } catch (error) {
    if (error && error.name === 'AbortError') return;
    console.warn('Não foi possível compartilhar o PDF:', error);
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareData.text}\n${pdfUrl}`)}`;
    window.open(whatsappUrl, '_blank', 'noopener');
  }
}

document.addEventListener('click', (event) => {
  const previewButton = event.target.closest('[data-pdf-preview]');
  if (!previewButton) return;
  event.preventDefault();
  showPdfViewerModal(previewButton.dataset.pdfPreview, previewButton.dataset.pdfTitle || 'Documento PDF');
});

function fileListHTML(files, emptyMessage, options = {}) {
  if (!files.length) return `<p class="muted">${escapeHTML(emptyMessage || 'Nenhum arquivo cadastrado.')}</p>`;
  const showSector = options.showSector !== false;
  return `<div class="file-list">${files.map(file => `
    <div class="file-item">
      <div>
        <strong>${escapeHTML(file.titulo || file.pdfNome || file.arquivoNome || 'Arquivo')}</strong>
        ${showSector ? fileSectorHTML(file) : ''}
        ${file.descricao ? `<span>${escapeHTML(file.descricao)}</span>` : ''}
        <span>${escapeHTML(fileCategoryLabel(file))}${file.origemLegada ? ' • legado' : ''} • ${formatDate(file.criadoEm)}</span>
        ${file.wordNome ? `<span>PDF: ${escapeHTML(file.pdfNome || file.arquivoNome || '-')} • Word: ${escapeHTML(file.wordNome)}</span>` : ''}
      </div>
      ${fileActionsHTML(file, options)}
    </div>
  `).join('')}</div>`;
}

function materialListHTML(materiais, adminManage = false) {
  return fileListHTML(materiais, 'Nenhum material de apoio cadastrado nesta etapa.', { adminManage });
}

function isoCompletaFileHTML(files = []) {
  const completos = files.filter(isIsoCompletaFile);
  const file = completos.find(item => item.id === 'iso_completa_geral') || completos[0];

  if (!file) {
    return `
      <section class="card muted-card">
        <span class="kicker">ISO completa</span>
        <h2>Nenhum arquivo completo disponível</h2>
        <p>A administração ainda não liberou o arquivo completo da ISO para visualização.</p>
      </section>
    `;
  }

  return `
    <section class="card featured-document">
      <span class="kicker">Arquivo completo</span>
      <h2>${escapeHTML(file.titulo || 'ISO completa')}</h2>
      <p>${escapeHTML(file.descricao || 'Documento completo disponibilizado pela administração.')}</p>
      <div class="vault-meta">
        <span><strong>Tipo:</strong> ISO completa</span>
        <span><strong>Versões:</strong> ${file.wordNome ? 'PDF e Word' : 'PDF'}</span>
      </div>
      ${fileActionsHTML(file)}
    </section>
  `;
}


function arquivosConsultoriaListHTML(files, adminManage = false) {
  return fileListHTML(files, 'Nenhum arquivo enviado pela consultoria nesta etapa.', { adminManage });
}

async function uploadArquivoVersao(storagePath, file) {
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

function safeFileName(fileName) {
  return `${Date.now()}_${fileName}`.replaceAll('/', '-').replaceAll('\\', '-');
}

function baseStoragePathForArquivo({ categoria, empresaId, req, tipoMaterial = '' }) {
  if (categoria === 'material_apoio') {
    if (tipoMaterial === 'iso_completa') return 'materiais-apoio/iso-completa';
    if (tipoMaterial === 'avulso') return 'cofre-admin/materiais-avulsos';
    const reqPath = req?.id || 'geral';
    return `materiais-apoio/${reqPath}`;
  }

  if (categoria === 'consultoria') {
    return `empresas/${empresaId}/consultoria/${req.id}`;
  }

  return `empresas/${empresaId}/documentos-empresa/${req.id}`;
}

async function salvarArquivoISO({ categoria, empresaId = '', req = null, form, publico = false, tipoMaterial = '' }) {
  const pdfFile = form.get('arquivoPdf') || form.get('arquivo');
  const wordFile = form.get('arquivoWord');

  if (!pdfFile || !pdfFile.name) throw new Error('Selecione a versão em PDF.');
  const materialIsoCompleta = categoria === 'material_apoio' && tipoMaterial === 'iso_completa';
  if (categoria !== 'material_apoio' && !req) throw new Error('Selecione um requisito ISO válido.');
  if (categoria === 'material_apoio' && !materialIsoCompleta && tipoMaterial !== 'avulso' && !req) throw new Error('Selecione um requisito ISO válido.');

  const materialAvulso = categoria === 'material_apoio' && tipoMaterial === 'avulso';
  const basePath = baseStoragePathForArquivo({ categoria, empresaId, req, tipoMaterial });
  const pdfStoragePath = `${basePath}/pdf/${safeFileName(pdfFile.name)}`;
  const pdfUrl = await uploadArquivoVersao(pdfStoragePath, pdfFile);

  let wordUrl = '';
  let wordNome = '';
  let wordStoragePath = '';

  if (wordFile && wordFile.name) {
    wordStoragePath = `${basePath}/word/${safeFileName(wordFile.name)}`;
    wordUrl = await uploadArquivoVersao(wordStoragePath, wordFile);
    wordNome = wordFile.name;
  }

  const payload = {
    categoria,
    empresaId: materialAvulso || materialIsoCompleta ? '' : empresaId,
    publico: materialIsoCompleta ? true : (categoria === 'material_apoio' && !materialAvulso ? publico : false),
    tipoMaterial: categoria === 'material_apoio' ? (materialIsoCompleta ? 'iso_completa' : (materialAvulso ? 'avulso' : 'iso')) : '',
    secaoId: materialIsoCompleta ? 'iso_completa' : (materialAvulso ? 'avulso' : req.section.id),
    secaoTitulo: materialIsoCompleta ? 'ISO completa' : (materialAvulso ? 'Cofre de materiais' : req.section.title),
    requisitoId: materialIsoCompleta || materialAvulso ? '' : req.id,
    requisitoNumero: materialIsoCompleta ? 'ISO completa' : (materialAvulso ? 'Avulso' : req.number),
    requisitoTitulo: materialIsoCompleta ? 'Arquivo completo' : (materialAvulso ? 'Material avulso' : req.title),
    titulo: (form.get('titulo') || '').trim() || (materialIsoCompleta ? 'ISO completa' : pdfFile.name),
    descricao: (form.get('descricao') || '').trim(),
    pdfUrl,
    pdfNome: pdfFile.name,
    pdfStoragePath,
    wordUrl,
    wordNome,
    wordStoragePath,
    // Campos legados mantidos para compatibilidade com telas e dados antigos.
    arquivoUrl: pdfUrl,
    arquivoNome: pdfFile.name,
    storagePath: pdfStoragePath,
    atualizadoPor: state.user.uid,
    atualizadoEm: serverTimestamp()
  };

  if (materialIsoCompleta) {
    return setDoc(doc(db, 'arquivos', 'iso_completa_geral'), {
      ...payload,
      criadoPor: state.user.uid,
      criadoEm: serverTimestamp()
    }, { merge: true });
  }

  return addDoc(collection(db, 'arquivos'), {
    ...payload,
    criadoPor: state.user.uid,
    criadoEm: serverTimestamp()
  });
}


async function deleteStoragePathIfExists(path) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    console.warn('Arquivo físico não removido ou já inexistente:', path, error);
  }
}

async function refreshAdminFileContext() {
  const ctx = state.currentAdminView || {};
  if (ctx.type === 'adminRequirement' && ctx.empresaId && ctx.reqId) return renderAdminRequirement(ctx.empresaId, ctx.reqId);
  if (ctx.type === 'materiais') return renderMateriais(ctx.reqId || '', ctx.empresaId || '');
  if (ctx.type === 'empresaDetalhe' && ctx.empresaId) return renderEmpresaDetalhe(ctx.empresaId);
  if (ctx.type === 'empresaIso' && ctx.empresaId) return renderEmpresaIso(ctx.empresaId);
  if (ctx.type === 'empresaEcossistema' && ctx.empresaId) return renderEmpresaEcossistemaAdmin(ctx.empresaId);
  if (state.page === 'materiais') return renderMateriais();
  return navigate(state.page || 'dashboard');
}

async function deleteArquivo(arquivoId) {
  if (state.perfil?.tipo !== 'admin') return toast('Apenas administradores podem excluir arquivos.', 'error');
  const snap = await getDoc(doc(db, 'arquivos', arquivoId));
  if (!snap.exists()) return toast('Arquivo não encontrado.', 'error');
  const file = { id: snap.id, ...snap.data() };
  const label = file.titulo || file.pdfNome || file.wordNome || 'arquivo';
  const ok = confirm(`Excluir definitivamente o arquivo "${label}"?\n\nEssa ação remove o registro do sistema e tenta apagar os arquivos PDF/Word do Storage.`);
  if (!ok) return;

  await Promise.all([
    deleteStoragePathIfExists(file.pdfStoragePath || file.storagePath),
    deleteStoragePathIfExists(file.wordStoragePath)
  ]);
  await deleteDoc(doc(db, 'arquivos', arquivoId));
  toast('Arquivo excluído com sucesso.');
  await refreshAdminFileContext();
}

function reqOptionsHTML(selectedReqId = '') {
  return ISO_SECTIONS.map(section => `
    <optgroup label="${escapeHTML(section.title)}">
      ${section.requirements.map(req => `<option value="${req.id}" ${selectedReqId === req.id ? 'selected' : ''}>${req.number} - ${escapeHTML(req.title)}</option>`).join('')}
    </optgroup>
  `).join('');
}

async function showArquivoEditModal(arquivoId) {
  if (state.perfil?.tipo !== 'admin') return toast('Apenas administradores podem editar arquivos.', 'error');
  await loadEmpresas();
  const snap = await getDoc(doc(db, 'arquivos', arquivoId));
  if (!snap.exists()) return toast('Arquivo não encontrado.', 'error');
  const file = { id: snap.id, ...snap.data() };
  const isMaterial = file.categoria === 'material_apoio';
  const isCompleto = isIsoCompletaFile(file);
  const isAvulso = isMaterial && !isCompleto && (file.tipoMaterial === 'avulso' || !file.requisitoId);
  const existing = document.querySelector('.modal-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <form id="editArquivoForm">
        <div class="actions" style="justify-content:space-between; margin-bottom:14px;">
          <div>
            <strong>Editar arquivo</strong>
            <p class="muted" style="margin:4px 0 0;">Atualize nome, descrição, etapa ISO ou substitua as versões em PDF/Word.</p>
          </div>
          <button class="btn btn-soft btn-small" type="button" data-arquivo-modal-close>Fechar</button>
        </div>

        ${isMaterial ? `
          <div class="form-group">
            <label>Tipo de material</label>
            <select name="tipoMaterial" id="editArquivoTipoMaterial">
              <option value="iso_completa" ${isCompleto ? 'selected' : ''}>Arquivo ISO completo</option>
              <option value="iso" ${(!isAvulso && !isCompleto) ? 'selected' : ''}>Material vinculado a tópico ISO</option>
              <option value="avulso" ${isAvulso ? 'selected' : ''}>Material avulso</option>
            </select>
          </div>
        ` : ''}

        <div class="form-group ${isAvulso || isCompleto ? 'hidden' : ''}" id="editArquivoReqBox">
          <label>Requisito ISO</label>
          <select name="requisitoId">${reqOptionsHTML(file.requisitoId || '')}</select>
        </div>
        <div class="form-group"><label>Título</label><input name="titulo" value="${escapeHTML(file.titulo || '')}" required /></div>
        <div class="form-group"><label>Descrição/orientação</label><textarea name="descricao">${escapeHTML(file.descricao || '')}</textarea></div>

        ${isMaterial ? `
          <div id="editArquivoVisibilidadeBox" class="${isAvulso || isCompleto ? 'hidden' : ''}">
            <div class="form-group">
              <label>Visibilidade</label>
              <select name="visibilidade" id="editArquivoVisibilidade">
                <option value="publico" ${file.publico ? 'selected' : ''}>Padrão para todas as empresas</option>
                <option value="empresa" ${!file.publico && !isAvulso && !isCompleto ? 'selected' : ''}>Específico para uma empresa</option>
              </select>
            </div>
            <div class="form-group ${file.publico || isAvulso || isCompleto ? 'hidden' : ''}" id="editArquivoEmpresaBox">
              <label>Empresa específica</label>
              <select name="empresaId">
                <option value="">Selecione</option>
                ${state.empresas.map(e => `<option value="${e.id}" ${file.empresaId === e.id ? 'selected' : ''}>${escapeHTML(e.nome)}</option>`).join('')}
              </select>
            </div>
          </div>
        ` : '<input type="hidden" name="empresaId" value="' + escapeHTML(file.empresaId || '') + '" />'}

        <div class="notice">Deixe os campos de arquivo vazios para manter as versões atuais.</div>
        <div class="form-grid-2">
          <div class="form-group"><label>Substituir PDF</label><input name="arquivoPdf" type="file" accept="application/pdf,.pdf" /><small>Atual: ${escapeHTML(file.pdfNome || file.arquivoNome || '-')}</small></div>
          <div class="form-group"><label>Substituir Word</label><input name="arquivoWord" type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /><small>Atual: ${escapeHTML(file.wordNome || '-')}</small></div>
        </div>
        ${file.wordUrl ? `
          <label class="check-line">
            <input type="checkbox" name="removerWord" value="sim" />
            Remover versão Word atual
          </label>
        ` : ''}
        <div class="actions" style="margin-top:16px; justify-content:flex-end;">
          <button class="btn btn-soft" type="button" data-arquivo-modal-close>Cancelar</button>
          <button class="btn btn-primary" type="submit">Salvar alterações</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(backdrop);

  const tipoMaterialSelect = document.getElementById('editArquivoTipoMaterial');
  const reqBox = document.getElementById('editArquivoReqBox');
  const visibilitySelect = document.getElementById('editArquivoVisibilidade');
  const visibilityBox = document.getElementById('editArquivoVisibilidadeBox');
  const empresaBox = document.getElementById('editArquivoEmpresaBox');

  function syncEditArquivoMode() {
    const completo = tipoMaterialSelect?.value === 'iso_completa';
    const avulso = tipoMaterialSelect?.value === 'avulso';
    reqBox?.classList.toggle('hidden', Boolean(avulso || completo));
    visibilityBox?.classList.toggle('hidden', Boolean(avulso || completo));
    if (avulso || completo) {
      empresaBox?.classList.add('hidden');
    } else {
      empresaBox?.classList.toggle('hidden', visibilitySelect?.value !== 'empresa');
    }
  }

  tipoMaterialSelect?.addEventListener('change', syncEditArquivoMode);
  visibilitySelect?.addEventListener('change', syncEditArquivoMode);

  backdrop.addEventListener('click', event => {
    if (event.target === backdrop || event.target.closest('[data-arquivo-modal-close]')) backdrop.remove();
  });

  document.getElementById('editArquivoForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = event.submitter;
    setLoading(btn, true, 'Salvando...');
    try {
      const form = new FormData(event.currentTarget);
      const tipoMaterial = isMaterial ? (form.get('tipoMaterial') || 'iso') : '';
      const completo = isMaterial && tipoMaterial === 'iso_completa';
      const avulso = isMaterial && tipoMaterial === 'avulso';
      const req = (avulso || completo) ? null : requirementMap.get(form.get('requisitoId'));
      if (!avulso && !completo && !req) throw new Error('Selecione um requisito ISO válido.');

      const updateData = {
        titulo: (form.get('titulo') || '').trim(),
        descricao: (form.get('descricao') || '').trim(),
        atualizadoEm: serverTimestamp(),
        atualizadoPor: state.user.uid
      };

      if (completo) {
        updateData.tipoMaterial = 'iso_completa';
        updateData.publico = true;
        updateData.empresaId = '';
        updateData.secaoId = 'iso_completa';
        updateData.secaoTitulo = 'ISO completa';
        updateData.requisitoId = '';
        updateData.requisitoNumero = 'ISO completa';
        updateData.requisitoTitulo = 'Arquivo completo';
      } else if (avulso) {
        updateData.tipoMaterial = 'avulso';
        updateData.publico = false;
        updateData.empresaId = '';
        updateData.secaoId = 'avulso';
        updateData.secaoTitulo = 'Cofre de materiais';
        updateData.requisitoId = '';
        updateData.requisitoNumero = 'Avulso';
        updateData.requisitoTitulo = 'Material avulso';
      } else {
        updateData.secaoId = req.section.id;
        updateData.secaoTitulo = req.section.title;
        updateData.requisitoId = req.id;
        updateData.requisitoNumero = req.number;
        updateData.requisitoTitulo = req.title;
        if (isMaterial) {
          const publico = form.get('visibilidade') === 'publico';
          const empresaId = publico ? '' : form.get('empresaId');
          if (!publico && !empresaId) throw new Error('Selecione a empresa específica.');
          updateData.tipoMaterial = 'iso';
          updateData.publico = publico;
          updateData.empresaId = empresaId;
        }
      }

      const effectiveEmpresaId = isMaterial ? (updateData.empresaId || '') : (file.empresaId || '');
      const basePath = baseStoragePathForArquivo({ categoria: file.categoria, empresaId: effectiveEmpresaId, req, tipoMaterial });
      const pdfFile = form.get('arquivoPdf');
      const wordFile = form.get('arquivoWord');

      if (pdfFile && pdfFile.name) {
        const pdfStoragePath = `${basePath}/pdf/${safeFileName(pdfFile.name)}`;
        updateData.pdfUrl = await uploadArquivoVersao(pdfStoragePath, pdfFile);
        updateData.pdfNome = pdfFile.name;
        updateData.pdfStoragePath = pdfStoragePath;
        updateData.arquivoUrl = updateData.pdfUrl;
        updateData.arquivoNome = pdfFile.name;
        updateData.storagePath = pdfStoragePath;
        await deleteStoragePathIfExists(file.pdfStoragePath || file.storagePath);
      }

      if (wordFile && wordFile.name) {
        const wordStoragePath = `${basePath}/word/${safeFileName(wordFile.name)}`;
        updateData.wordUrl = await uploadArquivoVersao(wordStoragePath, wordFile);
        updateData.wordNome = wordFile.name;
        updateData.wordStoragePath = wordStoragePath;
        await deleteStoragePathIfExists(file.wordStoragePath);
      } else if (form.get('removerWord') === 'sim') {
        await deleteStoragePathIfExists(file.wordStoragePath);
        updateData.wordUrl = '';
        updateData.wordNome = '';
        updateData.wordStoragePath = '';
      }

      await updateDoc(doc(db, 'arquivos', arquivoId), updateData);
      backdrop.remove();
      toast('Arquivo atualizado com sucesso.');
      await refreshAdminFileContext();
    } catch (error) {
      toast(normalizeError(error), 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

document.addEventListener('click', async (event) => {
  const editBtn = event.target.closest('[data-edit-arquivo]');
  const deleteBtn = event.target.closest('[data-delete-arquivo]');
  if (editBtn) {
    event.preventDefault();
    await showArquivoEditModal(editBtn.dataset.editArquivo);
  }
  if (deleteBtn) {
    event.preventDefault();
    await deleteArquivo(deleteBtn.dataset.deleteArquivo);
  }
});

function requirementReferenceHTML(req) {
  return `
    <div class="requirement-reference">
      <div>
        <span class="kicker">Estrutura da planilha</span>
        <h3>Documentos e direcionamento desta etapa</h3>
      </div>
      <div class="reference-grid">
        <div><strong>Documentos 2015</strong><span>${escapeHTML(req.doc2015 || '-')}</span></div>
        <div><strong>Documentos 2026 - Draft</strong><span>${escapeHTML(req.doc2026 || '-')}</span></div>
      </div>
      ${req.guidance ? `<p>${escapeHTML(req.guidance)}</p>` : ''}
    </div>
  `;
}

function getResponseValue(r, key, fallback = '') {
  return escapeHTML(r?.[key] || fallback || '');
}

function displayText(value) {
  return escapeHTML(value || '-').replaceAll('\n', '<br>');
}

function renderAdminResponseHTML(req, r = {}, resposta = null) {
  if (req.manualType === 'swot') {
    return `
      <div><strong>Responsável:</strong><p>${displayText(r.responsavel)}</p></div>
      <div class="swot-read-grid">
        <div class="swot-box positive"><strong>Pontos fortes</strong><p>${displayText(r.pontosFortes || r.informacoes)}</p></div>
        <div class="swot-box negative"><strong>Fraquezas</strong><p>${displayText(r.fraquezas || r.processos)}</p></div>
        <div class="swot-box positive"><strong>Oportunidades</strong><p>${displayText(r.oportunidades || r.evidencias)}</p></div>
        <div class="swot-box negative"><strong>Ameaças</strong><p>${displayText(r.ameacas || r.observacoes)}</p></div>
      </div>
      <div><strong>Observações adicionais:</strong><p>${displayText(r.observacoesGerais)}</p></div>
      <div><strong>Última atualização:</strong><p>${formatDate(resposta?.atualizadoEm)}</p></div>
    `;
  }

  if (req.manualType === 'stakeholders') {
    const rows = [
      ['Organização', r.organizacao],
      ['Clientes', r.clientes],
      ['Sócios', r.socios],
      ['Colaboradores', r.colaboradores],
      ['Fornecedores', r.fornecedores],
      ['Sociedade', r.sociedade],
      ['Parceiros', r.parceiros]
    ];
    return `
      <div><strong>Responsável:</strong><p>${displayText(r.responsavel)}</p></div>
      <div class="table-wrap compact-table">
        <table>
          <thead><tr><th>Parte interessada</th><th>Necessidades e expectativas</th></tr></thead>
          <tbody>${rows.map(([label, value]) => `<tr><td><strong>${label}</strong></td><td>${displayText(value)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <div><strong>Observações adicionais:</strong><p>${displayText(r.observacoes)}</p></div>
      <div><strong>Última atualização:</strong><p>${formatDate(resposta?.atualizadoEm)}</p></div>
    `;
  }

  return `
    <div class="notice">Esta etapa não possui preenchimento manual da empresa. A administração disponibiliza os arquivos e materiais necessários para consulta do cliente.</div>
    <div><strong>Última atualização:</strong><p>${formatDate(resposta?.atualizadoEm)}</p></div>
  `;
}

function isEtapaConcluida(resposta) {
  return ['concluido', 'aprovado'].includes(resposta?.status || '');
}

function renderClienteManualFormHTML(req, r = {}, resposta = null) {
  if (req.manualType && isEtapaConcluida(resposta)) {
    return `
      <div class="card">
        <span class="kicker">Etapa concluída</span>
        <h2>Resposta finalizada pela administração</h2>
        <p>Esta etapa já foi marcada como concluída. O formulário fica oculto e a empresa visualiza somente os materiais e arquivos disponibilizados pela administração.</p>
      </div>
    `;
  }
  if (req.manualType === 'swot') {
    return `
      <form class="card" id="clienteRespostaForm">
        <span class="kicker">Preenchimento manual</span>
        <h2>Análise SWOT da empresa</h2>
        <p>Preencha os fatores internos e externos conforme a estrutura da planilha.</p>
        <div class="form-group"><label>Responsável pelo preenchimento</label><input name="responsavel" value="${getResponseValue(r, 'responsavel')}" /></div>
        <div class="swot-form-grid">
          <div class="form-group"><label>Pontos fortes</label><textarea name="pontosFortes" placeholder="Ex.: equipe especializada, qualidade reconhecida, agilidade na produção...">${getResponseValue(r, 'pontosFortes', r.informacoes)}</textarea></div>
          <div class="form-group"><label>Fraquezas</label><textarea name="fraquezas" placeholder="Ex.: oscilações de demanda, dependência de fornecedores, necessidade de capacitação...">${getResponseValue(r, 'fraquezas', r.processos)}</textarea></div>
          <div class="form-group"><label>Oportunidades</label><textarea name="oportunidades" placeholder="Ex.: novos segmentos, inovação tecnológica, fortalecimento de parcerias...">${getResponseValue(r, 'oportunidades', r.evidencias)}</textarea></div>
          <div class="form-group"><label>Ameaças</label><textarea name="ameacas" placeholder="Ex.: concorrência por preço, instabilidade econômica, aumento de matéria-prima...">${getResponseValue(r, 'ameacas', r.observacoes)}</textarea></div>
        </div>
        <div class="form-group"><label>Observações adicionais</label><textarea name="observacoesGerais">${getResponseValue(r, 'observacoesGerais')}</textarea></div>
        <button class="btn btn-primary" type="submit">Salvar SWOT</button>
      </form>
    `;
  }

  if (req.manualType === 'stakeholders') {
    const field = (name, label, placeholder = '') => `
      <div class="form-group stakeholder-row">
        <label>${label}</label>
        <textarea name="${name}" placeholder="${placeholder}">${getResponseValue(r, name)}</textarea>
      </div>
    `;
    return `
      <form class="card" id="clienteRespostaForm">
        <span class="kicker">Preenchimento manual</span>
        <h2>Mapeamento das partes interessadas</h2>
        <p>Informe as principais necessidades e expectativas de cada parte interessada.</p>
        <div class="form-group"><label>Responsável pelo preenchimento</label><input name="responsavel" value="${getResponseValue(r, 'responsavel')}" /></div>
        ${field('organizacao', 'Organização', 'Ex.: monitoramento por indicadores de desempenho, processos definidos, gestão da qualidade...')}
        ${field('clientes', 'Clientes', 'Ex.: conforto dos usuários, qualidade, prazo, atendimento...')}
        ${field('socios', 'Sócios', 'Ex.: valorização da empresa, lucro, crescimento sustentável...')}
        ${field('colaboradores', 'Colaboradores', 'Ex.: segurança, treinamento, ambiente adequado, clareza nas responsabilidades...')}
        ${field('fornecedores', 'Fornecedores', 'Ex.: parceria, previsibilidade de pedidos, pagamento e comunicação...')}
        ${field('sociedade', 'Sociedade', 'Ex.: responsabilidade social, conformidade legal, geração de emprego...')}
        ${field('parceiros', 'Parceiros', 'Ex.: relação comercial, confiança, padronização e continuidade...')}
        <div class="form-group"><label>Observações adicionais</label><textarea name="observacoes">${getResponseValue(r, 'observacoes')}</textarea></div>
        <button class="btn btn-primary" type="submit">Salvar partes interessadas</button>
      </form>
    `;
  }

  return '';
}

function collectManualResponses(req, form) {
  if (req.manualType === 'swot') {
    return {
      responsavel: form.get('responsavel').trim(),
      pontosFortes: form.get('pontosFortes').trim(),
      fraquezas: form.get('fraquezas').trim(),
      oportunidades: form.get('oportunidades').trim(),
      ameacas: form.get('ameacas').trim(),
      observacoesGerais: form.get('observacoesGerais').trim()
    };
  }

  if (req.manualType === 'stakeholders') {
    return {
      responsavel: form.get('responsavel').trim(),
      organizacao: form.get('organizacao').trim(),
      clientes: form.get('clientes').trim(),
      socios: form.get('socios').trim(),
      colaboradores: form.get('colaboradores').trim(),
      fornecedores: form.get('fornecedores').trim(),
      sociedade: form.get('sociedade').trim(),
      parceiros: form.get('parceiros').trim(),
      observacoes: form.get('observacoes').trim()
    };
  }

  return {};
}

async function renderAdminRequirement(empresaId, reqId) {
  state.page = 'empresas';
  state.currentAdminView = { type: 'adminRequirement', empresaId, reqId };
  state.currentClientView = null;
  pushAppHistory(`admin:empresa:${empresaId}:req:${reqId}`, { page: 'empresas', adminView: state.currentAdminView });
  await loadEmpresas();
  const req = requirementMap.get(reqId);
  const empresa = state.empresas.find(e => e.id === empresaId);
  const { resposta, materiais, arquivosConsultoria } = await loadRequirementData(empresaId, reqId, true);
  const r = resposta?.respostas || {};

  shell(`${req.number} - ${req.title}`, `Dentro da empresa: ${empresa?.nome || '-'}`, `
    <section class="actions" style="margin-bottom:18px;">
      <button class="btn btn-soft" id="voltarIsoAdmin">← Voltar para a empresa</button>
      ${statusBadge(resposta?.status || 'pendente')}
      ${req.manualType ? `<span class="badge blue">${escapeHTML(req.manualLabel)}</span>` : '<span class="badge">Sem preenchimento manual</span>'}
    </section>
    ${requirementReferenceHTML(req)}
    <section class="grid grid-2" style="margin-top:18px;">
      <div class="card stack">
        <div>
          <span class="kicker">Resposta da empresa</span>
          <h2>${req.manualType ? 'Informações preenchidas' : 'Acompanhamento da etapa'}</h2>
        </div>
        <div class="notice ${resposta ? 'success' : ''}">${resposta ? 'Esta etapa já possui movimentação da empresa ou análise administrativa.' : 'Ainda não existe movimentação nesta etapa para esta empresa.'}</div>
        ${renderAdminResponseHTML(req, r, resposta)}
      </div>
      <form class="card" id="adminReviewForm">
        <span class="kicker">Análise da administração</span>
        <h2>Status e comentários</h2>
        <div class="form-group">
          <label>Status</label>
          <select name="status">
            <option value="pendente" ${resposta?.status === 'pendente' ? 'selected' : ''}>Pendente</option>
            <option value="em_analise" ${resposta?.status === 'em_analise' ? 'selected' : ''}>Em análise</option>
            <option value="ajustar" ${resposta?.status === 'ajustar' ? 'selected' : ''}>Ajustar</option>
            <option value="concluido" ${['concluido', 'aprovado'].includes(resposta?.status || '') ? 'selected' : ''}>Concluído</option>
          </select>
        </div>
        <div class="form-group">
          <label>Comentário para a empresa</label>
          <textarea name="observacaoAdmin" placeholder="Ex.: Favor complementar as informações desta etapa.">${escapeHTML(resposta?.observacaoAdmin || '')}</textarea>
        </div>
        <button class="btn btn-primary" type="submit">Salvar análise</button>
      </form>
    </section>

    <section class="card" style="margin-top:18px;">
      <span class="kicker">Arquivos da empresa</span>
      <h2>Os arquivos ficam no Ecossistema documental</h2>
      <p>Para manter o sistema organizado, a análise ISO ficou separada dos documentos. Use o Ecossistema documental para criar pastas e adicionar PDF, Word ou links desta empresa.</p>
      <button class="btn btn-gold" type="button" id="abrirEcossistemaDaEtapa">Abrir ecossistema documental</button>
    </section>
  `);

  document.getElementById('voltarIsoAdmin').addEventListener('click', () => renderEmpresaIso(empresaId));
  document.getElementById('abrirEcossistemaDaEtapa')?.addEventListener('click', () => renderEmpresaEcossistemaAdmin(empresaId));

  document.getElementById('adminReviewForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = event.submitter;
    setLoading(btn, true);
    try {
      const form = new FormData(event.currentTarget);
      await setDoc(doc(db, 'respostas_iso', `${empresaId}_${reqId}`), {
        empresaId,
        secaoId: req.section.id,
        secaoTitulo: req.section.title,
        requisitoId: req.id,
        requisitoNumero: req.number,
        requisitoTitulo: req.title,
        status: form.get('status'),
        observacaoAdmin: form.get('observacaoAdmin').trim(),
        atualizadoEm: serverTimestamp(),
        analisadoPor: state.user.uid
      }, { merge: true });
      toast('Análise salva com sucesso.');
      renderAdminRequirement(empresaId, reqId);
    } catch (error) {
      toast(normalizeError(error), 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

function materialVaultCardHTML(file) {
  const info = getRequirementInfoFromFile(file);
  const isCompleto = isIsoCompletaFile(file);
  const isAvulso = !isCompleto && (file.tipoMaterial === 'avulso' || !file.requisitoId);
  const visibility = isCompleto
    ? 'Arquivo completo visível para as empresas'
    : (isAvulso ? 'Cofre interno da administração' : 'Tópico ISO visível para as empresas');
  const search = [
    file.titulo,
    file.descricao,
    info.number,
    info.title,
    info.sectionTitle,
    visibility,
    file.pdfNome,
    file.wordNome
  ].filter(Boolean).join(' ').toLowerCase();

  return `
    <article class="vault-card" data-material-card data-search="${escapeHTML(search)}">
      <div class="vault-card-top">
        <span class="vault-badge ${isCompleto ? 'completo' : (isAvulso ? 'avulso' : 'iso')}">${isCompleto ? 'ISO completa' : (isAvulso ? 'Avulso' : 'Tópico ISO')}</span>
        <small>${formatDate(file.criadoEm)}</small>
      </div>
      <h3>${escapeHTML(file.titulo || file.pdfNome || file.arquivoNome || 'Material de apoio')}</h3>
      <p>${escapeHTML(file.descricao || 'Sem descrição cadastrada.')}</p>
      <div class="vault-meta">
        <span><strong>Setor:</strong> ${escapeHTML(isCompleto ? 'ISO completa' : (isAvulso ? 'Material avulso' : fileSectorLabel(file)))}</span>
        <span><strong>Visibilidade:</strong> ${visibility}</span>
        ${file.wordNome ? `<span><strong>Versões:</strong> PDF e Word</span>` : '<span><strong>Versões:</strong> PDF</span>'}
      </div>
      ${fileActionsHTML(file, { adminManage: true })}
    </article>
  `;
}

async function renderMateriais(preselectedReqId = '', preselectedEmpresaId = '') {
  state.page = 'materiais';
  state.currentAdminView = { type: 'materiais', reqId: preselectedReqId, empresaId: preselectedEmpresaId };
  state.currentClientView = null;
  pushAppHistory(`admin:materiais:${preselectedReqId || 'todos'}:${preselectedEmpresaId || 'geral'}`, { page: 'materiais', adminView: state.currentAdminView });
  await loadEmpresas();
  const materiais = await safeQueryBy('arquivos', [['categoria', '==', 'material_apoio']]);
  const materiaisOrdenados = [...materiais].sort((a, b) => {
    const aCompleto = isIsoCompletaFile(a);
    const bCompleto = isIsoCompletaFile(b);
    if (aCompleto !== bCompleto) return aCompleto ? -1 : 1;
    const aAvulso = !aCompleto && (a.tipoMaterial === 'avulso' || !a.requisitoId);
    const bAvulso = !bCompleto && (b.tipoMaterial === 'avulso' || !b.requisitoId);
    if (aAvulso !== bAvulso) return aAvulso ? 1 : -1;
    const diff = requirementSortScore(a) - requirementSortScore(b);
    if (diff !== 0) return diff;
    return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
  });

  const reqOptions = ISO_SECTIONS.map(section => `
    <optgroup label="${escapeHTML(section.title)}">
      ${section.requirements.map(req => `<option value="${req.id}" ${preselectedReqId === req.id ? 'selected' : ''}>${req.number} - ${escapeHTML(req.title)}</option>`).join('')}
    </optgroup>
  `).join('');

  const formOpen = Boolean(preselectedReqId);

  shell('Materiais de apoio', 'Cofre exclusivo da administração para guardar modelos, exemplos, orientações ISO e materiais avulsos.', `
    <section class="card vault-toolbar">
      <div>
        <span class="kicker">Cofre da administração</span>
        <h2>Biblioteca de materiais</h2>
        <p>Salve materiais vinculados aos requisitos da ISO ou arquivos avulsos para consulta interna da administração.</p>
      </div>
      <div class="vault-tools">
        <input id="materialSearch" type="search" placeholder="Buscar por título, descrição, setor ISO ou arquivo..." aria-label="Buscar material de apoio" />
        <button class="btn btn-primary" type="button" id="toggleMaterialForm">+ Adicionar material</button>
      </div>
    </section>

    <form class="card ${formOpen ? '' : 'hidden'}" id="materialForm">
      <div class="actions" style="justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
        <div>
          <span class="kicker">Novo material</span>
          <h2>Adicionar ao cofre</h2>
          <p class="muted" style="margin:6px 0 0;">O PDF é usado para visualizar dentro do app. O Word é opcional para download.</p>
        </div>
        <button class="btn btn-soft btn-small" type="button" id="closeMaterialForm">Fechar</button>
      </div>

      <div class="form-grid-2">
        <div class="form-group">
          <label>Tipo de material</label>
          <select name="tipoMaterial" id="tipoMaterialSelect">
            <option value="iso_completa">Arquivo ISO completo</option>
            <option value="iso" ${preselectedReqId ? 'selected' : ''}>Material vinculado a tópico ISO</option>
            <option value="avulso" ${preselectedReqId ? '' : 'selected'}>Material avulso</option>
          </select>
        </div>
        <div class="form-group" id="requisitoMaterialBox">
          <label>Requisito ISO</label>
          <select name="requisitoId" id="materialRequisitoSelect">
            <option value="">Selecione</option>${reqOptions}
          </select>
        </div>
      </div>

      <div class="notice">
        <strong>Organização do cofre:</strong> o arquivo ISO completo e os tópicos ISO ficam disponíveis para as empresas. Materiais avulsos ficam somente no cofre interno da administração.
      </div>

      <div class="form-group"><label>Título do material</label><input name="titulo" required placeholder="Ex.: ISO completa, Modelo de Análise SWOT ou Procedimento 5.1" /></div>
      <div class="form-group"><label>Descrição/orientação</label><textarea name="descricao" placeholder="Explique quando e como este material deve ser usado."></textarea></div>
      <div class="form-grid-2">
        <div class="form-group"><label>Versão em PDF</label><input name="arquivoPdf" type="file" accept="application/pdf,.pdf" required /><small>Usada para “Ver PDF” e “Baixar PDF”.</small></div>
        <div class="form-group"><label>Versão em Word</label><input name="arquivoWord" type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /><small>Opcional. Aparece como “Baixar Word”.</small></div>
      </div>
      <button class="btn btn-primary" type="submit">Salvar material</button>
    </form>

    <section class="card">
      <div class="actions" style="justify-content:space-between; align-items:center; margin-bottom:14px;">
        <div>
          <h2>Materiais salvos</h2>
          <p class="muted" style="margin:4px 0 0;">${materiaisOrdenados.length} material(is) no cofre.</p>
        </div>
      </div>
      <div class="vault-grid" id="materialVaultList">
        ${materiaisOrdenados.map(materialVaultCardHTML).join('') || '<p class="muted">Nenhum material cadastrado ainda.</p>'}
      </div>
      <p class="muted hidden" id="materialSearchEmpty">Nenhum material encontrado com essa busca.</p>
    </section>
  `);

  const formEl = document.getElementById('materialForm');
  const toggleBtn = document.getElementById('toggleMaterialForm');
  const closeBtn = document.getElementById('closeMaterialForm');
  const tipoSelect = document.getElementById('tipoMaterialSelect');
  const requisitoBox = document.getElementById('requisitoMaterialBox');
  const requisitoSelect = document.getElementById('materialRequisitoSelect');

  function syncMaterialFormMode() {
    const completo = tipoSelect.value === 'iso_completa';
    const avulso = tipoSelect.value === 'avulso';
    requisitoBox.classList.toggle('hidden', avulso || completo);
    requisitoSelect.required = !avulso && !completo;
    if (avulso || completo) requisitoSelect.value = '';
  }

  toggleBtn?.addEventListener('click', () => {
    formEl.classList.remove('hidden');
    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  closeBtn?.addEventListener('click', () => formEl.classList.add('hidden'));

  if (preselectedReqId) tipoSelect.value = 'iso';
  syncMaterialFormMode();
  tipoSelect.addEventListener('change', syncMaterialFormMode);

  const searchInput = document.getElementById('materialSearch');
  const emptySearch = document.getElementById('materialSearchEmpty');
  searchInput?.addEventListener('input', () => {
    const term = searchInput.value.trim().toLowerCase();
    const cards = [...document.querySelectorAll('[data-material-card]')];
    let visible = 0;
    cards.forEach(card => {
      const match = !term || (card.dataset.search || '').includes(term);
      card.classList.toggle('hidden', !match);
      if (match) visible += 1;
    });
    emptySearch?.classList.toggle('hidden', visible > 0 || cards.length === 0);
  });

  document.getElementById('materialForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = event.submitter;
    setLoading(btn, true, 'Enviando...');
    try {
      const form = new FormData(event.currentTarget);
      const tipoMaterial = form.get('tipoMaterial') || 'iso';
      const completo = tipoMaterial === 'iso_completa';
      const avulso = tipoMaterial === 'avulso';
      const req = (avulso || completo) ? null : requirementMap.get(form.get('requisitoId'));
      if (!avulso && !completo && !req) throw new Error('Selecione o requisito ISO.');
      const publico = completo || !avulso;
      const empresaId = '';
      await salvarArquivoISO({ categoria: 'material_apoio', empresaId, req, form, publico, tipoMaterial });
      toast(completo ? 'Arquivo completo da ISO salvo com sucesso.' : 'Material salvo no cofre com sucesso.');
      renderMateriais(req?.id || '', '');
    } catch (error) {
      toast(normalizeError(error), 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

async function loadClienteInitialResponses(empresaId) {
  const [swotSnap, stakeholdersSnap] = await Promise.all([
    getDoc(doc(db, 'respostas_iso', `${empresaId}_4_1`)),
    getDoc(doc(db, 'respostas_iso', `${empresaId}_4_2`))
  ]);

  return {
    swot: swotSnap.exists() ? { id: swotSnap.id, ...swotSnap.data() } : null,
    stakeholders: stakeholdersSnap.exists() ? { id: stakeholdersSnap.id, ...stakeholdersSnap.data() } : null
  };
}

function hasManualAnswer(resposta) {
  const respostas = resposta?.respostas || {};
  return Object.values(respostas).some(value => String(value || '').trim());
}

function clienteInitialStatusHTML(status) {
  const swotDone = hasManualAnswer(status.swot);
  const stakeholdersDone = hasManualAnswer(status.stakeholders);
  const allDone = swotDone && stakeholdersDone;

  if (allDone) {
    return `
      <section class="client-status-card success">
        <div>
          <span class="kicker">Diagnóstico inicial</span>
          <h2>Respostas 4.1 e 4.2 enviadas</h2>
          <p>A administração irá analisar as informações e liberar os materiais correspondentes para a empresa.</p>
        </div>
        <span class="badge success">Enviado</span>
      </section>
    `;
  }

  return `
    <section class="client-status-card alert">
      <div>
        <span class="kicker">Ação necessária</span>
        <h2>Complete o diagnóstico inicial da empresa</h2>
        <p>Antes de avançar, responda as etapas <strong>4.1</strong> e <strong>4.2</strong>. Você preencherá tudo em uma única tela.</p>
        <div class="client-mini-status">
          <span class="${swotDone ? 'done' : ''}">4.1 ${swotDone ? 'respondido' : 'pendente'}</span>
          <span class="${stakeholdersDone ? 'done' : ''}">4.2 ${stakeholdersDone ? 'respondido' : 'pendente'}</span>
        </div>
      </div>
      <button class="btn btn-primary" type="button" id="abrirDiagnosticoInicial">Abrir diagnóstico</button>
    </section>
  `;
}

function clienteHomeOptionsHTML() {
  return `
    <section class="client-home-options">
      <button class="client-option-card" type="button" id="abrirIsoCompleta">
        <span class="option-icon">☑</span>
        <strong>Ver ISO completa</strong>
        <small>Abra o arquivo único completo que a administração disponibilizou.</small>
      </button>
      <button class="client-option-card" type="button" id="abrirIsoTopicos">
        <span class="option-icon">▦</span>
        <strong>ISO por tópicos</strong>
        <small>Acesse os documentos desmembrados por requisito: 4.1, 4.2, 5.1 e demais etapas.</small>
      </button>
      <button class="client-option-card" type="button" id="abrirEcossistemaCliente">
        <span class="option-icon">▣</span>
        <strong>Ecossistema da empresa</strong>
        <small>Consulte as pastas, documentos e links liberados para sua empresa.</small>
      </button>
    </section>
  `;
}

function stakeholderExamplesHTML() {
  const examples = [
    ['Organização', 'Monitoramento de indicadores, processos definidos, gestão da qualidade e melhoria contínua.'],
    ['Clientes', 'Qualidade do produto, cumprimento de prazo, bom atendimento e solução rápida de problemas.'],
    ['Sócios', 'Crescimento sustentável, lucratividade, valorização da empresa e controle dos resultados.'],
    ['Colaboradores', 'Segurança, capacitação, ambiente adequado, comunicação clara e reconhecimento.'],
    ['Fornecedores', 'Previsibilidade de compras, parceria, pagamento em dia e informações claras.'],
    ['Sociedade', 'Responsabilidade social, geração de empregos, conformidade legal e respeito ao meio ambiente.'],
    ['Parceiros', 'Confiança, continuidade, padronização, comunicação e cumprimento de acordos.']
  ];

  return `
    <div class="example-box">
      <strong>Exemplo de preenchimento</strong>
      <p>Use os exemplos abaixo como referência. Adapte para a realidade da sua empresa.</p>
      <div class="example-table">
        ${examples.map(([label, text]) => `<div><span>${label}</span><p>${text}</p></div>`).join('')}
      </div>
    </div>
  `;
}

function diagnosticoInicialFormHTML(swot = {}, stakeholders = {}) {
  const fieldStake = (name, label, placeholder = '') => `
    <div class="form-group stakeholder-row">
      <label>${label}</label>
      <textarea name="stake_${name}" placeholder="${placeholder}">${getResponseValue(stakeholders, name)}</textarea>
    </div>
  `;

  return `
    <form class="client-diagnostic-form" id="clienteDiagnosticoForm">
      <section class="card">
        <span class="kicker">Etapa 4.1</span>
        <h2>Contexto da organização - SWOT</h2>
        <p>Informe os pontos fortes, fraquezas, oportunidades e ameaças da empresa.</p>
        <div class="form-group"><label>Responsável pelo preenchimento</label><input name="swot_responsavel" value="${getResponseValue(swot, 'responsavel')}" /></div>
        <div class="swot-form-grid">
          <div class="form-group"><label>Pontos fortes</label><textarea name="swot_pontosFortes" placeholder="Ex.: equipe especializada, qualidade reconhecida, agilidade na produção...">${getResponseValue(swot, 'pontosFortes', swot.informacoes)}</textarea></div>
          <div class="form-group"><label>Fraquezas</label><textarea name="swot_fraquezas" placeholder="Ex.: necessidade de capacitação, dependência de fornecedores, falhas de comunicação...">${getResponseValue(swot, 'fraquezas', swot.processos)}</textarea></div>
          <div class="form-group"><label>Oportunidades</label><textarea name="swot_oportunidades" placeholder="Ex.: novos mercados, inovação tecnológica, novas parcerias...">${getResponseValue(swot, 'oportunidades', swot.evidencias)}</textarea></div>
          <div class="form-group"><label>Ameaças</label><textarea name="swot_ameacas" placeholder="Ex.: concorrência, aumento de matéria-prima, instabilidade econômica...">${getResponseValue(swot, 'ameacas', swot.observacoes)}</textarea></div>
        </div>
        <div class="form-group"><label>Observações adicionais</label><textarea name="swot_observacoesGerais">${getResponseValue(swot, 'observacoesGerais')}</textarea></div>
      </section>

      <section class="card">
        <span class="kicker">Etapa 4.2</span>
        <h2>Partes interessadas, necessidades e expectativas</h2>
        <p>Preencha o que cada parte interessada espera da empresa e do sistema de gestão.</p>
        ${stakeholderExamplesHTML()}
        <div class="form-group"><label>Responsável pelo preenchimento</label><input name="stake_responsavel" value="${getResponseValue(stakeholders, 'responsavel')}" /></div>
        ${fieldStake('organizacao', 'Organização', 'Ex.: monitoramento por indicadores, processos definidos, gestão da qualidade...')}
        ${fieldStake('clientes', 'Clientes', 'Ex.: qualidade, prazo, atendimento, conforto e solução de problemas...')}
        ${fieldStake('socios', 'Sócios', 'Ex.: lucro, crescimento sustentável, controle e valorização da empresa...')}
        ${fieldStake('colaboradores', 'Colaboradores', 'Ex.: segurança, treinamento, ambiente adequado e clareza nas responsabilidades...')}
        ${fieldStake('fornecedores', 'Fornecedores', 'Ex.: parceria, previsibilidade de pedidos, pagamento e comunicação...')}
        ${fieldStake('sociedade', 'Sociedade', 'Ex.: responsabilidade social, conformidade legal e geração de emprego...')}
        ${fieldStake('parceiros', 'Parceiros', 'Ex.: confiança, padronização, continuidade e cumprimento de acordos...')}
        <div class="form-group"><label>Observações adicionais</label><textarea name="stake_observacoes">${getResponseValue(stakeholders, 'observacoes')}</textarea></div>
      </section>

      <section class="actions diagnostic-actions">
        <button class="btn btn-soft" type="button" id="cancelarDiagnosticoInicial">← Voltar</button>
        <button class="btn btn-primary" type="submit">Enviar respostas 4.1 e 4.2</button>
      </section>
    </form>
  `;
}

async function renderClienteHome() {
  state.page = 'cliente-home';
  state.currentAdminView = null;
  state.currentClientView = { type: 'home' };
  pushAppHistory('cliente:home', { page: 'cliente-home', clientView: state.currentClientView });
  await loadEmpresas();
  const empresa = state.empresas.find(e => e.id === state.perfil.empresaId);
  if (!state.perfil?.empresaId || !empresa) {
    return shell('Acesso sem empresa vinculada', 'Procure a administração para revisar seu cadastro.', `
      <section class="card">
        <span class="kicker">Cadastro incompleto</span>
        <h2>Este usuário ainda não possui empresa vinculada</h2>
        <p>Para acessar os requisitos ISO, o usuário precisa estar vinculado a uma empresa ativa no cadastro.</p>
      </section>
    `);
  }

  const initialStatus = await loadClienteInitialResponses(state.perfil.empresaId);

  shell('Painel da empresa', `Dentro da empresa: ${empresa?.nome || '-'}`, `
    ${clienteInitialStatusHTML(initialStatus)}
    ${clienteHomeOptionsHTML()}
    <section class="card muted-card">
      <span class="kicker">Como funciona</span>
      <h2>Consulta e acompanhamento</h2>
      <p>A empresa responde apenas o diagnóstico inicial das etapas <strong>4.1</strong> e <strong>4.2</strong>. Nas demais etapas, o cliente visualiza os materiais e documentos disponibilizados pela administração.</p>
    </section>
  `);

  document.getElementById('abrirDiagnosticoInicial')?.addEventListener('click', renderClienteDiagnosticoInicial);
  document.getElementById('abrirIsoCompleta')?.addEventListener('click', renderClienteIsoCompleta);
  document.getElementById('abrirIsoTopicos')?.addEventListener('click', renderClienteIsoTopicos);
  document.getElementById('abrirEcossistemaCliente')?.addEventListener('click', renderClienteEcossistema);
}

async function renderClienteIsoCompleta() {
  state.page = 'cliente-home';
  state.currentAdminView = null;
  state.currentClientView = { type: 'isoCompleta' };
  pushAppHistory('cliente:iso-completa', { page: 'cliente-home', clientView: state.currentClientView });
  await loadEmpresas();
  const empresa = state.empresas.find(e => e.id === state.perfil.empresaId);
  const materiaisPublicos = await safeQueryBy('arquivos', [['categoria', '==', 'material_apoio'], ['publico', '==', true]]);
  const arquivosEmpresa = await safeQueryBy('arquivos', [['empresaId', '==', state.perfil.empresaId]]);
  const arquivos = uniqueFiles([
    ...materiaisPublicos.filter(isIsoCompletaFile),
    ...arquivosEmpresa.filter(isIsoCompletaFile)
  ]);

  shell('ISO completa', `Dentro da empresa: ${empresa?.nome || '-'}`, `
    <section class="actions" style="margin-bottom:18px;">
      <button class="btn btn-soft" id="voltarClienteHome">← Voltar</button>
    </section>
    <section class="card">
      <span class="kicker">Documento único</span>
      <h2>Arquivo completo da ISO</h2>
      <p>Esta tela mostra somente o arquivo completo enviado pela administração. Para acessar os documentos separados por etapa, use <strong>ISO por tópicos</strong>.</p>
    </section>
    <section class="grid" style="margin-top:18px;">
      ${isoCompletaFileHTML(arquivos)}
    </section>
  `);

  document.getElementById('voltarClienteHome')?.addEventListener('click', renderClienteHome);
}

async function renderClienteIsoTopicos() {
  state.page = 'cliente-home';
  state.currentAdminView = null;
  state.currentClientView = { type: 'isoTopicos' };
  pushAppHistory('cliente:iso-topicos', { page: 'cliente-home', clientView: state.currentClientView });
  await loadEmpresas();
  const empresa = state.empresas.find(e => e.id === state.perfil.empresaId);

  shell('ISO por tópicos', `Dentro da empresa: ${empresa?.nome || '-'}`, `
    <section class="actions" style="margin-bottom:18px;">
      <button class="btn btn-soft" id="voltarClienteHome">← Voltar</button>
    </section>
    <section class="card">
      <span class="kicker">Navegação por seção</span>
      <h2>Escolha um tópico da ISO</h2>
      <p>Use esta visão para acessar os arquivos desmembrados por requisito ISO. Cada tópico mostra somente os materiais e documentos enviados pela administração para aquela etapa.</p>
    </section>
    <section class="grid" style="margin-top:18px;">
      ${isoAccordionHTML('cliente-topicos', false)}
    </section>
  `);

  document.getElementById('voltarClienteHome')?.addEventListener('click', renderClienteHome);
  bindIsoAccordion(renderClienteRequirement, 'cliente-topicos');
}

async function renderClienteDiagnosticoInicial() {
  state.page = 'cliente-home';
  state.currentAdminView = null;
  state.currentClientView = { type: 'diagnosticoInicial' };
  pushAppHistory('cliente:diagnostico-inicial', { page: 'cliente-home', clientView: state.currentClientView });

  const empresaId = state.perfil.empresaId;
  const { swot, stakeholders } = await loadClienteInitialResponses(empresaId);

  shell('Diagnóstico inicial', 'Responda as etapas 4.1 e 4.2 em uma única tela.', `
    <section class="notice" style="margin-bottom:18px;">
      Preencha as informações com calma. Depois de enviar, as respostas ficam em análise para a administração concluir ou solicitar ajustes.
    </section>
    ${diagnosticoInicialFormHTML(swot?.respostas || {}, stakeholders?.respostas || {})}
  `);

  document.getElementById('cancelarDiagnosticoInicial')?.addEventListener('click', renderClienteHome);

  document.getElementById('clienteDiagnosticoForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = event.submitter;
    setLoading(btn, true);
    try {
      const form = new FormData(event.currentTarget);
      const req41 = requirementMap.get('4_1');
      const req42 = requirementMap.get('4_2');

      const swotData = {
        responsavel: form.get('swot_responsavel').trim(),
        pontosFortes: form.get('swot_pontosFortes').trim(),
        fraquezas: form.get('swot_fraquezas').trim(),
        oportunidades: form.get('swot_oportunidades').trim(),
        ameacas: form.get('swot_ameacas').trim(),
        observacoesGerais: form.get('swot_observacoesGerais').trim()
      };

      const stakeholdersData = {
        responsavel: form.get('stake_responsavel').trim(),
        organizacao: form.get('stake_organizacao').trim(),
        clientes: form.get('stake_clientes').trim(),
        socios: form.get('stake_socios').trim(),
        colaboradores: form.get('stake_colaboradores').trim(),
        fornecedores: form.get('stake_fornecedores').trim(),
        sociedade: form.get('stake_sociedade').trim(),
        parceiros: form.get('stake_parceiros').trim(),
        observacoes: form.get('stake_observacoes').trim()
      };

      if (!Object.values(swotData).some(value => value) || !Object.values(stakeholdersData).some(value => value)) {
        throw new Error('Preencha ao menos uma informação em 4.1 e uma informação em 4.2 antes de enviar.');
      }

      await Promise.all([
        setDoc(doc(db, 'respostas_iso', `${empresaId}_4_1`), {
          empresaId,
          secaoId: req41.section.id,
          secaoTitulo: req41.section.title,
          requisitoId: req41.id,
          requisitoNumero: req41.number,
          requisitoTitulo: req41.title,
          tipoPreenchimento: req41.manualType || '',
          respostas: swotData,
          status: 'em_analise',
          atualizadoEm: serverTimestamp(),
          atualizadoPor: state.user.uid
        }, { merge: true }),
        setDoc(doc(db, 'respostas_iso', `${empresaId}_4_2`), {
          empresaId,
          secaoId: req42.section.id,
          secaoTitulo: req42.section.title,
          requisitoId: req42.id,
          requisitoNumero: req42.number,
          requisitoTitulo: req42.title,
          tipoPreenchimento: req42.manualType || '',
          respostas: stakeholdersData,
          status: 'em_analise',
          atualizadoEm: serverTimestamp(),
          atualizadoPor: state.user.uid
        }, { merge: true })
      ]);

      toast('Diagnóstico inicial enviado com sucesso. Aguarde a análise da administração.');
      renderClienteHome();
    } catch (error) {
      toast(normalizeError(error), 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

async function renderClienteRequirement(reqId) {
  state.page = 'cliente-home';
  state.currentAdminView = null;
  state.currentClientView = { type: 'requirement', reqId };
  pushAppHistory(`cliente:requirement:${reqId}`, { page: 'cliente-home', clientView: state.currentClientView });
  const req = requirementMap.get(reqId);
  const empresaId = state.perfil.empresaId;
  const { resposta, materiais, arquivosConsultoria } = await loadRequirementData(empresaId, reqId, false);
  const r = resposta?.respostas || {};
  const manualArea = renderClienteManualFormHTML(req, r, resposta);

  shell(`${req.number} - ${req.title}`, req.section.title, `
    <section class="actions" style="margin-bottom:18px;">
      <button class="btn btn-soft" id="voltarClienteHome">← Voltar</button>
      ${statusBadge(resposta?.status || 'pendente')}
      ${req.manualType && !isEtapaConcluida(resposta) ? `<span class="badge blue">${escapeHTML(req.manualLabel)}</span>` : ''}
    </section>
    ${resposta?.observacaoAdmin ? `<section class="notice ${isEtapaConcluida(resposta) ? 'success' : ''}" style="margin-bottom:18px;"><strong>Comentário da administração:</strong><br>${escapeHTML(resposta.observacaoAdmin).replaceAll('\n','<br>')}</section>` : ''}
    ${requirementReferenceHTML(req)}

    ${manualArea ? `<section class="grid" style="margin-top:18px;">${manualArea}</section>` : ''}

    <section class="grid" style="margin-top:18px;">
      <div class="card">
        <span class="kicker">Material disponibilizado</span>
        <h2>Material do tópico ISO</h2>
        <p>Modelos, orientações e materiais gerais liberados pela administração para esta etapa. Os documentos específicos da empresa ficam no Ecossistema da empresa.</p>
        ${materialListHTML(materiais)}
      </div>
    </section>
  `);

  document.getElementById('voltarClienteHome').addEventListener('click', renderClienteHome);

  const respostaForm = document.getElementById('clienteRespostaForm');
  if (respostaForm) {
    respostaForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const btn = event.submitter;
      setLoading(btn, true);
      try {
        if (isEtapaConcluida(resposta)) throw new Error('Esta etapa já foi concluída pela administração.');
        const form = new FormData(event.currentTarget);
        await setDoc(doc(db, 'respostas_iso', `${empresaId}_${req.id}`), {
          empresaId,
          secaoId: req.section.id,
          secaoTitulo: req.section.title,
          requisitoId: req.id,
          requisitoNumero: req.number,
          requisitoTitulo: req.title,
          tipoPreenchimento: req.manualType || '',
          respostas: collectManualResponses(req, form),
          status: 'em_analise',
          atualizadoEm: serverTimestamp(),
          atualizadoPor: state.user.uid
        }, { merge: true });
        toast('Informações salvas com sucesso. Aguarde a análise da administração.');
        renderClienteRequirement(req.id);
      } catch (error) {
        toast(normalizeError(error), 'error');
      } finally {
        setLoading(btn, false);
      }
    });
  }
}

async function renderClienteArquivos() {
  state.page = 'cliente-arquivos';
  state.currentAdminView = null;
  state.currentClientView = { type: 'arquivos' };
  pushAppHistory('cliente:arquivos', { page: 'cliente-arquivos', clientView: state.currentClientView });
  const empresaId = state.perfil.empresaId;
  const arquivosDaEmpresa = await safeQueryBy('arquivos', [['empresaId', '==', empresaId]]);
  const consultoria = arquivosDaEmpresa.filter(a => a.categoria === 'consultoria');

  shell('Arquivos recebidos', 'Arquivos disponibilizados pela administração para a sua empresa.', `
    <section class="card">
      <span class="kicker">Administração</span>
      <h2>Arquivos enviados para sua empresa</h2>
      <p>A empresa não envia arquivos por esta área. Os arquivos ficam sob responsabilidade da administração do sistema e aparecem organizados pelo setor ISO correspondente.</p>
      ${arquivosRecebidosPorSetorHTML(consultoria)}
    </section>
  `);
}

function renderBlocked(user) {
  appEl.innerHTML = `
    <main class="login-page">
      <section class="login-card" style="grid-template-columns:1fr; max-width:720px;">
        <div class="login-form">
          <h2>Acesso ainda não liberado</h2>
          <p>O usuário <strong>${escapeHTML(user.email)}</strong> ainda não possui liberação ativa no sistema.</p>
          <div class="notice">Quando o admin cria o acesso pela tela de Empresas ou Usuários, o perfil é vinculado automaticamente. Se este usuário ainda aparece bloqueado, crie o acesso pelo painel admin usando este mesmo e-mail.</div>
          <button class="btn btn-primary" id="blockedLogout" style="margin-top:18px;">Sair</button>
        </div>
      </section>
    </main>
  `;
  document.getElementById('blockedLogout').addEventListener('click', () => signOut(auth));
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      state.user = null;
      state.perfil = null;
      state.appHistoryInitialized = false;
      state.historyKey = '';
      state.currentAdminView = null;
      state.currentClientView = null;
      return renderLogin();
    }
    state.user = user;
    state.perfil = await loadPerfil(user);
    if (!state.perfil || state.perfil.ativo !== true) return renderBlocked(user);
    if (state.perfil.tipo === 'admin') {
      state.page = 'dashboard';
      return renderAdminDashboard();
    }
    state.page = 'cliente-home';
    return renderClienteHome();
  } catch (error) {
    appEl.innerHTML = `<main class="login-page"><div class="login-form" style="border-radius:24px;"><h2>Erro ao carregar</h2><div class="notice error">${escapeHTML(normalizeError(error))}</div><button class="btn btn-primary" id="logoutAfterError">Sair</button></div></main>`;
    document.getElementById('logoutAfterError')?.addEventListener('click', () => signOut(auth));
  }
});
