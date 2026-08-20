import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const V = '20260820-79';
let perfil = null;
let modulePromise = null;
let observerStarted = false;
let timer = null;

const text = el => String(el?.textContent || '').replace(/\s+/g, ' ').trim();
const lower = el => text(el).toLowerCase();

function podeTreinamentos() {
  if (!perfil) return false;
  if (perfil.tipo === 'admin') return true;
  if (perfil.tipo !== 'cliente') return true;
  if (!Array.isArray(perfil.permissoes)) return true;
  return perfil.permissoes.includes('treinamentos');
}

async function carregarPerfil(user) {
  perfil = null;
  if (!user) return;
  const snap = await getDoc(doc(db, 'usuarios', user.uid));
  perfil = snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

function sidebarNav() {
  return document.querySelector('#sidebar nav, #sidebar .nav-group, .sidebar nav, .sidebar .nav-group, #sidebar');
}

function navButtons() {
  return Array.from(document.querySelectorAll('#sidebar .nav-btn, .sidebar .nav-btn'));
}

function trainingButtons() {
  return navButtons().filter(btn => lower(btn).includes('treinamento'));
}

function toast(message) {
  document.querySelector('[data-training-entry-toast]')?.remove();
  const box = document.createElement('div');
  box.dataset.trainingEntryToast = 'true';
  box.textContent = message;
  box.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:99999;background:#073F5A;color:#fff;border-radius:14px;padding:12px 14px;font-weight:900;box-shadow:0 18px 42px rgba(5,36,55,.25);max-width:360px;';
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3500);
}

function markActive(btn) {
  navButtons().forEach(item => item.classList.remove('active'));
  btn?.classList.add('active');
  document.getElementById('sidebar')?.classList.remove('open');
}

function mainLooksLikeTraining() {
  const main = document.querySelector('.main');
  const t = lower(main);
  return t.includes('treinamento') || t.includes('matriz de competências') || t.includes('plano anual') || t.includes('pid') && t.includes('desenvolvimento');
}

function extractPackedSource(wrapperText) {
  const block = wrapperText.match(/const\s+parts\s*=\s*\[([\s\S]*?)\];/);
  if (!block) throw new Error('Pacote de Treinamentos não encontrado.');
  const parts = [];
  const re = /'([^']+)'/g;
  let match;
  while ((match = re.exec(block[1]))) parts.push(match[1]);
  if (!parts.length) throw new Error('Pacote de Treinamentos vazio.');
  return parts.join('');
}

async function gunzipBase64(b64) {
  if (!('DecompressionStream' in window)) throw new Error('Navegador sem suporte ao carregador do módulo.');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

function declarationNames(source) {
  const names = new Set();
  for (const m of source.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) names.add(m[1]);
  for (const m of source.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g)) names.add(m[1]);
  return [...names];
}

function enrichSource(source) {
  const firebaseUrl = new URL('./firebase-config.js', location.href).href;
  source = source.replace("from './firebase-config.js'", `from '${firebaseUrl}'`);
  const names = declarationNames(source);
  const expose = names.map(name => `try{if(typeof ${name}==='function')window.__EXCELLENCE_TRAINING_FUNCTIONS['${name}']=${name}}catch(_){}`).join(';');
  return `${source}\n;window.__EXCELLENCE_TRAINING_FUNCTIONS=window.__EXCELLENCE_TRAINING_FUNCTIONS||{};${expose};window.dispatchEvent(new CustomEvent('excellence-training-module-ready'));`;
}

async function loadTrainingModule() {
  if (window.__EXCELLENCE_TRAINING_MODULE_LOADED) return;
  if (modulePromise) return modulePromise;
  modulePromise = (async () => {
    const response = await fetch(`./treinamentos-patch.js?v=${V}&raw=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível carregar o módulo de Treinamentos.');
    const wrapper = await response.text();
    const source = await gunzipBase64(extractPackedSource(wrapper));
    const instrumented = enrichSource(source);
    const url = URL.createObjectURL(new Blob([instrumented], { type: 'text/javascript' }));
    try {
      await import(url);
      window.__EXCELLENCE_TRAINING_MODULE_LOADED = true;
    } finally {
      URL.revokeObjectURL(url);
    }
  })().catch(error => {
    modulePromise = null;
    console.error('Treinamentos v79:', error);
    throw error;
  });
  return modulePromise;
}

function candidateFunctions() {
  const api = window.__EXCELLENCE_TRAINING_FUNCTIONS || {};
  const entries = Object.entries(api).filter(([, fn]) => typeof fn === 'function');
  const score = name => {
    const n = name.toLowerCase();
    let s = 0;
    if (n === 'rendertreinamentos' || n === 'rendertrainings') s += 1000;
    if (n.includes('render') && n.includes('trein')) s += 600;
    if (n.includes('trein') && (n.includes('home') || n.includes('dashboard') || n.includes('visao') || n.includes('painel'))) s += 500;
    if (n.includes('abrir') && n.includes('trein')) s += 450;
    if (n.includes('open') && n.includes('train')) s += 450;
    if (n.includes('trein')) s += 250;
    if (n.includes('render') && (n.includes('home') || n.includes('dashboard'))) s += 100;
    return s;
  };
  return entries.sort((a, b) => score(b[0]) - score(a[0]));
}

async function tryOpenThroughFunctions() {
  const candidates = candidateFunctions();
  for (const [name, fn] of candidates) {
    if (!/trein|train|render/i.test(name)) continue;
    if (fn.length > 1) continue;
    try {
      const result = fn.length === 1 ? fn('visao') : fn();
      if (result && typeof result.then === 'function') await result;
      await new Promise(resolve => setTimeout(resolve, 80));
      if (mainLooksLikeTraining()) return true;
    } catch (error) {
      console.debug(`Treinamentos: candidato ${name} não abriu a tela.`, error);
    }
  }
  return false;
}

async function openTraining(entryBtn) {
  if (!podeTreinamentos()) {
    toast('Seu usuário não tem permissão para acessar Treinamentos.');
    return;
  }

  markActive(entryBtn);

  // Se o módulo já criou uma entrada própria, reutiliza o clique original dele.
  const internal = trainingButtons().find(btn => btn !== entryBtn && !btn.dataset.trainingEntryV79);
  if (internal) {
    internal.click();
    await new Promise(resolve => setTimeout(resolve, 120));
    if (mainLooksLikeTraining()) return;
  }

  try {
    await loadTrainingModule();
    await new Promise(resolve => setTimeout(resolve, 120));

    const moduleButton = trainingButtons().find(btn => btn !== entryBtn && !btn.dataset.trainingEntryV79);
    if (moduleButton) {
      moduleButton.click();
      await new Promise(resolve => setTimeout(resolve, 120));
      if (mainLooksLikeTraining()) return;
    }

    if (await tryOpenThroughFunctions()) return;

    window.dispatchEvent(new CustomEvent('excellence-open-trainings'));
    document.dispatchEvent(new CustomEvent('excellence-open-trainings'));
    await new Promise(resolve => setTimeout(resolve, 120));
    if (mainLooksLikeTraining()) return;

    toast('A área de Treinamentos foi carregada, mas a tela não abriu. Atualize a página uma vez e tente novamente.');
  } catch (error) {
    console.error(error);
    toast('Não foi possível abrir Treinamentos. Atualize a página e tente novamente.');
  }
}

function ensureNav() {
  const nav = sidebarNav();
  if (!nav || !perfil) return;

  const allowed = podeTreinamentos();
  const existing = trainingButtons();
  if (existing.length) {
    existing.forEach((btn, index) => {
      btn.style.display = allowed && index === 0 ? '' : 'none';
      if (index === 0) btn.dataset.trainingEntryV79 = 'existing';
    });
    return;
  }

  if (!allowed) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-btn';
  btn.dataset.trainingEntryV79 = 'created';
  btn.innerHTML = '<span>▤</span>Treinamentos';
  btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    openTraining(btn);
  });

  const buttons = navButtons();
  const apontamento = buttons.find(b => lower(b).includes('apontamento'));
  const quemSomos = buttons.find(b => lower(b).includes('quem somos'));
  if (apontamento?.parentElement === nav) apontamento.insertAdjacentElement('afterend', btn);
  else if (quemSomos?.parentElement === nav) nav.insertBefore(btn, quemSomos);
  else nav.appendChild(btn);
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(ensureNav, 60);
}

function startObserver() {
  if (observerStarted) return;
  observerStarted = true;
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
}

onAuthStateChanged(auth, async user => {
  try {
    await carregarPerfil(user);
    startObserver();
    schedule();
    if (user && podeTreinamentos()) loadTrainingModule().catch(() => null);
  } catch (error) {
    console.warn('Entrada de Treinamentos indisponível:', error);
  }
});

window.addEventListener('load', () => {
  startObserver();
  schedule();
});

console.info(`Excellence System® entrada de Treinamentos ${V} carregada.`);
