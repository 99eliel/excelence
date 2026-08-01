PROJETO EXCELLENCE SYSTEM® - VERSÃO 15
Sistema Integrado de Gestão para Indústrias do Vestuário
Autor: Márcia Pedro
Desenvolvimento Técnico: MPEDRO Consultoria e Treinamentos
Versão do pacote: 20260707-15

============================================================
1. O QUE ESTA VERSÃO JÁ FAZ
============================================================

Esta versão está conectada ao Firebase informado e já segue a estrutura final da planilha "ESTRUTURA PARA APLICATIVO.xlsx".

Projeto Firebase: excellence-system
Auth Domain: excellence-system.firebaseapp.com
Storage Bucket: excellence-system.firebasestorage.app

Funções incluídas:

- Login por e-mail e senha.
- Primeiro admin criado manualmente no Firebase.
- Admin cadastra empresas e já cria o acesso principal do responsável automaticamente.
- Admin cria usuários clientes adicionais e novos administradores automaticamente.
- Cliente acessa a estrutura da ISO 9001:2015.
- Estrutura ISO atualizada com 4.0 a 10.0, conforme planilha.
- Somente 4.1 e 4.2 possuem preenchimento manual pela empresa.
- 4.1 possui formulário específico de SWOT: pontos fortes, fraquezas, oportunidades e ameaças.
- 4.2 possui formulário específico de partes interessadas: organização, clientes, sócios, colaboradores, fornecedores, sociedade e parceiros.
- As demais etapas ficam como áreas de consulta dos materiais e arquivos enviados pela administração.
- Admin escolhe a empresa e visualiza as respostas de 4.1 e 4.2.
- Admin adiciona materiais de apoio por requisito ISO.
- Material de apoio pode ser padrão para todas as empresas ou específico para uma empresa.
- Cliente preenche somente as respostas manuais de 4.1 e 4.2.
- Admin envia arquivos para uma empresa específica dentro de cada etapa ISO, como documentos corrigidos, concluídos ou orientações personalizadas.
- Arquivos novos ficam centralizados na coleção arquivos, com categoria material_apoio ou consultoria.
- Admin muda status da etapa: pendente, em análise, ajustar ou concluído.
- Admin deixa comentário para a empresa.
- Tela Quem Somos com foto da autora e LinkedIn.
- Sistema PWA instalável.
- Botão de instalação para Android.
- Instruções de instalação para iPhone/iPad.
- Identidade visual ajustada para MP Consultoria.
- Service Worker com versionamento e atualização automática.
- Convite automático de acesso: se o Authentication já tiver o e-mail, o sistema cria o vínculo no próximo login, sem mexer manualmente no Firestore.

============================================================
2. ATIVAR SERVIÇOS NO FIREBASE
============================================================

No Firebase, ative:

1. Authentication
   - Sign-in method
   - Ative Email/Password

2. Firestore Database
   - Criar banco de dados
   - Pode iniciar em modo produção

3. Storage
   - Criar Storage
   - Usado para guardar materiais de apoio e arquivos enviados pela administração para as empresas

============================================================
3. CRIAR O PRIMEIRO ADMIN MANUALMENTE
============================================================

PASSO 1 - Criar usuário no Authentication

1. Firebase > Authentication > Users
2. Clique em Add user
3. Cadastre o e-mail do admin
4. Cadastre uma senha provisória
5. Depois de criar, copie o UID do usuário

PASSO 2 - Criar documento do admin no Firestore

1. Vá em Firestore Database > Data
2. Clique em Start collection
3. Nome da coleção: usuarios
4. Em Document ID, cole o UID do admin criado no Authentication
5. Crie estes campos:

nome        string      Márcia Pedro
email       string      e-mail usado no Authentication
tipo        string      admin
empresaId   string      deixar vazio
ativo       boolean     true
criadoEm    timestamp   data/hora atual

Atenção:
O Document ID precisa ser exatamente o UID do usuário no Authentication.

============================================================
4. REGRAS DO FIRESTORE E STORAGE
============================================================

Copie o conteúdo dos arquivos abaixo para o Firebase:

firestore.rules -> Firebase > Firestore Database > Rules
storage.rules   -> Firebase > Storage > Rules

Depois clique em Publish nos dois locais.

============================================================
5. COLEÇÕES QUE O SISTEMA USA
============================================================

usuarios
empresas
respostas_iso
arquivos
convites_acesso

Coleções antigas mantidas por compatibilidade:
materiais_apoio
anexos_empresa

Você só precisa criar manualmente a coleção usuarios para o primeiro admin.
Depois o próprio sistema cria os documentos conforme for usado.

============================================================
6. ESTRUTURA FINAL DA ISO NO SISTEMA
============================================================

4.0 Contexto da Organização
  4.1 Entendendo a Organização e seu Contexto - preenchimento manual SWOT
  4.2 Entendendo as necessidades e expectativas das partes interessadas - preenchimento manual
  4.3 Determinando o escopo do sistema da gestão da qualidade
  4.4 Sistema da gestão da Qualidade e seus processos

5.0 Liderança
  5.1 Liderança e Comprometimento
  5.2 Política
  5.3 Papéis, responsabilidades e autoridades

6.0 Planejamento
  6.1 Ações para abordar riscos e Oportunidades
  6.2 Objetivos da qualidade e planejamento para alcançá-los
  6.3 Planejamentos e Mudanças

7.0 Apoio
  7.1 Recursos
  7.2 Competência
  7.3 Conscientização
  7.4 Comunicação
  7.5 Informação Documentada

8.0 Operação
  8.1 Planejamento e Controle Operacionais
  8.2 Requisitos para Produtos e Serviços
  8.3 Projeto e desenvolvimento de Produtos e Serviços
  8.4 Controle de Processos, produtos e serviços providos externamente
  8.5 Produção e Provisão de serviço
  8.6 Liberação de produtos e serviços
  8.7 Controle de Saídas não conformes

9.0 Avaliação de Desempenho
  9.1 Monitoramento, medição, análise e avaliação
  9.2 Auditoria Interna
  9.3 Análise Crítica pela Direção

10.0 Melhoria
  10.1 Generalidades

============================================================
7. COMO O CLIENTE USA
============================================================

1. Login com e-mail e senha liberados pelo admin.
2. Abre a estrutura ISO.
3. Preenche manualmente somente 4.1 e 4.2.
4. Em qualquer etapa, consulta materiais de apoio.
5. Visualiza os materiais e arquivos disponibilizados pela administração em cada etapa.
6. Quando a administração marca uma etapa como concluída, o formulário de perguntas fica oculto para o cliente.
7. Aguarda análise da administração.

============================================================
8. COMO O ADMIN USA
============================================================

1. Login como admin.
2. Cadastra empresas pela aba Empresas, preenchendo também o responsável, e-mail de login e senha provisória.
3. O sistema cria automaticamente a empresa, o convite de acesso e o usuário cliente principal vinculado a ela.
4. Para usuários extras da mesma empresa, use a aba Usuários. Se o e-mail já existir no Authentication, o sistema deixa um convite automático e vincula o perfil quando ele logar.
5. Cadastra materiais de apoio por requisito ISO.
6. Entra em ISO por empresa.
7. Escolhe uma empresa.
8. Abre a seção e o requisito ISO.
9. Visualiza os documentos enviados pela empresa.
10. Envia arquivos da consultoria para aquela empresa, quando necessário.
9. Visualiza respostas, anexos e documentos esperados conforme a planilha.
10. Define status e comentário.


============================================================
9. INSTALAÇÃO COMO APP
============================================================

ANDROID:
- Na tela inicial/login aparece o botão "Instalar app".
- Se o navegador permitir, o botão abre a instalação automática do PWA.
- Caso o botão automático não apareça, o usuário pode usar o menu do Chrome e escolher "Instalar app" ou "Adicionar à tela inicial".

IOS / IPHONE / IPAD:
- O iOS não permite instalação automática por botão igual ao Android.
- O sistema mostra as instruções dentro do botão "Instalar no iPhone/iPad".
- O cliente deve abrir no Safari, tocar em Compartilhar e escolher "Adicionar à Tela de Início".

VERSIONAMENTO:
- Atualize sempre os arquivos index.html, app.js, styles.css, sw.js, manifest.json e version.json.
- A versão atual é 20260707-15.
- O arquivo version.json ajuda o sistema a perceber nova versão e forçar atualização do cache.

============================================================
10. PUBLICAR NO GITHUB PAGES
============================================================

1. Envie todos os arquivos deste pacote para o repositório.
2. Vá em Settings > Pages.
3. Em Source, selecione Deploy from a branch.
4. Escolha a branch main e a pasta root.
5. Salve.

Para garantir atualização no navegador, esta versão usa:

APP_VERSION: 20260707-24
CACHE_NAME: excellence-system-20260707-24

============================================================


IMPORTANTE - ACESSO AUTOMÁTICO DE NOVOS USUÁRIOS
Subir os arquivos no GitHub NÃO publica as regras do Firebase.
Para os usuários criados pelo painel entrarem corretamente, copie o conteúdo de firestore.rules em:
Firebase Console > Firestore Database > Rules > Publish.

A coleção convites_acesso é usada pelo sistema para ativar automaticamente perfis quando o e-mail já existe no Authentication ou quando o perfil ainda não foi criado no Firestore.

ATUALIZAÇÃO V13 - GERENCIAMENTO DE USUÁRIOS
- A aba Usuários agora permite editar nome, tipo, empresa vinculada e status.
- É possível bloquear/ativar usuários sem apagar dados.
- É possível excluir o acesso do sistema, removendo o perfil em usuarios e o convite em convites_acesso.
- É possível enviar e-mail de redefinição de senha ao usuário.
- Observação importante: por segurança do Firebase, um site estático no GitHub Pages não consegue apagar definitivamente outro usuário do Firebase Authentication nem definir manualmente uma nova senha para ele. Para isso, use o Console Firebase ou uma Cloud Function com Admin SDK. O sistema bloqueia o acesso removendo/desativando o perfil no Firestore.


ATUALIZAÇÃO V16 - FLUXO POR EMPRESA
-------------------------------------
A gestão administrativa agora começa pela aba Empresas.
O admin deve abrir a empresa desejada e, somente dentro dela, acessar a estrutura ISO, respostas, arquivos enviados para a empresa, usuários vinculados, status e comentários.
O seletor superior de empresa na análise ISO foi removido do fluxo principal para evitar confusão.

REGRAS EM TXT
--------------
Além dos arquivos técnicos firestore.rules e storage.rules, esta versão também acompanha:
- firestore-rules.txt
- storage-rules.txt
Use estes arquivos de texto para copiar e colar as regras no Firebase com mais facilidade.


ATUALIZAÇÃO V18
- Adicionada função de editar empresa.
- Adicionada função de excluir empresa com confirmação.
- A exclusão remove empresa, usuários vinculados, respostas ISO, convites e registros de arquivos da empresa.
- Arquivos do Storage com caminho registrado também são removidos quando possível.
- As regras também seguem em firestore-rules.txt e storage-rules.txt.


ATUALIZAÇÃO V25 - ARQUIVOS EM PDF E WORD

Agora os arquivos enviados pela administração podem ter duas versões:
- PDF: usado para visualizar e baixar.
- Word: usado para baixar a versão editável.

Cada arquivo exibido no sistema pode mostrar as ações: Ver PDF, Baixar PDF e Baixar Word.
A versão PDF é obrigatória nos novos envios. A versão Word é opcional.
