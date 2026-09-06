const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const ical = require('node-ical');

admin.initializeApp();

const CALENDAR_ICS_URL = defineString('MARCIA_CALENDAR_ICS_URL');
const AGENDA_CACHE_TTL_MS = 10 * 60 * 1000;
const agendaMemoryCache = new Map();

function cleanText(value = '') {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
}

function eventId(event, startDate) {
  return `${event.uid || event.summary || 'evento'}-${startDate.toISOString()}`
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 180);
}

function formatDayLabel(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  }).format(date);
}

function normalizeEvent(event, startDate, endDate) {
  return {
    id: eventId(event, startDate),
    title: cleanText(event.summary) || 'Compromisso sem título',
    description: cleanText(event.description),
    location: cleanText(event.location),
    start: startDate.toISOString(),
    end: endDate ? endDate.toISOString() : '',
    dayLabel: formatDayLabel(startDate)
  };
}

function eventDuration(event) {
  const start = event.start instanceof Date ? event.start : new Date(event.start);
  const end = event.end instanceof Date ? event.end : null;
  if (!end || Number.isNaN(end.getTime())) return 60 * 60 * 1000;
  return Math.max(end.getTime() - start.getTime(), 15 * 60 * 1000);
}

function expandEvent(event, rangeStart, rangeEnd) {
  const events = [];
  const duration = eventDuration(event);

  if (event.rrule && typeof event.rrule.between === 'function') {
    const dates = event.rrule.between(rangeStart, rangeEnd, true) || [];
    dates.forEach(date => {
      const start = new Date(date);
      const end = new Date(start.getTime() + duration);
      if (end >= rangeStart && start <= rangeEnd) events.push(normalizeEvent(event, start, end));
    });
    return events;
  }

  const start = event.start instanceof Date ? event.start : new Date(event.start);
  const end = event.end instanceof Date ? event.end : new Date(start.getTime() + duration);

  if (!Number.isNaN(start.getTime()) && end >= rangeStart && start <= rangeEnd) {
    events.push(normalizeEvent(event, start, end));
  }

  return events;
}

function buildCacheKey(days) {
  return `marcia_${Number(days) || 30}`;
}

function isFresh(updatedAtMs) {
  return updatedAtMs && (Date.now() - Number(updatedAtMs)) < AGENDA_CACHE_TTL_MS;
}

function publicAgendaPayload(data = {}, cacheSource = 'cache') {
  return {
    days: Number(data.days || 30),
    total: Number(data.total || (Array.isArray(data.events) ? data.events.length : 0)),
    events: Array.isArray(data.events) ? data.events : [],
    updatedAt: data.updatedAt || new Date(Number(data.updatedAtMs || Date.now())).toISOString(),
    cacheSource
  };
}

async function readAgendaCache(cacheKey) {
  const memory = agendaMemoryCache.get(cacheKey);
  if (memory && isFresh(memory.updatedAtMs)) {
    return { fresh: true, data: publicAgendaPayload(memory.data, 'memory') };
  }

  const snap = await admin.firestore().doc(`agenda_cache/${cacheKey}`).get();
  if (!snap.exists) return { fresh: false, data: null };

  const raw = snap.data() || {};
  const data = publicAgendaPayload(raw, 'firestore');
  const cacheData = { data, updatedAtMs: Number(raw.updatedAtMs || 0) };
  agendaMemoryCache.set(cacheKey, cacheData);

  return {
    fresh: isFresh(raw.updatedAtMs),
    data
  };
}

async function writeAgendaCache(cacheKey, payload) {
  const updatedAtMs = Date.now();
  const data = {
    ...payload,
    updatedAtMs,
    cacheUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  agendaMemoryCache.set(cacheKey, {
    data,
    updatedAtMs
  });

  await admin.firestore().doc(`agenda_cache/${cacheKey}`).set(data, { merge: true });
}

async function requireActiveAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login para continuar.');
  const snap = await admin.firestore().doc(`usuarios/${uid}`).get();
  const perfil = snap.exists ? snap.data() : null;
  if (!perfil || perfil.ativo !== true || perfil.tipo !== 'admin') {
    throw new HttpsError('permission-denied', 'Apenas administradores ativos podem executar esta ação.');
  }
  return perfil;
}

exports.alterarSenhaUsuario = onCall({
  region: 'southamerica-east1',
  timeoutSeconds: 30,
  memory: '256MiB'
}, async (request) => {
  await requireActiveAdmin(request.auth?.uid);

  const userId = String(request.data?.userId || '').trim();
  const novaSenha = String(request.data?.novaSenha || '');

  if (!userId) throw new HttpsError('invalid-argument', 'Usuário não informado.');
  if (novaSenha.length < 6) throw new HttpsError('invalid-argument', 'A nova senha precisa ter pelo menos 6 caracteres.');
  if (novaSenha.length > 128) throw new HttpsError('invalid-argument', 'A nova senha é muito longa.');

  const usuarioRef = admin.firestore().doc(`usuarios/${userId}`);
  const usuarioSnap = await usuarioRef.get();
  if (!usuarioSnap.exists) throw new HttpsError('not-found', 'Usuário não encontrado no sistema.');

  try {
    const authUser = await admin.auth().getUser(userId);
    await admin.auth().updateUser(authUser.uid, { password: novaSenha });
    await usuarioRef.set({
      senhaAtualizadaEm: admin.firestore.FieldValue.serverTimestamp(),
      senhaAtualizadaPor: request.auth.uid
    }, { merge: true });

    return {
      ok: true,
      userId: authUser.uid,
      email: authUser.email || usuarioSnap.data()?.email || ''
    };
  } catch (error) {
    console.error('Erro ao alterar senha do usuário:', error);
    if (error?.code === 'auth/user-not-found') {
      throw new HttpsError('not-found', 'Este usuário não existe no Firebase Authentication.');
    }
    throw new HttpsError('internal', 'Não foi possível alterar a senha agora.');
  }
});

exports.getAgendaMarcia = onCall({
  region: 'southamerica-east1',
  timeoutSeconds: 60,
  memory: '256MiB'
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Faça login para acessar a agenda.');
  }

  const perfilSnap = await admin.firestore().doc(`usuarios/${request.auth.uid}`).get();
  const perfil = perfilSnap.exists ? perfilSnap.data() : null;

  if (!perfil || perfil.ativo !== true || perfil.tipo !== 'admin') {
    throw new HttpsError('permission-denied', 'A agenda é exclusiva da administração.');
  }

  const calendarUrl = CALENDAR_ICS_URL.value();
  if (!calendarUrl || !/^https:\/\/calendar\.google\.com\/calendar\/ical\//.test(calendarUrl)) {
    throw new HttpsError('failed-precondition', 'Link iCal da agenda não configurado na função.');
  }

  const days = Math.min(Math.max(Number(request.data?.days || 30), 1), 90);
  const force = request.data?.force === true;
  const cacheKey = buildCacheKey(days);
  let cached = null;

  if (!force) {
    cached = await readAgendaCache(cacheKey);
    if (cached.fresh && cached.data) {
      return cached.data;
    }
  }

  const rangeStart = new Date();
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart.getTime() + days * 24 * 60 * 60 * 1000);

  try {
    const calendar = await ical.async.fromURL(calendarUrl);
    const events = Object.values(calendar)
      .filter(item => item && item.type === 'VEVENT')
      .flatMap(item => expandEvent(item, rangeStart, rangeEnd))
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, 120);

    const payload = {
      days,
      total: events.length,
      events,
      updatedAt: new Date().toISOString(),
      cacheSource: 'live'
    };

    await writeAgendaCache(cacheKey, payload);
    return payload;
  } catch (error) {
    console.error('Erro ao ler agenda iCal:', error);

    const fallback = cached?.data || (await readAgendaCache(cacheKey)).data;
    if (fallback) {
      return {
        ...fallback,
        stale: true,
        cacheSource: 'stale'
      };
    }

    throw new HttpsError('internal', 'Não foi possível carregar a agenda agora.');
  }
});
