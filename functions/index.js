const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const ical = require('node-ical');

admin.initializeApp();

const CALENDAR_ICS_URL = defineString('MARCIA_CALENDAR_ICS_URL');

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

exports.getAgendaMarcia = onCall({
  region: 'southamerica-east1',
  timeoutSeconds: 20,
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

    return {
      days,
      total: events.length,
      events,
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Erro ao ler agenda iCal:', error);
    throw new HttpsError('internal', 'Não foi possível carregar a agenda agora.');
  }
});
