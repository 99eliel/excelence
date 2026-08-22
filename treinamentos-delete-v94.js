import { db, storage } from './firebase-config.js';
import {
  collection, query, where, getDocs, getDoc, doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { ref, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const VERSION = '20260821-94';

function toast(message, type = 'ok') {
  document.querySelector('[data-training-delete-toast]')?.remove();
  const el = document.createElement('div');
  el.dataset.trainingDeleteToast = '1';
  el.textContent = message;
  el.style.cssText = `position:fixed;right:18px;bottom:18px;z-index:100000;padding:12px 15px;border-radius:14px;font-weight:850;color:#fff;max-width:460px;box-shadow:0 18px 42px rgba(5,36,55,.25);background:${type === 'err' ? '#9f2e2e' : '#073F5A'}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

async function docsByTraining(collectionName, trainingId) {
  const snap = await getDocs(query(
    collection(db, collectionName),
    where('treinamentoId', '==', trainingId)
  ));
  return snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

async function removeEvidence(event) {
  if (!event?.evidenciaPath) return;
  try {
    await deleteObject(ref(storage, event.evidenciaPath));
  } catch (error) {
    // Arquivo já ausente não deve impedir a limpeza dos dados do treinamento.
    console.warn('Evidência não removida do Storage:', event.evidenciaPath, error);
  }
}

async function deleteTrainingCompletely(trainingId, button) {
  const trainingRef = doc(db, 'empresa_treinamentos', trainingId);
  const trainingSnap = await getDoc(trainingRef);
  if (!trainingSnap.exists()) {
    toast('Este treinamento já não existe.', 'err');
    window.__EXCELLENCE_TRAINING_OPEN?.();
    return;
  }

  const training = trainingSnap.data();
  const title = String(training.titulo || 'Treinamento').trim();
  const confirmed = confirm(
    `Excluir definitivamente “${title}”?\n\n` +
    `Também serão removidos:\n` +
    `• público e matriz deste treinamento\n` +
    `• realizações registradas\n` +
    `• avaliações de eficácia\n` +
    `• evidências anexadas\n` +
    `• PIDs automáticos vinculados ao treinamento\n\n` +
    `Essa ação não pode ser desfeita.`
  );
  if (!confirmed) return;

  const originalText = button?.textContent || 'Excluir';
  if (button) {
    button.disabled = true;
    button.textContent = 'Excluindo...';
  }

  try {
    const [matrixRows, events, pids] = await Promise.all([
      docsByTraining('empresa_matriz_competencias', trainingId),
      docsByTraining('empresa_treinamento_eventos', trainingId),
      docsByTraining('empresa_pids', trainingId)
    ]);

    await Promise.all(events.map(removeEvidence));

    await Promise.all([
      ...matrixRows.map(item => deleteDoc(doc(db, 'empresa_matriz_competencias', item.id))),
      ...events.map(item => deleteDoc(doc(db, 'empresa_treinamento_eventos', item.id))),
      ...pids.filter(item => item.autoGerado === true || item.origemTipo === 'treinamento')
        .map(item => deleteDoc(doc(db, 'empresa_pids', item.id)))
    ]);

    await deleteDoc(trainingRef);

    toast(`Treinamento “${title}” excluído completamente.`);
    await window.__EXCELLENCE_TRAINING_OPEN?.();
  } catch (error) {
    console.error('Falha ao excluir treinamento:', error);
    toast('Não foi possível excluir o treinamento. Verifique as permissões e tente novamente.', 'err');
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-delete-plan]');
  if (!button || !button.closest('.tr-root')) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const trainingId = button.dataset.deletePlan;
  if (!trainingId || button.disabled) return;
  deleteTrainingCompletely(trainingId, button);
}, true);

console.info(`Excellence System® exclusão completa de Treinamentos ${VERSION} carregada.`);
