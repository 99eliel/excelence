import { auth, db, storage } from './firebase-config.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const VERSION = '20260908-105';
const EXCEL_ACCEPT = '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
let activePermissionResourceId = '';
let enhancing = false;

const esc = (value = '') => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function toast(message, error = false) {
  document.querySelector('[data-documentos-excel-toast]')?.remove();
  const el = document.createElement('div');
  el.dataset.documentosExcelToast = '1';
  el.textContent = message;
  el.style.cssText = `position:fixed;right:18px;bottom:18px;z-index:145000;max-width:480px;padding:12px 15px;border-radius:13px;color:#fff;font-weight:850;background:${error ? '#9f2e2e' : '#073F5A'};box-shadow:0 18px 42px rgba(5,36,55,.25)`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4100);
}

function safeFileName(name = '') {
  return String(name || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

function normalizeUrl(value = '') {
  const clean = String(value || '').trim();
  if (!clean) return '';
  const url = new URL(clean);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('O link precisa começar com http:// ou https://.');
  return url.toString();
}

function currentEmpresaId() {
  const meta = history.state?.meta || {};
  const view = meta.adminView || {};
  if (view.empresaId) return String(view.empresaId);
  const key = String(history.state?.key || '');
  const match = key.match(/admin:empresa:([^:]+)/);
  return match?.[1] || '';
}

async function currentPerfil() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'usuarios', user.uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function uploadFile(path, file) {
  if (!file?.name) return { url: '', nome: '', path: '' };
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return { url: await getDownloadURL(storageRef), nome: file.name, path };
}

async function removeStorage(path) {
  if (!path) return;
  try { await deleteObject(ref(storage, path)); } catch (error) {
    if (!String(error?.code || '').includes('object-not-found')) console.warn('Arquivo não removido do Storage:', error);
  }
}

function refreshAdminEcosystem() {
  const back = document.getElementById('voltarEmpresaDetalhe');
  if (!back) return;
  back.click();
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    const open = document.getElementById('abrirEcossistemaEmpresa');
    if (open) {
      clearInterval(timer);
      open.click();
    } else if (tries > 30) clearInterval(timer);
  }, 80);
}

function excelInputHTML(name = 'arquivoExcel', label = 'Excel opcional') {
  return `<div class="form-group" data-excel-field><label>${esc(label)}</label><input name="${esc(name)}" type="file" accept="${EXCEL_ACCEPT}" /><small>Formatos XLS e XLSX.</small></div>`;
}

function enhanceAdminForms() {
  document.querySelectorAll('form[data-empresa-recurso-form]').forEach(form => {
    if (form.querySelector('[name="arquivoExcel"]')) return;
    const word = form.querySelector('[name="arquivoWord"]');
    const grid = word?.closest('.form-grid-2') || form.querySelector('.form-grid-2');
    if (grid) grid.insertAdjacentHTML('beforeend', excelInputHTML());
    const summary = form.closest('details')?.querySelector('summary');
    if (summary && !/excel/i.test(summary.textContent || '')) summary.textContent = '+ Adicionar arquivo (PDF, Word ou Excel) ou link nesta pasta';
  });
}

async function saveAdminResource(form, button) {
  const perfil = await currentPerfil();
  if (perfil?.tipo !== 'admin' || perfil?.ativo !== true) throw new Error('Apenas administradores podem adicionar arquivos.');
  const empresaId = currentEmpresaId();
  if (!empresaId) throw new Error('Não foi possível identificar a empresa.');

  const data = new FormData(form);
  const pastaId = String(form.dataset.pastaId || '');
  const titulo = String(data.get('titulo') || '').trim();
  const descricao = String(data.get('descricao') || '').trim();
  const tipoLink = String(data.get('tipoLink') || '').trim();
  const linkUrl = normalizeUrl(data.get('linkUrl'));
  const pdfFile = data.get('arquivoPdf');
  const wordFile = data.get('arquivoWord');
  const excelFile = data.get('arquivoExcel');

  if (!titulo) throw new Error('Informe o título do item.');
  if (!pdfFile?.name && !wordFile?.name && !excelFile?.name && !linkUrl) {
    throw new Error('Adicione pelo menos um PDF, Word, Excel ou link.');
  }

  const old = button?.textContent || 'Salvar item';
  if (button) { button.disabled = true; button.textContent = 'Salvando item...'; }

  try {
    const base = `empresas/${empresaId}/ecossistema/${pastaId || 'sem-pasta'}`;
    const stamp = Date.now();
    const [pdf, word, excel] = await Promise.all([
      pdfFile?.name ? uploadFile(`${base}/pdf/${stamp}-${safeFileName(pdfFile.name)}`, pdfFile) : { url:'', nome:'', path:'' },
      wordFile?.name ? uploadFile(`${base}/word/${stamp}-${safeFileName(wordFile.name)}`, wordFile) : { url:'', nome:'', path:'' },
      excelFile?.name ? uploadFile(`${base}/excel/${stamp}-${safeFileName(excelFile.name)}`, excelFile) : { url:'', nome:'', path:'' }
    ]);

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
      excelUrl: excel.url,
      excelNome: excel.nome,
      excelStoragePath: excel.path,
      criadoEm: serverTimestamp(),
      criadoPor: auth.currentUser.uid,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: auth.currentUser.uid
    });

    form.reset();
    toast('Item salvo no ecossistema da empresa.');
    refreshAdminEcosystem();
  } finally {
    if (button) { button.disabled = false; button.textContent = old; }
  }
}

async function enhanceAdminResourceCard(card) {
  const deleteButton = card.querySelector('[data-delete-recurso]');
  const resourceId = deleteButton?.dataset.deleteRecurso || '';
  if (!resourceId || card.dataset.excelEnhanced === VERSION) return;
  card.dataset.excelEnhanced = VERSION;
  const snap = await getDoc(doc(db, 'empresa_recursos', resourceId));
  if (!snap.exists()) return;
  const item = snap.data() || {};
  if (!item.excelUrl) return;

  const small = card.querySelector('small');
  if (small && !/Excel:/i.test(small.textContent || '')) {
    small.textContent = `${small.textContent || 'Material disponível'} • Excel: ${item.excelNome || 'planilha.xlsx'}`;
  }
  const actions = card.querySelector('.file-actions');
  if (actions && !actions.querySelector('[data-excel-download]')) {
    const link = document.createElement('a');
    link.className = 'btn btn-small btn-primary';
    link.dataset.excelDownload = '1';
    link.href = item.excelUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.download = item.excelNome || 'planilha.xlsx';
    link.textContent = 'Baixar Excel';
    actions.insertBefore(link, actions.firstChild);
  }
}

function addExcelPermissionField(form, checked = false) {
  if (form.querySelector('[name="clientePermiteExcel"]')) return;
  const checks = form.querySelector('.cliente-upload-checks');
  if (!checks) return;
  const label = document.createElement('label');
  label.dataset.excelPermission = '1';
  label.innerHTML = `<input type="checkbox" name="clientePermiteExcel" ${checked ? 'checked' : ''} /> <span><strong>Permitir Excel</strong><small>Usuário poderá enviar planilhas XLS/XLSX.</small></span>`;
  const linkLabel = checks.querySelector('[name="clientePermiteLink"]')?.closest('label');
  if (linkLabel) checks.insertBefore(label, linkLabel);
  else checks.appendChild(label);
}

async function enhancePermissionModal() {
  const form = document.getElementById('clientUploadPermissionForm');
  if (!form || form.dataset.excelEnhanced === VERSION || !activePermissionResourceId) return;
  form.dataset.excelEnhanced = VERSION;
  const snap = await getDoc(doc(db, 'empresa_recursos', activePermissionResourceId));
  addExcelPermissionField(form, snap.exists() && snap.data()?.clientePermiteExcel === true);
}

async function savePermissionForm(form, button) {
  if (!activePermissionResourceId) throw new Error('Item não identificado. Feche e abra a configuração novamente.');
  const data = new FormData(form);
  const enabled = data.get('clientePodeEditar') === 'on';
  const pdf = data.get('clientePermitePdf') === 'on';
  const word = data.get('clientePermiteWord') === 'on';
  const excel = data.get('clientePermiteExcel') === 'on';
  const link = data.get('clientePermiteLink') === 'on';
  if (enabled && !pdf && !word && !excel && !link) throw new Error('Escolha pelo menos PDF, Word, Excel ou Link para liberar este item.');

  const old = button?.textContent || 'Salvar permissão';
  if (button) { button.disabled = true; button.textContent = 'Salvando...'; }
  try {
    await updateDoc(doc(db, 'empresa_recursos', activePermissionResourceId), {
      clientePodeEditar: enabled,
      clientePermitePdf: enabled && pdf,
      clientePermiteWord: enabled && word,
      clientePermiteExcel: enabled && excel,
      clientePermiteLink: enabled && link,
      clienteInstrucoes: String(data.get('clienteInstrucoes') || '').trim(),
      permissaoClienteAtualizadaEm: serverTimestamp(),
      permissaoClienteAtualizadaPor: auth.currentUser?.uid || ''
    });
    toast('Permissão da empresa atualizada.');
    form.closest('.cliente-upload-modal-backdrop')?.remove();
    document.querySelectorAll('[data-cliente-upload-admin]').forEach(el => {
      delete el.dataset.clienteUploadAdmin;
      el.querySelector('.cliente-upload-admin-box')?.remove();
    });
    document.dispatchEvent(new Event('click'));
  } finally {
    if (button) { button.disabled = false; button.textContent = old; }
  }
}

async function enhancePermissionBox(box) {
  const parent = box.closest('.ecosystem-resource-item');
  const resourceId = parent?.querySelector('[data-delete-recurso]')?.dataset.deleteRecurso || '';
  if (!resourceId || box.dataset.excelEnhanced === VERSION) return;
  box.dataset.excelEnhanced = VERSION;
  const snap = await getDoc(doc(db, 'empresa_recursos', resourceId));
  if (!snap.exists() || snap.data()?.clientePermiteExcel !== true) return;
  const strong = box.querySelector('strong');
  if (strong && !/excel/i.test(strong.textContent || '')) strong.textContent = `${strong.textContent || 'Liberado'}${/Liberado:/i.test(strong.textContent || '') ? ', Excel' : ' • Excel'}`;
}

async function enhanceClientCard(card) {
  const resourceId = card.dataset.clienteUploadCard || '';
  if (!resourceId || card.dataset.excelEnhanced === VERSION) return;
  card.dataset.excelEnhanced = VERSION;
  const snap = await getDoc(doc(db, 'empresa_recursos', resourceId));
  if (!snap.exists()) return;
  const item = { id: snap.id, ...snap.data() };

  if (item.clientePermiteExcel === true) {
    const badges = card.querySelector('.cliente-upload-badges');
    if (badges && !badges.querySelector('[data-excel-badge]')) {
      badges.insertAdjacentHTML('beforeend', '<span class="cliente-upload-badge" data-excel-badge>Excel</span>');
    }
    const form = card.querySelector('.cliente-upload-form');
    const grid = form?.querySelector('.form-grid-2');
    if (grid && !form.querySelector('[name="clienteExcel"]')) {
      grid.insertAdjacentHTML('beforeend', excelInputHTML('clienteExcel', 'Enviar Excel'));
    }
  }

  if (item.clienteExcelUrl) {
    let submission = card.querySelector('.cliente-upload-submission');
    if (!submission) {
      submission = document.createElement('div');
      submission.className = 'cliente-upload-submission';
      card.querySelector('.cliente-upload-form')?.insertAdjacentElement('beforebegin', submission);
    }
    let actions = submission.querySelector('.file-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'file-actions';
      submission.appendChild(actions);
    }
    if (!actions.querySelector('[data-client-excel-download]')) {
      const link = document.createElement('a');
      link.className = 'btn btn-small btn-primary';
      link.dataset.clientExcelDownload = '1';
      link.href = item.clienteExcelUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.download = item.clienteExcelNome || 'planilha.xlsx';
      link.textContent = 'Baixar Excel enviado';
      actions.appendChild(link);
    }
  }
}

async function saveClientSubmission(form, button) {
  const resourceId = form.dataset.clienteUploadForm || '';
  if (!resourceId) throw new Error('Item não identificado.');
  const snap = await getDoc(doc(db, 'empresa_recursos', resourceId));
  if (!snap.exists()) throw new Error('Item não encontrado.');
  const item = { id: snap.id, ...snap.data() };
  const perfil = await currentPerfil();
  if (perfil?.tipo !== 'cliente' || perfil?.ativo !== true || perfil.empresaId !== item.empresaId) throw new Error('Acesso não autorizado para este item.');

  const data = new FormData(form);
  const pdfFile = data.get('clientePdf');
  const wordFile = data.get('clienteWord');
  const excelFile = data.get('clienteExcel');
  const linkUrl = normalizeUrl(data.get('clienteLink'));
  const payload = {};
  const stamp = Date.now();
  const base = `empresas/${item.empresaId}/cliente-uploads/${item.id}/${auth.currentUser.uid}`;

  const old = button?.textContent || 'Salvar envio';
  if (button) { button.disabled = true; button.textContent = 'Enviando...'; }
  try {
    if (pdfFile?.name) {
      if (item.clientePermitePdf !== true) throw new Error('Este item não está liberado para PDF.');
      const file = await uploadFile(`${base}/pdf/${stamp}-${safeFileName(pdfFile.name)}`, pdfFile);
      Object.assign(payload, { clientePdfUrl:file.url, clientePdfNome:file.nome, clientePdfStoragePath:file.path });
    }
    if (wordFile?.name) {
      if (item.clientePermiteWord !== true) throw new Error('Este item não está liberado para Word.');
      const file = await uploadFile(`${base}/word/${stamp}-${safeFileName(wordFile.name)}`, wordFile);
      Object.assign(payload, { clienteWordUrl:file.url, clienteWordNome:file.nome, clienteWordStoragePath:file.path });
    }
    if (excelFile?.name) {
      if (item.clientePermiteExcel !== true) throw new Error('Este item não está liberado para Excel.');
      const file = await uploadFile(`${base}/excel/${stamp}-${safeFileName(excelFile.name)}`, excelFile);
      Object.assign(payload, { clienteExcelUrl:file.url, clienteExcelNome:file.nome, clienteExcelStoragePath:file.path });
    }
    if (linkUrl) {
      if (item.clientePermiteLink !== true) throw new Error('Este item não está liberado para link.');
      payload.clienteLinkUrl = linkUrl;
    }
    if (!Object.keys(payload).length) throw new Error('Escolha um arquivo ou informe um link para enviar.');

    Object.assign(payload, {
      clienteStatus: 'enviado',
      clienteAtualizadoEm: serverTimestamp(),
      clienteAtualizadoPor: auth.currentUser.uid
    });
    await updateDoc(doc(db, 'empresa_recursos', resourceId), payload);
    toast('Arquivo da empresa enviado com sucesso.');
    document.getElementById('clienteUploadsLiberadosPanel')?.remove();
    document.dispatchEvent(new Event('click'));
  } finally {
    if (button) { button.disabled = false; button.textContent = old; }
  }
}

async function deleteResource(resourceId) {
  const snap = await getDoc(doc(db, 'empresa_recursos', resourceId));
  if (!snap.exists()) return toast('Item não encontrado.', true);
  const item = { id:snap.id, ...snap.data() };
  if (!confirm(`Excluir definitivamente o item “${item.titulo || 'sem título'}”?`)) return;
  await Promise.all([
    removeStorage(item.pdfStoragePath),
    removeStorage(item.wordStoragePath),
    removeStorage(item.excelStoragePath),
    removeStorage(item.clientePdfStoragePath),
    removeStorage(item.clienteWordStoragePath),
    removeStorage(item.clienteExcelStoragePath)
  ]);
  await deleteDoc(doc(db, 'empresa_recursos', resourceId));
  toast('Item excluído.');
  refreshAdminEcosystem();
}

async function deleteFolder(pastaId) {
  const pastaSnap = await getDoc(doc(db, 'empresa_pastas', pastaId));
  if (!pastaSnap.exists()) return toast('Pasta não encontrada.', true);
  const recursosSnap = await getDocs(query(collection(db, 'empresa_recursos'), where('pastaId', '==', pastaId)));
  const recursos = recursosSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  const nome = pastaSnap.data()?.nome || 'sem nome';
  if (!confirm(`Excluir a pasta “${nome}” e ${recursos.length} item(ns) dentro dela?`)) return;
  for (const item of recursos) {
    await Promise.all([
      removeStorage(item.pdfStoragePath), removeStorage(item.wordStoragePath), removeStorage(item.excelStoragePath),
      removeStorage(item.clientePdfStoragePath), removeStorage(item.clienteWordStoragePath), removeStorage(item.clienteExcelStoragePath)
    ]);
    await deleteDoc(doc(db, 'empresa_recursos', item.id));
  }
  await deleteDoc(doc(db, 'empresa_pastas', pastaId));
  toast('Pasta excluída.');
  refreshAdminEcosystem();
}

function normalizeVisibleCopy() {
  const replacements = [
    ['PDF, Word ou links', 'PDF, Word, Excel ou links'],
    ['PDF, Word e links', 'PDF, Word, Excel e links'],
    ['PDF, Word ou Link', 'PDF, Word, Excel ou Link']
  ];
  document.querySelectorAll('p,small,span').forEach(el => {
    if (el.children.length) return;
    let value = el.textContent || '';
    for (const [from,to] of replacements) value = value.replace(from,to);
    if (value !== el.textContent) el.textContent = value;
  });
}

async function enhanceAll() {
  if (enhancing) return;
  enhancing = true;
  try {
    enhanceAdminForms();
    normalizeVisibleCopy();
    await enhancePermissionModal();
    const cards = Array.from(document.querySelectorAll('.ecosystem-resource-item'));
    for (const card of cards) await enhanceAdminResourceCard(card).catch(() => null);
    const boxes = Array.from(document.querySelectorAll('.cliente-upload-admin-box'));
    for (const box of boxes) await enhancePermissionBox(box).catch(() => null);
    const clientCards = Array.from(document.querySelectorAll('.cliente-upload-card[data-cliente-upload-card]'));
    for (const card of clientCards) await enhanceClientCard(card).catch(() => null);
  } finally {
    enhancing = false;
  }
}

document.addEventListener('click', event => {
  const permission = event.target.closest?.('[data-client-upload-permission]');
  if (permission) {
    activePermissionResourceId = permission.dataset.clientUploadPermission || '';
    setTimeout(enhanceAll, 30);
  }

  const delResource = event.target.closest?.('[data-delete-recurso]');
  if (delResource) {
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    deleteResource(delResource.dataset.deleteRecurso).catch(error => toast(error?.message || 'Erro ao excluir item.', true));
    return;
  }

  const delFolder = event.target.closest?.('[data-delete-pasta]');
  if (delFolder) {
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    deleteFolder(delFolder.dataset.deletePasta).catch(error => toast(error?.message || 'Erro ao excluir pasta.', true));
  }
}, true);

document.addEventListener('submit', event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.matches('form[data-empresa-recurso-form]')) {
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    saveAdminResource(form, event.submitter).catch(error => toast(error?.message || 'Erro ao salvar item.', true));
    return;
  }

  if (form.id === 'clientUploadPermissionForm') {
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    savePermissionForm(form, event.submitter).catch(error => toast(error?.message || 'Erro ao salvar permissão.', true));
    return;
  }

  if (form.matches('.cliente-upload-form[data-cliente-upload-form]')) {
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    saveClientSubmission(form, event.submitter).catch(error => toast(error?.message || 'Erro ao enviar arquivo.', true));
  }
}, true);

new MutationObserver(() => requestAnimationFrame(enhanceAll)).observe(document.body, { childList:true, subtree:true });
window.addEventListener('load', enhanceAll);
setInterval(enhanceAll, 2600);

enhanceAll();
console.info(`Excellence System • documentos com Excel ${VERSION} carregados.`);
