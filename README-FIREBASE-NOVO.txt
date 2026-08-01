EXCELLENCE SYSTEM® - FIREBASE NOVO

Projeto Firebase conectado nesta versão:

projectId: excellence-system
authDomain: excellence-system.firebaseapp.com
storageBucket: excellence-system.firebasestorage.app

PASSOS OBRIGATÓRIOS NO FIREBASE NOVO

1. Ativar Authentication
- Firebase > Authentication > Sign-in method
- Ativar Email/Password

2. Criar Firestore Database
- Firebase > Firestore Database
- Criar banco de dados
- Pode criar em modo produção
- Depois publicar as regras do arquivo firestore-rules.txt

3. Criar Storage
- Firebase > Storage
- Criar bucket
- Depois publicar as regras do arquivo storage-rules.txt

4. Criar o admin inicial
- Firebase > Authentication > Users > Add user
- Criar o e-mail e senha do admin
- Copiar o UID gerado

5. Criar o perfil do admin no Firestore
Coleção: usuarios
Documento: UID_DO_ADMIN

Campos:
nome: string
email: string
tipo: string = admin
empresaId: string vazio
ativo: boolean = true
criadoEm: timestamp

Exemplo:
nome: Eliel do Carmo
email: seu-email@email.com
tipo: admin
empresaId: 
ativo: true
criadoEm: timestamp atual

6. Hospedagem no Firebase Hosting
Se usar Firebase CLI, entre na pasta dos arquivos e rode:

firebase login
firebase init hosting

Respostas recomendadas:
- Use an existing project
- excellence-system
- Public directory: .
- Configure as single-page app: Yes
- Overwrite index.html: No

Depois publique:

firebase deploy --only hosting --project excellence-system

7. Publicar regras pelo terminal, se quiser

firebase deploy --only firestore:rules,storage --project excellence-system

IMPORTANTE
Esta versão não migra nenhum dado antigo. Ela está pronta para começar do zero no Firebase novo.


AGENDA ADMINISTRATIVA (V38)
Para a aba Agenda funcionar, configure a pasta functions conforme functions/README-AGENDA-FUNCTIONS.txt e publique com firebase deploy --only functions --project excellence-system.
