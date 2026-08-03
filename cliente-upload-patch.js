import { auth, db, storage } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const CLIENT_UPLOAD_VERSION = '20260801-49';
const PERFIL_CACHE = { uid: '', value: null };
let enhancing = false;

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toastUpload(message, type = 'success') {
  const old = document.querySelector('.cliente-upload-toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = `notice ${type} cliente-upload-toast`;
  el.style.position = 'fixed';
  el.style.right = '18px';
  el.style.bottom = '18px';
  el.style.zIndex = '2800';
  el.style.maxWidth = '460px';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

async function perfilAtual() {
  const user = auth.currentUser;
  if (!user) return null;
  if (PERFIL_CACHE.uid === user.uid && PERFIL_CACHE.value) return PERFIL_CACHE.value;
  const snap = await getDoc(doc(db, 'usuarios', user.uid));
  if (!snap.exists()) return null;
  PERFIL_CACHE.uid = user.uid;
  PERFIL_CACHE.value = { id: snap.id, ...snap.data() };
  return PERFIL_CACHE.value;
}

function isAdmin(perfil) {
  return perfil?.tipo === 'admin' && perfil?.ativo === true;
}

function isCliente(perfil) {
  return perfil?.tipo === 'cliente' && perfil?.ativo === true && perfil?.empresaId;
}

function safeFileName(name = '') {
  return String(name || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

function normalizeUrl(url = '') {
  const clean = String(url || '').trim();
  if (!clean) return '';
  const parsed = new URL(clean);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('O link precisa começar com http:// ou https://.');
  return parsed.toString();
}

function formatDate(value) {
  if (!value) return '-';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function currentEmpresaIdFromHistory() {
  const meta = window.history.state?.meta || {};
  const view = meta.adminView || {};
  if (view.empresaId) return view.empresaId;
  const key = window.history.state?.key || '';
  const match = String(key).match(/admin:empresa:([^:]+)/);
  return match ? match[1] : '';
}

async function fetchRecurso(recursoId) {
  const snap = await getDoc(doc(db, 'empresa_recursos', recursoId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

function permissionLabel(item = {}) {
  if (!item.clientePodeEditar) return 'Bloqueado para envio da empresa';
  const tipos = [];
  if (item.clientePermitePdf) tipos.push('PDF');
  if (item.clientePermiteWord) tipos.push('Word');
  if (item.clientePermiteLink) tipos.push('Link');
  return `Liberado: ${tipos.join(', ') || 'sem tipo definido'}`;
}

function clientSubmissionHTML(item = {}, compact = false) {
  const actions = [];
  if (item.clientePdfUrl) actions.push(`<a class="btn btn-small btn-blue" href="${escapeHTML(item.clientePdfUrl)}" target="_blank" rel="noopener">Ver PDF enviado</a>`);
  if (item.clienteWordUrl) actions.push(`<a class="btn btn-small btn-gold" href="${escapeHTML(item.clienteWordUrl)}" target="_blank" rel="noopener">Baixar Word enviado</a>`);
  if (item.clienteLinkUrl) actions.push(`<a class="btn btn-small btn-primary" href="${escapeHTML(item.clienteLinkUrl)}" target="_blank" rel="noopener">Abrir link enviado</a>`);
  if (!actions.length) return compact ? '<small>Sem envio da empresa ainda.</small>' : '<p class="muted">A empresa ainda não enviou nenhum arquivo para este item.</p>';
  return `
    <div class="cliente-upload-submission">
      <small>Último envio: ${escapeHTML(formatDate(item.clienteAtualizadoEm))}</small>
      <div class="file-actions">${actions.join('')}</div>
    </div>
  `;
}

function injectStyles() {
  if (document.getElementById('clienteUploadStyles')) return;
  const style = document.createElement('style');
  style.id = 'clienteUploadStyles';
  style.textContent = `
    .cliente-upload-admin-box{margin-top:10px;padding:10px;border:1px dashed var(--line-strong,#bad4df);border-radius:14px;background:#f8fbfd;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .cliente-upload-admin-box small{display:block;color:var(--muted,#627986);font-weight:700}
    .cliente-upload-panel{margin-top:18px;border:1px solid rgba(10,88,128,.18);background:linear-gradient(180deg,#fff,#f7fbfd);border-radius:20px;padding:18px}
    .cliente-upload-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
    .cliente-upload-panel-head h2{margin:4px 0;color:var(--primary-dark,#073f5a)}
    .cliente-upload-list{display:grid;gap:14px}
    .cliente-upload-card{border:1px solid var(--line,#d8e7ee);background:#fff;border-radius:18px;padding:16px}
    .cliente-upload-card h3{margin:4px 0;color:var(--primary-dark,#073f5a)}
    .cliente-upload-card p{color:var(--muted,#627986)}
    .cliente-upload-badges{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
    .cliente-upload-badge{border-radius:999px;background:#eef7fb;border:1px solid var(--line,#d8e7ee);padding:5px 9px;font-weight:800;font-size:12px;color:var(--primary-dark,#073f5a)}
    .cliente-upload-form{margin-top:12px;border-top:1px solid var(--line,#d8e7ee);padding-top:12px}
    .cliente-upload-submission{margin-top:10px;padding:10px;border-radius:14px;background:#f2f7fa;border:1px solid var(--line,#d8e7ee)}
    .cliente-upload-modal-backdrop{position:fixed;inset:0;background:rgba(5,24,36,.58);z-index:3000;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto}
    .cliente-upload-modal{width:min(680px,100%);background:#fff;border-radius:22px;border:1px solid var(--line,#d8e7ee);box-shadow:0 24px 70px rgba(0,0,0,.24);padding:20px}
    .cliente-upload-checks{display:grid;gap:10px;margin:12px 0}
    .cliente-upload-checks label{display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid var(--line,#d8e7ee);border-radius:14px;background:#f8fbfd;cursor:pointer}
    .cliente-upload-checks input{width:18px;height:18px;margin-top:2px}
    @media(max-width:720px){.cliente-upload-panel-head{flex-direction:column}.cliente-upload-admin-box{align-items:flex-start}.cliente-upload-modal-backdrop{padding:10px}.cliente-upload-modal{border-radius:16px}}
  `;
  document.head.appendChild(style);
}

async function configurePermission(resourceId) {
  const item = await fetchRecurso(resourceId);
  if (!item) return toastUpload('Item não encontrado.', 'error');
  document.querySelector('.cliente-upload-modal-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'cliente-upload-modal-backdrop';
  backdrop.innerHTML = `
    <div class="cliente-upload-modal">
      <div class="section-title-row compact-row no-margin">
        <div>
          <span class="kicker">Permissão da empresa</span>
          <h2>${escapeHTML(item.titulo || 'Item do ecossistema')}</h2>
          <p>Escolha se o usuário da empresa poderá enviar/alterar arquivos neste item específico.</p>
        </div>
        <button class="btn btn-small btn-soft" type="button" data-client-upload-close>Fechar</button>
      </div>
      <form id="clientUploadPermissionForm">
        <div class="cliente-upload-checks">
          <label><input type="checkbox" name="clientePodeEditar" ${item.clientePodeEditar ? 'checked' : ''} /> <span><strong>Liberar envio/alteração pela empresa</strong><small>Quando desmarcado, o cliente apenas visualiza os arquivos enviados pela administração.</small></span></label>
          <label><input type="checkbox" name="clientePermitePdf" ${item.clientePermitePdf ? 'checked' : ''} /> <span><strong>Permitir PDF</strong><small>Usuário poderá enviar ou substituir o PDF de retorno/evidência.</small></span></label>
          <label><input type="checkbox" name="clientePermiteWord" ${item.clientePermiteWord ? 'checked' : ''} /> <span><strong>Permitir Word</strong><small>Usuário poderá enviar DOC/DOCX.</small></span></label>
          <label><input type="checkbox" name="clientePermiteLink" ${item.clientePermiteLink ? 'checked' : ''} /> <span><strong>Permitir link</strong><small>Usuário poderá informar link de Drive, vídeo, slide ou material externo.</small></span></label>
        </div>
        <div class="form-group"><label>Orientação para a empresa</label><textarea name="clienteInstrucoes" placeholder="Ex.: Subir o formulário preenchido, contrato assinado ou evidência atualizada.">${escapeHTML(item.clienteInstrucoes || '')}</textarea></div>
        <div class="notice">A liberação vale somente para este item. Outros arquivos continuam bloqueados até a administração liberar.</div>
        <div class="actions" style="margin-top:16px;">
          <button class="btn btn-primary" type="submit">Salvar permissão</button>
          <button class="btn btn-soft" type="button" data-client-upload-close>Cancelar</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop || event.target.closest('[data-client-upload-close]')) backdrop.remove();
  });
  backdrop.querySelector('#clientUploadPermissionForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const enabled = form.get('clientePodeEditar') === 'on';
    const permitePdf = form.get('clientePermitePdf') === 'on';
    const permiteWord = form.get('clientePermiteWord') === 'on';
    const permiteLink = form.get('clientePermiteLink') === 'on';
    if (enabled && !permitePdf && !permiteWord && !permiteLink) {
      toastUpload('Escolha pelo menos PDF, Word ou Link para liberar este item.', 'error');
      return;
    }
    const btn = event.submitter;
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      await updateDoc(doc(db, 'empresa_recursos', resourceId), {
        clientePodeEditar: enabled,
        clientePermitePdf: enabled && permitePdf,
        clientePermiteWord: enabled && permiteWord,
        clientePermiteLink: enabled && permiteLink,
        clienteInstrucoes: String(form.get('clienteInstrucoes') || '').trim(),
        permissaoClienteAtualizadaEm: serverTimestamp(),
        permissaoClienteAtualizadaPor: auth.currentUser?.uid || ''
      });
      toastUpload('Permissão da empresa atualizada.');
      backdrop.remove();
      refreshAdminPermissionBoxes();
    } catch (error) {
      toastUpload(error?.message || 'Erro ao salvar permissão.', 'error');
      btn.disabled = false;
      btn.textContent = 'Salvar permissão';
    }
  });
}

async function enhanceAdminResource(itemEl, resourceId) {
  if (!resourceId || itemEl.dataset.clienteUploadAdmin === CLIENT_UPLOAD_VERSION) return;
  itemEl.dataset.clienteUploadAdmin = CLIENT_UPLOAD_VERSION;
  const data = await fetchRecurso(resourceId).catch(() => null);
  const box = document.createElement('div');
  box.className = 'cliente-upload-admin-box';
  box.dataset.clienteUploadBox = resourceId;
  box.innerHTML = `
    <div>
      <small>Envio da empresa</small>
      <strong>${escapeHTML(permissionLabel(data || {}))}</strong>
      ${data?.clienteStatus === 'enviado' ? clientSubmissionHTML(data, true) : '<small>Nenhum arquivo enviado pela empresa ainda.</small>'}
    </div>
    <button class="btn btn-small btn-gold" type="button" data-client-upload-permission="${escapeHTML(resourceId)}">Configurar</button>
  `;
  itemEl.appendChild(box);
  box.querySelector('[data-client-upload-permission]')?.addEventListener('click', () => configurePermission(resourceId));
}

function refreshAdminPermissionBoxes() {
  document.querySelectorAll('[data-cliente-upload-admin]').forEach(el => {
    delete el.dataset.clienteUploadAdmin;
    el.querySelector('.cliente-upload-admin-box')?.remove();
  });
  enhanceAll().catch(() => null);
}

async function enhanceAdmin(perfil) {
  if (!isAdmin(perfil)) return;
  const resourceButtons = Array.from(document.querySelectorAll('[data-delete-recurso]'));
  for (const btn of resourceButtons) {
    const resourceId = btn.dataset.deleteRecurso;
    const itemEl = btn.closest('.ecosystem-resource-item');
    if (itemEl) await enhanceAdminResource(itemEl, resourceId);
  }
}

function allowedBadges(item) {
  const badges = [];
  if (item.clientePermitePdf) badges.push('<span class="cliente-upload-badge">PDF</span>');
  if (item.clientePermiteWord) badges.push('<span class="cliente-upload-badge">Word</span>');
  if (item.clientePermiteLink) badges.push('<span class="cliente-upload-badge">Link</span>');
  return badges.join('');
}

async function uploadClienteFile(empresaId, resourceId, tipo, file) {
  if (!file || !file.name) return null;
  const path = `empresas/${empresaId}/cliente-uploads/${resourceId}/${auth.currentUser.uid}/${tipo}/${Date.now()}-${safeFileName(file.name)}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, nome: file.name, path };
}

async function submitClienteArquivo(item, formEl) {
  const form = new FormData(formEl);
  const payload = {};
  const pdfFile = form.get('clientePdf');
  const wordFile = form.get('clienteWord');
  const linkUrl = normalizeUrl(form.get('clienteLink'));

  if (pdfFile?.name) {
    if (!item.clientePermitePdf) throw new Error('Este item não está liberado para PDF.');
    const pdf = await uploadClienteFile(item.empresaId, item.id, 'pdf', pdfFile);
    payload.clientePdfUrl = pdf.url;
    payload.clientePdfNome = pdf.nome;
    payload.clientePdfStoragePath = pdf.path;
  }
  if (wordFile?.name) {
    if (!item.clientePermiteWord) throw new Error('Este item não está liberado para Word.');
    const word = await uploadClienteFile(item.empresaId, item.id, 'word', wordFile);
    payload.clienteWordUrl = word.url;
    payload.clienteWordNome = word.nome;
    payload.clienteWordStoragePath = word.path;
  }
  if (linkUrl) {
    if (!item.clientePermiteLink) throw new Error('Este item não está liberado para link.');
    payload.clienteLinkUrl = linkUrl;
  }

  if (!Object.keys(payload).length) throw new Error('Escolha um arquivo ou informe um link para enviar.');

  payload.clienteStatus = 'enviado';
  payload.clienteAtualizadoEm = serverTimestamp();
  payload.clienteAtualizadoPor = auth.currentUser.uid;

  await updateDoc(doc(db, 'empresa_recursos', item.id), payload);
}

function clienteUploadCardHTML(item) {
  return `
    <article class="cliente-upload-card" data-cliente-upload-card="${escapeHTML(item.id)}">
      <span class="kicker">Item liberado pela administração</span>
      <h3>${escapeHTML(item.titulo || 'Arquivo liberado')}</h3>
      ${item.descricao ? `<p>${escapeHTML(item.descricao)}</p>` : ''}
      ${item.clienteInstrucoes ? `<div class="notice"><strong>Orientação:</strong> ${escapeHTML(item.clienteInstrucoes)}</div>` : ''}
      <div class="cliente-upload-badges">${allowedBadges(item)}</div>
      ${clientSubmissionHTML(item)}
      <form class="cliente-upload-form" data-cliente-upload-form="${escapeHTML(item.id)}">
        <div class="form-grid-2">
          ${item.clientePermitePdf ? '<div class="form-group"><label>Enviar PDF</label><input name="clientePdf" type="file" accept="application/pdf,.pdf" /></div>' : ''}
          ${item.clientePermiteWord ? '<div class="form-group"><label>Enviar Word</label><input name="clienteWord" type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /></div>' : ''}
        </div>
        ${item.clientePermiteLink ? '<div class="form-group"><label>Enviar link</label><input name="clienteLink" type="url" placeholder="https://..." /></div>' : ''}
        <button class="btn btn-primary" type="submit">Salvar envio</button>
      </form>
    </article>
  `;
}

async function renderClienteUploadsPanel(perfil) {
  if (!isCliente(perfil)) return;
  const panel = document.querySelector('.company-ecosystem-panel');
  if (!panel || document.querySelector('#clienteUploadsLiberadosPanel')) return;

  const snap = await getDocs(query(collection(db, 'empresa_recursos'), where('empresaId', '==', perfil.empresaId)));
  const liberados = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(item => item.clientePodeEditar === true)
    .sort((a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR'));

  if (!liberados.length) return;

  const section = document.createElement('section');
  section.className = 'cliente-upload-panel';
  section.id = 'clienteUploadsLiberadosPanel';
  section.innerHTML = `
    <div class="cliente-upload-panel-head">
      <div>
        <span class="kicker">Envios liberados</span>
        <h2>Arquivos que a empresa pode alterar/enviar</h2>
        <p>Somente os itens liberados pela administração aparecem aqui. Os demais continuam apenas para visualização.</p>
      </div>
      <span class="cliente-upload-badge">${liberados.length} item(ns)</span>
    </div>
    <div class="cliente-upload-list">${liberados.map(clienteUploadCardHTML).join('')}</div>
  `;
  panel.insertAdjacentElement('beforebegin', section);

  section.querySelectorAll('[data-cliente-upload-form]').forEach(formEl => {
    formEl.addEventListener('submit', async event => {
      event.preventDefault();
      const resourceId = formEl.dataset.clienteUploadForm;
      const item = liberados.find(x => x.id === resourceId);
      const btn = event.submitter;
      btn.disabled = true;
      btn.textContent = 'Enviando...';
      try {
        const fresh = await fetchRecurso(resourceId);
        await submitClienteArquivo(fresh || item, formEl);
        toastUpload('Arquivo da empresa enviado com sucesso.');
        section.remove();
        await renderClienteUploadsPanel(perfil);
      } catch (error) {
        toastUpload(error?.message || 'Erro ao enviar arquivo.', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar envio';
      }
    });
  });
}

async function enhanceAll() {
  if (enhancing) return;
  enhancing = true;
  try {
    injectStyles();
    const perfil = await perfilAtual();
    if (!perfil) return;
    await enhanceAdmin(perfil);
    await renderClienteUploadsPanel(perfil);
  } catch (error) {
    console.warn('Permissões de envio da empresa indisponíveis agora:', error);
  } finally {
    enhancing = false;
  }
}

const observer = new MutationObserver(() => window.requestAnimationFrame(enhanceAll));
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('load', enhanceAll);
document.addEventListener('click', () => setTimeout(enhanceAll, 160));
setInterval(enhanceAll, 3000);

console.info(`Excellence System® permissões de envio ${CLIENT_UPLOAD_VERSION} carregadas.`);
