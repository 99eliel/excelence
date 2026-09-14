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

function authHttpsError(error, action = 'preparar') {
  const code = String(error?.code || '');
  console.error(`Erro ao ${action} usuário no Authentication:`, error);

  if (code.includes('invalid-email')) {
    return new HttpsError('invalid-argument', 'Informe um e-mail válido.');
  }
  if (code.includes('password')) {
    return new HttpsError('invalid-argument', 'A senha não atende aos requisitos do Firebase Authentication. Use pelo menos 6 caracteres e tente novamente.');
  }
  if (code.includes('email-already-exists')) {
    return new HttpsError('already-exists', 'Este e-mail já existe no Authentication. Tente salvar novamente para atualizar a senha e o perfil.');
  }
  if (code.includes('insufficient-permission') || code.includes('permission-denied')) {
    return new HttpsError('failed-precondition', 'A Cloud Function não tem permissão para administrar usuários do Firebase Authentication.');
  }
  return new HttpsError('internal', `Não foi possível ${action} a conta de acesso.`);
}

async function optionalInvite(db, email) {
  try {
    const ref = db.doc(`convites_acesso/${inviteIdFromEmail(email)}`);
    const snap = await ref.get();
    return snap.exists ? { ref, data: snap.data() || {} } : { ref, data: null };
  } catch (error) {
    console.warn('Convite antigo não pôde ser consultado; cadastro seguirá sem ele:', error);
    return { ref: null, data: null };
  }
}

async function cleanupLegacyRecords(db, email, uid, inviteRef) {
  const jobs = [];

  if (inviteRef) {
    jobs.push(inviteRef.delete().catch(error => {
      console.warn('Convite antigo não removido após cadastro direto:', error);
    }));
  }

  jobs.push((async () => {
    try {
      const snap = await db.collection('usuarios').where('email', '==', email).get();
      const duplicates = snap.docs.filter(docSnap => docSnap.id !== uid);
      await Promise.all(duplicates.map(docSnap => docSnap.ref.delete().catch(error => {
        console.warn('Perfil antigo duplicado não removido:', docSnap.id, error);
      })));
    } catch (error) {
      console.warn('Limpeza de perfis antigos não executada:', error);
    }
  })());

  await Promise.allSettled(jobs);
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

  const db = admin.firestore();
  let empresaNome = '';
  if (empresaId) {
    const empresaSnap = await db.doc(`empresas/${empresaId}`).get();
    if (!empresaSnap.exists) throw new HttpsError('not-found', 'Empresa não encontrada.');
    empresaNome = String(empresaSnap.data()?.nome || '');
  }

  let authUser;
  let created = false;

  try {
    authUser = await admin.auth().getUserByEmail(email);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw authHttpsError(error, 'localizar');
  }

  if (authUser) {
    try {
      authUser = await admin.auth().updateUser(authUser.uid, {
        password: senha,
        displayName: nome,
        disabled: false
      });
    } catch (error) {
      throw authHttpsError(error, 'atualizar');
    }
  } else {
    try {
      authUser = await admin.auth().createUser({
        email,
        password: senha,
        displayName: nome,
        disabled: false
      });
      created = true;
    } catch (error) {
      if (error?.code === 'auth/email-already-exists') {
        try {
          authUser = await admin.auth().getUserByEmail(email);
          authUser = await admin.auth().updateUser(authUser.uid, {
            password: senha,
            displayName: nome,
            disabled: false
          });
          created = false;
        } catch (retryError) {
          throw authHttpsError(retryError, 'atualizar');
        }
      } else {
        throw authHttpsError(error, 'criar');
      }
    }
  }

  if (!authUser?.uid) {
    throw new HttpsError('internal', 'O Firebase não retornou o usuário criado.');
  }

  const usuarioRef = db.doc(`usuarios/${authUser.uid}`);
  let existingProfile = {};
  try {
    const existingSnap = await usuarioRef.get();
    existingProfile = existingSnap.exists ? existingSnap.data() || {} : {};
  } catch (error) {
    console.warn('Perfil atual não pôde ser lido; será recriado:', error);
  }

  const invite = await optionalInvite(db, email);
  const inviteData = invite.data || {};

  const perfil = {
    ...existingProfile,
    nome,
    email,
    tipo,
    empresaId,
    empresaNome,
    ativo: true,
    credencialDefinidaPeloAdmin: true,
    acessoPrincipal: existingProfile.acessoPrincipal === true || inviteData.acessoPrincipal === true,
    prontoParaLogin: true,
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    atualizadoPor: request.auth.uid
  };

  if (Array.isArray(existingProfile.permissoes)) perfil.permissoes = existingProfile.permissoes;
  else if (Array.isArray(inviteData.permissoes)) perfil.permissoes = inviteData.permissoes;

  if (!existingProfile.criadoEm) {
    perfil.criadoEm = admin.firestore.FieldValue.serverTimestamp();
    perfil.criadoPor = request.auth.uid;
  }

  try {
    await usuarioRef.set(perfil, { merge: true });
  } catch (error) {
    console.error('Erro ao gravar perfil do usuário:', error);
    if (created) {
      await admin.auth().deleteUser(authUser.uid).catch(rollbackError => {
        console.error('Falha ao desfazer usuário criado após erro de perfil:', rollbackError);
      });
    }
    throw new HttpsError('internal', 'A conta não foi concluída no sistema. Nenhum acesso novo foi deixado pela metade.');
  }

  await cleanupLegacyRecords(db, email, authUser.uid, invite.ref);

  return {
    ok: true,
    created,
    userId: authUser.uid,
    email,
    empresaId,
    readyToLogin: true
  };
});
