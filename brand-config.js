(function () {
  'use strict';

  const VERSION = window.EXCELLENCE_SYSTEM_VERSION || '20260908-105';
  const BRAND_NAME = 'Excellence System';
  const COMPANY_NAME = 'MP Consultoria';
  const HD_LOGO = `logo-mp-consultoria.svg?v=${VERSION}`;
  let pdfLogoData = '';

  window.EXCELLENCE_BRAND = Object.freeze({
    name: BRAND_NAME,
    company: COMPANY_NAME,
    logo: HD_LOGO,
    version: VERSION,
    isoVersion: 'ISO 9001:2015'
  });

  const replacements = [
    [/Excellence System\s*®/g, BRAND_NAME],
    [/ISO 9001\s*[:\-–]?\s*2026/gi, 'ISO 9001:2015'],
    [/ISO\s*9001\/2026/gi, 'ISO 9001:2015'],
    [/Documentos\s+2026\s*-\s*Draft/gi, 'Documentos complementares'],
    [/Senha provisória/g, 'Senha de acesso'],
    [/senha provisória/g, 'senha de acesso'],
    [/Gerar senha provisória/g, 'Gerar senha segura'],
    [/®/g, ''],
    [/gerada\. Anote e envie ao responsável com segurança\./g, 'gerada. Anote e envie ao responsável com segurança.']
  ];

  function normalizeText(value) {
    let out = String(value ?? '');
    for (const [pattern, replacement] of replacements) out = out.replace(pattern, replacement);
    return out;
  }

  function logoAbsoluteUrl() {
    try { return new URL(HD_LOGO, window.location.href).href; }
    catch (_) { return HD_LOGO; }
  }

  function improveLogo(img, baseDocument = document) {
    if (!(img instanceof (baseDocument.defaultView?.HTMLImageElement || HTMLImageElement))) return;

    const src = String(img.getAttribute('src') || '');
    const alt = String(img.getAttribute('alt') || '');
    const isBrandLogo = img.classList.contains('boot-logo') ||
      img.classList.contains('login-logo') ||
      img.classList.contains('sidebar-logo') ||
      img.classList.contains('tr93-logo') ||
      img.classList.contains('excellence-report-logo') ||
      /(?:^|\/)(?:logo\.png|icon-(?:192|512)\.png|logo-mp-consultoria\.svg)(?:\?|$)/i.test(src) ||
      /MP Consultoria|Excellence System/i.test(alt);

    if (!isBrandLogo) return;

    try { img.src = new URL(HD_LOGO, window.location.href).href; }
    catch (_) { img.src = HD_LOGO; }

    img.removeAttribute('srcset');
    img.decoding = 'async';
    img.style.imageRendering = 'auto';
    img.style.objectFit = 'contain';
  }

  function normalizeElement(el, baseDocument = document) {
    if (!el || el.nodeType !== 1) return;

    for (const attr of ['title', 'aria-label', 'alt', 'placeholder']) {
      if (!el.hasAttribute?.(attr)) continue;
      const before = el.getAttribute(attr);
      const after = normalizeText(before);
      if (before !== after) el.setAttribute(attr, after);
    }

    if (el.tagName === 'IMG') improveLogo(el, baseDocument);
    el.querySelectorAll?.('img').forEach(img => improveLogo(img, baseDocument));
  }

  function normalizeTree(root, baseDocument = document) {
    if (!root) return;

    if (root.nodeType === 9) {
      const doc = root;
      try { doc.title = normalizeText(doc.title); } catch (_) {}
      normalizeTree(doc.documentElement, doc);
      return;
    }

    normalizeElement(root.nodeType === 1 ? root : null, baseDocument);

    const walker = baseDocument.createTreeWalker(
      root,
      (baseDocument.defaultView?.NodeFilter || NodeFilter).SHOW_TEXT
    );

    let node;
    while ((node = walker.nextNode())) {
      const parentTag = node.parentElement?.tagName;
      if (parentTag === 'SCRIPT' || parentTag === 'STYLE') continue;
      const before = node.nodeValue || '';
      const after = normalizeText(before);
      if (before !== after) node.nodeValue = after;
    }

    if (root.querySelectorAll) root.querySelectorAll('*').forEach(el => normalizeElement(el, baseDocument));
  }

  function isReportDocument(doc) {
    if (!doc?.body) return false;
    const title = normalizeText(doc.title || '');
    const sample = normalizeText(String(doc.body.textContent || '').slice(0, 3000));
    return /relat[oó]rio|dossi[eê]|di[aá]rio de bordo|matriz de compet[eê]ncias|apontamento/i.test(`${title} ${sample}`);
  }

  function ensureReportLogo(doc) {
    if (!isReportDocument(doc)) return;

    let style = doc.getElementById('excellence-report-brand-style');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'excellence-report-brand-style';
      style.textContent = `
        .excellence-report-logo{width:48px;height:48px;object-fit:contain;flex:0 0 auto}
        .excellence-report-brandbar{display:flex;align-items:center;gap:10px;border-bottom:2px solid #073F5A;padding:0 0 8px;margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;color:#073F5A}
        .excellence-report-brandbar img{width:42px;height:42px;object-fit:contain}.excellence-report-brandbar strong{display:block;font-size:13px}.excellence-report-brandbar span{display:block;font-size:9px;color:#607788;margin-top:2px}
      `;
      doc.head?.appendChild(style);
    }

    const images = Array.from(doc.images || []);
    const brandImage = images.find(img => {
      const src = String(img.getAttribute('src') || '');
      const alt = String(img.getAttribute('alt') || '');
      return /logo\.png|logo-mp-consultoria|MP Consultoria|Excellence System/i.test(`${src} ${alt}`);
    });

    if (brandImage) {
      brandImage.classList.add('excellence-report-logo');
      improveLogo(brandImage, doc);
      return;
    }

    const header = doc.querySelector('.header,.report-header,.tr93-head,.ap-report-head,.ap-print-head,.cover .header,[class*="report"][class*="head"]');
    if (header) {
      const img = doc.createElement('img');
      img.className = 'excellence-report-logo';
      img.alt = 'MP Consultoria';
      img.src = logoAbsoluteUrl();
      header.prepend(img);
      return;
    }

    if (!doc.querySelector('.excellence-report-brandbar')) {
      const bar = doc.createElement('div');
      bar.className = 'excellence-report-brandbar';
      bar.innerHTML = `<img src="${logoAbsoluteUrl()}" alt="MP Consultoria"><div><strong>${BRAND_NAME}</strong><span>${COMPANY_NAME}</span></div>`;
      doc.body.prepend(bar);
    }
  }

  function normalizeReportDocument(doc) {
    if (!doc?.documentElement) return;
    normalizeTree(doc, doc);
    ensureReportLogo(doc);
  }

  function normalizeFrame(frame) {
    if (!frame || frame.tagName !== 'IFRAME') return;
    const clean = () => {
      try { normalizeReportDocument(frame.contentDocument); } catch (_) {}
    };
    frame.addEventListener('load', clean);
    [0, 25, 75, 150, 220, 400, 700].forEach(ms => setTimeout(clean, ms));
  }

  function normalizeHtmlString(value) {
    let html = normalizeText(String(value ?? ''));
    const logo = logoAbsoluteUrl().replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    html = html
      .replace(/src=(['"])(?:\.\/)?logo\.png(?:\?[^'"]*)?\1/gi, `src="${logo}"`)
      .replace(/src=(['"])(?:\.\/)?icon-(?:192|512)\.png(?:\?[^'"]*)?\1/gi, `src="${logo}"`);
    return html;
  }

  function patchWindowOpen() {
    if (window.__EXCELLENCE_WINDOW_OPEN_BRAND_PATCHED__) return;
    window.__EXCELLENCE_WINDOW_OPEN_BRAND_PATCHED__ = true;
    const originalOpen = window.open.bind(window);

    window.open = function (...args) {
      const child = originalOpen(...args);
      if (!child) return child;
      try {
        const doc = child.document;
        const originalWrite = doc.write.bind(doc);
        const originalWriteln = doc.writeln?.bind(doc);
        doc.write = (...parts) => originalWrite(...parts.map(normalizeHtmlString));
        if (originalWriteln) doc.writeln = (...parts) => originalWriteln(...parts.map(normalizeHtmlString));
        const clean = () => {
          try { normalizeReportDocument(doc); } catch (_) {}
        };
        child.addEventListener?.('load', clean);
        [40, 120, 260, 420].forEach(ms => setTimeout(clean, ms));
      } catch (_) {}
      return child;
    };
  }

  async function preparePdfLogo() {
    if (pdfLogoData) return pdfLogoData;
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = logoAbsoluteUrl();
      await (img.decode ? img.decode() : new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; }));
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 512, 512);
      ctx.drawImage(img, 0, 0, 512, 512);
      pdfLogoData = canvas.toDataURL('image/png', 0.96);
    } catch (error) {
      console.warn('Logo para PDF não preparada:', error);
    }
    return pdfLogoData;
  }

  function normalizePdfText(value) {
    if (Array.isArray(value)) return value.map(normalizePdfText);
    return typeof value === 'string' ? normalizeText(value) : value;
  }

  function patchJsPdf() {
    const jsPDF = window.jspdf?.jsPDF;
    const API = jsPDF?.API;
    if (!API || API.__excellenceBrandPatched) return;
    API.__excellenceBrandPatched = true;

    if (typeof API.text === 'function') {
      const originalText = API.text;
      API.text = function (text, ...args) {
        return originalText.call(this, normalizePdfText(text), ...args);
      };
    }

    if (typeof API.save === 'function') {
      const originalSave = API.save;
      API.save = function (...args) {
        try {
          if (!this.__excellenceLogoAdded && pdfLogoData && typeof this.addImage === 'function') {
            const currentPage = this.internal?.getCurrentPageInfo?.().pageNumber || 1;
            this.setPage?.(1);
            this.addImage(pdfLogoData, 'PNG', 3, 3, 9, 9, undefined, 'FAST');
            this.__excellenceLogoAdded = true;
            this.setPage?.(currentPage);
          }
        } catch (error) {
          console.warn('Logo não adicionada ao PDF:', error);
        }
        return originalSave.apply(this, args);
      };
    }
  }

  function watchDynamicPdfLibrary(node) {
    if (node?.nodeType !== 1 || node.tagName !== 'SCRIPT') return;
    const src = String(node.getAttribute('src') || '');
    if (!/jspdf/i.test(src)) return;
    node.addEventListener('load', () => {
      patchJsPdf();
      preparePdfLogo();
    });
  }

  function normalizeDocument() {
    document.title = `${BRAND_NAME} | ${COMPANY_NAME}`;
    normalizeTree(document, document);
    document.querySelectorAll('iframe').forEach(normalizeFrame);
    document.querySelectorAll('script[src*="jspdf" i]').forEach(watchDynamicPdfLibrary);
    patchJsPdf();
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1 && node.tagName === 'IFRAME') normalizeFrame(node);
        if (node.nodeType === 1 && node.tagName === 'SCRIPT') watchDynamicPdfLibrary(node);
        if (node.nodeType === 1) normalizeTree(node, document);
        if (node.nodeType === 3) {
          const before = node.nodeValue || '';
          const after = normalizeText(before);
          if (before !== after) node.nodeValue = after;
        }
      });
    }
    patchJsPdf();
  });

  patchWindowOpen();
  preparePdfLogo();
  normalizeDocument();
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', () => {
    normalizeDocument();
    preparePdfLogo();
  });
  setInterval(patchJsPdf, 1000);

  console.info(`${BRAND_NAME} • configuração central de marca e relatórios ${VERSION} carregada.`);
})();
