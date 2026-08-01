from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "app.js"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Trecho não encontrado: {label}")
    return text.replace(old, new, 1)


s = APP.read_text(encoding="utf-8")

s = replace_once(
    s,
    """function fileActionsHTML(file, options = {}) {
  const pdfUrl = file.pdfUrl || file.arquivoUrl || '';
  const wordUrl = file.wordUrl || '';
  const pdfNome = file.pdfNome || file.arquivoNome || 'documento.pdf';
  const wordNome = file.wordNome || 'documento-word.docx';
  const titulo = file.titulo || pdfNome || 'Documento PDF';
  const actions = [];
""",
    """function fileHasPdf(file = {}) {
  return Boolean(file.pdfUrl || file.pdfNome || file.arquivoUrl || file.arquivoNome);
}

function fileHasWord(file = {}) {
  return Boolean(file.wordUrl || file.wordNome);
}

function fileVersionsLabel(file = {}) {
  const hasPdf = fileHasPdf(file);
  const hasWord = fileHasWord(file);
  if (hasPdf && hasWord) return 'PDF e Word';
  if (hasPdf) return 'PDF';
  if (hasWord) return 'Word';
  return 'Sem arquivo';
}

function fileActionsHTML(file, options = {}) {
  const pdfUrl = file.pdfUrl || file.arquivoUrl || '';
  const wordUrl = file.wordUrl || '';
  const pdfNome = file.pdfNome || file.arquivoNome || 'documento.pdf';
  const wordNome = file.wordNome || 'documento-word.docx';
  const titulo = file.titulo || file.pdfNome || file.arquivoNome || file.wordNome || 'Documento';
  const actions = [];
""",
    "helpers de formatos",
)

s = replace_once(
    s,
    """        <strong>${escapeHTML(file.titulo || file.pdfNome || file.arquivoNome || 'Arquivo')}</strong>
        ${showSector ? fileSectorHTML(file) : ''}
        ${file.descricao ? `<span>${escapeHTML(file.descricao)}</span>` : ''}
        <span>${escapeHTML(fileCategoryLabel(file))}${file.origemLegada ? ' • legado' : ''} • ${formatDate(file.criadoEm)}</span>
        ${file.wordNome ? `<span>PDF: ${escapeHTML(file.pdfNome || file.arquivoNome || '-')} • Word: ${escapeHTML(file.wordNome)}</span>` : ''}
""",
    """        <strong>${escapeHTML(file.titulo || file.pdfNome || file.arquivoNome || file.wordNome || 'Arquivo')}</strong>
        ${showSector ? fileSectorHTML(file) : ''}
        ${file.descricao ? `<span>${escapeHTML(file.descricao)}</span>` : ''}
        <span>${escapeHTML(fileCategoryLabel(file))}${file.origemLegada ? ' • legado' : ''} • ${formatDate(file.criadoEm)}</span>
        ${(fileHasPdf(file) || fileHasWord(file)) ? `<span>Versões disponíveis: ${escapeHTML(fileVersionsLabel(file))}</span>` : ''}
""",
    "listagem de arquivos",
)

s = s.replace(
    "<span><strong>Versões:</strong> ${file.wordNome ? 'PDF e Word' : 'PDF'}</span>",
    "<span><strong>Versões:</strong> ${escapeHTML(fileVersionsLabel(file))}</span>",
)

s = replace_once(
    s,
    """async function salvarArquivoISO({ categoria, empresaId = '', req = null, form, publico = false, tipoMaterial = '' }) {
  const pdfFile = form.get('arquivoPdf') || form.get('arquivo');
  const wordFile = form.get('arquivoWord');

  if (!pdfFile || !pdfFile.name) throw new Error('Selecione a versão em PDF.');
  const materialIsoCompleta = categoria === 'material_apoio' && tipoMaterial === 'iso_completa';
""",
    """async function salvarArquivoISO({ categoria, empresaId = '', req = null, form, publico = false, tipoMaterial = '' }) {
  const pdfFile = form.get('arquivoPdf') || form.get('arquivo');
  const wordFile = form.get('arquivoWord');
  const hasPdf = Boolean(pdfFile && pdfFile.name);
  const hasWord = Boolean(wordFile && wordFile.name);

  if (!hasPdf && !hasWord) throw new Error('Selecione pelo menos um arquivo em PDF ou Word.');
  const materialIsoCompleta = categoria === 'material_apoio' && tipoMaterial === 'iso_completa';
""",
    "validação de arquivo",
)

s = replace_once(
    s,
    """  const materialAvulso = categoria === 'material_apoio' && tipoMaterial === 'avulso';
  const basePath = baseStoragePathForArquivo({ categoria, empresaId, req, tipoMaterial });
  const pdfStoragePath = `${basePath}/pdf/${safeFileName(pdfFile.name)}`;
  const pdfUrl = await uploadArquivoVersao(pdfStoragePath, pdfFile);

  let wordUrl = '';
  let wordNome = '';
  let wordStoragePath = '';

  if (wordFile && wordFile.name) {
""",
    """  const materialAvulso = categoria === 'material_apoio' && tipoMaterial === 'avulso';
  const basePath = baseStoragePathForArquivo({ categoria, empresaId, req, tipoMaterial });
  let pdfUrl = '';
  let pdfNome = '';
  let pdfStoragePath = '';

  if (hasPdf) {
    pdfStoragePath = `${basePath}/pdf/${safeFileName(pdfFile.name)}`;
    pdfUrl = await uploadArquivoVersao(pdfStoragePath, pdfFile);
    pdfNome = pdfFile.name;
  }

  let wordUrl = '';
  let wordNome = '';
  let wordStoragePath = '';

  if (hasWord) {
""",
    "upload independente",
)

s = replace_once(
    s,
    """    titulo: (form.get('titulo') || '').trim() || (materialIsoCompleta ? 'ISO completa' : pdfFile.name),
    descricao: (form.get('descricao') || '').trim(),
    pdfUrl,
    pdfNome: pdfFile.name,
    pdfStoragePath,
    wordUrl,
    wordNome,
    wordStoragePath,
    // Campos legados mantidos para compatibilidade com telas e dados antigos.
    arquivoUrl: pdfUrl,
    arquivoNome: pdfFile.name,
    storagePath: pdfStoragePath,
""",
    """    titulo: (form.get('titulo') || '').trim() || (materialIsoCompleta ? 'ISO completa' : (pdfNome || wordNome)),
    descricao: (form.get('descricao') || '').trim(),
    pdfUrl,
    pdfNome,
    pdfStoragePath,
    wordUrl,
    wordNome,
    wordStoragePath,
    // Campos legados só apontam para PDF, evitando tratar Word como PDF nas telas antigas.
    arquivoUrl: pdfUrl,
    arquivoNome: pdfNome,
    storagePath: pdfStoragePath,
""",
    "payload independente",
)

s = replace_once(
    s,
    "<h3>${escapeHTML(file.titulo || file.pdfNome || file.arquivoNome || 'Material de apoio')}</h3>",
    "<h3>${escapeHTML(file.titulo || file.pdfNome || file.arquivoNome || file.wordNome || 'Material de apoio')}</h3>",
    "título de material Word",
)

s = s.replace(
    "${file.wordNome ? `<span><strong>Versões:</strong> PDF e Word</span>` : '<span><strong>Versões:</strong> PDF</span>'}",
    "<span><strong>Versões:</strong> ${escapeHTML(fileVersionsLabel(file))}</span>",
)

s = replace_once(
    s,
    '<p class="muted" style="margin:6px 0 0;">O PDF é usado para visualizar dentro do app. O Word é opcional para download.</p>',
    '<p class="muted" style="margin:6px 0 0;">Envie somente o PDF, somente o Word ou as duas versões. O PDF pode ser visualizado dentro do app; o Word fica disponível para download.</p>',
    "texto do formulário",
)

s = replace_once(
    s,
    """        <div class="form-group"><label>Versão em PDF</label><input name="arquivoPdf" type="file" accept="application/pdf,.pdf" required /><small>Usada para “Ver PDF” e “Baixar PDF”.</small></div>
        <div class="form-group"><label>Versão em Word</label><input name="arquivoWord" type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /><small>Opcional. Aparece como “Baixar Word”.</small></div>
""",
    """        <div class="form-group"><label>Versão em PDF (opcional)</label><input name="arquivoPdf" type="file" accept="application/pdf,.pdf" /><small>Quando enviada, libera “Ver PDF” e “Baixar PDF”.</small></div>
        <div class="form-group"><label>Versão em Word (opcional)</label><input name="arquivoWord" type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /><small>Quando enviada, libera “Baixar Word”. É obrigatório selecionar pelo menos um dos dois formatos.</small></div>
""",
    "campos opcionais",
)

s = s.replace("20260801-41", "20260801-42")
APP.write_text(s, encoding="utf-8")

for name in ["index.html", "pwa.js", "sw.js", "manifest.json"]:
    path = ROOT / name
    text = path.read_text(encoding="utf-8")
    text = text.replace("20260801-41", "20260801-42").replace("2026.08.01.41", "2026.08.01.42")
    path.write_text(text, encoding="utf-8")

(ROOT / "version.json").write_text(
    '''{\n  "version": "20260801-42",\n  "name": "Excellence System®",\n  "updatedAt": "2026-08-01",\n  "message": "Materiais com PDF e Word independentes.",\n  "notes": "A administração pode cadastrar materiais somente em PDF, somente em Word ou com as duas versões. É obrigatório informar pelo menos um arquivo."\n}\n''',
    encoding="utf-8",
)

(ROOT / "ATUALIZACAO-V42-PDF-WORD-OPCIONAIS.txt").write_text(
    """ATUALIZAÇÃO V42 - PDF E WORD INDEPENDENTES

- Removida a obrigatoriedade de anexar PDF no material de apoio.
- A administração pode salvar somente PDF, somente Word ou ambos.
- O sistema exige apenas que pelo menos um dos formatos seja informado.
- Cards e listagens agora identificam corretamente PDF, Word ou PDF e Word.
- Materiais somente em Word não são tratados incorretamente como PDF.
- Versionamento atualizado para 20260801-42.
""",
    encoding="utf-8",
)
