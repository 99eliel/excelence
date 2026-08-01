AGENDA DA MÁRCIA - CONFIGURAÇÃO SEGURA

1. Entre na pasta functions:
   cd functions

2. Crie um arquivo chamado .env, baseado no .env.example:
   MARCIA_CALENDAR_ICS_URL=https://calendar.google.com/calendar/ical/SEU_LINK_PRIVADO/basic.ics

3. Volte para a raiz do sistema:
   cd ..

4. Publique a função:
   firebase deploy --only functions --project excellence-system

5. Publique o site, se ainda não publicou a versão 38:
   firebase deploy --only hosting --project excellence-system

Observação: o link iCal NÃO fica no app.js nem no Hosting. Ele fica somente na configuração da Cloud Function. A aba Agenda só aparece para admin e a função valida o perfil admin em usuarios/UID.
