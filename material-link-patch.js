import { auth, db, storage } from './firebase-config.js';
import { ISO_SECTIONS } from './iso-data.js';
import { collection, doc, getDocs, setDoc, addDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const PATCH_VERSION = '20260801-43';
const requirementMap = new Map();
ISO_SECTIONS.forEach(section => section.requirements.forEach(req => requirementMap.set(req.id, { ...req, section })));

function escapeHTML(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function toast(message, type = 'success') {
  const existing = document.querySelector('.toast-message-v43');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = `notice ${type} toast-message-v43`;
  el.style.position = 'fixed';
  el.style.right = '18px';
  el.style.bottom = '18px';
  el.style.zIndex = '999';
  el.style.maxWidth = '420px';
  el.innerHTML = escapeHTML(message);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4300);
}

function normalizarUrlOpcional(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function safeFileName(fileName) {
  return `${Date.now()}_${fileName}`.replaceAll('/', '-').replaceAll('\\', '-');
}

function baseStoragePathForArquivo({ req, tipoMaterial = '' }) {
  if (tipoMaterial === 'iso_completa') return 'materiais-apoio/iso-completa';
  if (tipoMaterial === 'avulso') return 'cofre-admin/materiais-avulsos';
  return `materiais-apoio/${req?.id || 'geral'}`;
}

async function uploadArquivoVersao(storagePath, file) {
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

async function salvarMaterialLivre(formEl) {
  const form = new FormData(formEl);
  const tipoMaterial = form.get('tipoMaterial') || 'iso';
  const completo = tipoMaterial === 'iso_completa';
  const avulso = tipoMaterial === 'avulso';
  const req = (avulso || completo) ? null : requirementMap.get(form.get('requisitoId'));
  if (!avulso && !completo && !req) throw new Error('Selecione o requisito ISO.');

  const pdfFile = form.get('arquivoPdf') || form.get('arquivo');
  const wordFile = form.get('arquivoWord');
  const linkUrl = normalizarUrlOpcional(form.get('linkUrl'));
  const tipoLink = String(form.get('tipoLink') || '').trim();
  const hasPdf = Boolean(pdfFile && pdfFile.name);
  const hasWord = Boolean(wordFile && wordFile.name);
  const hasLink = Boolean(linkUrl);
  if (!hasPdf && !hasWord && !hasLink) throw new Error('Adicione pelo menos um PDF, um Word ou um link.');

  const basePath = baseStoragePathForArquivo({ req, tipoMaterial });
  let pdfUrl = '', pdfNome = '', pdfStoragePath = '';
  if (hasPdf) {
    pdfStoragePath = `${basePath}/pdf/${safeFileName(pdfFile.name)}`;
    pdfUrl = await uploadArquivoVersao(pdfStoragePath, pdfFile);
    pdfNome = pdfFile.name;
  }

  let wordUrl = '', wordNome = '', wordStoragePath = '';
  if (hasWord) {
    wordStoragePath = `${basePath}/word/${safeFileName(wordFile.name)}`;
    wordUrl = await uploadArquivoVersao(wordStoragePath, wordFile);
    wordNome = wordFile.name;
  }

  const payload = {
    categoria: 'material_apoio',
    empresaId: '',
    publico: completo ? true : !avulso,
    tipoMaterial: completo ? 'iso_completa' : (avulso ? 'avulso' : 'iso'),
    secaoId: completo ? 'iso_completa' : (avulso ? 'avulso' : req.section.id),
    secaoTitulo: completo ? 'ISO completa' : (avulso ? 'Cofre de materiais' : req.section.title),
    requisitoId: completo || avulso ? '' : req.id,
    requisitoNumero: completo ? 'ISO completa' : (avulso ? 'Avulso' : req.number),
    requisitoTitulo: completo ? 'Arquivo completo' : (avulso ? 'Material avulso' : req.title),
    titulo: (form.get('titulo') || '').trim() || (completo ? 'ISO completa' : (pdfNome || wordNome || 'Link externo')),
    descricao: (form.get('descricao') || '').trim(),
    tipoLink: linkUrl ? (tipoLink || 'outro') : '',
    linkUrl,
    pdfUrl,
    pdfNome,
    pdfStoragePath,
    wordUrl,
    wordNome,
    wordStoragePath,
    arquivoUrl: pdfUrl,
    arquivoNome: pdfNome,
    storagePath: pdfStoragePath,
    atualizadoPor: auth.currentUser?.uid || '',
    atualizadoEm: serverTimestamp()
  };

  if (completo) {
    await setDoc(doc(db, 'arquivos', 'iso_completa_geral'), {
      ...payload,
      criadoPor: auth.currentUser?.uid || '',
      criadoEm: serverTimestamp()
    }, { merge: true });
  } else {
    await addDoc(collection(db, 'arquivos'), {
      ...payload,
      criadoPor: auth.currentUser?.uid || '',
      criadoEm: serverTimestamp()
    });
  }
}

function injectLinkFields() {
  const form = document.getElementById('materialForm');
  if (!form || form.dataset.v43LinkReady === 'true') return;
  form.dataset.v43LinkReady = 'true';

  const oldHint = [...form.querySelectorAll('small')].find(el => /obrigatório selecionar/i.test(el.textContent || ''));
  if (oldHint) oldHint.textContent = 'Quando enviado, libera “Baixar Word”.';

  const descriptionGroup = [...form.querySelectorAll('.form-group')].find(group => group.querySelector('textarea[name="descricao"]'));
  if (descriptionGroup && !form.querySelector('[name="linkUrl"]')) {
    descriptionGroup.insertAdjacentHTML('afterend', `
      <div class="form-grid-2" data-v43-link-fields>
        <div class="form-group"><label>Tipo do link</label><select name="tipoLink"><option value="">Sem link</option><option value="video">Vídeo</option><option value="slide">Slide/apresentação</option><option value="outro">Outro link</option></select></div>
        <div class="form-group"><label>Link externo (opcional)</label><input name="linkUrl" type="url" placeholder="https://... vídeo, slide, página ou material externo" /><small>Use para vídeo, slide, Google Drive, página ou outro material online.</small></div>
      </div>
      <div class="notice" data-v43-free-choice>Informe pelo menos uma opção: PDF, Word ou link externo. Eles não precisam ser enviados juntos.</div>
    `);
  }
}

async function addLinkButtonsToVisibleCards() {
  if (!document.querySelector('[data-edit-arquivo], .featured-document, .file-item, .vault-card')) return;
  let files = [];
  try {
    const snap = await getDocs(query(collection(db, 'arquivos'), where('categoria', '==', 'material_apoio')));
    files = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(file => file.linkUrl);
  } catch (error) {
    return;
  }

  files.forEach(file => {
    document.querySelectorAll(`[data-edit-arquivo="${CSS.escape(file.id)}"]`).forEach(btn => {
      const actions = btn.closest('.file-actions');
      if (actions && !actions.querySelector(`[data-v43-link="${CSS.escape(file.id)}"]`)) {
        actions.insertAdjacentHTML('afterbegin', `<a class="btn btn-small btn-primary" data-v43-link="${escapeHTML(file.id)}" href="${escapeHTML(file.linkUrl)}" target="_blank" rel="noopener">Abrir link</a>`);
      }
    });

    const title = String(file.titulo || file.pdfNome || file.wordNome || 'Material de apoio').trim().toLowerCase();
    if (!title) return;
    document.querySelectorAll('.file-item, .featured-document, .vault-card').forEach(card => {
      const strongOrTitle = card.querySelector('strong, h2, h3');
      const cardTitle = String(strongOrTitle?.textContent || '').trim().toLowerCase();
      if (!cardTitle || cardTitle !== title) return;
      let actions = card.querySelector('.file-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'file-actions';
        card.appendChild(actions);
      }
      if (!actions.querySelector(`[data-v43-link="${CSS.escape(file.id)}"]`)) {
        actions.insertAdjacentHTML('afterbegin', `<a class="btn btn-small btn-primary" data-v43-link="${escapeHTML(file.id)}" href="${escapeHTML(file.linkUrl)}" target="_blank" rel="noopener">Abrir link</a>`);
      }
      actions.querySelectorAll('.muted').forEach(el => {
        if (/indisponível/i.test(el.textContent || '')) el.remove();
      });
    });
  });
}

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'materialForm') return;
  if (!form.querySelector('[name="linkUrl"]')) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const btn = event.submitter;
  const oldText = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Salvando...';
  }

  try {
    await salvarMaterialLivre(form);
    toast('Material salvo no cofre com sucesso.');
    setTimeout(() => location.reload(), 700);
  } catch (error) {
    toast(error?.message || 'Erro ao salvar material.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = oldText || 'Salvar material';
    }
  }
}, true);

let lastEnhance = 0;
function enhance() {
  const now = Date.now();
  if (now - lastEnhance < 250) return;
  lastEnhance = now;
  injectLinkFields();
  addLinkButtonsToVisibleCards();
}

const observer = new MutationObserver(enhance);
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('load', enhance);
document.addEventListener('click', () => setTimeout(enhance, 250));

console.info(`Excellence System® material patch ${PATCH_VERSION} carregado.`);
