import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { collection, doc, getDoc, getDocs, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const VERSION = '20260906-97';

const PRESETS = {
  responsavel: {
    label: 'Responsável da empresa',
    descricao: 'Acompanha a operação da empresa e pode atuar nas áreas liberadas de qualidade, documentos, produção e treinamentos.',
    permissoes: ['estrutura_iso','ecossistema','arquivos_recebidos','diario_bordo','apontamento','treinamentos']
  },
  qualidade_rh: {
    label: 'Qualidade / RH',
    descricao: 'Foco em ISO, documentos, treinamentos, pessoas e acompanhamento da consultoria.',
    permissoes: ['estrutura_iso','ecossistema','arquivos_recebidos','diario_bordo','treinamentos']
  },
  producao: {
    label: 'Produção',
    descricao: 'Acesso operacional focado exclusivamente no Apontamento de produção.',
    permissoes: ['apontamento']
  },
  consulta: {
    label: 'Consulta',
    descricao: 'Acesso enxuto às informações recebidas e ao acompanhamento das horas da consultoria.',
    permissoes: ['arquivos_recebidos','diario_bordo']
  }
};

let perfilAdmin = null;
let usuarios = new Map();
let observerStarted = false;
let timer = null;

function esc(value = '') {
  return String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function isAdmin() {
  return perfilAdmin?.tipo === 'admin' && perfilAdmin?.ativo === true;
}

function injectStyle() {
  if (document.getElementById('perfis-empresa-style')) return;
  const style = document.createElement('style');
  style.id = 'perfis-empresa-style';
  style.textContent = `
    .perfil-preset-box{border:1px solid #cfe0e6;background:linear-gradient(180deg,#f8fbfc,#fff);border-radius:15px;padding:12px;display:grid;gap:9px}
    .perfil-preset-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}.perfil-preset-top strong{color:#073F5A}.perfil-preset-top small{display:block;color:#607788;margin-top:2px}
    .perfil-preset-controls{display:grid;grid-template-columns:minmax(180px,1fr) auto;gap:8px}.perfil-preset-controls select{width:100%;border:1px solid #cbdde4;border-radius:10px;padding:9px;background:#fff;color:#173846}.perfil-preset-controls button{border:0;border-radius:10px;padding:9px 12px;background:#073F5A;color:#fff;font-weight:850;cursor:pointer}
    .perfil-preset-current{display:inline-flex;border-radius:999px;padding:5px 8px;background:#e8f3f7;color:#073F5A;font-size:11px;font-weight:900}
    @media(max-width:620px){.perfil-preset-controls{grid-template-columns:1fr}.perfil-preset-controls button{width:100%}}
  `;
  document.head.appendChild(style);
}

function toast(message, error = false) {
  document.querySelector('[data-perfil-preset-toast]')?.remove();
  const el = document.createElement('div');
  el.dataset.perfilPresetToast = '1';
  el.textContent = message;
  el.style.cssText = `position:fixed;right:18px;bottom:18px;z-index:130000;max-width:430px;padding:12px 15px;border-radius:13px;color:#fff;font-weight:850;background:${error?'#9f2e2e':'#073F5A'};box-shadow:0 18px 42px rgba(5,36,55,.25)`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

async function loadContext(user) {
  perfilAdmin = null;
  usuarios = new Map();
  if (!user) return;
  const p = await getDoc(doc(db,'usuarios',user.uid));
  perfilAdmin = p.exists() ? { id:p.id, ...p.data() } : null;
  if (!isAdmin()) return;
  const snap = await getDocs(collection(db,'usuarios'));
  snap.docs.forEach(d => usuarios.set(d.id,{ id:d.id, ...d.data() }));
}

function setCheckboxes(card, permissoes) {
  card.querySelectorAll('input[name="permissao"]').forEach(input => {
    input.checked = permissoes.includes(input.value);
  });
}

function currentLabel(usuario) {
  return PRESETS[usuario?.perfilOperacional]?.label || (usuario?.perfilOperacional === 'personalizado' ? 'Personalizado' : 'Não definido');
}

function optionHTML() {
  return Object.entries(PRESETS).map(([id,p]) => `<option value="${id}">${esc(p.label)}</option>`).join('');
}

function markPersonalized(card) {
  const id = card?.dataset?.userId;
  const usuario = usuarios.get(id);
  if (usuario) usuario.perfilOperacional = 'personalizado';
  const current = card?.querySelector('.perfil-preset-current');
  if (current) current.textContent = 'Personalizado';
}

function enhanceCard(card) {
  if (!isAdmin() || card.dataset.perfilPreset === VERSION) return;
  const id = card.dataset.userId;
  const usuario = usuarios.get(id);
  if (!usuario || usuario.tipo === 'admin') return;
  const options = card.querySelector('.perm-options');
  if (!options) return;
  card.dataset.perfilPreset = VERSION;

  const box = document.createElement('section');
  box.className = 'perfil-preset-box';
  box.innerHTML = `
    <div class="perfil-preset-top"><div><strong>Perfil pronto de acesso</strong><small>Use um modelo como ponto de partida. Depois você ainda pode marcar/desmarcar áreas manualmente.</small></div><span class="perfil-preset-current">${esc(currentLabel(usuario))}</span></div>
    <div class="perfil-preset-controls"><select data-perfil-preset-select><option value="">Escolha um perfil...</option>${optionHTML()}</select><button type="button" data-perfil-preset-apply>Aplicar perfil</button></div>
    <small data-perfil-preset-description style="color:#607788">Os perfis não alteram dados da empresa; apenas as permissões deste usuário.</small>
  `;
  options.parentElement?.insertBefore(box, options);

  const select = box.querySelector('[data-perfil-preset-select]');
  const desc = box.querySelector('[data-perfil-preset-description]');
  select?.addEventListener('change', () => {
    const preset = PRESETS[select.value];
    desc.textContent = preset?.descricao || 'Escolha um perfil pronto ou continue usando permissões personalizadas.';
  });

  box.querySelector('[data-perfil-preset-apply]')?.addEventListener('click', async event => {
    const presetId = select?.value || '';
    const preset = PRESETS[presetId];
    if (!preset) return toast('Escolha um perfil antes de aplicar.', true);
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Aplicando...';
    try {
      setCheckboxes(card, preset.permissoes);
      await updateDoc(doc(db,'usuarios',id), {
        permissoes: preset.permissoes,
        perfilOperacional: presetId,
        perfilOperacionalAtualizadoEm: serverTimestamp(),
        perfilOperacionalAtualizadoPor: auth.currentUser?.uid || '',
        permissoesAtualizadoEm: serverTimestamp(),
        permissoesAtualizadoPor: auth.currentUser?.uid || '',
        atualizadoEm: serverTimestamp(),
        atualizadoPor: auth.currentUser?.uid || ''
      });
      usuario.permissoes = [...preset.permissoes];
      usuario.perfilOperacional = presetId;
      box.querySelector('.perfil-preset-current').textContent = preset.label;
      toast(`Perfil ${preset.label} aplicado.`);
    } catch (error) {
      console.error(error);
      toast(error?.message || 'Não foi possível aplicar o perfil.', true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Aplicar perfil';
    }
  });
}

function detectManualChanges(card) {
  if (card.dataset.perfilManualBound === '1') return;
  card.dataset.perfilManualBound = '1';
  card.addEventListener('change', event => {
    if (!event.target.matches('input[name="permissao"]')) return;
    markPersonalized(card);
  });
}

async function persistCustomizedProfile(card) {
  const id = card?.dataset?.userId;
  const usuario = usuarios.get(id);
  if (!id || !usuario || usuario.tipo === 'admin' || usuario.perfilOperacional !== 'personalizado') return;
  try {
    await updateDoc(doc(db,'usuarios',id), {
      perfilOperacional:'personalizado',
      perfilOperacionalAtualizadoEm:serverTimestamp(),
      perfilOperacionalAtualizadoPor:auth.currentUser?.uid || ''
    });
  } catch (error) {
    console.warn('Não foi possível registrar o perfil personalizado:', error);
  }
}

function enhance() {
  if (!isAdmin()) return;
  injectStyle();
  document.querySelectorAll('[data-perm-user-card]').forEach(card => {
    enhanceCard(card);
    detectManualChanges(card);
  });
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(enhance,80);
}

function startObserver() {
  if (observerStarted) return;
  observerStarted = true;
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
}

document.addEventListener('click', event => {
  const shortcut = event.target.closest?.('[data-only-apontamento],[data-all-perms],[data-no-perms]');
  if (shortcut) markPersonalized(shortcut.closest('[data-perm-user-card]'));

  const save = event.target.closest?.('[data-save-perms]');
  if (save) {
    const card = save.closest('[data-perm-user-card]');
    setTimeout(() => persistCustomizedProfile(card), 80);
  }
}, true);

startObserver();
onAuthStateChanged(auth, async user => {
  try {
    await loadContext(user);
    schedule();
  } catch (error) {
    console.warn('Perfis de acesso da empresa indisponíveis:', error);
  }
});
window.addEventListener('load',schedule);
console.info(`Excellence System • perfis prontos de acesso ${VERSION} carregados.`);
