const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function inviteIdFromEmail(email = '') {
  return normalizeEmail(email).replace(/\//g, '_');
}

async function requireActiveAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login para continuar.');
  const snap = await admin.firestore().doc(`usuarios/${uid}`).get();
  const perfil = snap.exists ? snap.data() : null;
  if (!perfil || perfil.ativo !== true || perfil.tipo !== 'admin') {
    throw new HttpsError('permission-denied', 'Apenas administradores ativos podem cadastrar usuários.');
  }
  return perfil;
}

exports.cadastrarUsuarioAdmin = onCall({
  region: 'southamerica-east1',
  timeoutSeconds: 30,
  memory: '256MiB'
}, async (request) => {
  await requireActiveAdmin(request.auth?.uid);

  const nome = String(request.data?.nome || '').trim();
  const email = normalizeEmail(request.data?.email);
  const senha = String(request.data?.senha || '');
  const tipo = String(request.data?.tipo || 'cliente').trim().toLowerCase();
  const empresaId = tipo === 'cliente' ? String(request.data?.empresaId || '').trim() : '';

  if (!nome) throw new HttpsError('invalid-argument', 'Informe o nome do usuário.');
  if (!email || !email.includes('@')) throw new HttpsError('invalid-argument', 'Informe um e-mail válido.');
  if (senha.length < 6) throw new HttpsError('invalid-argument', 'A senha precisa ter pelo menos 6 caracteres.');
  if (senha.length > 128) throw new HttpsError('invalid-argument', 'A senha é muito longa.');
  if (!['cliente', 'admin'].includes(tipo)) throw new HttpsError('invalid-argument', 'Tipo de usuário inválido.');
  if (tipo === 'cliente' && !empresaId) throw new HttpsError('invalid-argument', 'Selecione a empresa do cliente.');

  let empresaNome = '';
  if (empresaId) {
    const empresaSnap = await admin.firestore().doc(`empresas/${empresaId}`).get();
    if (!empresaSnap.exists) throw new HttpsError('not-found', 'Empresa não encontrada.');
    empresaNome = String(empresaSnap.data()?.nome || '');
  }

  let authUser;
  let created = false;

  try {
    authUser = await admin.auth().getUserByEmail(email);
    authUser = await admin.auth().updateUser(authUser.uid, {
      email,
      password: senha,
      displayName: nome,
      disabled: false
    });
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') {
      console.error('Erro ao preparar usuário no Authentication:', error);
      if (error?.code === 'auth/invalid-email') throw new HttpsError('invalid-argument', 'Informe um e-mail válido.');
      if (error?.code === 'auth/invalid-password') throw new HttpsError('invalid-argument', 'A senha informada não é válida.');
      throw new HttpsError('internal', 'Não foi possível preparar a conta de acesso.');
    }

    try {
      authUser = await admin.auth().createUser({
        email,
        password: senha,
        displayName: nome,
        disabled: false
      });
      created = true;
    } catch (createError) {
      console.error('Erro ao criar usuário no Authentication:', createError);
      if (createError?.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'Este e-mail já possui um acesso. Tente salvar novamente.');
      }
      throw new HttpsError('internal', 'Não foi possível criar a conta de acesso.');
    }
  }

  const db = admin.firestore();
  const oldProfilesSnap = await db.collection('usuarios').where('email', '==', email).get();
  const oldProfiles = oldProfilesSnap.docs.filter(docSnap => docSnap.id !== authUser.uid);
  const existingProfile = oldProfilesSnap.docs.find(docSnap => docSnap.id === authUser.uid)?.data()
    || oldProfiles[0]?.data()
    || {};

  const conviteRef = db.doc(`convites_acesso/${inviteIdFromEmail(email)}`);
  const conviteSnap = await conviteRef.get();
  const convite = conviteSnap.exists ? conviteSnap.data() || {} : {};

  const perfil = {
    ...existingProfile,
    nome,
    email,
    tipo,
    empresaId,
    ativo: true,
    credencialDefinidaPeloAdmin: true,
    acessoPrincipal: existingProfile.acessoPrincipal === true || convite.acessoPrincipal === true,
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    atualizadoPor: request.auth.uid
  };

  if (Array.isArray(existingProfile.permissoes)) perfil.permissoes = existingProfile.permissoes;
  else if (Array.isArray(convite.permissoes)) perfil.permissoes = convite.permissoes;

  if (created && !existingProfile.criadoEm) {
    perfil.criadoEm = admin.firestore.FieldValue.serverTimestamp();
    perfil.criadoPor = request.auth.uid;
  }

  const batch = db.batch();
  const usuarioRef = db.doc(`usuarios/${authUser.uid}`);
  batch.set(usuarioRef, perfil, { merge: true });

  batch.set(conviteRef, {
    nome,
    email,
    tipo,
    empresaId,
    empresaNome,
    ativo: true,
    usado: true,
    usadoEm: admin.firestore.FieldValue.serverTimestamp(),
    vinculadoUid: authUser.uid,
    credencialDefinidaPeloAdmin: true,
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    atualizadoPor: request.auth.uid
  }, { merge: true });

  for (const oldProfile of oldProfiles) batch.delete(oldProfile.ref);
  await batch.commit();

  return {
    ok: true,
    created,
    userId: authUser.uid,
    email,
    readyToLogin: true
  };
});
